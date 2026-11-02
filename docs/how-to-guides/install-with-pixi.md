# Install with pixi

[pixi](https://pixi.sh) installs Node.js and, for running miti_bridge beside MITI, ROS 2 into the MITI folder, without a system ROS install. It works on Linux (x86-64 and ARM64), macOS on Apple silicon and Windows (x86-64; see [Install on Windows](install-on-windows.md)).

## Install pixi and MITI

```bash
curl -fsSL https://pixi.sh/install.sh | sh
# open a new terminal, or: source ~/.bashrc (zsh: source ~/.zshrc)
git clone https://github.com/hiran-t/MITI.git
cd MITI
```

## Run MITI

```bash
pixi run miti          # install, build and serve MITI on http://<this machine>:3000
pixi run miti 8080     # on another port
```

The first run installs Node.js 22 and the npm packages and builds MITI. Later runs skip both unless the source changed, and start in about a second. If port 3000 is taken, MITI uses the next free port; the first lines of the output show the addresses.

To run miti_bridge beside MITI, use `pixi run -e humble miti-bridge` (or `-e jazzy`); the first run builds miti_bridge from source, which takes a few minutes. See [Run miti_bridge beside MITI](run-miti-bridge-beside-miti.md). All tasks are in the [command line reference](../reference/command-line.md#pixi-tasks).

## Start MITI at boot

On Linux, add a systemd unit. Adjust the user, the folder and the pixi path from `which pixi`:

```ini
# /etc/systemd/system/miti.service
[Unit]
Description=MITI
After=network-online.target
Wants=network-online.target

[Service]
User=robot
WorkingDirectory=/home/robot/MITI
ExecStart=/home/robot/.pixi/bin/pixi run miti
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now miti
journalctl -u miti -f
```

Use `pixi run -e humble miti-bridge` in `ExecStart` to run the bridge too.

## Update or remove

```bash
git pull
pixi run miti          # rebuilds what changed
pixi run remove        # delete builds, npm packages and pixi environments
```

`pixi run remove` keeps the source, `.env` and `ros/overlay/src`; `pixi run miti` installs everything again.
