# Show a Point Cloud on Its Own

The Point Cloud panel shows one `sensor_msgs/msg/PointCloud2` topic on its own, for a quick look at a sensor without setting up frames.

1. Click **+** in the title bar and choose **Point Cloud**.
2. Click the panel's tab and choose the topic in **Point Cloud Topic**.

The panel waits until the first cloud arrives, then shows how many points it has and when it arrived. To see a cloud together with the robot model and other topics, turn it on in the [3D Scene](configure-the-3d-scene.md) instead.

```{figure} ../images/pointcloud.webp
:alt: The Point Cloud panel showing 14,892 lidar points from /livox/lidar

The Point Cloud panel with `/livox/lidar`.
```
