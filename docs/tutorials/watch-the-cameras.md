# Watch the Cameras

In this tutorial you show the robot's color and depth cameras, then draw the lidar over the camera image.

## Show the color camera

The default layout has a **Camera · Color** and a **Camera · Depth** panel. When the robot does not publish the default topic names, the panels switch by themselves to the robot's own camera topics, for example `/camera/camera/color/image_raw` from an Intel RealSense driver.

To choose another camera, click the panel's tab and pick the topic in **General → Topic**.

```{figure} ../images/camera.webp
:alt: A camera panel showing a live color image, with its General settings in the sidebar

A live color camera and its settings.
```

The tab shows the image size, frame rate, size per frame and the time of the last frame. A raw 1280 × 720 image is 2.8 MB, too much for most Wi-Fi links. With miti_bridge, the panel's **Compression** setting is **JPEG on robot** by default: the bridge sends color images as JPEG, around 100 KB a frame instead of 2.8 MB, and **Max FPS** limits how many it sends. Depth images stay raw.

## Show the depth camera

In the **Camera · Depth** panel, set **Color mode** to **Color map** so near and far get different colors.

```{figure} ../images/depth.webp
:alt: A depth image shown with the Turbo color map, near in blue and far in red

A depth image with Color mode Color map.
```

## Draw the lidar over the image

1. In the color camera's settings, check that **Calibration** shows the camera's `camera_info` topic (**Auto** finds it).
2. Expand **Topics**, find the lidar topic and turn on its eye icon.
3. Open the topic's settings and set **Color mode** to Flat and **Point size** to 3, so the points stand out.

```{figure} ../images/camera-cloud.webp
:alt: Livox lidar points drawn in cyan over a live camera image, with the point cloud settings in the sidebar

The lidar drawn over the camera image.
```

MITI projects the points into the image with the camera's calibration and TF. Costmaps, paths and TF frames can be drawn the same way; see [Draw 3D topics over a camera](../how-to-guides/draw-topics-over-a-camera.md).

## What next

You have finished the tutorials. The [How-To Guides](../how-to-guides/index.md) cover specific tasks, such as running miti_bridge beside MITI or monitoring a state machine.
