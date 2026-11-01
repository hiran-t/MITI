# How MITI Works

MITI is a web application. One machine runs it, and any browser on the network shows it. The robot's data reaches the browsers through foxglove_bridge.

## The parts

```{figure} ../images/architecture-bridge-on-robot.webp
:alt: The browser loads MITI from the MITI server over HTTP on port 3000 and connects over WebSocket on port 8765 to foxglove_bridge on the robot, which talks to the robot's ROS 2 nodes over DDS

foxglove_bridge on the robot.
```

ROS 2 nodes
: The robot's software. It publishes topics as usual; nothing MITI-specific is needed on the robot.

foxglove_bridge
: A ROS 2 node that offers the robot's topics over a WebSocket (the Foxglove WebSocket protocol, port 8765). It subscribes to a topic only while some browser shows it, and encodes the messages as CDR.

MITI server
: Serves the MITI pages (port 3000), and the robot's meshes when the bridge does not. It holds no robot data.

Browser
: Runs MITI: it connects to foxglove_bridge directly, decodes the messages in background workers, and draws the panels. Every browser has its own connection, so several people can watch the same robot.

## Where foxglove_bridge runs

The bridge can run in either of two places. MITI works the same way with both.

```{figure} ../images/architecture-bridge-beside-miti.webp
:alt: The browser loads MITI from the MITI server over HTTP on port 3000 and connects over WebSocket on port 8765 to foxglove_bridge on the MITI machine, which reaches the robot's ROS 2 nodes over DDS across the network; nothing is installed on the robot

foxglove_bridge beside MITI.
```

|                           | On the robot                                                                             | Beside MITI                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Where                     | The robot's computer                                                                     | The machine that runs MITI                                                             |
| How it reaches the topics | Locally                                                                                  | Over DDS, across the network                                                           |
| Work on the robot         | Subscribing, encoding and sending to every browser                                       | None beyond publishing                                                                 |
| Needs on the MITI machine | Nothing                                                                                  | The robot's ROS 2 distro, `ROS_DOMAIN_ID` and message packages                         |
| Set up with               | [Run foxglove_bridge on the robot](../how-to-guides/run-foxglove-bridge-on-the-robot.md) | [Run foxglove_bridge beside MITI](../how-to-guides/run-foxglove-bridge-beside-miti.md) |

## What crosses the network

Only the topics that panels show are sent, and each one is sent to each browser that shows it. Raw camera images are the largest: a 1280 × 720 image is 2.8 MB, so a few cameras can fill a Wi-Fi or VPN link, while joint states, TF and odometry are small. Compressed image topics (`.../compressed`) are many times smaller.

Panels limit how often they **draw** (for example **Max FPS** on a camera), which saves the computer's work; the bridge still sends every message.

## Stream modes

The connection settings offer two ways to receive the topics:

Synchronized
: The default. All topics share one connection, so cameras, TF and the 3D Scene show the same moment.

Prioritize robot motion
: Images, point clouds and maps get their own connections, one per topic. On a slow link the robot model and TF stay real-time, while the cameras may lag behind them.

```{figure} ../images/concept-stream-modes.webp
:alt: Synchronized mode sends every message through one connection, so small messages wait behind large images; Prioritize robot motion sends TF, joint states, odometry and the log on one connection and each image, point cloud and map topic on its own

The two stream modes.
```

## Where settings are kept

| Setting                                           | Kept in                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| The layout and the panels' settings               | The browser, for each MITI address                                                   |
| The bridge address and stream mode                | The browser, for each MITI address                                                   |
| The ROS network settings of a bridge MITI started | The MITI machine (`~/.config/miti/bridge.json` or `.miti/bridge.json`)               |
| Server settings (ports, mesh folders)             | The MITI machine (`/etc/miti/` for the apt package, environment variables otherwise) |

Because the layout belongs to the browser and the address, two browser tabs on the same address share it, while another computer starts with the default layout.
