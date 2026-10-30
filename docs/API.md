# API reference

This document describes MITI's hooks, components, types and utilities as of v3.2.0. All paths
are relative to `src/`, and `@/` is the import alias for `src/`.

## Table of contents

- [Hooks](#hooks)
- [Components](#components)
- [Types](#types)
- [Utilities](#utilities)
- [BridgeClient API](#bridgeclient-api)
- [HTTP routes](#http-routes)
- [Examples](#examples)

## Hooks

All hooks live in `hooks/` and are client-only (`'use client'`).

### useBridge

Connects to foxglove_bridge over the Foxglove WebSocket protocol. A new URL or stream mode
disconnects the old `BridgeClient` and creates a new one.

```typescript
// hooks/useBridge.ts
export const BRIDGE_PORT = 8765;

export function runtimeBridgePort(): number;

export function defaultBridgeUrl(
  location?: Pick<Location, 'protocol' | 'hostname'>,
  port: number = runtimeBridgePort()
): string;

export function useBridge(
  url?: string,
  streamMode: StreamMode = 'synchronized'
): {
  client: BridgeClient | null;
  connected: boolean;
  error: Error | null;
};
```

**Parameters:**

- `url` (optional): WebSocket URL of foxglove_bridge. An empty or missing value uses
  `defaultBridgeUrl()`.
- `streamMode` (optional): `'synchronized'` (default) or `'separate'`. See
  [Stream modes](#stream-modes).

**Returns:**

- `client`: the `BridgeClient`. It exists before it is connected, so gate it on `connected` when a
  consumer should only see a live client (the dashboard passes `connected ? client : null`).
- `connected`: `true` once the bridge has sent its server info.
- `error`: the last connection error; cleared on the next successful connection.

**Default URL:** `defaultBridgeUrl()` returns `NEXT_PUBLIC_BRIDGE_URL` when the build sets it.
Otherwise it returns the bridge port on the host that served MITI: `ws://<host>:<port>`, or
`wss://<host>:<port>` when MITI was served over HTTPS. The port is `runtimeBridgePort()`: the
`MITI_BRIDGE_PORT` the server announced in `window.__MITI__` (set on each request by
`src/app/layout.tsx`, from `scripts/start-miti.mjs` or Docker Compose), else 8765. IPv6 hosts are wrapped in brackets. Without a
browser location (server rendering) the host is `localhost`.

**Example:**

```typescript
const { client, connected, error } = useBridge('ws://192.168.1.100:8765');
```

---

### useTopic

Subscribes to a topic and returns the newest decoded message.

```typescript
// hooks/useTopic.ts
export interface TopicOptions {
  /** Minimum ms between React updates; messages in between are dropped except the newest. */
  throttleRate?: number;
  /**
   * Deliver at most this many messages per second (Hz), dropping extras before they are decoded.
   * The robot still sends every message; foxglove_bridge cannot throttle per client.
   */
  maxRate?: number;
}

export function useTopic<T = unknown>(
  client: BridgeClient | null,
  topic: string,
  messageType?: string,
  options?: TopicOptions
): { data: T | null; lastUpdate: Date | null };
```

**Parameters:**

- `client`: the `BridgeClient`, or `null` to subscribe to nothing.
- `topic`: topic name. An empty string subscribes to nothing.
- `messageType` (optional): only bind to a channel of this type (`pkg/Type` or `pkg/msg/Type`).
- `options.throttleRate` (optional): minimum ms between React updates. The hook also passes it to
  the client as `throttleMs`, so messages superseded within the window are dropped before they are
  decoded.
- `options.maxRate` (optional): rate cap in Hz, passed to the client as `maxRate`.

**Returns:**

- `data`: the newest message, or `null` until one arrives. It resets to `null` when the client,
  topic, type or options change.
- `lastUpdate`: when `data` was last set.

While the panel is hidden (see [usePanelVisible](#usepanelvisible)), the hook keeps only the newest
message and shows it when the panel is visible again.

**Example:**

```typescript
const { data, lastUpdate } = useTopic<sensor_msgs.CompressedImage>(
  client,
  '/camera/image_raw/compressed',
  'sensor_msgs/msg/CompressedImage',
  { throttleRate: 100, maxRate: 15 }
);
```

---

### useTopicList

Returns the topics foxglove_bridge advertises. The list updates when the bridge advertises or
removes channels.

```typescript
// hooks/useTopicList.ts
export function useTopicList(client: BridgeClient | null): {
  topics: TopicInfo[];
  loading: boolean;
  error: Error | null;
  refreshTopics: () => void;
};
```

**Returns:**

- `topics`: advertised topics, one entry per topic name, sorted by name.
- `loading`: always `false`; the list comes from bridge advertisements.
- `error`: always `null`.
- `refreshTopics`: reads the current list from the client again.

---

### useTF

Subscribes to TF topics and builds the transform tree.

```typescript
// hooks/useTF.ts
export function useTF(options: {
  client: BridgeClient | null;
  maxAge?: number;
  enabled?: boolean;
  tfTopics?: string[];
  staticTopics?: string[];
}): { tfTree: TFTree; isLoading: boolean };
```

**Parameters:**

- `client`: the `BridgeClient`.
- `maxAge` (optional): drop dynamic frames that have not been updated for this many ms (default
  `30000`). Static frames never expire.
- `enabled` (optional): turns the subscriptions on or off (default `true`).
- `tfTopics` (optional): TF topics (default `['/tf', '/tf_static']`).
- `staticTopics` (optional): topics treated as static. Their transforms never expire, and the
  client keeps them and replays them to later subscribers. Default: the topics in `tfTopics` whose
  name contains `static`.

**Returns:**

- `tfTree`: frames by name and the root frame. Each dynamic frame keeps up to 30 seconds (and at
  most 3000 samples) of history, so data stamped in the past can be placed with the transform of
  its time.
- `isLoading`: `true` until the first TF message arrives.

The tree is published at most once per animation frame, and only when it changed. While the panel
is hidden, the tree stays current but is published only when the panel is visible again.

---

### useLayoutConfig

Holds the panel layout and saves it to `localStorage` (key `miti_layout_config`).

```typescript
// hooks/useLayoutConfig.ts
export function normalizeLayout(value: unknown): LayoutConfig;

export function useLayoutConfig(): {
  hydrated: boolean;
  layout: LayoutConfig;
  updateWidget: (widgetId: string, updates: Partial<WidgetConfig>) => void;
  addWidget: (type: WidgetType, beside?: string | null) => void;
  removeWidget: (widgetId: string) => void;
  updateMosaic: (mosaic: MosaicTree | null) => void;
  resetLayout: () => void;
  toggleLock: (widgetId: string) => void;
};
```

**Returns:**

- `hydrated`: `true` once the saved layout has been read. The layout is saved only after that, so
  the default layout never overwrites a saved one.
- `layout`: the panels (`widgets`) and how they tile the workspace (`mosaic`).
- `updateWidget`: merges `updates` into one panel, e.g. a new title or new props.
- `addWidget`: adds a panel of `type` beside panel `beside` (the selected panel), or beside the
  whole layout. New ids are `<type>-<n>`.
- `removeWidget`: removes a panel and its place in the split tree.
- `updateMosaic`: replaces the split tree after a drag or resize.
- `resetLayout`: restores `DEFAULT_LAYOUT`.
- `toggleLock`: locks or unlocks a panel's position (a locked panel cannot be dragged).

`normalizeLayout` validates a stored layout: it drops unknown or duplicate panels, clamps the
legacy grid fields, converts MITI 2.x grid layouts to a split tree with `mosaicFromGrid`, and makes
sure the tree holds every panel exactly once. 3D Scene panels saved without props get the settings
from the old `miti_urdf_config` key.

---

### useLocalStorage

Keeps a value in `localStorage` as JSON.

```typescript
// hooks/useLocalStorage.ts
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void];
```

The setter accepts a value or an updater function, like `useState`. Read and write errors are
logged and the in-memory value is kept.

---

### usePanelVisible

Tells a panel whether it is visible. A panel is hidden while another panel is expanded to fill the
workspace. Hidden panels keep their subscriptions and newest data but skip rendering.

```typescript
// hooks/usePanelVisible.ts
export const PanelVisibleContext: React.Context<boolean>; // default true

export function usePanelVisible(): boolean;

/** Visibility as a ref for message callbacks; `onShown` runs when the panel becomes visible again. */
export function usePanelVisibleRef(onShown?: () => void): React.MutableRefObject<boolean>;
```

`PanelMosaic` provides `PanelVisibleContext`. `useTopic`, `useTF` and `LogPanel` use
`usePanelVisibleRef`; `SceneCanvas` stops its render loop when `usePanelVisible()` is `false`.

## Components

Components live in `components/features/` and are default exports unless noted.

### Dashboard

`dashboard/Dashboard.tsx`. The application shell; `app/page.tsx` loads it with
`next/dynamic` and `ssr: false`.

```typescript
export default function Dashboard(): JSX.Element;
```

It owns:

- The bridge connection (`useBridge`), with the URL and stream mode saved in `localStorage`
  (`miti_bridge_url`, `miti_stream_mode`). A URL saved by MITI 2.0 under `miti_rosbridge_url` is
  carried over with port 9090 changed to 8765.
- The topic list (`useTopicList`) and the layout (`useLayoutConfig`).
- The title bar: logo, layout name, Reset layout and Add panel (`AddWidgetButton`).
- The activity bar and a resizable sidebar (width saved as `miti_sidebar_width`) with four views:
  **Panel** (title and settings of the selected panel), **Topics** (`TopicList`), **Problems**
  (connection errors) and **Sources** (bridge address, status and `ConnectionSettings`).
- The workspace, rendered by `PanelMosaic` once the layout is hydrated.
- The status bar: `ConnectionStatus`, the problem count, the number of panels and the version.

---

### ActivityBar

`dashboard/ActivityBar.tsx`. The column of icons on the left that switches sidebar views.

```typescript
export const SIDEBAR_TABS = ['Panel', 'Topics', 'Problems', 'Sources'] as const;
export type SidebarTab = (typeof SIDEBAR_TABS)[number];
export const sidebarViewLabel: (tab: SidebarTab) => string;

interface ActivityBarProps {
  activeTab: SidebarTab;
  sidebarOpen: boolean;
  problemCount: number;
  /** Receives the active tab's button so closing the sidebar can return focus to it. */
  activeRef: Ref<HTMLButtonElement>;
  /** Clicking the open view closes the sidebar; any other icon opens that view. */
  onSelect: (tab: SidebarTab) => void;
  onFocusTab: (tab: SidebarTab) => void;
}
```

---

### ConnectionStatus

`connection/ConnectionStatus.tsx`. The connection box in the status bar: state icon, bridge
address and, when `onUrlChange` is given, the connection settings button.

```typescript
interface ConnectionStatusProps {
  connected: boolean;
  url: string;
  onUrlChange?: (url: string) => void;
  streamMode?: StreamMode;
  onStreamModeChange?: (mode: StreamMode) => void;
}
```

---

### ConnectionSettings

`connection/ConnectionSettings.tsx`. A button that opens a dialog for the bridge URL and the stream
mode (**Synchronized (like Foxglove)** or **Prioritize robot motion**).

```typescript
interface ConnectionSettingsProps {
  currentUrl: string;
  onUrlChange: (url: string) => void;
  currentMode?: StreamMode; // default 'synchronized'
  onModeChange?: (mode: StreamMode) => void;
  /** Overrides the trigger button's look, e.g. inside the status bar. */
  triggerClassName?: string;
}
```

---

### PanelMosaic

`layout/PanelMosaic.tsx`. Tiles the panels with `react-mosaic-component`. Each panel has a tab-style
header with its icon and title (click to select it and open its settings), a remove button, a slot
for live status, and expand and lock buttons. Drag a header onto an edge of another panel to split
it there; drag a divider to resize. Escape restores an expanded panel.

```typescript
interface PanelMosaicProps {
  widgets: WidgetConfig[];
  mosaic: MosaicTree | null;
  /** Called when a drag or a divider move finishes. */
  onMosaicChange: (mosaic: MosaicTree | null) => void;
  onRemoveWidget: (widgetId: string) => void;
  onToggleLock: (widgetId: string) => void;
  client: BridgeClient | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  onRefreshTopics: () => void;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
  settingsTarget: HTMLElement | null;
  onCloseSettings: () => void;
  onUpdateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
}
```

---

### WidgetContainer

`layout/WidgetContainer.tsx`. Renders the component for a panel's `type` and provides the
contexts the panel's portals need.

```typescript
interface WidgetContainerProps {
  widget: WidgetConfig;
  client: BridgeClient | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  onRefreshTopics: () => void;
  settingsTarget: HTMLElement | null;
  /** Slot in the panel's tab bar for live status. */
  statusTarget?: HTMLElement | null;
  onCloseSettings: () => void;
  onUpdateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
}
```

| `type`              | Component             |
| ------------------- | --------------------- |
| `topics`            | `TopicList`           |
| `urdf-viewer`       | `SceneViewer`         |
| `pointcloud-viewer` | `PointCloudViewer`    |
| `camera-viewer`     | `CameraViewer`        |
| `state-machine`     | `StateMachineMonitor` |
| `button-switch`     | `ButtonSwitchWidget`  |
| `log`               | `LogPanel`            |

---

### Settings and status portals

`layout/WidgetSettingsPortal.tsx`. A panel renders its own settings and status, and portals put
them in the sidebar and the tab bar, so the panel stays mounted while its settings are open.

```typescript
export const WidgetSettingsContext: React.Context<{
  target: HTMLElement | null;
  close: () => void;
}>;

/** Renders children in the sidebar's Panel view, only while this panel is selected. */
export default function WidgetSettingsPortal({
  children,
}: {
  children: ReactNode;
}): JSX.Element | null;

/** The slot in this panel's tab bar, between the tab and the panel actions. */
export const PanelStatusContext: React.Context<HTMLElement | null>;

/** Show live status (rate, lag, size…) in the panel's tab bar instead of over its content. */
export function PanelStatusPortal({ children }: { children: ReactNode }): JSX.Element | null;

export function useCloseWidgetSettings(): () => void;

/** The text in the sidebar's settings search box. */
export const SettingsSearchContext: React.Context<string>;

/** A collapsible settings group, hidden when it does not match the settings search. */
export function SettingsSection(props: {
  title: string;
  keywords?: string;
  children: ReactNode;
}): JSX.Element;
```

`layout/SettingsTree.tsx` has the Foxglove-style field components used inside settings
(`TreeSection`, `TreeField`, `ToggleField`, `SelectField`, `TextField`, `NumberField`,
`ColorField`, `SliderField`, `OptionalNumberField`, `Vec3Field`, `ActionMenu`).

---

### SceneViewer

`visualization/scene/SceneViewer.tsx`. The 3D Scene panel (widget type `urdf-viewer`). Settings are
grouped like Foxglove's 3D panel; see [3D Scene](3d-scene.md).

```typescript
export default function SceneViewer(props: {
  client: BridgeClient | null;
  topics?: TopicInfo[];
  /** Stored widget props; older layouts are migrated on read. */
  props: unknown;
  onPropsChange: (config: SceneConfig) => void;
}): JSX.Element;
```

`props` is read with `normalizeSceneConfig`, which converts MITI 2.0 (version 1) props.

---

### CameraViewer

`visualization/camera/CameraViewer.tsx`. The Image panel (widget type `camera-viewer`), modelled
on Foxglove's Image panel: a raw or compressed image, 3D topics drawn over it through the camera's
calibration and TF, Color mode for depth and mono images, flips, rotation and Rectify. The tab bar
shows the received frame rate, frame size and lag through `PanelStatusPortal`.

```typescript
interface CameraViewerProps {
  client: BridgeClient | null;
  topics?: TopicInfo[];
  /** Stored widget props; MITI ≤ 3.0 props are migrated on read. */
  props: unknown;
  onPropsChange: (config: ImagePanelConfig) => void;
}
```

`props` is read with `normalizeImageConfig`. The other files in `visualization/camera/` are
`ImageView` (the shader that draws the image, with scene layers on top through a camera that has
the real camera's intrinsics), `ImageSettings` (the settings tree) and `useImageSource`:

```typescript
export type ImageMessage = sensor_msgs.Image | sensor_msgs.CompressedImage;

/** Decodes one frame at a time into a texture; the newest waiting frame wins. */
export function useImageSource(
  message: ImageMessage | null,
  resetKey: string
): { source: ImageSource | null; error: string | null };
```

---

### PointCloudViewer

`visualization/pointcloud/PointCloudViewer.tsx`. The standalone Point Cloud panel. It parses
clouds with `parsePointCloud2` and draws them in `urdf/Scene3D`. For point clouds placed with TF,
use a 3D Scene panel instead.

```typescript
interface PointCloudViewerProps {
  client: BridgeClient | null;
  topic?: string; // default CAMERA_TOPICS.DEPTH_POINTS
}
```

---

### TopicList and TopicInput

`topic-viewer/TopicList.tsx` lists and searches topics. Each `TopicCard` can subscribe to its
topic and shows the newest message, shortened by `summarizeMessage`.

```typescript
interface TopicListProps {
  topics: TopicInfo[];
  loading: boolean;
  onRefresh: () => void;
  client: BridgeClient | null;
}
```

`topic-viewer/TopicInput.tsx` is a topic field with suggestions. It reports a name only when it is
committed (Enter or blur), checks it with `topicNameError`, and flags a topic whose type does not
match `messageType`.

```typescript
interface TopicInputProps {
  value: string;
  onCommit: (topic: string) => void;
  topics?: TopicInfo[];
  /** Message type(s) the consumer can display; filters suggestions and flags mismatches. */
  messageType?: string | string[];
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}
```

---

### Other panels

```typescript
// logs/LogPanel.tsx: ROS 1/2 and Foxglove log messages, by default from /rosout
export default function LogPanel(props: {
  client: BridgeClient | null;
  topics?: TopicInfo[];
  props?: LogWidgetProps;
  onConfigChange: (updates: Partial<LogWidgetProps>) => void;
}): JSX.Element;

// visualization/state-machine/StateMachineMonitor.tsx: SMACC2 and behavior tree status
interface StateMachineMonitorProps {
  client: BridgeClient | null;
  smaccTopic?: string;
  btStatusTopic?: string;
  onConfigChange: (config: { smaccTopic?: string; btStatusTopic?: string }) => void;
}

// controls/ButtonSwitchWidget.tsx: publishes a JSON payload or calls a service when toggled
interface ButtonSwitchWidgetComponentProps {
  client: BridgeClient | null;
  props?: ButtonSwitchWidgetProps;
  onConfigChange: (config: Partial<ButtonSwitchWidgetProps>) => void;
}
```

See [STATE_MACHINE_MONITORING.md](STATE_MACHINE_MONITORING.md) for the state machine panel.

## Types

### Bridge types

```typescript
// lib/bridge/types.ts
export interface TopicInfo {
  topic: string;
  type: string;
}

export type MessageCallback = (message: unknown) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: Error) => void;

export interface SubscribeOptions {
  /** Keep transforms from this TF topic and replay them to later subscribers. */
  retainTransforms?: boolean;
  /**
   * Deliver at most this many messages per second (Hz); omit for every message. Extra messages
   * are dropped on arrival, which saves decoding and rendering but not network traffic.
   */
  maxRate?: number;
  /**
   * The subscriber shows at most one message per this many ms, the newest. Messages superseded
   * within the window are dropped before they are decoded; the newest is delivered when the
   * window closes.
   */
  throttleMs?: number;
}

// lib/bridge/client.ts
export type StreamMode = 'synchronized' | 'separate';
```

---

### Widget types

```typescript
// types/widget.ts
interface WidgetBase {
  i: string; // panel id
  title: string;
  /** MITI 2.x grid position, kept only to convert older layouts. */
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  locked?: boolean;
}

export type WidgetConfig =
  | LogWidgetConfig // type 'log', props?: LogWidgetProps
  | TopicsWidgetConfig // type 'topics'
  | URDFWidgetConfig // type 'urdf-viewer', props?: SceneConfig | LegacyURDFWidgetProps
  | PointCloudWidgetConfig // type 'pointcloud-viewer', props?: { topic: string }
  | CameraWidgetConfig // type 'camera-viewer', props: ImagePanelConfig | LegacyCameraWidgetProps
  | StateMachineWidgetConfig // type 'state-machine', props?: StateMachineWidgetProps
  | ButtonSwitchWidgetConfig; // type 'button-switch', props?: ButtonSwitchWidgetProps

export type WidgetType = WidgetConfig['type'];
// 'log' | 'topics' | 'urdf-viewer' | 'pointcloud-viewer' | 'camera-viewer' | 'state-machine' | 'button-switch'

export interface LayoutConfig {
  widgets: WidgetConfig[];
  /** How panels tile the workspace: a split tree of panel ids. */
  mosaic?: MosaicTree | null;
}

export interface WidgetTypeInfo {
  type: WidgetType;
  label: string;
  icon: string;
  defaultSize: { w: number; h: number };
  minSize: { minW: number; minH: number };
}

export const WIDGET_TYPES: WidgetTypeInfo[]; // the Add panel menu, in order
export const DEFAULT_LAYOUT: LayoutConfig; // a 3D Scene and four cameras
```

The split tree is defined in `lib/layout/mosaic.ts`:

```typescript
export type MosaicDirection = 'row' | 'column';
export interface MosaicSplit {
  direction: MosaicDirection;
  first: MosaicTree;
  second: MosaicTree;
  /** Share of the first node, 0–100; undefined splits evenly. */
  splitPercentage?: number;
}
export type MosaicTree = string | MosaicSplit;
```

---

### Panel settings

- **3D Scene:** `SceneConfig` in `types/scene-config.ts` (frame, scene, view, transforms, publish,
  per-topic settings and custom grid/URDF layers). Layer kinds and their message types are in
  `LAYER_TYPES` in `types/scene.ts`. See [3D Scene](3d-scene.md).
- **Image:** `ImagePanelConfig` in `lib/camera/image-config.ts`:

```typescript
export interface ImagePanelConfig {
  version: 2;
  topic: string;
  /** CameraInfo topic; undefined follows the image topic (`<dir>/camera_info`), '' is None. */
  calibrationTopic?: string;
  /** Frames per second requested from the bridge; 0 receives every frame. */
  maxFps: number; // default 15
  rectify: boolean;
  /** Place the camera with TF at the image's stamp instead of the latest transform. */
  syncTimestamps: boolean;
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: ImageRotation; // 0 | 90 | 180 | 270
  colorMode: ImageColorMode; // 'gradient' | 'colormap'
  colorMap: ColorMapName; // 'turbo' | 'rainbow'
  gradient: [string, string];
  valueMin?: number;
  valueMax?: number;
  scene: { labelScale: number; ignoreColladaUpAxis: boolean; meshUpAxis: 'y_up' | 'z_up' };
  transforms: TransformSettings;
  /** Overlay topics drawn on the image, as in the 3D Scene's Topics. */
  topics: Record<string, TopicSettings>;
}
```

- **Legacy URDF settings:** `URDFConfig` in `types/urdf-config.ts` is the MITI 2.0 robot source.
  It is only read to migrate old layouts.

```typescript
export type URDFMode = 'topic' | 'url';

export interface URDFConfig {
  mode: URDFMode;
  topic: string;
  urdfUrl: string;
  meshBaseUrl: string;
  packageMapping: Record<string, string>;
}
```

---

### ROS message types

`types/ros-messages.d.ts` declares the messages MITI reads, in namespaces (`std_msgs`,
`sensor_msgs`, `geometry_msgs`, `tf2_msgs`). Byte arrays are `Uint8Array` when decoded from CDR;
the types also allow number arrays and base64 strings.

```typescript
namespace sensor_msgs {
  interface Image {
    header: std_msgs.Header;
    height: number;
    width: number;
    encoding: string;
    is_bigendian: number;
    step: number;
    data: Uint8Array | number[] | string;
  }

  interface CompressedImage {
    header: std_msgs.Header;
    format: string;
    data: Uint8Array | number[] | string;
  }

  interface PointCloud2 {
    header: std_msgs.Header;
    height: number;
    width: number;
    fields: PointField[];
    is_bigendian: boolean;
    point_step: number;
    row_step: number;
    data: Uint8Array | number[] | string;
    is_dense: boolean;
  }
}
```

TF types are in `types/tf-messages.d.ts`:

```typescript
export interface TFMessage {
  transforms: TFTransformStamped[];
}

export interface TFFrame {
  name: string;
  parent: string | null;
  transform: Transform;
  timestamp: number; // in milliseconds
  children: string[];
  isStatic?: boolean;
  history?: { time: number; transform: Transform }[];
}

export interface TFTree {
  frames: Map<string, TFFrame>;
  rootFrame: string | null;
}
```

## Utilities

### Class names

```typescript
// styles/common.styles.ts (also exported from '@/styles')
export const cn: (...classes: (string | boolean | undefined | null)[]) => string;
```

Joins the truthy class names with spaces. `styles/*.styles.ts` hold Tailwind class strings per
area (`commonStyles`, `connectionStyles`, `topicStyles`, `visualizationStyles`, `widgetStyles`).

---

### Theme tokens

`lib/theme.ts` holds the colors shared by CSS, Tailwind and three.js:

- `MITI_CYAN`, `MITI_CYAN_HOVER`, `MITI_CYAN_RGB`: the brand cyan, for the logo and 3D data.
- `UI_TOKENS`: the dark UI theme. `tailwind.config.ts` emits each token as a `--miti-<name>` CSS
  variable on `:root`, e.g. `--miti-bg-panel`, `--miti-accent`, `--miti-error-rgb`.
- `GRAY_SCALE`: the neutral ramp behind Tailwind's `gray-*` classes.
- `LOG_NAME_COLORS`: node-name colors in the Log panel.

Tailwind colors built on these tokens: `brand`, `accent` (and `accent-hover`), `ok`, `warn`,
`danger`, `surface-chrome`, `surface-panel`, `surface-viewport`, `surface-input` and `gray-*`.
`accent`, `ok`, `warn` and `danger` support opacity modifiers such as `bg-danger/20`.

---

### Topic helpers

```typescript
// lib/bridge/topics.ts
/** ROS 2 accepts both `pkg/Type` and `pkg/msg/Type`; compare them in one form. */
export const normalizeMessageType: (type: string) => string; // 'pkg/msg/Type' → 'pkg/Type'

/** Why a topic name is not a valid ROS name, or null when it is valid or empty. */
export function topicNameError(name: string): string | null;

export function findTopicType(topics: TopicInfo[], topic: string): string | undefined;

/** The topic's actual type when the live topic list shows it cannot deliver any of `expected`. */
export function topicTypeMismatch(
  topics: TopicInfo[],
  topic: string,
  expected: string | string[]
): string | null;

// lib/bridge/codec.ts
/** `std_msgs/Bool` → `std_msgs/msg/Bool`; ROS 2 publishers need the full type name. */
export function ros2TypeName(type: string): string;
```

---

### Resource URLs and meshes

Robot resources normally come through foxglove_bridge's asset service. Without it, `package://`
resources are served by MITI's own server from the ROS workspace of the machine it runs on. A mesh
server URL or a per-package mapping overrides both.

```typescript
// lib/scene/resources.ts
export interface ResourceOptions {
  /** URL of a server whose root is a package directory; used for every unmapped package. */
  meshBaseUrl?: string;
  /** Package name → URL of that package's directory. */
  packageMapping?: Record<string, string>;
}

export function resolveResourceUrl(uri: string, options: ResourceOptions = {}): string;
export function packageApiUrl(pkg: string, path: string): string; // '/api/package/<pkg>/<path>'
/** Base for relative mesh paths in a URDF loaded from `location`. */
export function resourceBase(location: string): string;
```

`resolveResourceUrl` maps:

- `package://pkg/path` → `packageMapping[pkg]/path`, else `meshBaseUrl/path`, else
  `/api/package/pkg/path`.
- `file:///abs/path` → `/api/file?path=/abs/path`.
- Any other URI is returned unchanged (after trimming).

```typescript
resolveResourceUrl('package://my_robot/meshes/base.stl', {
  packageMapping: { my_robot: 'http://robot:8000/my_robot' },
});
// 'http://robot:8000/my_robot/meshes/base.stl'
```

```typescript
// lib/scene/mesh-loader.ts
export interface MeshLoadOptions {
  /** Treat COLLADA geometry as already Z-up, whatever its <up_axis> says. */
  ignoreColladaUpAxis: boolean;
  /** Up axis of formats without orientation metadata (STL, OBJ). */
  meshUpAxis: 'y_up' | 'z_up';
  manager?: THREE.LoadingManager;
  /** File extension when the URL has none (blob URLs of fetched assets). */
  format?: string;
}

export interface ResourceSources extends ResourceOptions {
  /** Reads package:// and file:// resources through foxglove_bridge, when it serves assets. */
  fetchAsset?: (uri: string) => Promise<Uint8Array<ArrayBuffer>>;
}

/** Load an STL, OBJ or COLLADA mesh into the ROS (Z-up) convention. */
export function loadMesh(url: string, options: MeshLoadOptions): Promise<THREE.Object3D>;

/** Load a mesh from a mesh server or package mapping, foxglove_bridge, or MITI's server. */
export async function loadMeshResource(
  uri: string,
  sources: ResourceSources,
  options: MeshLoadOptions
): Promise<THREE.Object3D>;

export function disposeObject(object: THREE.Object3D): void;
export function meshErrorMessage(uri: string, error: unknown): string;
```

---

### Image parser

Decodes `sensor_msgs/Image` and `sensor_msgs/CompressedImage` (`lib/parsers/image-parser.ts`).

```typescript
/**
 * RGBA pixels for a raw image, honouring `step` and `is_bigendian`. When a decode worker already
 * converted the image, the prepared pixels are returned as they are; treat them as read-only.
 */
export function decodeImagePixels(imageMsg: sensor_msgs.Image): Uint8ClampedArray<ArrayBuffer>;

/** Draw a raw or compressed (JPEG/PNG) image onto a canvas, sized to the image. */
export async function drawImageMessage(
  canvas: HTMLCanvasElement,
  imageMsg: sensor_msgs.Image | sensor_msgs.CompressedImage
): Promise<{ width: number; height: number }>;

export function getEncodingDescription(encoding: string): string;
```

Supported raw encodings: `rgb8`, `bgr8`, `rgba8`, `bgra8`, `mono8`, `mono16` (stretched gray),
`16UC1` and `32FC1` (rainbow depth). The Image panel decodes depth and mono images itself with
`decodeScalarImage` (`lib/camera/image-colors.ts`) so its Color mode can map the raw values.

---

### Point cloud parser

Reads `sensor_msgs/PointCloud2` (`lib/parsers/pointcloud-parser.ts`).

```typescript
/** Points of a cloud or scan in their message frame, with the fields that can color them. */
export interface PointData {
  count: number;
  /** x, y, z per point. */
  positions: Float32Array;
  /** Numeric fields a color map or gradient can use. */
  fields: string[];
  /** Whether the message carries per-point colors. */
  hasColors: boolean;
  /** One value per point, or undefined when the message has no such field. */
  values(field: string): Float32Array | undefined;
  /** r, g, b, a (0–1) per point from packed `rgb`/`rgba` or separate r/g/b/a fields. */
  colors(): Float32Array | undefined;
}

/** Read up to `maxPoints` points (every n-th point), skipping non-finite ones. Used by the 3D Scene. */
export function readPointCloud(msg: sensor_msgs.PointCloud2, maxPoints = 200000): PointData;

/** The costly part of `readPointCloud`: positions and byte offsets. A decode worker runs it ahead. */
export function scanPointCloud(msg: sensor_msgs.PointCloud2, maxPoints = 200000): PointScan;

/** One object per point; used by the standalone Point Cloud panel. */
export function parsePointCloud2(msg: sensor_msgs.PointCloud2, maxPoints = 200000): ParsedPoint[];

export interface ParsedPoint {
  x: number;
  y: number;
  z: number;
  r?: number;
  g?: number;
  b?: number;
  rgb?: number;
}
```

`readPointCloud` and `scanPointCloud` throw on invalid dimensions, invalid fields, a missing
`x`/`y`/`z` field or a truncated buffer.

---

### Prepared messages

When a heavy message is decoded in a worker, the worker also does the per-pixel or per-point work
and attaches the result to the decoded message (`lib/parsers/prepared.ts`). `decodeImagePixels`
and `readPointCloud` use it instead of doing the work again.

```typescript
export interface PointScan {
  /** Every `stride`-th point was read. */
  stride: number;
  count: number;
  /** x, y, z per point read, with non-finite points left out. */
  positions: Float32Array<ArrayBuffer>;
  /** Byte offset of each point read in the message's data. */
  offsets: Uint32Array<ArrayBuffer>;
}

export interface PreparedMessage {
  /** A sensor_msgs/Image as RGBA, as `decodeImagePixels` returns it. */
  pixels?: Uint8ClampedArray<ArrayBuffer>;
  /** A sensor_msgs/PointCloud2's points, as `readPointCloud` reads them. */
  cloud?: PointScan;
}

export function attachPrepared(message: unknown, data: PreparedMessage): void;
export function getPrepared(message: unknown): PreparedMessage | undefined;
```

---

### Decode workers

`lib/bridge/` decodes heavy messages off the main thread. `BridgeClient` uses these internally;
they are exported for tests.

```typescript
// decode-pool.ts
export class DecodePoolFailure extends Error {}
export class DecodePool {
  constructor(size?: number, createWorker?: () => Worker, onFailure?: (error: Error) => void);
  /** A pool where the platform has workers (browsers), else null (Jest, server rendering). */
  static create(onFailure?: (error: Error) => void, createWorker?: () => Worker): DecodePool | null;
  get available(): boolean;
  /** The bytes' buffer is transferred to the worker and is unusable afterwards. */
  decode(channel: ChannelSpec, data: ArrayBufferView): Promise<unknown>;
  dispose(): void;
}

// decode-core.ts: what a worker does
export function prepareMessage(
  schemaName: string,
  message: unknown
): { prepared?: PreparedMessage; transfer: ArrayBuffer[] };
export function createDecodeHandler(): (request: DecodeRequest) => {
  reply: DecodeReply;
  transfer: ArrayBuffer[];
};

// decode-worker-factory.ts: webpack bundles decode.worker.ts into its own chunk
export function createDecodeWorker(): Worker;
```

The pool starts 1 to 3 workers (`hardwareConcurrency - 1`, capped at 3). Each channel always goes
to the same worker, which keeps the channel's decoder.

---

### Other helpers

| Module                           | Exports                                                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/parsers/message-summary.ts` | `summarizeMessage(value: unknown): unknown`: shortens typed arrays, long arrays and strings, and turns BigInt into strings, so a message can be shown as JSON. |
| `lib/parsers/bytes.ts`           | `decodeBytes(data: string \| ArrayLike<number>): Uint8Array<ArrayBuffer>`: a `uint8[]` field as bytes (base64 strings are accepted).                           |
| `lib/layout/mosaic.ts`           | `isSplit`, `leaves`, `mosaicFromGrid`, `addToMosaic`, `removeFromMosaic`, `syncMosaic`: split tree helpers.                                                    |
| `lib/scene/transforms.ts`        | `stampSeconds`, `frameName`, `transformMatrix`, `lookupTransform(tree, target, source, time = 0): Matrix4`.                                                    |
| `lib/scene/scene-config.ts`      | `normalizeSceneConfig(props: unknown): SceneConfig`, `topicLayerType`, `defaultTopicVisible`, `autoFixedFrame`, `parseParameterName`.                          |
| `lib/scene/colors.ts`            | Point and map color modes, `COLOR_MAPS` (turbo, rainbow), `pointColors`, `occupancyPalette`, `parseHex`.                                                       |
| `lib/scene/geometry.ts`          | Laser scans as points, occupancy grids as pixels, marker bookkeeping, `messageTransform`.                                                                      |
| `lib/camera/image-config.ts`     | `normalizeImageConfig(props: unknown, fallbackTopic = ''): ImagePanelConfig`, `defaultCalibrationTopic`, `calibrationTopicOf`, `DEFAULT_IMAGE_CONFIG`.         |
| `lib/camera/projection.ts`       | Camera models from `CameraInfo`, image flips and rotation (`imageTransform`), `IntrinsicCamera`, `projectToPixel`.                                             |
| `lib/camera/rectify.ts`          | `plumb_bob` and `rational_polynomial` distortion: `parseDistortion`, `distort`, `undistort`, `rectifiedToRaw`, `RECTIFY_GLSL`.                                 |
| `lib/camera/image-colors.ts`     | `decodeScalarImage`, `valueRange`, `colorLut`, `colorAt` for Color mode on depth and mono images.                                                              |
| `lib/logs/log-messages.ts`       | `toLogEntry`, `matchesLog`, `formatLogStamp`, `LOG_LEVELS`, `LOG_MESSAGE_TYPES`.                                                                               |
| `lib/server/package-files.ts`    | Server-only lookup of package and `file://` resources for the HTTP routes.                                                                                     |
| `constants/ros-topics.ts`        | `CAMERA_TOPICS`, `TF_TOPICS`, `STATE_MACHINE_TOPICS`: default topic names.                                                                                     |

## BridgeClient API

`BridgeClient` (`lib/bridge/client.ts`) connects to foxglove_bridge with the WebSocket subprotocol
`foxglove.sdk.v1`, falling back to `foxglove.websocket.v1` for older bridges. Messages arrive as
CDR (or JSON) and are decoded with the schemas the bridge advertises
(`@foxglove/rosmsg2-serialization`).

Subscriptions are shared per topic and survive reconnects and node restarts: they bind to a
channel whenever the bridge advertises the topic. After a lost connection, each connection retries
every 3 seconds until `disconnect()` is called.

```typescript
const client = new BridgeClient('ws://localhost:8765', { streamMode: 'synchronized' });
```

### Constructor

```typescript
constructor(
  url: string,
  options: {
    streamMode?: StreamMode;
    /** Decode heavy messages in Web Workers when the platform has them (default true). */
    decodeInWorkers?: boolean;
    /** Worker factory, for tests; defaults to the bundled decode worker. */
    createWorker?: () => Worker;
  } = {}
)
```

### Stream modes

The bridge queues each client's messages in order, so the stream mode decides what can delay what.

- `synchronized` (default): every topic shares one connection, as in the Foxglove app. Cameras, TF
  and the 3D scene show the same moment, and on a slow link they are late together.
- `separate`: every heavy topic gets its own connection ("lane"). TF and robot motion stay
  real-time and a point cloud is not queued behind camera frames, but panels drift apart in time.
  If a topic's connection fails twice, the topic falls back to the main connection until its own
  opens. An unused lane is closed 30 seconds after its last subscriber leaves.

Heavy types (`isHeavyType(type: string): boolean`): `sensor_msgs/Image`,
`sensor_msgs/CompressedImage`, `sensor_msgs/PointCloud2`, `nav_msgs/OccupancyGrid`,
`nav2_msgs/Costmap`, `map_msgs/OccupancyGridUpdate` and the `foxglove_msgs` `CompressedVideo`,
`RawImage`, `CompressedImage` and `PointCloud` types. Robot asset downloads always use a
connection of their own in both modes.

### Rate limits and decoding

- `maxRate` (Hz, per subscriber): a message that arrives sooner than every subscriber's cap is
  dropped before it is decoded. The topic uses the highest cap; one subscriber without a cap
  receives every message.
- `throttleMs` (per subscriber): while the shortest throttle window of the subscribers is open,
  only the newest message is kept, and it is decoded when the window closes.
- Heavy messages are decoded in a `DecodePool`. One message per topic decodes at a time; a newer
  message replaces any waiting one, so a topic that arrives faster than it can be decoded shows
  its newest frames. Where workers are unavailable, or after they fail, decoding happens on the
  main thread.
- Subscriptions are never paused to throttle the robot. foxglove_bridge has no per-client
  throttling, so the robot still sends every message.

### Connection

```typescript
connect(): Promise<void>
```

Opens the main connection. Resolves when the bridge sends its server info (capabilities are known
from then); rejects if the first attempt fails, and keeps retrying.

```typescript
disconnect(): void
```

Closes every connection, stops reconnecting and stops the decode workers.

```typescript
isConnected(): boolean
hasCapability(capability: string): boolean
getServerTime(): number | null
```

`hasCapability` checks a capability the bridge advertises, e.g. `clientPublish`, `parameters`,
`services` or `assets`. `getServerTime` returns the robot's clock in seconds (simulation time
when the robot runs on sim time) if the bridge sends it, else `null`.

### Topics

```typescript
getTopics(): TopicInfo[]
onTopicsChanged(callback: (topics: TopicInfo[]) => void): () => void
```

`getTopics` returns the advertised topics, one per name, sorted by name. `onTopicsChanged` returns
an unregister function.

```typescript
subscribe(
  topic: string,
  callback: MessageCallback,
  type?: string,
  options?: SubscribeOptions
): void
```

Adds a subscriber. With `type`, only a channel of that type is bound; a channel of another type is
not subscribed (use `topicTypeMismatch` to explain the missing data). The first subscriber's `type`
applies to the topic. `options.retainTransforms` keeps the transforms of a TF topic and replays
them to later subscribers; this is always on for topics whose name contains `static`. A new
subscriber to such a topic receives the retained transforms at once.

```typescript
unsubscribe(topic: string, callback?: MessageCallback): void
```

Removes one callback, or every callback when `callback` is omitted. The bridge subscription ends
when the last callback is removed.

### Publishing

```typescript
advertise(topic: string, type: string): void
publish(topic: string, message: unknown): void
```

`advertise` declares a topic to publish on; repeated calls are free and the advertisement
survives reconnects. `publish` sends a JSON-encoded message on an advertised topic. It throws when
not connected, when the topic was not advertised, when the bridge lacks the `clientPublish`
capability, or when it does not accept JSON.

### Services, parameters and assets

```typescript
callService(name: string, args: unknown = {}): Promise<unknown>
```

Calls a service the bridge advertises. The request and response are CDR-encoded with the service
schema. Rejects after 5 seconds without a response, or when the connection drops.

```typescript
getParameter(name: string): Promise<unknown>
```

Reads a parameter named `/node.parameter`, e.g. `/robot_state_publisher.robot_description`.
Requires the `parameters` capability; rejects after 5 seconds.

```typescript
fetchAsset(uri: string): Promise<Uint8Array<ArrayBuffer>>
clearAssetCache(): Promise<void>
```

`fetchAsset` fetches a `package://` or `file://` resource from the robot, as foxglove_bridge
resolves it. Requires the `assets` capability. Each URI is requested once per session; results
are also kept in the browser's Cache Storage (`miti-robot-assets-v1`, secure contexts only), so a
robot crosses a slow link once. At most 4 assets download at a time, each with a 60-second timeout
and up to 3 attempts on timeout. `clearAssetCache` forgets fetched assets in memory and in Cache
Storage, e.g. after a URDF changes.

### Events

```typescript
onConnection(callback: ConnectionCallback): () => void
onDisconnection(callback: ConnectionCallback): () => void
onError(callback: ErrorCallback): () => void
```

Each returns an unregister function. Errors on per-topic or asset connections are logged as
warnings and not reported through `onError`.

## HTTP routes

MITI's Next.js server has two routes for robot resources when foxglove_bridge does not serve
assets. Both serve only mesh, texture and URDF files found under the ROS package search paths
(`MITI_PACKAGE_PATH`, `AMENT_PREFIX_PATH`, `ROS_PACKAGE_PATH` of the server process).

| Route                                | Serves                   |
| ------------------------------------ | ------------------------ |
| `GET /api/package/<pkg>/<path>`      | `package://<pkg>/<path>` |
| `GET /api/file?path=<absolute path>` | `file://<absolute path>` |

## Examples

### A custom panel

```typescript
'use client';
import type { BridgeClient } from '@/lib/bridge/client';
import { useTopic } from '@/hooks/useTopic';
import WidgetSettingsPortal, {
  PanelStatusPortal,
  SettingsSection,
} from '@/components/features/layout/WidgetSettingsPortal';

export default function BatteryPanel({ client }: { client: BridgeClient | null }) {
  const { data, lastUpdate } = useTopic<{ percentage: number }>(
    client,
    '/battery_state',
    'sensor_msgs/msg/BatteryState',
    { throttleRate: 500 }
  );

  if (!client) return <div>Not connected</div>;

  return (
    <>
      <PanelStatusPortal>{lastUpdate?.toLocaleTimeString() ?? 'waiting'}</PanelStatusPortal>
      <p>{data ? `${Math.round(data.percentage * 100)} %` : 'No data'}</p>
      <WidgetSettingsPortal>
        <SettingsSection title="General">{/* settings fields */}</SettingsSection>
      </WidgetSettingsPortal>
    </>
  );
}
```

To make it a panel type, add a variant to `WidgetConfig` and an entry to `WIDGET_TYPES` in
`types/widget.ts`, an icon in `layout/PanelIcon.tsx`, and a `case` in `layout/WidgetContainer.tsx`.

### A custom hook

```typescript
import { useEffect, useState } from 'react';
import type { BridgeClient } from '@/lib/bridge/client';

function useRobotMode(client: BridgeClient | null) {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    const callback = (message: unknown) => setMode((message as { data: string }).data);
    client.subscribe('/robot_mode', callback, 'std_msgs/msg/String', { maxRate: 5 });
    return () => client.unsubscribe('/robot_mode', callback);
  }, [client]);

  return mode;
}
```

Always unsubscribe with the same callback you subscribed with; other subscribers of the topic keep
receiving messages.
