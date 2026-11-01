# Install with apt

The apt package is the simplest way to run MITI on Ubuntu 22.04 and 24.04, on amd64 and arm64 (for example NVIDIA Jetson). It carries MITI and its own Node.js and adds the `miti` command.

## Install

```bash
curl -fsSL https://hiran-t.github.io/MITI/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miti.gpg
echo "deb [signed-by=/usr/share/keyrings/miti.gpg] https://hiran-t.github.io/MITI stable main" | sudo tee /etc/apt/sources.list.d/miti.list
sudo apt-get update
sudo apt-get install miti
```

Installing starts nothing. To install a downloaded package without the repository (no automatic updates), see [Install offline and run a kiosk screen](install-offline-and-run-a-kiosk.md).

## Run MITI in a terminal

`miti run` serves MITI until **Ctrl+C**:

```bash
miti run                  # http://<this machine>:3000
miti run --port 8080      # another port; a taken port moves to the next free one
miti run --bridge         # also foxglove_bridge beside MITI
```

`--bridge` needs foxglove_bridge from ROS's apt repository; see [Run foxglove_bridge beside MITI](run-foxglove-bridge-beside-miti.md). All options are in the [command line reference](../reference/command-line.md).

## Start MITI at boot

For a machine that serves MITI all the time, enable its service. The package installs two services, both off until enabled; they run as the `miti` user with the settings in `/etc/miti/`:

```bash
sudo systemctl enable --now miti           # MITI
sudo systemctl enable --now miti-bridge    # foxglove_bridge beside it, if wanted
systemctl status miti                      # state
journalctl -u miti -f                      # logs
sudo systemctl disable --now miti          # back to miti run
```

## Change the settings

The settings are in `/etc/miti/miti.env` (port, bridge port, robot mesh folders) and `/etc/miti/bridge.env` (the bridge's ROS settings). Variables set in the shell win, for example `ROS_DOMAIN_ID=5 miti run --bridge`. After changing them, restart a running service: `sudo systemctl restart miti`. Every setting is listed in the [configuration reference](../reference/configuration.md).

## Update or remove

```bash
sudo apt-get update && sudo apt-get upgrade    # settings are kept; running services restart
sudo apt-get remove miti                       # remove MITI
sudo apt-get purge miti                        # also delete the settings and the miti user
```
