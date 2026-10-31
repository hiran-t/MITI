# Cameras

The Camera panel shows one image topic: color, depth or infrared, raw (`sensor_msgs/msg/Image`) or compressed (`sensor_msgs/msg/CompressedImage`). It can also draw 3D topics over the image; see {doc}`camera-overlays`.

## Choose the image topic

1. Click the camera panel's tab to open its settings.
2. In **General → Topic**, choose the image topic exactly as it appears in **Topics**.
3. Wait for the first frame. Being connected does not mean the topic is sending; until a frame arrives the panel shows **Waiting for image data...**.

The default camera panels start on common topic names such as `/camera/color/image_raw`. When the robot does not publish that name, the panel switches by itself to the robot's own topic of the same kind, for example `/camera/camera/color/image_raw` from an Intel RealSense driver. A topic you chose is never changed.

```{figure} images/camera.webp
:alt: A camera panel showing a live color image from /camera/camera/color/image_raw, with its General settings in the sidebar

A live color camera and its settings.
```

The panel's tab shows the image size, frame rate, size per frame and the time of the last frame. The frame rate reflects what reaches the browser: a raw 1280 × 720 image is 2.8 MB per frame, so a slow network lowers it. Compressed topics (`.../compressed`) arrive much faster.

## Settings

Calibration
: The `CameraInfo` topic of the same camera. **Auto** picks the one beside the image topic. Needed for **Rectify** and for drawing 3D topics over the image.

Rectify
: Removes lens distortion using the calibration.

Sync timestamps
: Draws 3D topics with the TF from the image's time, so they line up with the picture.

Flip horizontal, Flip vertical, Rotation
: Turn the image to match how the camera is mounted.

Color mode, Gradient start/end, Value min/max
: For depth and mono images: how values become colors. **Auto** limits use each image's range.

Max FPS
: How often this panel decodes and draws frames, to save the computer's work. The robot still sends every frame.

## Depth images

For a depth camera, choose its depth topic, for example `/camera/camera/aligned_depth_to_color/image_raw`, and set **Color mode** to a gradient or color map. Near and far become different colors.

```{figure} images/depth.webp
:alt: A depth image shown with the Turbo color map, near in blue and far in red, with the depth camera settings

A depth image with **Color mode** Color map.
```
