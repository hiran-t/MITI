#!/usr/bin/env bash
# Builds the robot's own message packages so foxglove_bridge can offer their topics.
# Put the packages (or the whole repo that holds them) in ros/overlay/src, then run
# `pixi run -e <distro> build-msgs`. The Docker image runs this when it is built.
# Each ROS distro gets its own install space: ros/overlay/install/<distro>.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/overlay"

if [ -z "$(ls -A src 2>/dev/null | grep -v '^\.gitkeep$' || true)" ]; then
  echo "No packages in ros/overlay/src; nothing to build."
  exit 0
fi

distro="${ROS_DISTRO:?source ROS 2 first or run through pixi}"
colcon build \
  --merge-install \
  --build-base "build/$distro" \
  --install-base "install/$distro" \
  --cmake-args -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release
echo "Built into ros/overlay/install/$distro; restart the bridge to use it."
