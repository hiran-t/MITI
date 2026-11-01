# See Your Robot in 3D

In this tutorial you show the robot model in the 3D Scene, make the view follow the robot, and add the robot's lidar and costmap.

The robot model comes from `/robot_description`, which the robot's `robot_state_publisher` publishes; its links move with TF and `/joint_states`.

## Show the robot model

1. Click the **3D Scene** tab to open its settings.
2. Under **Topics**, check that `/robot_description` has its eye icon on. It is on by default.

The model appears once its meshes have loaded, which can take a few seconds on a slow link.

## Follow the robot

Under **Frame**:

1. Set **Fixed frame** to the frame the robot moves in, such as `map` or `odom`.
2. Set **Display frame** to a frame on the robot, such as `base_link`, so the view follows it.
3. Leave **Follow mode** at **Pose (position + attitude)** to turn the view with the robot.

```{figure} ../images/scene-frames.webp
:alt: The 3D Scene following the robot, with lidar points and the local costmap, and the Frame settings in the sidebar

The 3D Scene with fixed frame `map` and display frame `pelvis`.
```

If labels of the TF frames cover the robot, turn off the eye icon of **Transforms**. It only hides the drawing; the transforms are still used.

## Add the lidar and the costmap

1. Under **Topics**, find the robot's point cloud, such as `/livox/lidar`, and turn on its eye icon.
2. Turn on the costmap, such as `/local_costmap/costmap`.
3. Click a topic's name to open its settings, for example to change the costmap's **Color mode** to Costmap.

**Search panel settings** at the top of the sidebar finds a topic by name.

```{figure} ../images/scene-cloud.webp
:alt: Livox lidar points around the robot in the 3D Scene, with the point cloud settings in the sidebar

The robot's lidar in the 3D Scene.
```

If a topic shows **No transform**, its frame is not connected to the fixed frame; see [Frames and transforms](../concepts/frames-and-transforms.md).

## Next step

[Watch the cameras](watch-the-cameras.md).
