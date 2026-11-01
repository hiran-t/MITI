# Configuration

MITI and the foxglove_bridge beside it are configured with environment variables. Where to set them depends on how MITI runs:

| MITI runs with  | Set the variables in                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| The apt package | `/etc/miti/miti.env` and `/etc/miti/bridge.env`; variables set in the shell win                         |
| pixi            | The shell, before `pixi run`, or `.env` in the MITI folder                                              |
| Docker Compose  | `.env` in the MITI folder (copy [.env.example](https://github.com/hiran-t/MITI/blob/main/.env.example)) |
| From source     | `.env` / `.env.local` at build time, and the environment at run time                                    |

## MITI

| Variable                 | Default   | Meaning                                                                                                                                                          |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MITI_PORT`              | `3000`    | Port MITI serves on; a taken port moves to the next free one                                                                                                     |
| `MITI_HOST`              | `0.0.0.0` | Address MITI listens on; `0.0.0.0` serves every network                                                                                                          |
| `BRIDGE_PORT`            | `8765`    | Port of foxglove_bridge; browsers connect to `ws://<host MITI was opened from>:<port>`                                                                           |
| `MITI_PACKAGE_PATH`      | —         | Extra ROS package folders, separated by `:`, for robot meshes when foxglove_bridge does not serve them (`AMENT_PREFIX_PATH` and `ROS_PACKAGE_PATH` are read too) |
| `NEXT_PUBLIC_BRIDGE_URL` | —         | Bridge address MITI opens first, built into the app: rebuild after changing it. The address chosen in the connection settings always wins                        |
| `PORT`                   | `3000`    | Port for `npm start` when running from source                                                                                                                    |
| `COMPOSE_PROFILES`       | —         | `bridge` to start foxglove_bridge with every `docker compose up`                                                                                                 |

## Bridge beside MITI

Read by `ros/foxglove-bridge.sh` with every way of running the bridge beside MITI:

| Variable                   | Default            | Meaning                                                                                                                 |
| -------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `ROS_DOMAIN_ID`            | `0`                | Must match the robot                                                                                                    |
| `ROS_STATIC_PEERS`         | —                  | The robot's IPv4 addresses (`a;b`), to find it where multicast is dropped                                               |
| `RMW_IMPLEMENTATION`       | `rmw_fastrtps_cpp` | Or `rmw_cyclonedds_cpp`, which reads [ros/cyclonedds.xml](https://github.com/hiran-t/MITI/blob/main/ros/cyclonedds.xml) |
| `ROS_DISTRO`               | `humble`           | The ROS 2 in `/opt/ros` (apt package) or the image (Docker); with pixi choose `-e humble` or `-e jazzy`                 |
| `BRIDGE_PORT`              | `8765`             | WebSocket port                                                                                                          |
| `BRIDGE_TOPIC_WHITELIST`   | `['.*']`           | Regular expressions of the topics to offer                                                                              |
| `BRIDGE_SEND_BUFFER_LIMIT` | `10000000`         | Bytes queued per browser before messages are dropped                                                                    |
| `BRIDGE_MAX_QOS_DEPTH`     | `10`               | Subscription queue depth                                                                                                |

`ROS_DOMAIN_ID` and `ROS_STATIC_PEERS` can also be changed from the browser when MITI started the bridge; those values are saved and win over the variables (see [Change the ROS network settings](../how-to-guides/change-ros-network-settings.md)).
