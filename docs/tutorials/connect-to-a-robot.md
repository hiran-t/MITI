# Connect to a Robot

In this tutorial you start miti_bridge on the robot and connect MITI to it, then check that the robot's topics arrive.

MITI reads the robot's ROS 2 topics through [miti_bridge](https://github.com/hiran-t/MITI-sdk), a ROS 2 node that serves them over a WebSocket on port 8765. Here it runs on the robot; to keep the work off the robot, it can run beside MITI instead (see [Run miti_bridge beside MITI](../how-to-guides/run-miti-bridge-beside-miti.md)).

## Start miti_bridge on the robot

On the robot, add the MITI SDK's apt repository once, install miti_bridge for its ROS 2 distro and start it. This works on Ubuntu 22.04 (Humble) and 24.04 (Jazzy):

```bash
curl -fsSL https://hiran-t.github.io/MITI-sdk/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miti-sdk.gpg
```

```bash
echo "deb [signed-by=/usr/share/keyrings/miti-sdk.gpg] https://hiran-t.github.io/MITI-sdk $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/miti-sdk.list
```

```bash
source /opt/ros/humble/setup.bash   # /opt/ros/jazzy on a Jazzy robot
sudo apt update && sudo apt install ros-$ROS_DISTRO-miti-bridge
ros2 launch miti_bridge miti_start
```

The apt repository goes online with the MITI SDK's first release; until then, [build miti_bridge from source](https://github.com/hiran-t/MITI-sdk#build-from-source). [Run miti_bridge on the robot](../how-to-guides/run-miti-bridge-on-the-robot.md) lists its launch arguments.

:::{note}
A robot that still runs foxglove_bridge works too: enter its address the same way. JPEG camera compression, point clouds reduced on the robot, rate limits applied on the robot and the link statistics need miti_bridge.
:::

## Enter the robot's address

1. In MITI, click the **gear** in the status bar, next to the bridge address.
2. In **Bridge URL**, enter the robot's address, for example `ws://192.168.10.27:8765`.
3. Click **Save and reconnect**.

```{figure} ../images/connection-settings.webp
:alt: The connection settings dialog with a robot's address in the Bridge URL field

The connection settings with the robot's address.
```

The browser remembers the address for the next time.

## Check the connection

When MITI is connected, the status bar turns teal and shows **ROS 2 · miti_bridge** and how much the bridge sends per second. Open **Sources** in the activity bar on the left: it shows the bridge's address, the protocol, **Connected**, how many topics the bridge offers, and the link: what it sends and drops, what waits on the robot, and the busiest topics.

```{figure} ../images/sources.webp
:alt: The Sources view showing the bridge address, status Connected and 77 topics, next to the 3D scene and a camera

Sources after connecting.
```

Open **Topics** to see the topics and their message types. A topic in the list has a publisher; a panel showing it waits for its first message.

If the status bar stays red, see [Troubleshooting](../how-to-guides/troubleshooting.md#miti-cannot-connect).

## Next step

[Tour the workspace](tour-the-workspace.md).
