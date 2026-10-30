# Changelog

## [Unreleased]

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
