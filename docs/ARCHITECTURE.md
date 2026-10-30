# Architecture

This document describes how MITI is built and why, as of v3.2.0. For hook and function
signatures see [API.md](API.md); for running MITI see [DEPLOYMENT.md](DEPLOYMENT.md).

## Table of contents

- [Overview](#overview)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Data flow](#data-flow)
- [Key components](#key-components)
- [State management](#state-management)
- [Performance considerations](#performance-considerations)
- [Design patterns](#design-patterns)
- [Error handling](#error-handling)
- [Security considerations](#security-considerations)
- [Deployment](#deployment)
- [Future improvements](#future-improvements)

## Overview

MITI is a web application for visualizing ROS 2 robots and sensor data live. It runs in the
browser and connects over WebSocket to [foxglove_bridge](https://github.com/foxglove/foxglove-sdk)
using the Foxglove WebSocket protocol (since MITI 2.1; earlier versions used rosbridge). The
bridge sends messages as CDR together with their schemas, and MITI decodes them in the browser.

MITI's own Next.js server only serves the app and, when the bridge cannot serve robot assets,
meshes and URDFs from the local ROS workspace. ROS data never passes through it.

The bridge can run on the robot:

```
┌──────────────┐  HTTP (port 3000)  ┌──────────────┐
│   Browser    │ ◄────────────────► │ MITI server  │
│  (MITI app)  │                    └──────────────┘
│              │  WebSocket (8765)  ┌──────────────┐   ROS 2 (DDS)   ┌──────────────┐
│              │ ◄────────────────► │ foxglove_    │ ◄─────────────► │  ROS 2 nodes │
└──────────────┘                    │ bridge       │   same machine  │  (robot)     │
                                    └──────────────┘                 └──────────────┘
```

Or beside MITI on another machine, joined to the robot's ROS 2 network over DDS
(`pixi run miti-bridge`, or the Docker Compose `bridge` profile):

```
┌──────────────┐  HTTP + WebSocket  ┌──────────────────────────┐   ROS 2 (DDS)   ┌──────────────┐
│   Browser    │ ◄────────────────► │ MITI server              │ ◄─────────────► │  ROS 2 nodes │
│  (MITI app)  │   3000 and 8765    │ + foxglove_bridge        │    network      │  (robot)     │
└──────────────┘                    └──────────────────────────┘                 └──────────────┘
```

By default the browser connects to port 8765 on the host that served MITI, so the second setup
works without configuration. `NEXT_PUBLIC_BRIDGE_URL` fixes the address at build time, and the
connection settings change it per browser.

## Technology stack

### Frontend

- **Next.js 14** with the App Router. The dashboard is a client component loaded with
  `ssr: false`.
- **React 18** and **TypeScript 5.9**.
- **Tailwind CSS 3**, with colors backed by `--miti-*` CSS variables from `lib/theme.ts`. Class
  strings are grouped in `styles/*.styles.ts` and combined with a local `cn()` helper.
- **react-mosaic-component** for the tiled panel layout (the model Foxglove's layout uses).
- **lucide-react** for icons.
- **Node.js 22 with npm**: CI, pixi and the Docker image install with `npm ci` from
  `package-lock.json`. A `bun.lock` is kept in sync for Bun users.
- **Jest** with Testing Library for unit tests (`__tests__/` folders next to the code).

### 3D visualization

- **three.js** for rendering.
- **@react-three/fiber**, the React renderer for three.js, and **@react-three/drei** helpers.
- **urdf-loader** for URDF robot models; three.js loaders for STL, OBJ and COLLADA meshes.

### ROS 2 integration

- **foxglove_bridge** on the robot or beside MITI. MITI speaks the Foxglove WebSocket protocol,
  subprotocol `foxglove.sdk.v1` with a fallback to `foxglove.websocket.v1`.
- **@foxglove/ws-protocol**: the protocol client used by `BridgeClient`.
- **@foxglove/rosmsg** and **@foxglove/rosmsg2-serialization**: parse the advertised `ros2msg`
  schemas and decode or encode CDR.

## Project structure

Repository (generated from the filesystem, without `node_modules/`, `.next/`, `.pixi/` and tool
caches):

```
MITI/
├── docs/                     # This guide, API, 3D Scene, deployment, performance, releases
├── public/                   # main_logo.svg, robot_logo.svg
├── ros/                      # foxglove_bridge beside MITI
│   ├── overlay/src/          # The robot's own message packages, built by build-msgs.sh
│   ├── build-msgs.sh         # pixi run -e <distro> build-msgs
│   ├── cyclonedds.xml        # Cyclone DDS settings for the bridge
│   ├── Dockerfile            # Image for the compose "bridge" profile
│   ├── foxglove-bridge.sh    # pixi run bridge
│   └── miti-with-bridge.sh   # pixi run miti-bridge
├── scripts/
│   ├── heavy-bridge.js       # Load harness: a foxglove_bridge stand-in with robot-sized data
│   ├── perf-run.js           # Load harness: measures MITI in Chrome
│   ├── perf-probe.js         # Browser-side half of the harness
│   ├── deploy.sh             # Builds a Docker image or standalone package for a target
│   ├── ubuntu-setup.sh       # Installs that package on the target
│   ├── auto-startapp.service # systemd unit for the standalone server
│   ├── auto-launch-browser.sh
│   └── miti-browser.desktop  # Kiosk browser autostart
├── src/                      # The application (below)
├── Dockerfile                # MITI image (standalone Next.js server)
├── docker-compose.yml        # Service miti; profile bridge adds foxglove-bridge
├── pixi.toml                 # Node.js and, per ROS distro, foxglove_bridge
├── package.json
├── next.config.js
├── tailwind.config.ts
└── jest.config.ts
```

Source (each `__tests__/` folder holds that folder's unit tests):

```
src/
├── app/
│   ├── api/
│   │   ├── file/
│   │   │   └── route.ts              # GET /api/file?path=… for file:// resources
│   │   └── package/
│   │       └── [...path]/
│   │           └── route.ts          # GET /api/package/<pkg>/<path> for package:// resources
│   ├── globals.css
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Loads Dashboard on the client only
├── components/
│   └── features/
│       ├── connection/
│       │   ├── ConnectionSettings.tsx    # Bridge URL and stream mode dialog
│       │   └── ConnectionStatus.tsx      # Status bar connection box
│       ├── controls/
│       │   └── ButtonSwitchWidget.tsx    # Button Switch panel
│       ├── dashboard/
│       │   ├── ActivityBar.tsx           # Panel / Topics / Problems / Sources views
│       │   └── Dashboard.tsx             # Title bar, sidebar, workspace, status bar
│       ├── layout/
│       │   ├── __tests__/
│       │   ├── AddWidgetButton.tsx       # Add panel menu
│       │   ├── PanelIcon.tsx
│       │   ├── PanelMosaic.tsx           # Tiled panels with tab-style headers
│       │   ├── SettingsTree.tsx          # Settings field components
│       │   ├── WidgetContainer.tsx       # Panel type → component
│       │   └── WidgetSettingsPortal.tsx  # Settings and status portals
│       ├── logs/
│       │   ├── __tests__/
│       │   └── LogPanel.tsx
│       ├── topic-viewer/
│       │   ├── __tests__/
│       │   ├── TopicCard.tsx
│       │   ├── TopicInput.tsx
│       │   └── TopicList.tsx
│       └── visualization/
│           ├── camera/                   # Image panel
│           │   ├── CameraViewer.tsx
│           │   ├── ImageSettings.tsx
│           │   ├── ImageView.tsx
│           │   └── useImageSource.ts
│           ├── pointcloud/
│           │   └── PointCloudViewer.tsx  # Standalone Point Cloud panel
│           ├── scene/                    # 3D Scene panel and the layers it shares with Image
│           │   ├── __tests__/
│           │   ├── CameraLayer.tsx
│           │   ├── FatLine.tsx
│           │   ├── GridLayer.tsx
│           │   ├── MarkerShape.tsx
│           │   ├── PointsLayer.tsx
│           │   ├── PoseShapes.tsx
│           │   ├── Primitives.tsx
│           │   ├── PublishTool.tsx
│           │   ├── RobotLayer.tsx
│           │   ├── SceneCanvas.tsx
│           │   ├── SceneContext.ts
│           │   ├── SceneLayer.tsx
│           │   ├── SceneLayers.tsx
│           │   ├── SceneSettings.tsx
│           │   └── SceneViewer.tsx
│           ├── state-machine/
│           │   └── StateMachineMonitor.tsx
│           ├── tf/
│           │   └── TFVisualizer.tsx
│           └── urdf/
│               └── Scene3D.tsx           # Canvas used by the Point Cloud panel
├── constants/
│   └── ros-topics.ts                     # Default topic names
├── hooks/
│   ├── __tests__/
│   ├── useBridge.ts
│   ├── useLayoutConfig.ts
│   ├── useLocalStorage.ts
│   ├── usePanelVisible.ts
│   ├── useTF.ts
│   ├── useTopic.ts
│   └── useTopicList.ts
├── lib/
│   ├── bridge/                           # foxglove_bridge client
│   │   ├── __tests__/
│   │   ├── asset-cache.ts                # Robot assets in Cache Storage
│   │   ├── client.ts                     # BridgeClient
│   │   ├── codec.ts                      # CDR/JSON decoders and encoders from schemas
│   │   ├── decode-core.ts                # What a decode worker does
│   │   ├── decode-pool.ts                # Web Workers that decode heavy topics
│   │   ├── decode-worker-factory.ts
│   │   ├── decode.worker.ts              # Worker entry point
│   │   ├── topics.ts                     # Topic name and type helpers
│   │   └── types.ts
│   ├── camera/                           # Image panel math
│   │   ├── __tests__/
│   │   ├── image-colors.ts               # Color mode for depth and mono images
│   │   ├── image-config.ts               # ImagePanelConfig and migration
│   │   ├── projection.ts                 # Camera models, flips, rotation, projection
│   │   └── rectify.ts                    # Lens distortion
│   ├── layout/
│   │   ├── __tests__/
│   │   └── mosaic.ts                     # Split tree helpers
│   ├── logs/
│   │   ├── __tests__/
│   │   └── log-messages.ts
│   ├── parsers/
│   │   ├── __tests__/
│   │   ├── bytes.ts
│   │   ├── image-parser.ts
│   │   ├── message-summary.ts
│   │   ├── pointcloud-parser.ts
│   │   └── prepared.ts                   # Work a decode worker did for a message
│   ├── scene/                            # 3D Scene logic without React
│   │   ├── __tests__/
│   │   ├── colors.ts
│   │   ├── geometry.ts
│   │   ├── mesh-loader.ts
│   │   ├── point-geometry.ts
│   │   ├── resources.ts
│   │   ├── robot-placement.ts
│   │   ├── scene-config.ts
│   │   └── transforms.ts
│   ├── server/
│   │   ├── __tests__/
│   │   └── package-files.ts              # Server-side package lookup
│   └── theme.ts                          # Colors and UI tokens
├── styles/
│   ├── common.styles.ts                  # commonStyles and cn()
│   ├── connection.styles.ts
│   ├── index.ts
│   ├── topic.styles.ts
│   ├── visualization.styles.ts
│   └── widget.styles.ts
└── types/
    ├── ros-messages.d.ts
    ├── scene-config.ts                   # SceneConfig (3D Scene settings)
    ├── scene.ts                          # Layer types and display settings
    ├── tf-messages.d.ts
    ├── urdf-config.ts                    # Legacy URDF settings
    └── widget.ts                         # Panel types and the default layout
```

## Data flow

### 1. Connection

```
Dashboard → useBridge(url, streamMode) → new BridgeClient → connect()
  → WebSocket (foxglove.sdk.v1) → serverInfo, channel and service advertisements
  → useTopicList(client) → topic list in the sidebar and in panel settings
```

### 2. Topic subscription

```
useTopic(client, topic, type, options) → client.subscribe(topic, callback, type, { maxRate, throttleMs })
  → bind to the advertised channel on the right connection → bridge subscription
```

Subscriptions are shared per topic: one bridge subscription serves every panel that shows the
topic. They rebind when the bridge advertises the topic again (reconnects, node restarts). A
channel whose type differs from the requested type is not subscribed; panels use
`topicTypeMismatch` to explain why nothing arrives.

### 3. Message delivery

```
binary message → rate cap (maxRate) → throttle window (throttleMs, newest wins)
  → decode: heavy type → DecodePool worker (decode + RGBA pixels or point scan)
            other     → main thread
  → retain static TF → subscriber callbacks → React state (throttled, held while hidden) → render
```

Heavy topics (images, point clouds, maps) are decoded in a pool of Web Workers. The worker also
converts raw images to RGBA and scans point clouds; results come back as transferable buffers and
are attached to the message (`lib/parsers/prepared.ts`), so `decodeImagePixels` and
`readPointCloud` reuse them. One message per topic decodes at a time and the newest waiting
message wins. Where workers are unavailable (Jest, server rendering) or after they fail, decoding
stays on the main thread. See [PERFORMANCE.md](PERFORMANCE.md) for the load harness and
measurements.

### 4. Transforms

```
/tf, /tf_static → useTF → TFTree (frames with 30 s of history) → lookupTransform(tree, target, source, time)
```

Each 3D Scene and Image panel runs its own `useTF`. Static transforms are retained by the client,
so a panel added later still receives them. Layers place each message with the transform at the
message's stamp when the panel's timestamp sync setting is on, and with the latest transform
otherwise.

### 5. Rendering

```
3D Scene: SceneViewer → SceneCanvas (fixed frame) → SceneLayers → RobotLayer, GridLayer,
          SceneLayer (points, scans, markers, maps, poses, paths, cameras), TFVisualizer
Image:    CameraViewer → useImageSource (texture) → ImageView (shader) → SceneLayers overlays
URDF:     topic / parameter / URL / file → urdf-loader → meshes via bridge assets or MITI server
```

## Key components

### 1. Dashboard shell

`Dashboard.tsx` holds the connection, the topic list and the layout, and lays out the workspace
like an IDE:

- **Title bar**: logo, Reset layout and Add panel.
- **Activity bar** (`ActivityBar.tsx`): icons for the sidebar views **Panel** (settings of the
  selected panel, with a search box), **Topics**, **Problems** and **Sources** (bridge address,
  status and connection settings). The sidebar can be resized by dragging its edge.
- **Workspace**: `PanelMosaic`.
- **Status bar**: the connection box (`ConnectionStatus`), problem count, number of panels and
  the app version.

### 2. BridgeClient

`BridgeClient` (`lib/bridge/client.ts`) is the foxglove_bridge client:

- **Lanes.** Each WebSocket to the bridge is a lane that reconnects on its own (every 3 s). The
  control lane carries the topic list, services, parameters and, in synchronized mode, every
  topic.
- **Stream modes** (Connection settings → Streaming). The bridge queues each client's messages in
  order. **Synchronized** (default) keeps every topic on one connection, as the Foxglove app does,
  so cameras, TF and the 3D scene show the same moment. **Prioritize robot motion** (`separate`)
  gives every heavy topic a lane of its own: TF stays real-time and point clouds are not queued
  behind camera frames on a slow link, but panels drift apart in time. Robot asset downloads
  always use a lane of their own.
- **Rate caps and throttling.** `maxRate` drops messages that arrive sooner than every
  subscriber's cap, and `throttleMs` keeps only the newest message within a window; both act
  before decoding. Subscriptions are never paused to throttle the robot: measured on a real robot,
  resubscribing between frames lost frames (a 10 Hz camera dropped to 2.7 fps).
- **Decoding** with the advertised schemas, heavy types in Web Workers.
- **Static transform retention** for late subscribers.
- **Publishing** (JSON, requires the bridge's `clientPublish` capability), **service calls**,
  **parameter reads** and **asset fetching** (`package://` and `file://`), with assets cached per
  session and in the browser's Cache Storage.

### 3. Panel system

Panels tile the workspace like Foxglove's layout:

- `react-mosaic-component` renders a binary split tree of panel ids (`lib/layout/mosaic.ts`).
  Drag a panel's header onto an edge of another panel to split it, and drag dividers to resize.
- Each panel has a tab-style header: icon and title (click to select the panel and open its
  settings), remove, a status slot, expand and lock. Panels fill the slot through
  `PanelStatusPortal` (frame rate, lag, frame size and so on).
- A panel renders its settings itself, into the sidebar through `WidgetSettingsPortal`, so it stays
  mounted while its settings are open.
- Expanding a panel hides the others. Hidden panels keep their subscriptions but stop rendering
  (`PanelVisibleContext`).
- Layouts are saved in `localStorage`. MITI 2.x grid layouts are converted to a split tree on
  load.

Panel types (`types/widget.ts`): Topics, 3D Scene (`urdf-viewer`), Point Cloud, Camera / Image
(`camera-viewer`), State Machine, Button Switch and Log.

### 4. Visualization components

#### 3D Scene

`visualization/scene/`, modelled on Foxglove's 3D panel (see [3D Scene](3d-scene.md)):

- `SceneViewer` reads the panel's `SceneConfig`, runs `useTF`, picks the fixed and display frames
  and hosts the publish tools (point, pose, pose estimate).
- `SceneCanvas` is the react-three-fiber canvas with the orbit camera; children are drawn in the
  fixed frame.
- `SceneLayers` turns the topic list and settings into layers: `RobotLayer` (URDF from a topic,
  parameter, URL or file, with joint states), `GridLayer`, `SceneLayer` per topic and
  `TFVisualizer` for frames.
- `SceneLayer` subscribes to one topic and draws it: `PointsLayer` for point clouds and laser
  scans (with decay trails), `MarkerShape` for markers, `MapPlane` (`Primitives.tsx`) for
  occupancy grids, `PoseShapes` for poses, pose arrays, paths, odometry and covariance, and
  `CameraLayer` for camera frustums with their image. Each layer has its own error boundary and
  reports its status to the settings tree.
- `FatLine` draws wide lines with a material that lives as long as the component.

#### Image panel

`visualization/camera/`, modelled on Foxglove's Image panel:

- `CameraViewer` subscribes to a raw or compressed image (default cap 15 fps), its `CameraInfo`
  and TF, and shows rate, size and lag in the tab bar.
- `useImageSource` decodes one frame at a time into a texture; depth and mono images keep their raw
  values for Color mode.
- `ImageView` draws the image with a shader (flips, rotation, Color mode, Rectify) and renders
  `SceneLayers` on top through a camera with the real camera's intrinsics, so markers, point
  clouds and frames line up with the image.
- `lib/camera/` holds the math: camera models, projection, distortion and color lookup tables.

#### Other panels

- **Point Cloud**: a single cloud in its own frame (`PointCloudViewer`, `Scene3D`).
- **Topics**: the topic list with a live preview per topic.
- **Log**: `/rosout`-style logs with level, name and text filters.
- **State Machine**: SMACC2 and behavior tree status (see
  [STATE_MACHINE_MONITORING.md](STATE_MACHINE_MONITORING.md)).
- **Button Switch**: publishes a JSON payload or calls a service when toggled.

## State management

MITI has no global state library. State lives in React hooks and flows down as props.

### Application state

`Dashboard` owns the shared state: the client (`useBridge`), the topic list (`useTopicList`), the
layout (`useLayoutConfig`), the selected panel and the sidebar. Each panel's settings are stored in
its widget `props` and changed through `onUpdateWidget` / `onPropsChange`.

### Contexts

- `PanelVisibleContext`: whether a panel is visible.
- `WidgetSettingsContext`, `PanelStatusContext`: where a panel's settings and status render.
- `SettingsSearchContext`: the settings search text.
- `SceneDisplayContext`: scene-wide display options (label scale, mesh options, asset fetching)
  inside a canvas.

### Message state

`useTopic` and `useTF` keep the newest message or tree in React state. High-rate data is
throttled before it reaches React, and hidden panels hold data without rendering it.

### Persistent state

| Storage                                | Key                    | Contents                                    |
| -------------------------------------- | ---------------------- | ------------------------------------------- |
| `localStorage`                         | `miti_layout_config`   | Panels, their settings and the split tree   |
| `localStorage`                         | `miti_bridge_url`      | Bridge address                              |
| `localStorage`                         | `miti_stream_mode`     | `synchronized` or `separate`                |
| `localStorage`                         | `miti_sidebar_width`   | Sidebar width                               |
| `localStorage` (read once, to migrate) | `miti_urdf_config`     | MITI 2.0 URDF settings                      |
| `localStorage` (read once, to migrate) | `miti_rosbridge_url`   | MITI 2.0 rosbridge address                  |
| Cache Storage                          | `miti-robot-assets-v1` | Meshes and URDFs fetched through the bridge |

Stored panel settings are migrated on read: `normalizeLayout`, `normalizeSceneConfig` and
`normalizeImageConfig` accept every older format.

## Performance considerations

### 1. Loading

- `app/page.tsx` and `Dashboard` load the dashboard and the panel layout with `next/dynamic` and
  `ssr: false`; the decode worker is a separate webpack chunk.

### 2. Network and decoding

- The stream mode decides whether heavy topics can delay TF.
- Rate caps and throttle windows drop messages before they are decoded.
- Heavy messages are decoded in Web Workers, newest frame first, and their buffers are
  transferred, not copied.
- Robot assets are fetched a few at a time and cached for the session and in Cache Storage.

### 3. React

- `useTopic` throttles state updates; `useTF` publishes at most once per animation frame.
- Hidden panels hold their newest data and render nothing until they are shown again.
- `useMemo` and `useCallback` keep settings and layer props stable.

### 4. 3D rendering

- `SceneCanvas` stops its render loop while the panel is hidden; the Image panel renders on demand.
- Point geometry buffers are reused and grown with spare room, and only the drawn range is
  uploaded (`lib/scene/point-geometry.ts`).
- Point clouds are subsampled to a maximum number of points per message.
- `FatLine` updates its geometry in place instead of compiling a new line material.

[PERFORMANCE.md](PERFORMANCE.md) describes the load harness (`scripts/heavy-bridge.js`,
`scripts/perf-run.js`) and the measurements behind these choices.

## Design patterns

### 1. Hooks for data

Connection and topic logic live in hooks; components only render:

```typescript
const { client, connected } = useBridge(url, streamMode);
const { data, lastUpdate } = useTopic(client, topic, 'sensor_msgs/msg/Image', { maxRate: 15 });
```

### 2. Portals for settings and status

A panel renders its settings and status where the shell wants them, without unmounting:

```tsx
<>
  <PanelStatusPortal>{fps} fps</PanelStatusPortal>
  <ImageView … />
  <WidgetSettingsPortal>
    <ImageSettings … />
  </WidgetSettingsPortal>
</>
```

### 3. Composition of layers

The 3D Scene and the Image panel share the same layers:

```tsx
<SceneViewer>
  <SceneCanvas>
    <SceneLayers /> {/* RobotLayer, GridLayer, SceneLayer per topic, TFVisualizer */}
  </SceneCanvas>
  <WidgetSettingsPortal>
    <SceneSettings />
  </WidgetSettingsPortal>
</SceneViewer>

<CameraViewer>
  <ImageView>
    <SceneLayers /> {/* overlays through the camera's intrinsics */}
  </ImageView>
</CameraViewer>
```

### 4. Migration on read

Stored settings are never rewritten in bulk. Each reader (`normalizeLayout`,
`normalizeSceneConfig`, `normalizeImageConfig`) fills defaults and converts older formats when it
reads them.

## Error handling

### 1. Connection errors

- Every connection retries every 3 seconds until the client is disconnected.
- A banner and the **Problems** view show the error and the bridge address; the status bar shows
  the state.
- Pending service calls, parameter reads and asset requests are rejected when the connection drops.

### 2. Data errors

- A topic whose type does not match the panel is reported with its actual type.
- Decode errors are logged per topic and the next message is tried.
- If the decode workers fail, decoding moves to the main thread.
- Parsers throw descriptive errors (unsupported encoding, truncated buffer, missing field); panels
  show them as layer or panel status.

### 3. Render errors

- Each 3D Scene layer has an error boundary (`LayerBoundary` in `SceneLayer.tsx`): a failing layer
  reports its error and the rest of the scene keeps running.
- Mesh load failures are reported per mesh (`meshErrorMessage`).

## Security considerations

MITI has no authentication. Anyone who can reach MITI's port (3000) and foxglove_bridge's port
(8765) can view the robot's data and, when the bridge allows it, publish and call services. Run it
on a trusted network.

### 1. WebSocket

- MITI uses `wss://` automatically when it is served over HTTPS; TLS must then be provided for the
  bridge.
- Publishing requires the bridge's `clientPublish` capability. `BRIDGE_TOPIC_WHITELIST` limits
  which topics the bridge offers.

### 2. HTTP server

- `next.config.js` sets `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff` and a
  referrer policy, and removes the `X-Powered-By` header.
- `/api/package` and `/api/file` serve only mesh, texture and URDF files inside the ROS package
  search paths; package names are validated and paths cannot leave those directories.

### 3. Rendering

- React escapes text; message contents are shown as text, not HTML.
- No Content Security Policy is set.

## Deployment

Details are in [DEPLOYMENT.md](DEPLOYMENT.md). In short:

- **pixi** (`pixi.toml`) provides Node.js 22 and, in the `humble` and `jazzy` environments,
  foxglove_bridge from RoboStack. Tasks: `miti` (build if needed and serve on port 3000),
  `miti-bridge` (MITI and foxglove_bridge together), `bridge` (foxglove_bridge only) and
  `build-msgs` (build custom message packages from `ros/overlay/src`).
- **Docker Compose** (`docker-compose.yml`): service `miti`; the `bridge` profile adds a
  `foxglove-bridge` service built from `ros/Dockerfile`, using the host network to reach the
  robot over DDS.
- **Load testing**: `scripts/heavy-bridge.js` and `scripts/perf-run.js`, described in
  [PERFORMANCE.md](PERFORMANCE.md).

## Future improvements

1. **Point Cloud panel**: move it to `readPointCloud` and `PointsLayer`, as the 3D Scene uses, or
   fold it into the 3D Scene.
2. **Topic list**: virtual scrolling for robots with many topics.
3. **Security**: optional authentication and a Content Security Policy.
4. **Error reporting**: an application-level error boundary around each panel.
