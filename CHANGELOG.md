# Changelog

## [Unreleased]

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
