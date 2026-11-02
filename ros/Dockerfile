# miti_bridge for running beside MITI: it joins the robot's ROS 2 network over DDS (run it with
# host networking) and serves MITI on port 8765. Built by docker-compose.yml's `miti-bridge`
# service; ROS_DISTRO must match the robot.
ARG ROS_DISTRO=humble

# miti_bridge from MITI-sdk's source (ros/build-miti-bridge.sh pins the version).
FROM ros:${ROS_DISTRO}-ros-base AS miti-bridge
ARG ROS_DISTRO
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake ninja-build pkg-config python3-colcon-common-extensions \
      libboost-dev nlohmann-json3-dev libturbojpeg0-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /miti/ros
COPY build-miti-bridge.sh .
RUN . /opt/ros/${ROS_DISTRO}/setup.sh && bash build-miti-bridge.sh \
    && rm -rf miti-sdk/src miti-sdk/build miti-sdk/log

FROM ros:${ROS_DISTRO}-ros-base
ARG ROS_DISTRO

# Message definitions the bridge needs to offer the usual robot topics, and what miti_bridge
# links (TurboJPEG). The robot's own packages go in ros/overlay/src and are built below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libturbojpeg \
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
COPY --from=miti-bridge /miti/ros/miti-sdk/install /miti/ros/miti-sdk/install

# Build the robot's message packages, if any were added to ros/overlay/src.
RUN if [ -n "$(ls -A overlay/src | grep -v '^\.gitkeep$')" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends python3-colcon-common-extensions build-essential \
      && . /opt/ros/${ROS_DISTRO}/setup.sh \
      && bash build-msgs.sh \
      && rm -rf overlay/build overlay/log /var/lib/apt/lists/*; \
    fi

EXPOSE 8765
ENTRYPOINT ["bash", "/miti/ros/miti-bridge.sh"]
