# Configure the 3D Scene

This guide shows how to draw each kind of ROS topic in the 3D Scene and what its settings do. To set up the frames the scene draws in, see [Frames and transforms](../concepts/frames-and-transforms.md).

Click the 3D Scene's tab to open its settings. They are grouped into **Frame**, **Scene**, **View**, **Transforms**, **Topics**, **Custom layers** and **Publish**, and take effect immediately.

**Topics** lists every topic the scene can draw, picked by message type. Turn one on with its eye icon and open its settings with the arrow or its name; **Search panel settings** finds a topic by name. The robot description is shown by default; sensor topics are off until you turn them on.

## Robot model

The robot model comes from `/robot_description`, which the robot's `robot_state_publisher` publishes. Its settings:

| Setting                  | Use                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Control mode             | **Joint states** follows the robot's joints from ROS                                                   |
| Joint states topic       | Usually `/joint_states`                                                                                |
| Display mode             | **Auto** draws the visual geometry and falls back to collision geometry; or choose Visual or Collision |
| Color, Opacity           | The model's color and transparency; leave the color empty to use the URDF's materials                  |
| Show outlines, Show axis | Edges and link axes, to check the model                                                                |
| Frame prefix             | When the robot's TF frame names have a prefix                                                          |
| Mesh server URL          | An HTTP server for the robot's meshes, when the bridge does not serve them                             |
| Joint states, Links      | Expand to see the model's joints and links                                                             |

```{figure} ../images/scene-robot.webp
:alt: The robot model in the 3D Scene, with the /robot_description settings: control mode, joint states topic, display mode, color and 53 links

Robot model settings.
```

The model's meshes (`package://...`) come through miti_bridge from the robot's ROS workspace. When the bridge runs beside MITI, the robot's description package must be installed on the MITI machine too.

## Point clouds

Choose a cloud such as `/livox/lidar` and turn it on. Settings: **Point size**, **Point shape**, **Decay time**, **Color mode**, **Color**, **Opacity**, **Stixel view**, **Point limit**, **Max rate** and **Stale after**. Start with point size 2, Circle, Flat color, opacity 1 and decay 0, then change one setting at a time.

```{figure} ../images/scene-cloud.webp
:alt: Livox lidar points around the robot in the 3D Scene, with the point cloud settings in the sidebar

`/livox/lidar` in the 3D Scene, colored by intensity.
```

If the cloud shows **No transform: camera_init → map**, TF has no path from the cloud's frame to the fixed frame: check that its TF topic is in **TF topics** (FAST-LIO's `camera_init` comes from `/fast_lio/tf`), or choose a fixed frame the cloud's frame connects to.

## Maps and costmaps

Turn on `/map`, `/local_costmap/costmap` or `/global_costmap/costmap`, and choose a **Color mode** that matches: Map for occupancy maps, Costmap for costmaps, or Custom to set the colors yourself. Lower **Opacity** to keep the robot and other layers visible.

```{figure} ../images/scene-costmap.webp
:alt: The local costmap around the robot in costmap colors, with its settings in the sidebar

`/local_costmap/costmap` in the 3D Scene.
```

The scene draws `nav_msgs/msg/OccupancyGrid`. Nav2's `costmap_raw` topics use another type (`nav2_msgs/msg/Costmap`); choose topics by their type, not by a similar name.

## Paths

Turn on `/plan`, `/path` or another `nav_msgs/msg/Path` topic, choose **Type** Line, Arrow or Axis, and adjust the line width, gradient and opacity.

## Odometry and poses

An odometry topic such as `/odom` is drawn as an **Arrow** or **Axis**, with its color, shaft and head sizes and opacity. With **Covariance** on, it also draws the position uncertainty from the message's covariance as an ellipsoid (one standard deviation). It shows the latest pose only; to see the route the robot has driven, show a Path topic.

```{figure} ../images/scene-odom.webp
:alt: An odometry arrow at the robot in the 3D Scene, with the arrow settings in the sidebar

`/odom` drawn as an arrow.
```

## Camera views

A `CameraInfo` topic draws the camera's field of view (frustum), and can show its image on a plane inside it:

1. Turn on the camera's `CameraInfo` topic, for example `/camera/camera/color/camera_info`.
2. In **Image topic**, enter the camera's image, for example `/camera/camera/color/image_raw`.
3. Adjust **Image distance (m)**, the color and the opacity.
4. Check that the layer shows **Receiving**, and that TF connects the camera's optical frame to the fixed frame.

```{figure} ../images/scene-camera.webp
:alt: The camera's field of view drawn as a frustum from the robot's head, with the CameraInfo settings and the Receiving state

The color camera's field of view.
```

The image must be rectified and in the same optical frame as the `CameraInfo`; the 3D Scene does not remove lens distortion.

To send a goal or a point from the scene, see [Send goals from the 3D Scene](send-goals-from-the-3d-scene.md). For every message type the scene draws, see the [3D Scene layers reference](../reference/3d-scene-layers.md).
