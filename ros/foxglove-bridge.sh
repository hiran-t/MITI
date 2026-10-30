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
#   BRIDGE_PORT              WebSocket port (default 8765)
#   BRIDGE_ADDRESS           address to listen on (default 0.0.0.0)
#   BRIDGE_TOPIC_WHITELIST   regexes of topics to offer, e.g. "['/tf.*','/camera/.*/compressed']"
#   BRIDGE_SEND_BUFFER_LIMIT bytes queued per client before messages are dropped (default 10 MB)
#   BRIDGE_MAX_QOS_DEPTH     subscription queue depth (default 10)

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Docker images and system installs need ROS sourced; a pixi environment already has it.
if ! command -v ros2 >/dev/null 2>&1; then
  setup="/opt/ros/${ROS_DISTRO:-humble}/setup.bash"
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

echo "foxglove_bridge: ws://${BRIDGE_ADDRESS:-0.0.0.0}:${BRIDGE_PORT:-8765}," \
  "ROS_DOMAIN_ID=$ROS_DOMAIN_ID, $RMW_IMPLEMENTATION"

exec ros2 launch foxglove_bridge foxglove_bridge_launch.xml \
  port:="${BRIDGE_PORT:-8765}" \
  address:="${BRIDGE_ADDRESS:-0.0.0.0}" \
  topic_whitelist:="${BRIDGE_TOPIC_WHITELIST:-['.*']}" \
  send_buffer_limit:="${BRIDGE_SEND_BUFFER_LIMIT:-10000000}" \
  max_qos_depth:="${BRIDGE_MAX_QOS_DEPTH:-10}"
