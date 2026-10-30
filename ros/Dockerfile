# foxglove_bridge for running beside MITI: it joins the robot's ROS 2 network over DDS (run it
# with host networking) and serves MITI on port 8765. Built by docker-compose.yml's
# `foxglove-bridge` service; ROS_DISTRO must match the robot.
ARG ROS_DISTRO=humble
FROM ros:${ROS_DISTRO}-ros-base

# Message definitions the bridge needs to offer the usual robot topics. The robot's own
# packages go in ros/overlay/src and are built below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ros-${ROS_DISTRO}-foxglove-bridge \
      ros-${ROS_DISTRO}-rmw-fastrtps-cpp \
      ros-${ROS_DISTRO}-rmw-cyclonedds-cpp \
      ros-${ROS_DISTRO}-common-interfaces \
      ros-${ROS_DISTRO}-tf2-msgs \
      ros-${ROS_DISTRO}-nav2-msgs \
      ros-${ROS_DISTRO}-map-msgs \
      ros-${ROS_DISTRO}-moveit-msgs \
      ros-${ROS_DISTRO}-foxglove-msgs \
      ros-${ROS_DISTRO}-control-msgs \
      ros-${ROS_DISTRO}-vision-msgs \
      ros-${ROS_DISTRO}-bond \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /miti/ros
COPY . .

# Build the robot's message packages, if any were added to ros/overlay/src.
RUN if [ -n "$(ls -A overlay/src | grep -v '^\.gitkeep$')" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends python3-colcon-common-extensions build-essential \
      && . /opt/ros/${ROS_DISTRO}/setup.sh \
      && bash build-msgs.sh \
      && rm -rf overlay/build overlay/log /var/lib/apt/lists/*; \
    fi

EXPOSE 8765
ENTRYPOINT ["bash", "/miti/ros/foxglove-bridge.sh"]
