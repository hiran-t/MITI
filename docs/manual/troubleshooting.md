# Troubleshooting

## Problems and Sources

When something goes wrong, the **Problems** icon in the activity bar shows a count. Open it to see what failed and what to check.

```{figure} images/problems.webp
:alt: The Problems view showing Connection failed, WebSocket error, with a hint to check that foxglove_bridge is reachable

A connection problem.
```

**Sources** shows the bridge address MITI uses, the connection state and how many topics the bridge offers. Its **Connection settings** button opens the dialog to change the address.

## MITI cannot connect

**Connection failed / WebSocket error**, red status bar
: - Check the address in the status bar. MITI starts with the bridge on the host it was opened from; for a bridge on the robot, enter `ws://<robot-ip>:8765` in the connection settings.

- Check that foxglove_bridge runs: on the robot, `ros2 launch foxglove_bridge foxglove_bridge_launch.xml`; beside MITI, `miti run --bridge`.
- Check that the computer can reach the robot on port 8765, and that no firewall blocks it (`sudo ufw allow 8765/tcp`).

The page does not open from another computer
: Use the address `miti run` prints for other computers, `http://<miti-machine-ip>:3000`, and allow port 3000 through the firewall (`sudo ufw allow 3000/tcp`).

## Topics are missing

The bridge offers few or no topics
: The bridge and the robot need the same `ROS_DOMAIN_ID` and ROS 2 distro. For a bridge beside MITI, set the domain in the {ref}`ROS network settings <ros-network>`.

Topics come and go, mostly over Wi-Fi
: DDS discovery relies on multicast, which Wi-Fi often drops. Enter the robot's IP address in the ROS network settings, or set `ROS_STATIC_PEERS=<robot-ip>`.

A topic of the robot's own message type is missing
: The bridge offers only topics whose message definitions it has. A bridge beside MITI needs the robot's message packages installed on the MITI machine; see the [deployment guide](deployment.md#the-robots-own-message-types).

## A panel shows nothing

**Waiting for image data...** or **Waiting for message**
: The chosen topic has not sent anything yet. Check that its name matches the robot's topic list exactly (for example `/camera/camera/color/image_raw` rather than `/camera/color/image_raw`), and that the robot is publishing it.

The robot model does not appear
: The robot must run `robot_state_publisher`, which publishes `/robot_description`. If MITI says the topic is not published, the bridge cannot see it. With the bridge beside MITI, the robot's description package must also be on the MITI machine for its meshes.

**No transform: A → B**
: TF has no path from the topic's frame A to the frame B MITI draws in. Publish the missing transform, or choose a fixed frame that the topic's frame connects to. See {doc}`3d-scene`.

A layer is drawn in the wrong place over the camera
: See {ref}`When the overlay looks wrong <camera-overlay-problems>`.

## MITI is slow or images lag

Raw camera images are large: a 1280 × 720 image is 2.8 MB, and a few cameras can fill a Wi-Fi or VPN link. Then cameras drop to a few frames per second and other topics arrive late.

- Use compressed image topics (`.../compressed`) where the robot offers them.
- Close or hide camera panels you are not watching; MITI only receives topics that a panel shows.
- In the connection settings, choose **Prioritize robot motion** so the robot model and TF stay real-time while cameras lag.
- Run foxglove_bridge beside MITI, so the robot does not encode and send every stream itself.
