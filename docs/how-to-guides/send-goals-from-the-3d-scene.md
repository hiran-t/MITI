# Send Goals from the 3D Scene

The 3D Scene can publish a point, a goal pose or an initial pose by clicking on the ground of the scene, for example to send Nav2 a navigation goal or to tell AMCL where the robot is.

:::{warning}
A goal pose can make the robot drive. Publish one only when the robot and the space around it are ready.
:::

## Choose what to publish

Open the 3D Scene's settings and expand **Publish**. Choose the message type and its topic:

```{figure} ../images/scene-publish.webp
:alt: The Publish settings of the 3D Scene with type Pose and topic /goal_pose, and the publish button at the top right of the scene

Publish settings for a navigation goal; the publish button is at the top right of the scene.
```

| Type          | Message                                   | Default topic    | Used for                                                                                         |
| ------------- | ----------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| Point         | `geometry_msgs/PointStamped`              | `/clicked_point` | Marking a point, as RViz's Publish Point does                                                    |
| Pose          | `geometry_msgs/PoseStamped`               | `/goal_pose`     | A navigation goal for Nav2                                                                       |
| Pose estimate | `geometry_msgs/PoseWithCovarianceStamped` | `/initialpose`   | Setting the robot's position for localization; the covariance comes from the deviations set here |

## Publish

1. Click the publish button at the top right of the scene.
2. For a point, click where it should be. For a pose, press where the robot should be and drag toward the direction it should face, then release.
3. To cancel, press **Esc**.

MITI publishes on the ground plane of the fixed frame, so the fixed frame must be the frame the goal is meant for, usually `map`.
