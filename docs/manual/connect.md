# Connect to a robot

MITI opens `ws://<the host MITI was opened from>:8765` by default, which is the bridge beside MITI when there is one. To use a bridge on the robot, enter its address once; the browser remembers it.

## Before connecting

Without a bridge, the status bar at the bottom left is red and shows the address MITI tried, the panels say **Not connected to ROS**, and a notice under the title bar explains how to start a bridge.

```{figure} images/disconnected.webp
:alt: MITI before connecting: a notice under the title bar, a red status bar, and panels that say Not connected to ROS

MITI before it reaches a bridge.
```

## Enter the bridge address

1. Click the **gear** in the status bar, next to the bridge address.
2. In **foxglove_bridge URL**, enter the robot's address, for example `ws://192.168.10.27:8765`.
3. Choose how to stream (see below), then click **Save and reconnect**.

```{figure} images/connection-settings.webp
:alt: The connection settings dialog with the robot's bridge address in the foxglove_bridge URL field

Connection settings with the robot's bridge address.
```

**Reset to default** goes back to the bridge on the host MITI was opened from.

Streaming
: **Synchronized** (the default) uses one connection, so cameras, TF and the 3D scene show the same moment. **Prioritize robot motion** puts images and point clouds on their own connections: on a slow link the robot model stays real-time, while cameras may lag behind it.

## Check the connection

When MITI is connected, the status bar turns teal. Open **Sources** in the activity bar on the left to see the state and how many topics the bridge offers, and **Topics** to see them.

```{figure} images/sources.webp
:alt: The Sources view showing the bridge address, status Connected and 77 topics, next to the 3D scene and a camera

Sources after connecting: the bridge address, its state and the number of topics.
```

The list shows the topics the bridge offers. A topic in the list has a publisher, but that does not mean it is sending messages right now; a panel shows **Waiting for message** until the first one arrives.

(ros-network)=

## ROS network settings of a bridge beside MITI

When MITI started the bridge itself (`miti run --bridge`, or `pixi run -e <distro> miti-bridge`), the connection settings have a **ROS network** section:

ROS_DOMAIN_ID
: Must match the robot.

Robot IP addresses
: The robot's IPv4 addresses, separated by commas. Leave it empty to find the robot by multicast; add it when topics are missing or come and go, which is common on Wi-Fi.

**Apply and restart bridge** restarts foxglove_bridge with these values, and MITI reconnects by itself. The status line shows when the bridge runs again; if it stops, the line shows its last log message. The values are saved and used the next time MITI starts.

When MITI did not start the bridge (Docker, or a bridge on the robot), the section explains that these settings belong where the bridge runs, as in the screenshot above.
