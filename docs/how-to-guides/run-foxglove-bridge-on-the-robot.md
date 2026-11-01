# Run foxglove_bridge on the Robot

When foxglove_bridge runs on the robot, MITI connects to it directly. Nothing else is needed on the MITI machine. To keep the bridge's work off the robot instead, see [Run foxglove_bridge beside MITI](run-foxglove-bridge-beside-miti.md).

```{figure} ../images/architecture-bridge-on-robot.webp
:alt: The browser loads MITI from the MITI server over HTTP on port 3000 and connects over WebSocket on port 8765 to foxglove_bridge on the robot, which talks to the robot's ROS 2 nodes over DDS

foxglove_bridge on the robot.
```

## Install and start the bridge

On the robot, with its ROS 2 (replace `humble` with `jazzy` on a Jazzy robot):

```bash
sudo apt update
sudo apt install ros-humble-foxglove-bridge
source /opt/ros/humble/setup.bash
ros2 launch foxglove_bridge foxglove_bridge_launch.xml   # port 8765
```

Useful launch arguments:

| Argument            | Example                                                                | Use                                                                       |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `port`              | `port:=8765`                                                           | The WebSocket port                                                        |
| `topic_whitelist`   | `topic_whitelist:="['/tf.*','/joint_states','/camera/.*/compressed']"` | Offer only some topics, for example compressed images instead of raw ones |
| `send_buffer_limit` | `send_buffer_limit:=10000000`                                          | Bytes queued per browser before messages are dropped                      |

To start the bridge at boot, add it to the robot's launch files or to a systemd unit that sources ROS first.

## Connect MITI

In MITI, click the gear in the status bar and enter `ws://<robot-ip>:8765` as the **foxglove_bridge URL**; see [Connect to a robot](../tutorials/connect-to-a-robot.md). To make that address MITI's default for every browser, build MITI with `NEXT_PUBLIC_BRIDGE_URL=ws://<robot-ip>:8765` (see the [configuration reference](../reference/configuration.md)).
