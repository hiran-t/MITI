#!/usr/bin/env bash
# Runs foxglove_bridge on this machine. It joins the robot's ROS 2 network over DDS and serves
# MITI over WebSocket, so the robot only publishes as usual and the bridge's work (subscribing,
# encoding, WebSocket traffic to every browser) happens here instead of on the robot.
#
# Used by `pixi run bridge` / `pixi run miti-bridge` and by the foxglove-bridge Docker image.
# Settings (environment variables, all optional):
#   ROS_DOMAIN_ID            must match the robot (default 0)
#   RMW_IMPLEMENTATION       rmw_fastrtps_cpp (ROS 2 default) or rmw_cyclonedds_cpp
#   CYCLONEDDS_URI           Cyclone DDS config; defaults to ros/cyclonedds.xml beside this script
#   ROS_STATIC_PEERS         the robot's IP addresses (a;b), to find it where multicast is dropped
#   BRIDGE_PORT              WebSocket port (default 8765)
#   BRIDGE_ADDRESS           address to listen on (default 0.0.0.0)
#   BRIDGE_TOPIC_WHITELIST   regexes of topics to offer, e.g. "['/tf.*','/camera/.*/compressed']"
#   BRIDGE_SEND_BUFFER_LIMIT bytes queued per client before messages are dropped (default 10 MB)
#   BRIDGE_MAX_QOS_DEPTH     subscription queue depth (default 10)

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Docker images and system installs need ROS sourced; a pixi environment already has it.
if ! command -v ros2 >/dev/null 2>&1; then
  # ROS_DISTRO, else the ROS 2 installed in /opt/ros (Humble when there are several).
  setup="/opt/ros/${ROS_DISTRO:-humble}/setup.bash"
  if [ -z "${ROS_DISTRO:-}" ] && [ ! -f "$setup" ]; then
    for candidate in /opt/ros/*/setup.bash; do setup="$candidate"; done
  fi
  [ -f "$setup" ] || { echo "ros2 not found: run through pixi (pixi run bridge) or source ROS 2" >&2; exit 1; }
  # shellcheck disable=SC1090
  source "$setup"
fi

# The robot's own message packages, built by ros/build-msgs.sh.
overlay="$here/overlay/install/${ROS_DISTRO:-}/setup.bash"
if [ -n "${ROS_DISTRO:-}" ] && [ -f "$overlay" ]; then
  # shellcheck disable=SC1090
  source "$overlay"
fi

set -euo pipefail

export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-0}"
export RMW_IMPLEMENTATION="${RMW_IMPLEMENTATION:-rmw_fastrtps_cpp}"
if [ "$RMW_IMPLEMENTATION" = "rmw_cyclonedds_cpp" ] && [ -z "${CYCLONEDDS_URI:-}" ]; then
  export CYCLONEDDS_URI="file://$here/cyclonedds.xml"
fi

port="${BRIDGE_PORT:-8765}"

in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
# A foxglove_bridge answers the WebSocket handshake with its own subprotocol.
is_bridge() {
  local reply
  reply="$( (exec 3<>"/dev/tcp/127.0.0.1/$1" || exit 1
    printf 'GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: foxglove.sdk.v1, foxglove.websocket.v1\r\n\r\n' >&3
    while IFS= read -r -t 2 line <&3; do
      line="${line%$'\r'}"
      [ -z "$line" ] && break
      echo "$line"
    done) 2>/dev/null || true)"
  [[ "$reply" == "HTTP/1.1 101"* ]] && grep -qi '^sec-websocket-protocol: *foxglove' <<<"$reply"
}
owner_of() {
  local pid
  pid="$(lsof -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  [ -n "$pid" ] && echo "$(basename "$(ps -o comm= -p "$pid")") (PID $pid; stop it with: kill $pid)"
}

# A bridge already on the port: exit 3 (scripts/start-miti.mjs then uses it). Another program on
# the port: move to the next free one.
if in_use "$port"; then
  if is_bridge "$port"; then
    echo "foxglove_bridge already runs on port $port; use that one." >&2
    exit 3
  fi
  taken="$port"
  owner="$(owner_of "$port" || true)"
  if [ -n "${BRIDGE_PORT_FIXED:-}" ]; then
    echo "Port $taken is used by ${owner:-another program}." >&2
    exit 1
  fi
  for candidate in $(seq $((taken + 1)) $((taken + 20))); do
    if ! in_use "$candidate"; then
      port="$candidate"
      break
    fi
  done
  if [ "$port" = "$taken" ]; then
    echo "Port $taken is used by ${owner:-another program}, and no port up to $((taken + 20)) is free." >&2
    exit 1
  fi
  echo "Port $taken is used by ${owner:-another program}; foxglove_bridge uses $port instead." \
    "pixi run miti finds it; otherwise enter ws://<this machine>:$port in MITI's connection settings." >&2
fi

# The robot's addresses. Jazzy reads ROS_STATIC_PEERS itself; Humble needs them in the DDS
# configuration (IPv4 only, the form both DDS configurations accept).
peers=()
listed="${ROS_STATIC_PEERS:-}"
for peer in ${listed//[,;]/ }; do
  if [[ "$peer" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    peers+=("$peer")
  else
    echo "Ignoring robot address $peer: use an IPv4 address." >&2
  fi
done
if [ ${#peers[@]} -gt 0 ] && [ "${ROS_DISTRO:-}" = "humble" ]; then
  if [ "$RMW_IMPLEMENTATION" = "rmw_cyclonedds_cpp" ]; then
    xml='<CycloneDDS><Domain Id="any"><Discovery><ParticipantIndex>auto</ParticipantIndex><Peers>'
    for peer in "${peers[@]}"; do xml+="<Peer address=\"$peer\"/>"; done
    export CYCLONEDDS_URI="$CYCLONEDDS_URI,$xml</Peers></Discovery></Domain></CycloneDDS>"
  elif [ -n "${FASTRTPS_DEFAULT_PROFILES_FILE:-}" ]; then
    echo "FASTRTPS_DEFAULT_PROFILES_FILE is set; add the robot to its initialPeersList." >&2
  else
    # Multicast and this machine stay in the list, so discovery works as before plus the robot.
    profile="${TMPDIR:-/tmp}/miti-fastdds-$port.xml"
    {
      echo '<?xml version="1.0" encoding="UTF-8"?>'
      echo '<profiles xmlns="http://www.eprosima.com/XMLSchemas/fastRTPS_Profiles">'
      echo '  <participant profile_name="miti_robot_peers" is_default_profile="true">'
      echo '    <rtps><builtin><initialPeersList>'
      for address in 239.255.0.1 127.0.0.1 "${peers[@]}"; do
        echo "      <locator><udpv4><address>$address</address></udpv4></locator>"
      done
      echo '    </initialPeersList></builtin></rtps>'
      echo '  </participant>'
      echo '</profiles>'
    } >"$profile"
    export FASTRTPS_DEFAULT_PROFILES_FILE="$profile"
  fi
fi
export ROS_STATIC_PEERS="$(IFS=';'; echo "${peers[*]:-}")"

echo "foxglove_bridge: ws://${BRIDGE_ADDRESS:-0.0.0.0}:$port," \
  "ROS_DOMAIN_ID=$ROS_DOMAIN_ID, $RMW_IMPLEMENTATION${peers[0]:+, robot ${peers[*]}}"

exec ros2 launch foxglove_bridge foxglove_bridge_launch.xml \
  port:="$port" \
  address:="${BRIDGE_ADDRESS:-0.0.0.0}" \
  topic_whitelist:="${BRIDGE_TOPIC_WHITELIST:-['.*']}" \
  send_buffer_limit:="${BRIDGE_SEND_BUFFER_LIMIT:-10000000}" \
  max_qos_depth:="${BRIDGE_MAX_QOS_DEPTH:-10}"
