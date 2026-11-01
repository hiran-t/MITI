# Connect to a Robot

In this tutorial you start foxglove_bridge on the robot and connect MITI to it, then check that the robot's topics arrive.

MITI reads the robot's ROS 2 topics through [foxglove_bridge](https://github.com/foxglove/foxglove-sdk), a ROS 2 node that serves them over a WebSocket on port 8765. Here it runs on the robot; to keep the work off the robot, it can run beside MITI instead (see [Run foxglove_bridge beside MITI](../how-to-guides/run-foxglove-bridge-beside-miti.md)).

## Start foxglove_bridge on the robot

On the robot, install foxglove_bridge for its ROS 2 distro and start it. Replace `humble` with `jazzy` on a Jazzy robot:

```bash
sudo apt install ros-humble-foxglove-bridge
source /opt/ros/humble/setup.bash
ros2 launch foxglove_bridge foxglove_bridge_launch.xml
```

## Enter the robot's address

1. In MITI, click the **gear** in the status bar, next to the bridge address.
2. In **foxglove_bridge URL**, enter the robot's address, for example `ws://192.168.10.27:8765`.
3. Click **Save and reconnect**.

```{figure} ../images/connection-settings.webp
:alt: The connection settings dialog with a robot's address in the foxglove_bridge URL field

The connection settings with the robot's address.
```

The browser remembers the address for the next time.

## Check the connection

When MITI is connected, the status bar turns teal. Open **Sources** in the activity bar on the left: it shows the bridge's address, **Connected**, and how many topics the bridge offers.

```{figure} ../images/sources.webp
:alt: The Sources view showing the bridge address, status Connected and 77 topics, next to the 3D scene and a camera

Sources after connecting.
```

Open **Topics** to see the topics and their message types. A topic in the list has a publisher; a panel showing it waits for its first message.

If the status bar stays red, see [Troubleshooting](../how-to-guides/troubleshooting.md#miti-cannot-connect).

## Next step

[Tour the workspace](tour-the-workspace.md).
