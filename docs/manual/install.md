# Install and run MITI

MITI runs on one machine and serves every browser on the network on port 3000. Pick the way that suits the machine.

## apt package (Ubuntu)

For Ubuntu 22.04 and 24.04, on regular PCs (amd64) and ARM computers such as NVIDIA Jetson (arm64). The package includes everything MITI needs.

Add MITI's apt repository once, then install:

```bash
curl -fsSL https://hiran-t.github.io/MITI/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miti.gpg
echo "deb [signed-by=/usr/share/keyrings/miti.gpg] https://hiran-t.github.io/MITI stable main" | sudo tee /etc/apt/sources.list.d/miti.list
sudo apt-get update
sudo apt-get install miti
```

Installing starts nothing. Run MITI in a terminal; **Ctrl+C** stops it:

```bash
miti run                  # http://<this machine>:3000
miti run --port 8080      # another port; a taken port moves to the next free one
miti run --bridge         # also foxglove_bridge beside MITI (see below)
miti --help
```

`miti run` prints the addresses to open, including this machine's address on the network. `sudo apt-get upgrade` keeps MITI up to date.

Settings
: `/etc/miti/miti.env` holds the port (`MITI_PORT`) and the bridge port (`BRIDGE_PORT`); `/etc/miti/bridge.env` holds the bridge's ROS settings. Variables set in the shell win, for example `ROS_DOMAIN_ID=5 miti run --bridge`.

Start at boot
: To serve MITI all the time instead of from a terminal, enable its service: `sudo systemctl enable --now miti` (and `miti-bridge` for the bridge). `sudo systemctl disable --now miti` turns it off again.

## Docker

```bash
docker run -d --restart unless-stopped -p 3000:3000 --name miti ghcr.io/hiran-t/miti:latest
```

The image runs on amd64 and arm64 and restarts with the machine. To run foxglove_bridge beside it with Docker Compose, see the [deployment guide](deployment.md#docker-compose).

## pixi (Linux, macOS, Windows)

[pixi](https://pixi.sh) installs Node.js and, for the bridge, ROS 2 into the project folder:

```bash
git clone https://github.com/hiran-t/MITI.git
cd MITI
pixi run miti                       # http://<this machine>:3000
pixi run -e humble miti-bridge      # with foxglove_bridge beside MITI (-e jazzy for Jazzy)
```

## Set up foxglove_bridge

MITI needs a foxglove_bridge it can reach. Choose one place for it.

### On the robot

Install and start it with the robot's ROS 2 (replace `humble` with `jazzy` on a Jazzy robot):

```bash
sudo apt install ros-humble-foxglove-bridge
source /opt/ros/humble/setup.bash
ros2 launch foxglove_bridge foxglove_bridge_launch.xml
```

Then enter `ws://<robot-ip>:8765` in MITI's connection settings; see {doc}`connect`.

### Beside MITI

The bridge runs on the MITI machine and reads the robot's topics over DDS; nothing is installed on the robot. Both machines must be on the same network, with the same `ROS_DOMAIN_ID` and the same ROS 2 distro.

With the apt package, install foxglove_bridge from ROS's apt repository on the MITI machine, then start both:

```bash
sudo apt install ros-humble-foxglove-bridge
miti run --bridge
```

MITI connects to this bridge by itself. When MITI started the bridge, its ROS settings can be changed from the browser; see {ref}`ros-network`.

:::{note}
Over Wi-Fi, DDS discovery often misses topics because Wi-Fi drops multicast. Enter the robot's IP address in the ROS network settings, or set `ROS_STATIC_PEERS=<robot-ip>`.
:::
