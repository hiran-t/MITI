# Getting Started

In this tutorial you install MITI on an Ubuntu machine and open it in a browser. It takes about five minutes.

You need Ubuntu 22.04 or 24.04, on a PC (amd64) or an ARM computer such as an NVIDIA Jetson (arm64). On macOS, Windows or other Linux distributions, use [pixi](../how-to-guides/install-with-pixi.md) or [Docker](../how-to-guides/install-with-docker.md) instead, then continue with the next tutorial.

## Add MITI's apt repository

MITI is installed with apt from its own repository. Add the repository's key and address once:

```bash
curl -fsSL https://hiran-t.github.io/MITI/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miti.gpg
echo "deb [signed-by=/usr/share/keyrings/miti.gpg] https://hiran-t.github.io/MITI stable main" | sudo tee /etc/apt/sources.list.d/miti.list
```

## Install MITI

```bash
sudo apt-get update
sudo apt-get install miti
```

The package includes everything MITI needs, Node.js too. Installing starts nothing.

## Run MITI

```bash
miti run
```

MITI prints the addresses to open:

```text
MITI: http://localhost:3000  (other computers: http://192.168.1.20:3000)
Bridge: ws://<this machine>:8765 (none running here: start miti_bridge on the robot, or use miti run --bridge)
```

MITI keeps running in this terminal. Press **Ctrl+C** to stop it.

## Open MITI

Open `http://localhost:3000` in Chrome, Edge, Firefox or Safari on this machine, or the address for other computers from any computer on the network.

```{figure} ../images/disconnected.webp
:alt: MITI open in a browser, not yet connected to a robot: a notice under the title bar, a red status bar, and panels that say Not connected to ROS

MITI before it is connected to a robot.
```

The red status bar and the notice under the title bar say that MITI has not found a robot yet. That is expected: MITI shows a robot's data through miti_bridge, which you start in the next tutorial.

:::{note}
If the page does not open from another computer, allow the port through the firewall: `sudo ufw allow 3000/tcp`.
:::

## Next step

[Connect to a robot](connect-to-a-robot.md).
