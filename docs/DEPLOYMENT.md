# Deployment Guide

How to run MITI on a machine and how to give it a foxglove_bridge to talk to.

## Contents

- [Choose a way to run MITI](#choose-a-way-to-run-miti)
- [Install the tools](#install-the-tools)
- [pixi](#pixi)
- [Docker Compose](#docker-compose)
- [From source](#from-source)
- [foxglove_bridge on the robot](#foxglove_bridge-on-the-robot)
- [foxglove_bridge Beside MITI](#foxglove_bridge-beside-miti)
- [Windows](#windows)
- [Kiosk and offline installs](#kiosk-and-offline-installs)
- [Reverse proxy and HTTPS](#reverse-proxy-and-https)
- [Environment Variables](#environment-variables)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)

## Choose a way to run MITI

| Way                               | Good for                                    | Needs                                                     |
| --------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| [pixi](#pixi)                     | Laptops, robots' companion PCs, trying MITI | pixi only; it installs Node.js and, for the bridge, ROS 2 |
| [Docker Compose](#docker-compose) | A machine that serves MITI all the time     | Docker with Compose v2                                    |
| [From source](#from-source)       | Developing MITI                             | Node.js 22 and npm (or Bun)                               |

Any of them serves MITI on port 3000 to every browser on the network. MITI then needs a foxglove_bridge: [on the robot](#foxglove_bridge-on-the-robot), or [beside MITI](#foxglove_bridge-beside-miti) on the same machine.

## Install the tools

**pixi** (Linux and macOS):

```bash
curl -fsSL https://pixi.sh/install.sh | sh
# open a new terminal, or: source ~/.bashrc (zsh: source ~/.zshrc)
pixi --version
```

**pixi** (Windows, in PowerShell; then open a new terminal):

```powershell
powershell -ExecutionPolicy ByPass -c "irm -useb https://pixi.sh/install.ps1 | iex"
pixi --version
```

**Docker** (Ubuntu):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # log out and in again to use docker without sudo
sudo systemctl enable --now docker # start Docker at boot, so MITI comes back after a restart
docker compose version
```

**Node.js 22** (only to build from source), for example with [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22
```

**MITI** itself:

```bash
git clone https://github.com/hiran-t/MITI.git
cd MITI
```

## pixi

```bash
pixi run miti          # install, build and serve MITI on http://<this machine>:3000
pixi run miti 8080     # on another port
pixi run remove        # delete builds, npm packages and pixi environments
pixi run dev           # development server with hot reload
```

Ports move out of the way by themselves: if 3000 is taken, MITI uses the next free port, and `miti-bridge` uses a foxglove_bridge already on 8765 or, when another program holds 8765, starts the bridge on the next free port. MITI is told the bridge's port, so browsers connect without any setting; the first lines of the output show the addresses.

The first run installs Node.js 22 and the npm packages and builds MITI. Later runs skip both unless `package-lock.json` or the source changed, and start in about a second. Supported: Linux x86-64 and ARM64, macOS on Apple silicon, Windows x86-64 ([notes](#windows)).

| Task                                      | What it does                                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixi run miti [port]`                    | Build if needed and serve MITI                                                                                                                                                     |
| `pixi run dev`                            | Development server                                                                                                                                                                 |
| `pixi run -e <distro> miti-bridge [port]` | MITI and foxglove_bridge together ([beside MITI](#foxglove_bridge-beside-miti))                                                                                                    |
| `pixi run -e <distro> bridge`             | foxglove_bridge only                                                                                                                                                               |
| `pixi run -e <distro> build-msgs`         | Build the robot's message packages in `ros/overlay/src`                                                                                                                            |
| `pixi run remove`                         | Delete `.next`, `node_modules`, the message build in `ros/overlay` and the pixi environments; source, `.env` and `ros/overlay/src` stay. `pixi run miti` installs everything again |

`<distro>` is `humble` or `jazzy`. Don't build MITI (`pixi run miti`, `npm run build`) while `next dev` runs from the same folder: both use `.next`, and the dev server stops serving pages until it is restarted.

### As a service with pixi

To start MITI at boot without Docker, add a systemd unit (adjust the user, folder and the pixi path from `which pixi`):

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

## Docker Compose

[docker-compose.yml](../docker-compose.yml) runs MITI as the `miti` service with `restart: unless-stopped`, so it comes back after a restart once Docker starts at boot.

```bash
cp .env.example .env                    # optional settings
docker compose up -d                    # MITI only
docker compose --profile bridge up -d   # MITI and foxglove_bridge beside it
docker compose logs -f                  # follow logs
docker compose ps                       # status
docker compose down                     # stop
```

### Without Compose

Released versions are published as an image (linux/amd64 and linux/arm64), so no build is needed:

```bash
docker run -d --restart unless-stopped -p 3000:3000 --name miti ghcr.io/hiran-t/miti:latest
```

Or build it yourself:

```bash
docker build -t miti:latest .
docker run -d --restart unless-stopped -p 3000:3000 --name miti miti:latest
```

`NEXT_PUBLIC_BRIDGE_URL` is built into the app, so pass it as a build argument: `docker build --build-arg NEXT_PUBLIC_BRIDGE_URL=ws://robot:8765 -t miti:latest .`. Setting it with `docker run -e` has no effect.

## From source

```bash
npm ci
npm run build
npm start                          # http://localhost:3000
npm start -- --hostname 0.0.0.0    # reachable from other machines
```

`STANDALONE_BUILD=true npm run build` produces a self-contained server in `.next/standalone` (used by the Docker image and `scripts/deploy.sh`). Bun works too: `bun install`, `bun run build`, `bun run start`.

## foxglove_bridge on the robot

Install foxglove_bridge with the robot's ROS 2 (replace `humble` with `jazzy` on Jazzy):

```bash
sudo apt update
sudo apt install ros-humble-foxglove-bridge
```

Start it:

```bash
source /opt/ros/humble/setup.bash
ros2 launch foxglove_bridge foxglove_bridge_launch.xml   # port 8765
```

Open MITI and set the address in the connection settings (gear in the status bar) to `ws://<robot-ip>:8765`, or build MITI with `NEXT_PUBLIC_BRIDGE_URL=ws://<robot-ip>:8765` so it opens there by default.

Useful launch arguments: `port:=8765`, `topic_whitelist:="['/tf.*','/joint_states']"`, `send_buffer_limit:=10000000`. To start it at boot, add it to the robot's launch files or a systemd unit that sources ROS first.

## foxglove_bridge Beside MITI

Instead of running foxglove_bridge on the robot, run it on the MITI machine. It joins the robot's ROS 2 network over DDS and subscribes only to the topics someone is viewing; the robot just publishes as usual, and the bridge's work (subscribing, encoding, one WebSocket stream per browser) moves off the robot.

```
robot (ROS 2 nodes) ──DDS──▶ MITI machine: foxglove_bridge :8765 + MITI :3000 ◀── browsers
```

Requirements: both machines on the same network, the same `ROS_DOMAIN_ID`, and the bridge on the robot's ROS 2 distro (Humble and Jazzy do not discover each other reliably). Nothing has to be installed on the robot.

### With pixi

pixi installs ROS 2 and foxglove_bridge from [RoboStack](https://robostack.github.io/) into the project; no system ROS install is needed.

```bash
pixi run -e humble miti-bridge   # MITI and foxglove_bridge together (-e jazzy for a Jazzy robot)
pixi run -e humble bridge        # foxglove_bridge only
```

Settings are environment variables, for example `ROS_DOMAIN_ID=5 pixi run -e humble miti-bridge`.

**Change them from the browser.** With `miti-bridge`, the connection settings (gear in MITI's status bar) have a **ROS network** section: `ROS_DOMAIN_ID` and the robot's IP addresses. **Apply and restart bridge** restarts foxglove_bridge with them and MITI reconnects on its own, so settings found on site can be tried without a terminal. They are saved in `.miti/bridge.json` and used on the next start in place of the environment variables; delete that file (or run `pixi run remove`) to go back to the environment. If the bridge stops after a change, MITI keeps running and the section shows its last log line. The section is read-only information with Docker or a bridge on the robot, where the settings belong to that bridge.

### With Docker Compose

```bash
docker compose --profile bridge up -d
```

Set the distro and DDS settings in `.env` first (copy [.env.example](../.env.example)); put `COMPOSE_PROFILES=bridge` there to start the bridge on every `docker compose up`. The bridge image (`ros/Dockerfile`, based on `ros:<distro>-ros-base`) runs with host networking, which DDS discovery needs, so this runs on Linux; Docker Desktop on macOS and Windows cannot join the robot's DDS network.

### Settings

Environment variables, read by `ros/foxglove-bridge.sh` (pixi and Docker alike):

| Variable                   | Default            |                                                                                  |
| -------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `ROS_DOMAIN_ID`            | `0`                | Must match the robot                                                             |
| `RMW_IMPLEMENTATION`       | `rmw_fastrtps_cpp` | Or `rmw_cyclonedds_cpp`, which reads [ros/cyclonedds.xml](../ros/cyclonedds.xml) |
| `ROS_DISTRO`               | `humble`           | Docker only; with pixi choose `-e humble` / `-e jazzy`                           |
| `BRIDGE_PORT`              | `8765`             | WebSocket port                                                                   |
| `BRIDGE_TOPIC_WHITELIST`   | `['.*']`           | Regexes of topics to offer                                                       |
| `BRIDGE_SEND_BUFFER_LIMIT` | `10000000`         | Bytes queued per browser before messages are dropped                             |
| `BRIDGE_MAX_QOS_DEPTH`     | `10`               | Subscription queue depth                                                         |
| `ROS_STATIC_PEERS`         | —                  | The robot's IPv4 addresses (`a;b`), to find it where multicast is dropped        |

MITI opens `ws://<host it was opened from>:<bridge port>` by default, which is this bridge: `pixi run miti` / `miti-bridge` and Docker Compose tell it the port (`MITI_BRIDGE_PORT`). If `BRIDGE_PORT` is taken by another program, the bridge moves to the next free port and says so; if a foxglove_bridge already listens there, it is used.

### The robot's own message types

The bridge can only offer topics whose message definitions are installed beside it. The standard packages (`common_interfaces`, `tf2_msgs`, `nav2_msgs`, `map_msgs`, `moveit_msgs`, `foxglove_msgs`, `control_msgs`, `vision_msgs`, and nav2's `bond`) are included. For the robot's own packages (for example `oc_g1_msgs`), copy their source into `ros/overlay/src` and build them:

```bash
cp -r ~/robot_ws/src/oc_g1_msgs ros/overlay/src/
pixi run -e humble build-msgs            # pixi; restart the bridge afterwards
docker compose --profile bridge build    # Docker builds them into the image
```

Topics of types that are still missing are left out, and the bridge logs `package '...' not found` each time the topic graph changes.

### Robot meshes

The bridge serves `package://` meshes of the robot model from the packages installed beside it. With the bridge beside MITI, the robot's description package (meshes) must be on the MITI machine too: build it into the overlay like a message package, or point MITI's mesh fallback at it with `MITI_PACKAGE_PATH`.

### Network and DDS

DDS carries every message the bridge subscribes to from the robot to this machine, so the link still decides how much fits:

- **Use compressed images.** A raw 1280×720 image is 2.7 MB; on a test network a raw camera reached this machine at about 2.5 frames per second, while joint states (40 Hz), TF and odometry arrived in full. Subscribe MITI to `/compressed` image topics, or offer only those with `BRIDGE_TOPIC_WHITELIST`.
- **Discovery over Wi-Fi** relies on multicast, which Wi-Fi often drops; topics then come and go. List the robot directly: its IP in MITI's connection settings (**ROS network**), or `ROS_STATIC_PEERS=<robot-ip>` (in `.env` for Docker; exported before `pixi run` with pixi). Jazzy reads `ROS_STATIC_PEERS` itself; on Humble the bridge script adds the address to Fast DDS's initial peers (a generated profile, unless `FASTRTPS_DEFAULT_PROFILES_FILE` is already set) or to Cyclone DDS's peers. Multicast discovery keeps working alongside.
- **Large messages over Wi-Fi** need big socket buffers. With Cyclone DDS, [ros/cyclonedds.xml](../ros/cyclonedds.xml) asks for up to 16 MB; raise the kernel limit once on Linux: `sudo sysctl -w net.core.rmem_max=16777216` (add it to `/etc/sysctl.conf` to keep it).
- **Several networks** (Wi-Fi, Ethernet, Docker): pin the robot's network with `<NetworkInterface name="..."/>` in `ros/cyclonedds.xml` if discovery picks the wrong one.
- The first subscription can take a few seconds while DDS discovery settles; later ones are immediate.
- `sequence size exceeds remaining buffer` or `invalid data size` in the bridge log means the robot runs another ROS 2 distro: Humble cannot read Iron/Jazzy discovery data. Use the matching environment (`-e jazzy`) or `ROS_DISTRO` in Docker.
- `Port 8765 is used by <process> (PID …); foxglove_bridge uses 8766 instead`: another program holds the port, so the bridge moved; `pixi run miti` and `miti-bridge` find it. To keep 8765, stop that program (the message shows the command).

## Windows

pixi runs MITI and foxglove_bridge on Windows 10 and 11 (x86-64) with the same commands as on Linux; the bridge tasks run the PowerShell versions of the scripts in `ros/` (`*.ps1`). Windows support is new; please report problems.

```powershell
pixi run miti                       # MITI on http://<this machine>:3000
pixi run -e humble miti-bridge      # MITI and foxglove_bridge beside it (-e jazzy for Jazzy)
pixi run -e humble bridge           # foxglove_bridge only
```

Settings are environment variables, set before `pixi run`:

```powershell
$env:ROS_DOMAIN_ID = "5"
$env:ROS_STATIC_PEERS = "192.168.10.27"   # find the robot by IP
pixi run -e jazzy miti-bridge
```

**Firewall.** The first start asks whether to allow Node.js, Python and foxglove_bridge on the network; allow them on private networks. Or open the ports once, in PowerShell as administrator:

```powershell
New-NetFirewallRule -DisplayName "MITI web and bridge" -Direction Inbound -Protocol TCP -LocalPort 3000,8765 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "ROS 2 DDS" -Direction Inbound -Protocol UDP -LocalPort 7400-7700 -Action Allow -Profile Private
```

Set the network the robot is on to _Private_ (Settings > Network > Properties); public networks block discovery.

**The robot's own messages.** `build-msgs` compiles C++ and needs the Visual Studio 2022 Build Tools with the C++ workload, installed once:

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

**Start at login.** Use Task Scheduler, for example (adjust the folder):

```powershell
schtasks /Create /TN MITI /SC ONLOGON /TR "cmd /c cd /d C:\MITI && pixi run miti"
```

**Port 8765 used by `svchost`**: a Windows service holds the port, usually IP Helper forwarding it with `netsh interface portproxy` (often set up for WSL). The bridge moves to the next free port by itself and MITI follows. To free 8765, check with `tasklist /svc /fi "PID eq <pid>"` and `netsh interface portproxy show all`, and remove an unused forward in an administrator PowerShell: `netsh interface portproxy delete v4tov4 listenport=8765 listenaddress=0.0.0.0`.

**Keep MITI out of OneDrive.** Put the folder somewhere like `C:\MITI`, not under `Desktop` or `Documents` when those sync to OneDrive: pixi installs thousands of files in `.pixi`, which OneDrive then tries to upload.

**Bridge fails with `LoadLibrary error: 4551`** (for example on `rmw_fastrtps_cpp.dll`): Windows blocked a library pixi downloaded, because it is not signed. Error 4551 means _An Application Control policy has blocked this file_: Smart App Control (Windows 11) or an App Control policy set by your organization. To confirm, run in PowerShell:

```powershell
(Get-MpComputerStatus).SmartAppControlState     # On / Evaluation / Off
Get-WinEvent -LogName "Microsoft-Windows-CodeIntegrity/Operational" -MaxEvents 20 |
  Where-Object Id -in 3033,3077 | Format-List TimeCreated, Message
```

Then, depending on the machine:

- **Smart App Control is On or Evaluation**: turn it off in Windows Security > App & browser control > Smart App Control. Windows can only turn it back on by resetting or reinstalling Windows.
- **A company-managed PC**: ask IT to allow the MITI folder (its `.pixi` directory), or use one of the options below.
- **Without changing Windows**: run the bridge in **WSL 2** (mirrored networking, as below) with `pixi run -e humble bridge` there, and MITI on Windows with `pixi run miti`; or run foxglove_bridge on the robot.

**Docker Desktop** can run MITI (`docker compose up -d`) but not the `bridge` profile, which needs Linux host networking. **WSL 2** works like Linux for MITI itself; for the bridge, turn on mirrored networking (`networkingMode=mirrored` in `%UserProfile%\.wslconfig`, Windows 11) so DDS can reach the robot.

## Kiosk and offline installs

For a screen on the shop floor, or a machine without internet:

- `scripts/deploy.sh` (on a build machine) packs MITI as a Docker image (`miti-docker.tar`) or a standalone build (`miti-standalone.tar.gz`).
- `scripts/ubuntu-setup.sh` (on the target, next to the package) loads the image and starts it with `--restart unless-stopped`, or installs the standalone build as the systemd service `miti.service` from `scripts/auto-startapp.service`.
- `scripts/auto-launch-browser.sh` with `scripts/miti-browser.desktop` opens Chrome or Chromium in kiosk mode on `http://localhost:3000` after login.

## Reverse proxy and HTTPS

Behind nginx, forward WebSocket upgrades. A page served over HTTPS can only open `wss://` bridges; MITI's default then becomes `wss://<host>:8765`, so terminate TLS for the bridge as well (for example a second `server` block proxying to port 8765), or use foxglove_bridge's own `tls:=true certfile:=... keyfile:=...`.

```nginx
server {
    listen 80;
    server_name miti.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Environment Variables

MITI reads these from `.env` / `.env.local` at build time and from the environment at run time. Copy [.env.example](../.env.example) to start.

| Variable                 | Default                                 | Meaning                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_BRIDGE_URL` | `ws://<host MITI was opened from>:8765` | Bridge address MITI opens first. Built into the app: rebuild after changing it. The address chosen in the connection settings always wins and is remembered per browser. Replaces the former `NEXT_PUBLIC_ROSBRIDGE_URL` |
| `PORT`                   | `3000`                                  | Port for `npm start` / the standalone server                                                                                                                                                                             |
| `MITI_PORT`              | `3000`                                  | Port Docker Compose publishes                                                                                                                                                                                            |
| `MITI_BRIDGE_PORT`       | `8765`                                  | Bridge port the page tells browsers, read at run time; set by `pixi run miti` / `miti-bridge` and by Docker Compose from `BRIDGE_PORT`                                                                                   |
| `MITI_PACKAGE_PATH`      | —                                       | Extra ROS package directories for MITI's `/api/package` mesh fallback (`AMENT_PREFIX_PATH` / `ROS_PACKAGE_PATH` are read too). Meshes normally come through foxglove_bridge                                              |
| `COMPOSE_PROFILES`       | —                                       | `bridge` to start foxglove_bridge with every `docker compose up`                                                                                                                                                         |

The bridge's variables are listed under [Settings](#settings).

## Updating

```bash
git pull
pixi run miti                  # pixi rebuilds what changed
docker compose up -d --build   # Docker
npm ci && npm run build        # from source
```

## Troubleshooting

| Problem                                     | What to check                                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Status bar says Disconnected                | foxglove_bridge runs and port 8765 is reachable (firewall: `sudo ufw allow 8765/tcp`); the address in the connection settings |
| Connected, but a panel waits for data       | The panel's topic exists (Topics in the activity bar); topic names differ between robots                                      |
| 3D Scene looks empty                        | _Display frame_ is a robot frame; topics are turned on (eye icons)                                                            |
| Bridge beside MITI sees few or no topics    | Same `ROS_DOMAIN_ID` and distro as the robot; [Network and DDS](#network-and-dds)                                             |
| Bridge log: `package '...' not found`       | [Add the message package](#the-robots-own-message-types)                                                                      |
| Robot model without meshes                  | [Robot meshes](#robot-meshes)                                                                                                 |
| `pixi run miti` fails in `npm ci`           | `pixi run remove`, then `pixi run miti`                                                                                       |
| Dev server shows a blank page after a build | Restart `npm run dev`; builds and the dev server share `.next`                                                                |
| Container restarts                          | `docker compose logs miti`; `docker stats` for memory                                                                         |
