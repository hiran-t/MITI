# Draw 3D topics over a camera

A camera panel can draw ROS data over the image: LiDAR points, maps and costmaps, planned paths and TF frames. To place them correctly MITI needs three things that belong together:

| What        | Example                            | Used for                                                 |
| ----------- | ---------------------------------- | -------------------------------------------------------- |
| Image       | `/camera/camera/color/image_raw`   | The picture underneath                                   |
| Calibration | `/camera/camera/color/camera_info` | Projecting 3D points onto the image                      |
| Transforms  | `/tf`, `/tf_static`                | Moving data from its frame to the camera's optical frame |

A topic being listed, or its eye icon being on, does not mean anything is drawn yet. Check the topic's state in the settings and the image itself.

## Match the image with its calibration

1. Click the camera panel's tab, and expand the panel to see the image well.
2. In **General → Topic**, choose the image, for example `/camera/camera/color/image_raw`.
3. In **Calibration**, choose **Auto** (it shows the `camera_info` it found) or the `camera_info` topic itself. With **None**, 3D topics cannot be drawn.
4. Use the calibration of the same camera and image mode; another camera's `camera_info` puts everything in the wrong place.
5. Leave **Sync timestamps** on, so the TF at the image's time is used. If MITI reports **TF is too old**, for example with a simulator whose TF lags behind the image, turn it off to draw with the latest TF.
6. Use **Rectify** when the calibration describes lens distortion. It does not fix missing TF.

```{figure} images/camera.webp
:alt: Camera settings with the image topic, Calibration set to Auto with the camera_info topic, and Sync timestamps

**General** holds the image topic, its calibration and time sync.
```

## Turn topics on

In the camera's settings, collapse **General** and expand **Topics**. The eye icon next to a topic turns it on and off; the arrow or the topic's name opens its settings. Camera panels and the 3D Scene have their own topic lists, so turning a topic on in one does not show it in the other.

### Point clouds

For a `sensor_msgs/msg/PointCloud2` topic such as `/livox/lidar`:

1. Turn the topic on and open its settings.
2. Start with **Point size** 3, **Point shape** Circle, **Color mode** Flat, and a color that stands out from the image, such as `#15FBFF`.
3. Lower **Opacity** so the image stays visible behind the points.
4. Keep **Decay time (s)** at 0 to see only the latest scan; raise it to let points build up.
5. Adjust **Point limit**, **Max rate (Hz)** and **Stale after (s)** to the amount of data and how often it arrives.

RGB and RGBA color modes use colors stored in the cloud, when it has them. Color maps and gradients color points by one of the cloud's fields.

```{figure} images/camera-cloud.webp
:alt: Livox lidar points drawn in cyan over a live camera image, with the point cloud settings in the sidebar

`/livox/lidar` drawn over the camera image.
```

### Costmaps and occupancy grids

For a `nav_msgs/msg/OccupancyGrid` topic such as `/local_costmap/costmap`:

1. Turn the topic on and open its settings.
2. Choose **Color mode** Costmap for a costmap, or Map for an occupancy map. **Custom** lets you set the colors for minimum, maximum, unknown and invalid cells; **Raw** shows the values as they are.
3. Set **Opacity** to about 0.45 so the image shows through.
4. **Frame lock**, **Draw behind** and **Max rate (Hz)** fine-tune how the map is drawn; change one at a time.

The map can only be drawn when TF connects its frame to the camera.

```{figure} images/camera-costmap.webp
:alt: The local costmap drawn over a live camera image in costmap colors at opacity 0.45, with its settings in the sidebar

`/local_costmap/costmap` drawn over the camera image.
```

### Paths

For a `nav_msgs/msg/Path` topic such as `/plan`:

1. Turn the topic on and open its settings.
2. Choose **Type** Line for a continuous path, or Arrow or Axis to show each pose.
3. Adjust **Line width**, **Gradient start/end** and **Opacity** so the path stands out.
4. Check **Point limit**, **Max rate (Hz)** and **Stale after (s)**.

A planner usually publishes a path only while it has a goal, so the topic can be quiet when the robot is idle.

### TF frames

1. Turn on **Transforms** and expand it.
2. Check that **TF topics** lists `/tf, /tf_static`, and add any other TF topic the robot uses, such as `/fast_lio/tf` from FAST-LIO. Static TF topics with other names go in **Static TF topics**.
3. Set **Labels**, **Label size (px)**, **Axis scale**, **Line width** and **Line color**.
4. Turn single frames on and off with their eye icons to keep the image readable.

```{figure} images/camera-tf.webp
:alt: A live camera image with TF axes, connecting lines and frame names drawn over it, and the Transforms group open in the settings

TF frames drawn over a live camera image.
```

(camera-overlay-problems)=

## When the overlay looks wrong

| Symptom                                                                    | Check                                                                                                                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The topic is listed but shows **Waiting for message**                      | Whether the robot is publishing it right now                                                                                                                     |
| The eye is on but nothing is drawn                                         | Calibration; TF from the topic's frame to the camera's optical frame; whether the data is in front of the camera and inside the image; Opacity                   |
| **No transform: A → B**                                                    | The TF chain from A to B                                                                                                                                         |
| **No TF at the image time**, **TF history unavailable**, **TF is too old** | The time of the image against the TF, and whether every node uses the same clock. MITI then uses the latest TF, which can be off while the robot or camera moves |
| Image and overlay are offset                                               | That the calibration belongs to this camera, the optical frame, distortion and rectification, and timestamps                                                     |
| **Stale**                                                                  | How often the topic is published, against **Stale after**                                                                                                        |
| Low frame rate                                                             | Fewer layers, a lower **Point limit** or **Max rate**. These reduce the drawing work only; the bridge still sends every message                                  |

Turning off **Sync timestamps** hides time problems rather than fixing them; expect the overlay to drift while the robot moves.
