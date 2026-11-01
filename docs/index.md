# MITI Documentation

Welcome to the documentation of MITI, a web dashboard for ROS 2 robots.

MITI shows a robot's 3D scene, cameras, logs and state machines in tiled panels, in any browser on the network, with nothing to install on the computers that view it. It reads the robot's topics through [foxglove_bridge](https://github.com/foxglove/foxglove-sdk), which runs on the robot or beside MITI. MITI is open source under the MIT license; its source is on [GitHub](https://github.com/hiran-t/MITI).

```{figure} images/overview.webp
:alt: MITI connected to a robot: the topic list, a 3D scene with the robot model, lidar points and costmap, a camera image with the lidar drawn over it, and the log

MITI connected to a robot.
```

## How to Use This Website

- [Tutorials](tutorials/index.md) take you from installing MITI to watching your robot. Start here if you are new to MITI.
- [How-To Guides](how-to-guides/index.md) answer the question "How do I … with MITI?", such as running foxglove_bridge beside MITI or monitoring a state machine.
- [Concepts](concepts/index.md) explain how MITI works: where the data goes, and how frames and transforms place it.
- [Reference](reference/index.md) lists every command, setting and message in detail.
- [Contributing](contributing/index.md) is for working on MITI itself.

## Table of Contents

```{toctree}
:maxdepth: 2

tutorials/index
how-to-guides/index
concepts/index
reference/index
contributing/index
```
