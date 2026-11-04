# Add the Robot's Message Types

The bridge can only offer topics whose message definitions are installed beside it. The standard packages (`common_interfaces`, `tf2_msgs`, `nav2_msgs`, `map_msgs`, `moveit_msgs`, `control_msgs`, `vision_msgs`, and nav2's `bond`) are included. For the robot's own packages (for example `oc_g1_msgs`), add them to the MITI machine.

## With pixi or Docker

Copy their source into `ros/overlay/src` and build them:

```bash
cp -r ~/robot_ws/src/oc_g1_msgs ros/overlay/src/
pixi run -e humble build-msgs            # pixi; restart the bridge afterwards
docker compose --profile bridge build    # Docker builds them into the image
```

Topics of types that are still missing are left out, and the bridge logs `package '...' not found` each time the topic graph changes.

## With the apt package

Install the robot's message packages into the ROS 2 in `/opt/ros`, for example from the robot's own apt repository, or build them in a workspace and source it before `miti run --bridge`.

The robot's description package (with its meshes) is added the same way, so the robot model's `package://` meshes load.
