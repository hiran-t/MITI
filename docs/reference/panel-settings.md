# Panel Settings

The settings of each panel, as they appear in the sidebar under **Panel settings**. Every panel also has a **Title**.

## Camera

**General**:

Topic
: The image topic, `sensor_msgs/msg/Image` or `sensor_msgs/msg/CompressedImage`. Panels still on a default topic switch to the robot's own camera topic when the default is not published.

Calibration
: The `CameraInfo` topic of the same camera. **Auto** picks the one beside the image topic. Needed for **Rectify** and for drawing 3D topics over the image.

Rectify
: Removes lens distortion using the calibration.

Sync timestamps
: Draws 3D topics with the TF from the image's time, so they line up with the picture.

Flip horizontal, Flip vertical, Rotation
: Turn the image to match how the camera is mounted.

Color mode, Gradient start/end, Color map, Value min/max
: For depth and mono images: how values become colors. **Auto** limits use each image's range.

Max FPS
: How often this panel decodes and draws frames, to save the computer's work. The robot still sends every frame.

**Scene**, **Transforms** and **Topics** set what is drawn over the image; see [Draw 3D topics over a camera](../how-to-guides/draw-topics-over-a-camera.md).

## 3D Scene

| Group         | Holds                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Frame         | Fixed frame, display frame, follow mode, sync timestamps ([Frames and transforms](../concepts/frames-and-transforms.md))     |
| Scene         | Background, label size, mesh options, render statistics                                                                      |
| View          | Camera distance, angles, field of view                                                                                       |
| Transforms    | TF topics and how the frames are drawn                                                                                       |
| Topics        | Every topic the scene can draw, with its own settings ([Configure the 3D Scene](../how-to-guides/configure-the-3d-scene.md)) |
| Custom layers | Grids, and robot models loaded from a URL, a file, a parameter or a topic                                                    |
| Publish       | What the publish button sends ([Send goals from the 3D Scene](../how-to-guides/send-goals-from-the-3d-scene.md))             |

## Log

Topic, Log level
: The log topic, usually `/rosout`, and the lowest level to show, from **DEBUG** to **FATAL**.

Namespaces
: Show or hide the messages of single nodes.

Display
: Font size, and whether each line shows its level, date, time, time zone, node name and source location.

## Point Cloud

Point Cloud Topic
: The `sensor_msgs/msg/PointCloud2` topic to show.

## State Machine

SMACC2 Status Topic
: The SMACC2 status topic (default `/smacc2/status`).

BehaviorTree Status Topic
: The behavior tree status topic (default `/behavior_tree/execution_status`).

The messages are described in [State machine messages](state-machine-messages.md).

## Button Switch

| Setting                 | Meaning                                                     |
| ----------------------- | ----------------------------------------------------------- |
| Button Label            | The text on the switch                                      |
| Action Mode             | **Publish Topic** or **Call Service**                       |
| Topic, Message Type     | Where and what to publish (Publish Topic)                   |
| ON Payload, OFF Payload | The messages sent when the switch turns on and off, as JSON |
| Service                 | The service to call (Call Service)                          |
| ON Args, OFF Args       | The requests sent when the switch turns on and off, as JSON |
