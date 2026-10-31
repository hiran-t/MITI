# Changelog

## [Unreleased]

### Added

- Debian packages for Ubuntu 22.04 and 24.04 (amd64 and arm64) and an apt repository at `https://hiran-t.github.io/MITI`, so MITI installs with `sudo apt-get install miti`. The package includes Node.js and adds the `miti` command: `miti run` serves MITI in the terminal until Ctrl+C, with the same port handling as `pixi run miti`, and `miti run --bridge` adds foxglove_bridge from the ROS 2 in `/opt/ros`. Installing starts nothing; `miti` and `miti-bridge` systemd services start MITI at boot when enabled. Settings are in `/etc/miti/` Built and tested on Ubuntu 22.04 and 24.04 for amd64 and arm64, each on its own architecture, for every change, and published for each release by `.github/workflows/packages.yml`
- `ros/foxglove-bridge.sh` uses the ROS 2 installed in `/opt/ros` when `ROS_DISTRO` is not set and Humble is not there

- Release tags publish the MITI image to `ghcr.io/hiran-t/miti` (linux/amd64 and linux/arm64, tagged with the version and `latest`)
- A daily workflow keeps the repository's traffic (views, clones, referrers, stars) beyond GitHub's 14 days, on the `traffic` branch; it needs a `TRAFFIC_TOKEN` secret

## [3.3.4] - 2026-10-30

### Added

- ROS network settings in the browser: with `pixi run -e <distro> miti-bridge`, the connection settings set the bridge's `ROS_DOMAIN_ID` and the robot's IP addresses and restart foxglove_bridge with them; MITI reconnects on its own. The settings are saved in `.miti/bridge.json`. A bridge that stops after such a change no longer stops MITI, and the settings show its last log line

### Fixed

- `ROS_STATIC_PEERS` now works on Humble too (pixi, Windows and Docker): the bridge scripts add the robot to Fast DDS's initial peers or Cyclone DDS's peers, keeping multicast discovery
- Detecting a running foxglove_bridge no longer makes it log `Connection reset by peer`

## [3.3.3] - 2026-10-30

### Fixed

- Windows: foxglove_bridge no longer exits at start with `0xC0000135` (DLL not found); RoboStack installs `foxglove.dll` and `foxglove_cpp_shared.dll` in `Library\lib`, which the bridge script now adds to `PATH`. The harmless `WinError 1314` log-symlink warning is silenced
- `miti-bridge` and the bridge it starts now always agree on the port: the launcher also checks whether something answers on the port (on Windows a port forwarded for one address could still be opened on all addresses), and tells the bridge to use exactly that port

### Changed

- No npm warnings on install: Jest 30 (jsdom 29), ESLint 10 with a flat config (`eslint.config.mjs`, Next.js core-web-vitals rules and the Rules of Hooks), overrides for `uuid`, `three-mesh-bvh` and `test-exclude`, and current browser data; `ws` is a direct dev dependency (the load harness uses it). The npm update notice and Next.js telemetry notice no longer show in pixi output. `npm run lint` runs `eslint .`

## [3.3.2] - 2026-10-30

### Changed

- Ports move out of each other's way. `pixi run miti` and `miti-bridge` (now one Node.js launcher, `scripts/start-miti.mjs`, the same on Linux, macOS and Windows) serve MITI on the next free port when 3000 is taken; `miti-bridge` uses a foxglove_bridge already on 8765, or starts the bridge on the next free port when another program holds 8765; `pixi run miti` finds a bridge already running on this machine. MITI learns the bridge port at run time (`MITI_BRIDGE_PORT`, also set by Docker Compose from `BRIDGE_PORT`), so browsers connect without any setting
- The bridge scripts (`pixi run bridge`) name the program holding their port, with the command to stop it or, for `svchost` on Windows, to check port forwarding, then move to the next free port; a foxglove_bridge already on the port is reported instead of started twice
- The output of `pixi run miti` / `miti-bridge` lists the addresses to open, including this machine's address on the network

### Removed

- `ros/miti-with-bridge.sh` and `ros/miti-with-bridge.ps1`, replaced by `scripts/start-miti.mjs`

## [3.3.1] - 2026-10-30

### Added

- `pixi run remove` deletes everything generated (`.next`, `node_modules`, the message build in `ros/overlay`, the pixi environments) on Linux, macOS and Windows; source, `.env` and `ros/overlay/src` stay, and `pixi run miti` installs everything again
- Windows notes for the bridge being blocked by Smart App Control or App Control (`LoadLibrary error: 4551`), and for keeping MITI out of OneDrive

### Changed

- When MITI cannot reach foxglove_bridge, the notice names the address it tried and says what to do: start the bridge on the robot and enter its address, or run `pixi run -e <distro> miti-bridge`

## [3.3.0] - 2026-10-30

### Added

- Windows (x86-64) for pixi: `pixi run miti`, and `pixi run -e <distro> miti-bridge` / `bridge` / `build-msgs` through PowerShell versions of the scripts in `ros/`; the deployment guide covers installing pixi, the firewall, the Visual Studio Build Tools for message packages, starting at login, Docker Desktop and WSL 2

## [3.2.1] - 2026-10-30

### Added

- The foxglove_bridge beside MITI includes nav2's `bond` messages, so `/bond` is offered instead of logging `package 'bond' not found`
- `ROS_STATIC_PEERS` passes through Docker Compose to the bridge, so a Jazzy bridge can find the robot by IP when Wi-Fi drops multicast discovery

### Fixed

- The bridge script stops with a clear message when its port is already in use, instead of foxglove_bridge aborting with a bind error

### Changed

- Documentation rewritten for 3.2: a standard README (install with pixi, Docker or from source, foxglove_bridge on the robot or beside MITI, configuration, troubleshooting), a deployment guide with install commands for pixi, Docker, Node.js and foxglove_bridge and a pixi systemd service, and API, architecture, contributing, release, security, 3D Scene, State Machine and performance docs that match the code; issue and pull request templates ask for the ROS distro and where foxglove_bridge runs

## [3.2.0] - 2026-10-30

### Added

- `pixi run miti` installs Node.js and the npm packages, builds MITI and serves it on port 3000 (`pixi run miti 8080` for another port), with no system Node.js; later runs skip the build when nothing changed
- foxglove_bridge on the MITI machine instead of the robot: `pixi run -e humble miti-bridge` (or `-e jazzy`) runs MITI and a bridge that joins the robot's ROS 2 network over DDS, so the robot only publishes; `pixi run -e <distro> bridge` runs the bridge alone
- Docker Compose `bridge` profile (`docker compose --profile bridge up -d`) with a foxglove_bridge image (`ros/Dockerfile`, Humble by default) on host networking; ROS distro, domain ID, RMW, topic whitelist and send buffer are set in `.env`
- The bridge includes the standard message packages (common_interfaces, tf2, nav2, map, moveit, foxglove, control and vision messages); the robot's own message packages go in `ros/overlay/src` and are built with `pixi run -e <distro> build-msgs` or into the Docker image
- Cyclone DDS settings for large messages over Wi-Fi (`ros/cyclonedds.xml`)

### Changed

- Without `NEXT_PUBLIC_BRIDGE_URL`, MITI connects to `ws://<host MITI was served from>:8765` instead of `ws://localhost:8765`, so browsers on other machines reach a bridge running beside MITI
- Docker Compose runs MITI as the `miti` service; `NEXT_PUBLIC_BRIDGE_URL` is a build argument (it was set at run time, where it had no effect); the image installs from `package-lock.json` with `npm ci` and uses Node.js 22

## [3.1.1] - 2026-10-30

### Removed

- Unused code: `LayoutConfig`, `TopicDataDisplay`, `PointCloudRenderer` and `ViewerControls` components, the `useUrdfConfig` hook, the `dashboard` and `layout-config` style modules, and unused style groups
- Unused `public/icon.png` (left over from the Electron build)
- Unused dependencies `zustand`, `clsx` and `@jest/globals`

## [3.1.0] - 2026-10-30

### Added

- Camera panel works like Foxglove's Image panel:
  - Calibration topic (Auto = `<image dir>/camera_info`, None, or any CameraInfo topic) and a Topics section that draws point clouds, laser scans, occupancy grids and costmaps, poses, paths, markers and robot models over the image, projected through the camera intrinsics and placed with TF; Sync timestamps uses TF at the image stamp
  - Color mode for mono and depth images: Gradient or color map (Turbo, Rainbow) with Value min/max
  - Flip horizontal/vertical and rotation 0/90/180/270°, applied to the image and overlays alike
  - Rectify undistorts plumb_bob and rational_polynomial lenses on the GPU
  - Without calibration or TF the plain image stays visible with a message
- Load harness for performance work: `scripts/heavy-bridge.js` (a robot-sized foxglove_bridge stand-in) and `scripts/perf-run.js` (measures frame rate, long tasks and main-thread time in Chrome); see `docs/PERFORMANCE.md`

### Changed

- The UI stays smooth under heavy robot data: images, point clouds and maps are decoded in Web Workers, frames a panel would throttle away are not decoded, point clouds reuse their geometry, TF and path lines no longer recompile a shader every frame, log rows are memoized, and panels hidden behind an expanded panel do no render work. On a CPU slowed 4×, long tasks went from 32–36 per 20 s to none and the worst frame from 67 ms to 17 ms
- Camera panels default to a maximum of 15 fps (panels that set a value keep it)

## [3.0.1] - 2026-10-30

### Changed

- Camera panel stats (resolution, rate, frame size, lag and time) moved from an overlay on the image to the panel's tab bar; in narrow panels the time and frame size hide first, then the resolution
- Log panel node names each get their own color, assigned in the order nodes first log and kept while the panel is open; amber and red stay reserved for WARN and ERROR

## [3.0.0] - 2026-10-30

### Changed

- New MITI look in the style of VS Code and JetBrains, replacing the Foxglove-like styling: neutral dark grays, a muted teal accent (`#2fb4c4`) used only for active, selected and focus states, and status colors (ok, warning, error) used only for real state
- Workspace shell rearranged without changing any workflow:
  - one title bar with the MITI logo, the layout name, Reset layout and Add panel (now icon buttons)
  - an activity bar on the left replaces the Sidebar button and the sidebar tabs (Panel, Topics, Problems, Sources); clicking the open view closes the sidebar, and arrow keys move between views
  - a status bar at the bottom shows the connection (address, state and connection settings), the problem count, the panel count and the app version
- Panel headers are tabs (icon, title, close) with expand and lock on the right; the selected panel's tab has a teal top line; panels are separated by 1px seams with square corners
- Topic list, settings tree, Log panel, connection dialog, State Machine and Button Switch panels restyled to match
- 3D Scene default colors (paths, poses, camera frustums, TF lines, publish tool) use the MITI cyan `#15FBFF` instead of purple
- All UI colors come from tokens in `src/lib/theme.ts`, exposed as `--miti-*` CSS variables and Tailwind colors (`accent`, `ok`, `warn`, `danger`, `surface-*`)

### Removed

- Camera panel presets (Color, Detection, Depth and IR buttons); choose the image topic in the Image Topic field

## [2.2.0] - 2026-10-30

### Added

- Log panel, modelled on Foxglove's: streams `/rosout` (`rcl_interfaces/msg/Log`, also ROS 1 and `foxglove.Log`), filters by minimum level, search chips matching node names or message text, and hidden node names; display options for font size, level, date, time, time zone, node name and source location; copy and clear
- 3D Scene per-topic display settings like Foxglove's: point clouds and laser scans get point size in pixels, circle or square points, decay time, color modes (flat, color map with Turbo or Rainbow, gradient, RGB, RGBA) on any field with automatic or fixed value range, and stixel view; occupancy grids get Custom, Map, Costmap and Raw palettes with min, max, unknown and invalid colors, frame lock and draw behind
- Color fields in settings accept typed hex values, including `#rrggbbaa` with alpha
- Poses, poses with covariance (new layer type, e.g. `/amcl_pose`), pose arrays, odometry and paths display as axes, arrows (shaft and head length and width) or a gradient line with width in meters, as in Foxglove; poses with covariance and odometry draw a covariance ellipsoid
- Robot description settings like Foxglove's: Control mode (Joint states or Manual), a Joint states section listing every movable joint with live positions or manual sliders, a Links section with per-link visibility, opacity, mesh outlines and link axes
- Marker topics list their namespaces with visibility toggles
- The sidebar resizes by dragging its edge (double-click resets it); the width is remembered

### Changed

- Point clouds and laser scans are colored automatically like Foxglove (the message's own colors, else intensity on a color map, else flat), and their point size is in screen pixels instead of meters
- Panels tile the workspace like Foxglove's layout (react-mosaic) instead of a block grid: drag a panel's header onto an edge of another panel to split it there, drag the dividers to resize, and new panels open beside the selected one; saved layouts are converted automatically, and `react-grid-layout` is removed
- Poses default to axes, pose arrays and odometry to arrows, and paths to a line, as in Foxglove; the old arrow size setting is replaced by axis scale and arrow dimensions

## [2.1.0] - 2026-10-29

### Changed

- MITI connects to [foxglove_bridge](https://github.com/foxglove/foxglove-sdk) (Foxglove WebSocket protocol, default `ws://localhost:8765`) instead of rosbridge_server; messages are CDR-decoded in the browser using the schemas the bridge advertises
- `NEXT_PUBLIC_ROSBRIDGE_URL` renamed to `NEXT_PUBLIC_BRIDGE_URL`; a rosbridge URL saved in the browser is migrated to the same host on port 8765
- 3D Scene settings follow Foxglove's 3D panel (Frame, Scene, View, Transforms, Topics, Custom layers, Publish); MITI 2.0 layouts are migrated
- Data is placed with TF at its own timestamp by default; TF history holds 30 s / 3,000 samples per frame

### Added

- Streaming modes: Synchronized (one connection, default) and Prioritize robot motion (separate connections for heavy topics)
- Robot models follow TF per link; URDF layers from URL, file path, parameter or topic; meshes fetched through the bridge and cached in the browser, with `/api/package` and `/api/file` server fallbacks
- Click-to-publish points, poses and pose estimates; grid layers; render stats; two-way View camera settings
- Camera panels: canvas drawing, `CompressedImage`, optional Max FPS, frame rate, frame size and lag in the status bar
- Topic fields commit on Enter or blur, with ROS name validation and type mismatch warnings

### Fixed

- Topic list loading after connect, stale client after changing the bridge address, service call id collisions
- Occupancy grid and point cloud decoding from CDR; topic inspector freezing on large messages

## Earlier

```markdown
### Added

- Initial project setup
- ROS2 rosbridge WebSocket integration
- URDF robot model viewer with real-time joint states
- Point cloud visualization
- TF (Transform) visualization
- Topic browser and live data monitoring
- Camera image viewer
- Draggable widget dashboard system
- Dark theme UI with Tailwind CSS
- Auto-reconnection on connection loss
- Persistent layout configuration
- Connection settings with custom rosbridge URL
- URDF loading from URL or ROS topic
- **State Machine Monitoring**
  - SMACC2 state machine visualization and monitoring
  - BehaviorTree.CPP execution monitoring
  - State diagram visualization
  - Transition history tracking
  - Tree structure visualization
  - Node status indicators
  - Execution statistics and logs
```
