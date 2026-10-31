# MITI

MITI is a web dashboard for ROS 2 robots. It shows a robot's 3D scene, cameras, logs and state machines in tiled panels, in any browser on the network, with nothing to install on the computers that view it.

```{figure} manual/images/overview.webp
:alt: MITI connected to a robot: the topic list, a 3D scene with the robot model, lidar points and costmap, a camera image with the lidar drawn over it, and the log

MITI connected to a robot: topics on the left, the 3D scene and a camera in the middle, the log below.
```

## What you can do with MITI

- See the robot model move with its joints and TF, together with point clouds, laser scans, maps and costmaps, paths, poses and markers, in the **3D Scene**.
- Watch color and depth **cameras**, and draw point clouds, costmaps, paths and TF frames over the image.
- Read the robot's **log**, follow **state machines** (SMACC2) and **behavior trees**, and send commands with **button switches**.
- Arrange panels side by side, resize and expand them; the layout is kept in the browser.

## How MITI reaches the robot

MITI reads the robot's topics through [foxglove_bridge](https://github.com/foxglove/foxglove-sdk), a ROS 2 node that serves them over WebSocket (port 8765). The bridge can run in either of two places:

On the robot
: The robot runs foxglove_bridge; MITI connects to `ws://<robot-ip>:8765`.

Beside MITI
: foxglove_bridge runs on the MITI machine and subscribes to the robot's topics over DDS, so the robot does no extra work. `miti run --bridge` starts both.

## Contents

```{toctree}
:caption: User manual
:maxdepth: 2

manual/install
manual/connect
manual/workspace
manual/camera
manual/camera-overlays
manual/3d-scene
manual/other-panels
manual/troubleshooting
manual/deployment
```

```{toctree}
:caption: Reference
:maxdepth: 1

reference/3d-scene
reference/state-machine
```

```{toctree}
:caption: For developers
:maxdepth: 1

develop/architecture
develop/api
develop/performance
develop/releases
```
