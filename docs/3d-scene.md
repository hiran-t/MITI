# MITI 3D Scene

The scene is independent of the robot description. A grid, TF frames and sensor layers can be used without a URDF model. Select the scene and open **Panel**: settings are grouped like Foxglove's 3D panel — **Frame**, **Scene**, **View**, **Transforms**, **Topics**, **Custom layers** and **Publish** — and take effect immediately. Layouts saved by MITI 2.0 are converted automatically.

**Topics** lists every published topic the scene can draw; use its eye button to show or hide it and expand it for display settings. Robot descriptions (`std_msgs/String` topics ending in `robot_description`) are shown by default, sensor topics are opt-in. **Custom layers** holds grids and URDF models loaded from a URL, a file path, a node parameter or a topic.

## Supported layers

| Layer                 | ROS 2 interface                                                            | Display                                                                                           |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Robot                 | `std_msgs/msg/String` (`*robot_description`), `sensor_msgs/msg/JointState` | URDF model; links follow TF, joint states pose links without TF                                   |
| TF                    | `tf2_msgs/msg/TFMessage`                                                   | Frame axes, labels, parent connections                                                            |
| Point Cloud           | `sensor_msgs/msg/PointCloud2`                                              | XYZ points; packed RGB/RGBA or individual color channels                                          |
| Laser Scan            | `sensor_msgs/msg/LaserScan`                                                | Valid ranges projected onto the scan plane                                                        |
| Marker / Marker Array | `visualization_msgs/msg/Marker`, `MarkerArray`                             | Arrows, cubes, spheres, cylinders, lines, lists, points, text, meshes, triangles and arrow strips |
| Occupancy Grid        | `nav_msgs/msg/OccupancyGrid`                                               | Grayscale grid with origin pose, resolution and unknown cells                                     |
| Path                  | `nav_msgs/msg/Path`                                                        | Connected positions, respecting per-pose frames                                                   |
| Odometry              | `nav_msgs/msg/Odometry`                                                    | Current pose arrow                                                                                |
| Pose / Pose Array     | `geometry_msgs/msg/PoseStamped`, `PoseArray`                               | Pose arrows                                                                                       |
| Camera / Image        | `sensor_msgs/msg/CameraInfo` + optional `Image` or `CompressedImage`       | Calibrated frustum and textured image plane                                                       |

Topic suggestions use the live topic list and filter by message type. A topic can also be entered manually. Layer visibility, topic, opacity and applicable style controls live in the sidebar. Layer status distinguishes disconnected, waiting, empty, stale and errors. Removing a layer releases its subscriptions; changing a shared topic does not unsubscribe other widgets.

## Robot models

Like Foxglove, every URDF link that has a TF frame (from `robot_state_publisher`) is drawn at that frame, so the model moves with TF. Links without TF are posed from the URDF joints and the **Joint states topic** (default `/joint_states`). **Frame prefix** is prepended to link names when looking up TF. **Display mode** _Auto_ draws visual geometry and falls back to collision geometry for links without visuals.

The robot must run `robot_state_publisher` for the model to appear from `/robot_description`. To read the description without the topic, add a URDF custom layer with source **Parameter** (`/robot_state_publisher.robot_description`); MITI reads the parameter through foxglove_bridge.

### Meshes (`package://`)

`package://` and `file://` meshes are fetched through foxglove_bridge's asset capability, like the Foxglove app, so they are read from the robot's ROS workspace and MITI can run on any machine. A **Mesh server URL** (an HTTP server whose root is the package directory) or a per-package mapping, when set, is used instead of the bridge. Without either, and when the bridge does not serve assets, MITI's server serves the meshes from the ROS workspace of the machine it runs on (`/api/package/<pkg>/<path>`): run MITI from a shell where the workspace is sourced (`AMENT_PREFIX_PATH` / `ROS_PACKAGE_PATH`), or set `MITI_PACKAGE_PATH` to colon-separated package or `install/` directories (see `scripts/auto-startapp.service`). Only mesh, texture and URDF files inside those directories are served.

Meshes are requested four at a time and kept in the browser's Cache Storage (when MITI is opened from `localhost` or HTTPS), so a robot crosses the network once; use **Reload model (clear mesh cache)** in the robot's ⋮ menu after its meshes change. foxglove_bridge drops replies when the connection is saturated, which raw camera images easily do over VPNs or Wi-Fi: hide image topics or publish compressed images while a robot loads. Timed-out meshes are requested up to three times.

By default all topics share one bridge connection, as in Foxglove, so cameras, robot motion and the scene show the same moment; on a slow link they are late together. **Connection Settings → Streaming → Prioritize robot motion** gives each image, point cloud and map topic a connection of its own instead: robot motion stays real-time and point clouds are not queued behind camera frames, at the cost of cameras trailing the robot. Mesh downloads always use their own connection. **Max rate (Hz)** on a topic, and **Max FPS** on camera panels (default: every frame), only limit how often MITI decodes and draws; the robot still sends every message, since foxglove_bridge cannot throttle per client. The camera status bar shows the received frame rate, the frame size and, when the frame is stamped on the robot's clock, how far it trails the robot.

## Coordinates and time

- **Fixed frame** is the frame data is accumulated in. _Auto_ picks the TF root, preferring `map`, `odom` or `world`; without TF it uses the first message frame.
- **Display frame** is the frame the camera follows. **Follow mode** _Pose_ follows position and orientation, _Position_ follows position only, _Fixed_ keeps the camera still in the fixed frame.
- Missing transforms produce a layer error, rather than drawing data at an assumed origin.
- **Sync timestamps** defaults on: each message is placed with TF at its own stamp, as Foxglove's 3D panel does, so data that arrives late still lines up with the robot. When off, the latest transforms are used. When on, dynamic TF history is bounded to 30 seconds of message time / 3,000 samples per child; translation and quaternion rotation are interpolated. Outside the available history, a tolerance of 0.2 seconds is allowed. Zero timestamps use the latest transform.
- Dynamic frames stop being retained after 30 seconds without updates. Static transforms on configured **Static TF topics** do not expire (defaults are inferred from names containing `static`). Their merged snapshots are replayed to newly attached scene subscribers on the same connection and cleared on disconnect.
- Custom static topic names can be entered under **Static TF topics**. foxglove_bridge subscribes with QoS matching the topic's publishers, so transient-local `/tf_static`, maps and robot descriptions also reach late subscribers.
- Non-frame-locked markers retain their initial transform until replaced; frame-locked markers follow TF. Namespace/id replacement, DELETE, DELETEALL and lifetime are supported. Lifetime is measured from receipt using browser wall time, not `/clock` simulation time.

## Data and resource limits

PointCloud2 accepts CDR byte arrays (also number arrays and Base64), padded rows, both byte orders, and packed float RGB bit patterns. Invalid buffers/fields are reported. Clouds/scans are sampled to the configured point limit (100,000 by default, maximum 1,000,000). Pose/path limits produce an error rather than silently rendering partial geometry. Maps are capped at 16M cells and use the common occupancy convention: 0 free, 100 occupied, -1 unknown. Marker rendering is capped at 5,000 active entities.

Robot and marker mesh URLs must be browser-accessible with appropriate CORS. STL, OBJ and DAE are supported, including `package://` and `file://` resources fetched through foxglove_bridge or resolved using the package mapping or mesh server URL. Embedded marker mesh/texture payloads and textured triangle-list messages are not implemented; unsupported mesh URIs report an error. Marker colors and scales come from the messages.

Camera images must be rectified and use the same optical frame as CameraInfo. Distortion correction is not performed. Raw image encodings use MITI's image decoder; compressed images use the browser's JPEG/PNG decoder. A zero focal length reports an uncalibrated camera. CameraInfo defines the image plane transform; the viewer is not a stereo reconstruction or image synchronization pipeline. The Foxglove protocol has no server-side throttling: foxglove_bridge sends every message and heavy topics are throttled for rendering in the browser, so prefer `CompressedImage` camera topics over slow links.

Odometry displays pose, not covariance ellipsoids or a stored trajectory. Use Path for trajectories. Custom ROS messages, volumetric maps and other message families need additional renderers; this is not complete RViz feature parity.

## Compatibility and validation

Existing `pointCloudTopics` are interpreted as enabled cloud layers until the scene's layer configuration is edited. Existing topics and URDF configuration are preserved. URL source edits automatically load after a 500 ms pause; obsolete requests cannot replace a newer source. Reload URDF is available to refresh an unchanged URL.

Regression tests cover transform composition/inversion/interpolation, missing frames and cycles, static TF retention, callback-specific cleanup, retained static messages, cloud parsing, laser projection, occupancy bytes and marker lifecycle. Browser verification used a local WebSocket fixture with all ten layer types, missing transforms, topic changes, stale input, persistence and mobile layout. Real foxglove_bridge/hardware and high-density sensor throughput still require validation on the target robot.

Run `npm run type-check`, `npm run lint`, `npm test -- --runInBand`, and `npm run build`.

## View and publishing

**View** mirrors the camera: orbiting or zooming updates distance, target offset, theta and phi, and editing them moves the camera. **Reset view** restores the default. **Perspective** off switches to an orthographic camera.

The publish button at the top right of the scene publishes on the ground plane of the fixed frame: click for a `geometry_msgs/PointStamped` (default `/clicked_point`), or press and drag toward the heading for a `PoseStamped` (`/goal_pose`) or `PoseWithCovarianceStamped` (`/initialpose`, covariance from the configured deviations). Choose the type and topics under **Publish**; Escape cancels.
