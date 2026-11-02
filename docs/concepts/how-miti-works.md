# How MITI Works

MITI is a web application. One machine runs it, and any browser on the network shows it. The robot's data reaches the browsers through miti_bridge.

## The parts

```{figure} ../images/architecture-bridge-on-robot.webp
:alt: The browser loads MITI from the MITI server over HTTP on port 3000 and connects over WebSocket on port 8765 to miti_bridge on the robot, which talks to the robot's ROS 2 nodes over DDS

miti_bridge on the robot.
```

ROS 2 nodes
: The robot's software. It publishes topics as usual; nothing MITI-specific is needed on the robot.

miti_bridge
: A ROS 2 node, from the [MITI SDK](https://github.com/hiran-t/MITI-sdk), that offers the robot's topics over a WebSocket (the MITI protocol, port 8765). It subscribes to a topic only while some browser shows it, and sends the messages as CDR. It decides on the robot what crosses the network: rate limits, the newest frame of a camera or point cloud, TF first, JPEG for camera images and smaller point clouds.

MITI server
: Serves the MITI pages (port 3000), and the robot's meshes when the bridge does not. It holds no robot data.

Browser
: Runs MITI: it connects to the bridge directly, decodes the messages in background workers, and draws the panels. Every browser has its own connection, so several people can watch the same robot.

## Where the bridge runs

The bridge can run in either of two places. MITI works the same way with both.

```{figure} ../images/architecture-bridge-beside-miti.webp
:alt: The browser loads MITI from the MITI server over HTTP on port 3000 and connects over WebSocket on port 8765 to miti_bridge on the MITI machine, which reaches the robot's ROS 2 nodes over DDS across the network; nothing is installed on the robot

miti_bridge beside MITI.
```

|                           | On the robot                                                                     | Beside MITI                                                                    |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Where                     | The robot's computer                                                             | The machine that runs MITI                                                     |
| How it reaches the topics | Locally                                                                          | Over DDS, across the network                                                   |
| Work on the robot         | Subscribing, compressing and sending to every browser                            | None beyond publishing                                                         |
| Needs on the MITI machine | Nothing                                                                          | The robot's ROS 2 distro, `ROS_DOMAIN_ID` and message packages                 |
| Set up with               | [Run miti_bridge on the robot](../how-to-guides/run-miti-bridge-on-the-robot.md) | [Run miti_bridge beside MITI](../how-to-guides/run-miti-bridge-beside-miti.md) |

## What crosses the network

Only the topics that panels show are sent, and each one is sent to each browser that shows it. Raw camera images are the largest: a 1280 × 720 image is 2.8 MB, so a few cameras can fill a Wi-Fi or VPN link, while joint states, TF and odometry are small.

miti_bridge keeps the link light:

- **Camera images** go as JPEG, around 100 KB a frame at 1280 × 720 instead of 2.8 MB, when the Image panel's **Compression** is **JPEG on robot** (the default). Depth images stay raw. Compressed image topics (`.../compressed`) are small already.
- **Point clouds** are cut to the 3D Scene's **Point limit** on the robot.
- **Rate limits** (**Max FPS** on a camera, **Max rate** on a layer) are applied by the bridge, so frames no panel draws are never sent.
- **Priorities.** TF, joint states and odometry go before images and point clouds, and a camera or point cloud that cannot keep up sends its newest frame.

The status bar shows how much the bridge sends per second, and turns amber when messages wait on the robot for more than half a second. **Sources** shows what each topic uses and how many messages the bridge dropped.

Measured over a 20 Mbit/s link with 30 ms of delay, a 1280 × 720 camera arrives at 14 frames per second as JPEG, and TF less than 70 ms late; with raw images, TF fell seconds behind.

## Stream modes

The connection settings offer two ways to receive the topics:

Synchronized
: The default. All topics share one connection, so cameras, TF and the 3D Scene show the same moment.

Prioritize robot motion
: Images, point clouds and maps get their own connections, one per topic. On a slow link the robot model and TF stay real-time, while the cameras may lag behind them.

```{figure} ../images/concept-stream-modes.webp
:alt: Synchronized mode sends every message through one connection, so on a slow link a small message can still wait for the image being sent; Prioritize robot motion sends TF, joint states, odometry and the log on one connection and each image, point cloud and map topic on its own

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
