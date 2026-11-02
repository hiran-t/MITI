# Run miti_bridge on the Robot

When [miti_bridge](https://github.com/hiran-t/MITI-sdk) runs on the robot, MITI connects to it directly. Nothing else is needed on the MITI machine. To keep the bridge's work off the robot instead, see [Run miti_bridge beside MITI](run-miti-bridge-beside-miti.md).

```{figure} ../images/architecture-bridge-on-robot.webp
:alt: The browser loads MITI from the MITI server over HTTP on port 3000 and connects over WebSocket on port 8765 to miti_bridge on the robot, which talks to the robot's ROS 2 nodes over DDS

miti_bridge on the robot.
```

## Install the bridge

On the robot: Ubuntu 22.04 (Humble) or 24.04 (Jazzy), amd64 or arm64, with ROS 2 installed. miti_bridge is not in ROS's apt repository yet, so add the MITI SDK's apt repository once, then install the package:

```bash
curl -fsSL https://hiran-t.github.io/MITI-sdk/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miti-sdk.gpg
```

```bash
echo "deb [signed-by=/usr/share/keyrings/miti-sdk.gpg] https://hiran-t.github.io/MITI-sdk $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/miti-sdk.list
```

```bash
sudo apt update && sudo apt install ros-$ROS_DISTRO-miti-bridge
```

On another setup, [build miti_bridge from source](https://github.com/hiran-t/MITI-sdk#build-from-source).

## Start the bridge

```bash
source /opt/ros/$ROS_DISTRO/setup.bash
ros2 launch miti_bridge miti_start   # port 8765
```

Useful launch arguments:

| Argument          | Example                                                       | Use                                                        |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `port`            | `port:=8765`                                                  | The WebSocket port                                         |
| `topic_whitelist` | `"topic_whitelist:=['/tf.*', '/joint_states', '/camera/.*']"` | Offer only some topics                                     |
| `max_qos_depth`   | `max_qos_depth:=10`                                           | The largest queue a subscription keeps                     |
| `asset_roots`     | `"asset_roots:=['/home/robot/meshes']"`                       | Folders `file://` meshes may come from                     |
| `use_sim_time`    | `use_sim_time:=true`                                          | Send the robot's `/clock` to MITI, for a robot on sim time |

The other arguments (`address`, `service_whitelist`, `param_whitelist`, `client_topic_whitelist`, `capabilities`) are in the [miti_bridge parameters](https://github.com/hiran-t/MITI-sdk/blob/main/ros/miti_bridge/README.md#parameters).

To start the bridge at boot, add it to the robot's launch files or to a systemd unit that sources ROS first.

## Connect MITI

In MITI, click the gear in the status bar and enter `ws://<robot-ip>:8765` as the **Bridge URL**; see [Connect to a robot](../tutorials/connect-to-a-robot.md). To make that address MITI's default for every browser, build MITI with `NEXT_PUBLIC_BRIDGE_URL=ws://<robot-ip>:8765` (see the [configuration reference](../reference/configuration.md)).

## What the bridge saves on the link

miti_bridge decides on the robot what crosses the network, so a slow link carries less:

- **Camera images** go as JPEG when the Image panel's **Compression** is **JPEG on robot**, the default. Depth images stay raw.
- **Point clouds** are cut to the 3D Scene's **Point limit** before they are sent.
- **Rate limits** (a camera's **Max FPS**, a layer's **Max rate**) are applied by the bridge, so frames no panel draws are never sent.
- **TF and joint states** go first, ahead of images and point clouds.

The status bar shows how much the bridge sends per second; it turns amber when messages wait on the robot for more than half a second. **Sources** lists what each topic uses.
