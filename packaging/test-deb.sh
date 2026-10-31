#!/usr/bin/env bash
# Installs a MITI .deb in a clean Ubuntu container and checks `miti run`: nothing starts on install,
# the page and API answer, Ctrl+C stops everything, ports move, shell variables win over
# /etc/miti, and `--bridge` starts foxglove_bridge (a stand-in ROS) with /etc/miti/bridge.env.
# Run as root in the container, on a machine of the package's architecture:
#   docker run --rm -v "$PWD:/src:ro" ubuntu:24.04 bash /src/packaging/test-deb.sh /src/dist/miti_<v>_amd64.deb
# Commands in single quotes run later, in the container's shells.
# shellcheck disable=SC1091,SC2016
set -euo pipefail

deb="${1:?usage: packaging/test-deb.sh <miti .deb>}"
export DEBIAN_FRONTEND=noninteractive
failed=0
# check <description> <command...>
check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "ok   $label"
  else
    echo "FAIL $label"
    failed=1
  fi
}
up() {
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "localhost:$1" && return 0
    sleep 0.5
  done
  return 1
}
# Starts `miti run` as a normal user in the background; Ctrl+C is SIGINT to the launcher.
start() {
  su robot -c "$1" >"$2" 2>&1 &
  for _ in $(seq 1 20); do
    pid="$(pgrep -u robot -f start-miti.mjs || true)"
    [ -n "$pid" ] && return 0
    sleep 0.25
  done
  return 1
}
interrupt() {
  kill -INT "$pid"
  for _ in $(seq 1 30); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  sleep 1
}
nothing_left() { ! pgrep -u robot >/dev/null; }

apt-get update -qq >/dev/null
apt-get install -y -qq curl procps >/dev/null
apt-get install -y -qq "$deb" >/dev/null
useradd -m robot
echo "$(. /etc/os-release && echo "$PRETTY_NAME"), $(dpkg --print-architecture), $(miti version)"

check "installing starts nothing" bash -c '! pgrep -x node'
check "Node.js runs" /usr/lib/miti/node/bin/node -e 'process.exit(0)'
check "miti --help" miti --help

start 'miti run' /tmp/run.log
check "miti run serves the page" up 3000
check "the page names miti run --bridge" bash -c \
  'curl -s localhost:3000 | grep -q "\"bridgeHint\":\"miti run --bridge\""'
check "/api/bridge answers" bash -c 'curl -s localhost:3000/api/bridge | grep -q available'
interrupt
check "Ctrl+C stops everything" nothing_left

/usr/lib/miti/node/bin/node -e "require('http').createServer().listen(3000)" &
holder=$!
sleep 1
start 'miti run' /tmp/port.log
check "a taken port moves to the next" up 3001
interrupt
kill "$holder"
start 'MITI_PORT=3200 miti run' /tmp/env.log
check "shell variables win over /etc/miti" up 3200
interrupt

mkdir -p /opt/ros/humble/bin
printf 'export ROS_DISTRO=humble\nexport PATH=/opt/ros/humble/bin:$PATH\n' >/opt/ros/humble/setup.bash
printf '#!/bin/sh\necho "stand-in ros2 $* DOMAIN=$ROS_DOMAIN_ID"\nexec sleep 600\n' >/opt/ros/humble/bin/ros2
chmod +x /opt/ros/humble/bin/ros2
sed -i 's/^ROS_DOMAIN_ID=0/ROS_DOMAIN_ID=4/' /etc/miti/bridge.env
start 'miti run --bridge' /tmp/bridge.log
check "miti run --bridge serves the page" up 3000
check "--bridge starts foxglove_bridge with bridge.env" bash -c \
  'for _ in $(seq 1 20); do grep -q "stand-in ros2 launch foxglove_bridge.*DOMAIN=4" /tmp/bridge.log && exit 0; sleep 0.5; done; exit 1'
check "ROS settings from the web restart the bridge" bash -c '
  curl -sf -X PUT -H "Content-Type: application/json" -d "{\"domainId\":6,\"peers\":\"\"}" localhost:3000/api/bridge &&
  for _ in $(seq 1 20); do grep -q "DOMAIN=6" /tmp/bridge.log && exit 0; sleep 0.5; done; exit 1'
interrupt
check "Ctrl+C stops MITI and the bridge" nothing_left

apt-get purge -y -qq miti >/dev/null
check "purge removes files and the miti user" bash -c '[ ! -e /usr/lib/miti ] && [ ! -e /etc/miti ] && ! getent passwd miti'

if [ "$failed" -ne 0 ]; then
  for log in /tmp/*.log; do
    echo "--- $log"
    tail -20 "$log"
  done
  exit 1
fi
