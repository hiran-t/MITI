#!/usr/bin/env bash
# `pixi run miti-bridge`: foxglove_bridge in the background and MITI in the foreground. Stopping
# either one (or Ctrl+C) stops both.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

bash ros/foxglove-bridge.sh &
bridge=$!
trap 'kill "$bridge" 2>/dev/null || true; wait "$bridge" 2>/dev/null || true' EXIT INT TERM

npm run start -- --hostname "${MITI_HOST:-0.0.0.0}" --port "${MITI_PORT:-3000}" &
web=$!
# Whichever exits first ends the pair (polling: macOS ships bash 3.2, without `wait -n`).
while kill -0 "$bridge" 2>/dev/null && kill -0 "$web" 2>/dev/null; do sleep 1; done
kill "$web" 2>/dev/null || true
