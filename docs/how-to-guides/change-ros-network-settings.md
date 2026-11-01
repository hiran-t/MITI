# Change the ROS Network Settings

On site you often don't know a robot's `ROS_DOMAIN_ID` or whether multicast works. When MITI started foxglove_bridge itself (`miti run --bridge`, or `pixi run -e <distro> miti-bridge`), you can change the bridge's ROS settings from the browser and try them right away, without a terminal.

## Change the settings

1. Click the **gear** in the status bar to open the connection settings.
2. In the **ROS network** section, set:

   ROS_DOMAIN_ID
   : Must match the robot.

   Robot IP addresses
   : The robot's IPv4 addresses, separated by commas. Leave it empty to find the robot by multicast; add it when topics are missing or come and go, which is common on Wi-Fi.

3. Click **Apply and restart bridge**.

```{figure} ../images/ros-network.webp
:alt: The connection settings with the ROS network section of the bridge beside MITI: Jazzy and Fast DDS, ROS_DOMAIN_ID 0, the robot IP address 192.168.10.27, foxglove_bridge running and the Apply and restart bridge button

The ROS network section, when MITI started the bridge.
```

MITI restarts foxglove_bridge with the new settings and reconnects by itself. The status line shows when the bridge runs again; if it stops, the line shows its last log message, and MITI keeps running so you can try other values.

## Where the settings are kept

The values are saved and used the next time MITI starts, in place of the environment variables:

| Started with                      | Saved in                               |
| --------------------------------- | -------------------------------------- |
| `miti run --bridge` (apt package) | `~/.config/miti/bridge.json`           |
| `pixi run miti-bridge`            | `.miti/bridge.json` in the MITI folder |

Delete that file to go back to the environment variables.

## When the section is read-only

With Docker, or a bridge on the robot, MITI did not start the bridge, so the section only explains where its settings belong: set `ROS_DOMAIN_ID` and `ROS_STATIC_PEERS` where that bridge runs.
