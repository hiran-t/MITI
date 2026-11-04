# Command Line

## The miti command

The apt package adds the `miti` command.

| Command                  | What it does                                                                     |
| ------------------------ | -------------------------------------------------------------------------------- |
| `miti run`               | Serves MITI in this terminal until **Ctrl+C**, on port 3000 or the next free one |
| `miti run --port <port>` | Serves MITI on another port; a taken port still moves to the next free one       |
| `miti run --bridge`      | Also starts miti_bridge beside MITI, from the ROS 2 in `/opt/ros`                |
| `miti version`           | Shows the installed version                                                      |
| `miti --help`            | Shows the options                                                                |

`miti run` reads `/etc/miti/miti.env` and `/etc/miti/bridge.env`; variables set in the shell win (see [Configuration](configuration.md)). If a bridge already runs on the bridge port, `miti run` uses it instead of starting another.

## Services

The apt package installs two systemd services, both off until enabled. They run as the `miti` user with the same settings as `miti run`.

| Service       | Runs                    |
| ------------- | ----------------------- |
| `miti`        | MITI                    |
| `miti-bridge` | miti_bridge beside MITI |

```bash
sudo systemctl enable --now miti     # start now and at boot
sudo systemctl restart miti          # after changing the settings
sudo systemctl disable --now miti    # stop, and don't start at boot
journalctl -u miti -f                # logs
```

## pixi tasks

Run from the MITI folder. `<distro>` is `humble` or `jazzy`.

| Task                                      | What it does                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixi run miti [port]`                    | Installs and builds what is needed, then serves MITI                                                                                                                                  |
| `pixi run dev`                            | Development server with hot reload                                                                                                                                                    |
| `pixi run -e <distro> miti-bridge [port]` | MITI and miti_bridge beside it (on Windows, the bridge that pixi installs there)                                                                                                      |
| `pixi run -e <distro> bridge`             | miti_bridge only (on Windows, the bridge that pixi installs there)                                                                                                                    |
| `pixi run -e <distro> build-bridge`       | Builds miti_bridge from the MITI SDK's source into `ros/miti-sdk/`; the two tasks above run it first when needed                                                                      |
| `pixi run -e <distro> build-msgs`         | Builds the robot's message packages in `ros/overlay/src`                                                                                                                              |
| `pixi run remove`                         | Deletes `.next`, `node_modules`, the message build in `ros/overlay`, the miti_bridge build in `ros/miti-sdk` and the pixi environments; the source, `.env` and `ros/overlay/src` stay |

Don't build MITI (`pixi run miti`, `npm run build`) while `pixi run dev` runs from the same folder: both use `.next`.

## Docker Compose

Run from the MITI folder.

| Command                                 | What it does                                       |
| --------------------------------------- | -------------------------------------------------- |
| `docker compose up -d`                  | Starts MITI as a service                           |
| `docker compose --profile bridge up -d` | Starts MITI and miti_bridge beside it (Linux only) |
| `docker compose up -d --build`          | Rebuilds after updating MITI                       |
| `docker compose logs -f`                | Follows the logs                                   |
| `docker compose down`                   | Stops everything                                   |
