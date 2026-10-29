# MITI 3D Scene

The scene is independent of the robot description. A grid, TF frames and sensor layers can be used without a URDF model. Select the scene, open **Panel**, and use **Add layer** to add a topic. Settings take effect immediately and are persisted in the existing workspace configuration.

## Supported layers

| Layer                 | ROS 2 interface                                                      | Display                                                                                           |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Robot                 | `std_msgs/msg/String` + `sensor_msgs/msg/JointState`                 | URDF model and articulated joints; HTTP URDF sources also supported                               |
| TF                    | `tf2_msgs/msg/TFMessage`                                             | Frame axes, labels, parent connections                                                            |
| Point Cloud           | `sensor_msgs/msg/PointCloud2`                                        | XYZ points; packed RGB/RGBA or individual color channels                                          |
| Laser Scan            | `sensor_msgs/msg/LaserScan`                                          | Valid ranges projected onto the scan plane                                                        |
| Marker / Marker Array | `visualization_msgs/msg/Marker`, `MarkerArray`                       | Arrows, cubes, spheres, cylinders, lines, lists, points, text, meshes, triangles and arrow strips |
| Occupancy Grid        | `nav_msgs/msg/OccupancyGrid`                                         | Grayscale grid with origin pose, resolution and unknown cells                                     |
| Path                  | `nav_msgs/msg/Path`                                                  | Connected positions, respecting per-pose frames                                                   |
| Odometry              | `nav_msgs/msg/Odometry`                                              | Current pose arrow                                                                                |
| Pose / Pose Array     | `geometry_msgs/msg/PoseStamped`, `PoseArray`                         | Pose arrows                                                                                       |
| Camera / Image        | `sensor_msgs/msg/CameraInfo` + optional `Image` or `CompressedImage` | Calibrated frustum and textured image plane                                                       |

Topic suggestions use the live topic list and filter by message type. A topic can also be entered manually. Layer visibility, topic, opacity and applicable style controls live in the sidebar. Layer status distinguishes disconnected, waiting, empty, stale and errors. Removing a layer releases its subscriptions; changing a shared topic does not unsubscribe other widgets.

## Coordinates and time

- Set **Fixed frame** to a frame shared by your data, such as `map`, `odom`, or `base_link`.
- **Robot root frame** is the TF frame corresponding to the URDF model's origin. The model follows this frame in the fixed frame.
- Missing transforms produce a layer error, rather than drawing data at an assumed origin.
- Timestamp matching defaults on. Dynamic TF history is bounded to 30 seconds / 300 samples per child; translation and quaternion rotation are interpolated. Outside the available history, a tolerance of 0.2 seconds is allowed. Zero timestamps use the latest transform.
- Dynamic frames stop being retained after 30 seconds without updates. Static transforms on configured **Static TF topics** do not expire (defaults are inferred from names containing `static`). Their merged snapshots are replayed to newly attached scene subscribers on the same connection and cleared on disconnect.
- Custom static topic names can be entered under **Static TF topics**. QoS matching uses the rosbridge server's defaults; ensure the server can receive transient-local `/tf_static`, maps and robot descriptions.
- Non-frame-locked markers retain their initial transform until replaced; frame-locked markers follow TF. Namespace/id replacement, DELETE, DELETEALL and lifetime are supported. Lifetime is measured from receipt using browser wall time, not `/clock` simulation time.

## Data and resource limits

PointCloud2 accepts numeric bytes or rosbridge Base64, padded rows, both byte orders, and packed float RGB bit patterns. Invalid buffers/fields are reported. Clouds/scans are sampled to the configured point limit (100,000 by default, maximum 1,000,000). Pose/path limits produce an error rather than silently rendering partial geometry. Maps are capped at 16M cells and use the common occupancy convention: 0 free, 100 occupied, -1 unknown. Marker rendering is capped at 5,000 active entities.

Robot and marker mesh URLs must be browser-accessible with appropriate CORS. STL, OBJ and DAE are supported, including `package://` resources resolved using the robot's package mapping or mesh base URL. Embedded marker mesh/texture payloads and textured triangle-list messages are not implemented; unsupported mesh URIs report an error. Marker colors and scales come from the messages.

Camera images must be rectified and use the same optical frame as CameraInfo. Distortion correction is not performed. Raw image encodings use MITI's image decoder; compressed images use the browser's JPEG/PNG decoder. A zero focal length reports an uncalibrated camera. CameraInfo defines the image plane transform; the viewer is not a stereo reconstruction or image synchronization pipeline.

Odometry displays pose, not covariance ellipsoids or a stored trajectory. Use Path for trajectories. Custom ROS messages, volumetric maps and other message families need additional renderers; this is not complete RViz feature parity.

## Compatibility and validation

Existing `pointCloudTopics` are interpreted as enabled cloud layers until the scene's layer configuration is edited. Existing topics and URDF configuration are preserved. URL source edits automatically load after a 500 ms pause; obsolete requests cannot replace a newer source. Reload URDF is available to refresh an unchanged URL.

Regression tests cover transform composition/inversion/interpolation, missing frames and cycles, static TF retention, callback-specific cleanup, retained static messages, cloud parsing, laser projection, occupancy bytes and marker lifecycle. Browser verification used a local WebSocket fixture with all ten layer types, missing transforms, topic changes, stale input, persistence and mobile layout. Real rosbridge/hardware and high-density sensor throughput still require validation on the target robot.

Run `npm run type-check`, `npm run lint`, `npm test -- --runInBand`, and `npm run build`.
