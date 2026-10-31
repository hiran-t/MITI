<div align="center">
  <img src="public/main_logo.svg" alt="MITI" width="640"/>

# MITI

**A web dashboard for watching and driving ROS 2 robots from any browser.**

[![Release](https://img.shields.io/github/v/release/hiran-t/MITI)](https://github.com/hiran-t/MITI/releases/latest)
[![CI](https://github.com/hiran-t/MITI/actions/workflows/ci.yml/badge.svg)](https://github.com/hiran-t/MITI/actions/workflows/ci.yml)
[![Docs](https://readthedocs.org/projects/miti/badge/?version=latest)](https://miti.readthedocs.io/en/latest/)
[![ROS 2](https://img.shields.io/badge/ROS%202-Humble%20%7C%20Jazzy-blue)](https://docs.ros.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![XERJ Corpus Hub contributor](https://hub.xerj.org/contributors/hiran-t/badge.svg)](https://hub.xerj.org/contributors/hiran-t)

</div>

MITI shows a robot's 3D scene, cameras, logs and state machines in tiled panels, in any browser on the network, with nothing to install on the computers that view it. It reads the robot's topics through [foxglove_bridge](https://github.com/foxglove/foxglove-sdk), which can run on the robot, or on the MITI machine, where it subscribes over DDS and keeps the work off the robot.

![MITI connected to a robot: the topic list, a 3D scene with the robot model, lidar points and costmap, a camera image with the lidar drawn over it, and the log](https://raw.githubusercontent.com/hiran-t/MITI/docs-images/images/overview.webp)

## Install

On Ubuntu 22.04 or 24.04 (PCs and ARM computers such as NVIDIA Jetson):

```bash
curl -fsSL https://hiran-t.github.io/MITI/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miti.gpg
echo "deb [signed-by=/usr/share/keyrings/miti.gpg] https://hiran-t.github.io/MITI stable main" | sudo tee /etc/apt/sources.list.d/miti.list
sudo apt-get update
sudo apt-get install miti
miti run                  # http://<this machine>:3000; Ctrl+C stops it
```

With Docker:

```bash
docker run -d --restart unless-stopped -p 3000:3000 --name miti ghcr.io/hiran-t/miti:latest
```

On macOS and Windows, or to run foxglove_bridge beside MITI, see [Install and run MITI](https://miti.readthedocs.io/en/latest/manual/install.html).

## Documentation

The manual is at **[miti.readthedocs.io/en/latest](https://miti.readthedocs.io/en/latest/)**: installing, connecting to a robot, every panel, deployment and troubleshooting, plus reference and developer guides. Its source is in [`docs/`](docs/).

## Contributing

Questions, ideas and setups using MITI are welcome in [Discussions](https://github.com/hiran-t/MITI/discussions). To contribute, read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md); report security issues as described in [SECURITY.md](SECURITY.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). MITI builds on [ROS 2](https://docs.ros.org/), [foxglove_bridge](https://github.com/foxglove/foxglove-sdk), [three.js](https://threejs.org/), [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/), [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/), [react-mosaic](https://github.com/nomcopter/react-mosaic) and [urdf-loader](https://github.com/gkjohnson/urdf-loaders).
