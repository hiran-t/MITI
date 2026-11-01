# Frames and Transforms

ROS data comes with a coordinate frame: a lidar's points are in the lidar's frame, a costmap in `odom`, a goal in `map`. To draw them together, MITI moves everything into one frame using the robot's transforms (TF). Most "nothing shows" problems in the 3D Scene and on camera overlays are frame problems.

```{figure} ../images/concept-tf-tree.webp
:alt: A TF tree from map through odom and base_link to livox_frame, camera_link and the camera optical frame, with map as the fixed frame and base_link as the display frame; a second tree, camera_init to body from /fast_lio/tf, is not joined to map and shows No transform: camera_init → map

A TF tree. Data in frames joined to the fixed frame is drawn; the FAST-LIO tree is not joined until `/fast_lio/tf` is added to TF topics.
```

## Fixed frame

The **fixed frame** is the frame the 3D Scene places all data in, such as `map`, `odom` or `world`. Every topic's frame needs a chain of transforms to it. **Auto** picks one from the robot's TF tree.

If a topic shows **No transform: A → B**, TF has no chain from the topic's frame A to the fixed frame B. Publish the missing transform, add the TF topic that carries it (see below), or choose a fixed frame that A connects to.

## Display frame and follow mode

The **display frame** is the frame the view follows. Set it to a frame on the robot, such as `base_link`, to keep the robot in view while it moves. **Follow mode** chooses how:

Pose (position + attitude)
: The view moves and turns with the robot.

Position
: The view moves with the robot but keeps its direction.

Fixed
: The view stays where it is.

Changing the display frame does not fix missing transforms: every topic still needs its chain to the fixed frame.

## TF topics

MITI reads transforms from `/tf` and `/tf_static` (**Transforms → TF topics**). Some robots publish part of their TF on another topic, such as `/fast_lio/tf` from FAST-LIO; add it there, or topics in its frames report **No transform**.

The eye icon of **Transforms** only shows or hides the axes and labels of the frames; the transforms are used either way. Hide them when the labels cover the robot.

## Time

Transforms change as the robot moves, so a message must be placed with the transforms from its own time. **Sync timestamps** does that. If topics report **TF is too old** or **No TF at the image time**, the transforms don't cover the messages' time; this is common with simulators and with clocks that differ between machines. Turning Sync timestamps off places messages with the latest transforms instead, which is fine while the robot stands still but drifts while it moves.

## Cameras

To draw 3D data over a camera image, MITI needs the camera's calibration (`camera_info`) and a chain of transforms from each topic's frame to the camera's **optical frame**, the frame `camera_info` names. See [Draw 3D topics over a camera](../how-to-guides/draw-topics-over-a-camera.md).
