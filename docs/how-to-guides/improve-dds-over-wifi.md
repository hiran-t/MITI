# Improve DDS over Wi-Fi

When miti_bridge runs beside MITI, DDS carries every message it subscribes to from the robot to the MITI machine, so the network decides how much arrives. This guide covers the usual problems on Wi-Fi and busy networks.

## Find the robot when multicast is dropped

DDS discovery relies on multicast, which Wi-Fi often drops: topics then come and go, or never appear. Give the bridge the robot's address:

```{figure} ../images/concept-dds-wifi.webp
:alt: Without the robot's address, multicast discovery is dropped by the Wi-Fi access point and topics come and go; with the robot's IP address, DDS reaches the robot by unicast and finds it every time

Discovery over Wi-Fi, without and with the robot's IP address.
```

- In MITI, enter the robot's IP in the connection settings (**ROS network**); see [Change the ROS network settings](change-ros-network-settings.md).
- Or set `ROS_STATIC_PEERS=<robot-ip>` before starting the bridge (in `.env` for Docker, in `/etc/miti/bridge.env` for the apt package).

Jazzy reads `ROS_STATIC_PEERS` itself; on Humble the bridge script adds the address to Fast DDS's initial peers (a generated profile, unless `FASTRTPS_DEFAULT_PROFILES_FILE` is already set) or to Cyclone DDS's peers. Multicast discovery keeps working alongside.

## Send less data

A raw 1280 × 720 image is 2.8 MB. On a test network a raw camera reached the MITI machine at about 2.5 frames per second, while joint states (40 Hz), TF and odometry arrived in full. Show `/compressed` image topics in MITI, or offer only those with `BRIDGE_TOPIC_WHITELIST`.

## Give large messages room

Large messages over Wi-Fi need big socket buffers. With Cyclone DDS, [ros/cyclonedds.xml](https://github.com/hiran-t/MITI/blob/main/ros/cyclonedds.xml) asks for up to 16 MB; raise the kernel limit once on Linux:

```bash
sudo sysctl -w net.core.rmem_max=16777216    # add it to /etc/sysctl.conf to keep it
```

## Pick the right network

On a machine with several networks (Wi-Fi, Ethernet, Docker), discovery can pick the wrong one. With Cyclone DDS, pin the robot's network with `<NetworkInterface name="..."/>` in `ros/cyclonedds.xml`.

## Read the bridge's messages

- The first subscription can take a few seconds while DDS discovery settles; later ones are immediate.
- `sequence size exceeds remaining buffer` or `invalid data size` in the bridge log means the robot runs another ROS 2 distro: Humble cannot read Iron/Jazzy discovery data. Use the matching environment (`-e jazzy`) or `ROS_DISTRO` in Docker.
- `Port 8765 is used by <process> (PID …); miti_bridge uses 8766 instead`: another program holds the port, so the bridge moved; `pixi run miti` and `miti-bridge` find it. To keep 8765, stop that program (the message shows the command).
