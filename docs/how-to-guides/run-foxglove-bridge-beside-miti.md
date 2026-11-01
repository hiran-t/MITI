# Run foxglove_bridge beside MITI

foxglove_bridge can run on the MITI machine instead of the robot. It joins the robot's ROS 2 network over DDS and subscribes only to the topics someone is viewing; the robot just publishes as usual, and the bridge's work (subscribing, encoding, one WebSocket stream per browser) moves off the robot.

```{figure} ../images/architecture-bridge-beside-miti.webp
:alt: The browser loads MITI from the MITI server over HTTP on port 3000 and connects over WebSocket on port 8765 to foxglove_bridge on the MITI machine, which reaches the robot's ROS 2 nodes over DDS across the network; nothing is installed on the robot

foxglove_bridge beside MITI.
```

Both machines must be on the same network, with the same `ROS_DOMAIN_ID` and the same ROS 2 distro (Humble and Jazzy do not discover each other reliably). Nothing has to be installed on the robot. MITI connects to the bridge beside it by itself.

## With the apt package

Install foxglove_bridge from ROS's apt repository on the MITI machine, then start MITI with it:

```bash
sudo apt install ros-humble-foxglove-bridge    # or ros-jazzy-foxglove-bridge
miti run --bridge
```

The bridge's settings are in `/etc/miti/bridge.env`; to run it at boot, enable the `miti-bridge` service (see [Install with apt](install-with-apt.md#start-miti-at-boot)).

## With pixi

pixi installs ROS 2 and foxglove_bridge from [RoboStack](https://robostack.github.io/) into the MITI folder:

```bash
pixi run -e humble miti-bridge   # MITI and foxglove_bridge together (-e jazzy for a Jazzy robot)
pixi run -e humble bridge        # foxglove_bridge only
```

Settings are environment variables, for example `ROS_DOMAIN_ID=5 pixi run -e humble miti-bridge`.

## With Docker Compose

```bash
docker compose --profile bridge up -d
```

Set the distro and DDS settings in `.env` first (copy [.env.example](https://github.com/hiran-t/MITI/blob/main/.env.example)), and put `COMPOSE_PROFILES=bridge` there to start the bridge on every `docker compose up`. This runs on Linux only, because DDS discovery needs host networking.

## Set the domain and the robot's address

When MITI started the bridge (`miti run --bridge` or `pixi run miti-bridge`), you can change its `ROS_DOMAIN_ID` and the robot's address from the browser; see [Change the ROS network settings](change-ros-network-settings.md). Every other bridge setting is in the [configuration reference](../reference/configuration.md#bridge-beside-miti).

## Give the bridge the robot's meshes and messages

The bridge beside MITI only knows what is installed on the MITI machine:

- **Message types.** Topics of the robot's own message types are left out until their packages are installed; see [Add the robot's message types](add-the-robots-message-types.md).
- **Robot meshes.** The robot model's `package://` meshes come from the robot's description package, which must be on the MITI machine too: build it into the overlay like a message package, or point MITI's mesh fallback at it with `MITI_PACKAGE_PATH`.

## Ports

If port 8765 is taken by another program, the bridge moves to the next free port and says so, and MITI follows. If a foxglove_bridge already listens there, MITI uses it.
