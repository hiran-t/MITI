# API Documentation

This document provides detailed information about the MITI API, including hooks, components, and utilities.

## Table of Contents

- [Hooks](#hooks)
- [Components](#components)
- [Types](#types)
- [Utilities](#utilities)

## Hooks

### useBridge

Connect to a ROS2 system via foxglove_bridge (Foxglove WebSocket protocol).

```typescript
function useBridge(url?: string): {
  client: BridgeClient | null;
  connected: boolean;
  error: Error | null;
};
```

**Parameters:**

- `url` (optional): WebSocket URL. Defaults to `NEXT_PUBLIC_BRIDGE_URL` or `ws://localhost:8765`

**Returns:**

- `client`: BridgeClient instance (a new URL replaces the client and resets the state)
- `connected`: Connection status
- `error`: Last error encountered

**Example:**

```typescript
const { client, connected, error } = useBridge('ws://192.168.1.100:8765');
```

---

### useTopic

Subscribe to a ROS2 topic and receive decoded messages.

```typescript
function useTopic<T = unknown>(
  client: BridgeClient | null,
  topic: string,
  messageType?: string,
  options?: { throttleRate?: number }
): {
  data: T | null;
  lastUpdate: Date | null;
};
```

**Parameters:**

- `client`: BridgeClient instance
- `topic`: Topic name to subscribe to
- `messageType` (optional): Only bind to a channel of this type (`pkg/Type` or `pkg/msg/Type`)
- `options.throttleRate` (optional): Minimum ms between React updates. The Foxglove protocol has no server-side throttling, so messages in between are dropped in the browser except the newest

**Returns:**

- `data`: Latest message
- `lastUpdate`: Time the latest message was delivered

**Example:**

```typescript
const { data, lastUpdate } = useTopic(client, '/camera/image_raw/compressed', undefined, {
  throttleRate: 100,
});
```

---

### useTopicList

Get the list of topics advertised by foxglove_bridge. The list updates live as the bridge advertises or removes topics.

```typescript
function useTopicList(client: BridgeClient | null): {
  topics: TopicInfo[];
  loading: boolean;
  error: Error | null;
  refreshTopics: () => void;
};
```

**Returns:**

- `topics`: Advertised topics, sorted by name
- `loading`: Always `false` (the list comes from bridge advertisements)
- `error`: Always `null`
- `refreshTopics`: Re-read the current list from the client

**Example:**

```typescript
const { topics } = useTopicList(client);
```

---

### useTF

Subscribe to TF (transform) data and build the transform tree.

```typescript
function useTF(options: {
  client: BridgeClient | null;
  maxAge?: number;
  enabled?: boolean;
  tfTopics?: string[];
  staticTopics?: string[];
}): {
  tfTree: TFTree;
  isLoading: boolean;
};
```

**Parameters:**

- `client`: BridgeClient instance
- `maxAge` (optional): Drop dynamic frames not updated for this many ms (default: `30000`)
- `enabled` (optional): Enable/disable TF subscription (default: `true`)
- `tfTopics` (optional): TF topics (default: `['/tf', '/tf_static']`)
- `staticTopics` (optional): Topics treated as static; their transforms never expire and are replayed to later subscribers (default: topics in `tfTopics` whose name contains `static`)

**Returns:**

- `tfTree`: Frames by name and the root frame
- `isLoading`: `true` until the first TF message arrives

---

### useLayoutConfig

Manage dashboard widget layout.

```typescript
function useLayoutConfig(): {
  layout: LayoutState;
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateLayout: (layouts: Layout[]) => void;
  resetLayout: () => void;
  toggleLock: (id: string) => void;
};
```

**Returns:**

- `layout`: Current layout state
- `addWidget`: Add new widget
- `removeWidget`: Remove widget by ID
- `updateLayout`: Update widget positions
- `resetLayout`: Reset to default layout
- `toggleLock`: Lock/unlock widget

---

### useUrdfConfig

Manage URDF viewer configuration.

```typescript
function useUrdfConfig(): {
  config: UrdfConfig;
  setMode: (mode: 'topic' | 'url') => void;
  setTopic: (topic: string) => void;
  setUrdfUrl: (url: string) => void;
  setMeshBaseUrl: (url: string) => void;
  setPackageMapping: (mapping: Record<string, string>) => void;
};
```

---

### useLocalStorage

Persist state in browser localStorage.

```typescript
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void];
```

**Parameters:**

- `key`: Storage key
- `initialValue`: Default value

**Returns:**

- `[value, setValue]`: Current value and setter function

---

## Components

### Dashboard

Main application component.

```typescript
function Dashboard(): JSX.Element;
```

**Features:**

- Connection management
- Widget layout
- Topic list
- Settings panel

---

### ConnectionStatus

Display connection status and settings.

```typescript
interface ConnectionStatusProps {
  connected: boolean;
  url: string;
  onUrlChange: (url: string) => void;
}

function ConnectionStatus(props: ConnectionStatusProps): JSX.Element;
```

---

### SceneViewer

The 3D Scene panel (widget type `urdf-viewer`). Settings are grouped like Foxglove's 3D panel; see [3D Scene](3d-scene.md).

```typescript
function SceneViewer(props: {
  client: BridgeClient | null;
  topics?: TopicInfo[];
  /** Stored widget props; MITI 2.0 layouts are migrated by normalizeSceneConfig. */
  props: unknown;
  onPropsChange: (config: SceneConfig) => void;
}): JSX.Element;
```

---

### PointCloudViewer

Point cloud visualization component.

```typescript
interface PointCloudViewerProps {
  topic: string;
  client: BridgeClient | null;
}

function PointCloudViewer(props: PointCloudViewerProps): JSX.Element;
```

---

### CameraViewer

Camera image display component.

```typescript
interface CameraViewerProps {
  topic: string;
  client: BridgeClient | null;
}

function CameraViewer(props: CameraViewerProps): JSX.Element;
```

---

### TopicList

Browse and search ROS2 topics.

```typescript
interface TopicListProps {
  topics: TopicInfo[];
  loading: boolean;
  onRefresh: () => void;
}

function TopicList(props: TopicListProps): JSX.Element;
```

---

## Types

### Bridge Types

```typescript
// src/lib/bridge/types.ts
interface TopicInfo {
  topic: string;
  type: string;
}

type MessageCallback = (message: unknown) => void;
type ConnectionCallback = () => void;
type ErrorCallback = (error: Error) => void;

interface SubscribeOptions {
  /** Keep transforms from this TF topic and replay them to later subscribers. */
  retainTransforms?: boolean;
}
```

---

### Widget Types

```typescript
type WidgetType =
  | 'topic-list'
  | 'urdf-viewer'
  | 'pointcloud-viewer'
  | 'camera-viewer'
  | 'tf-viewer';

interface Widget {
  id: string;
  type: WidgetType;
  config?: any;
  locked?: boolean;
}

interface LayoutState {
  widgets: Widget[];
  layouts: Layout[];
}
```

---

### URDF Types

```typescript
interface UrdfConfig {
  mode: 'topic' | 'url';
  topic: string;
  urdfUrl: string;
  meshBaseUrl: string;
  packageMapping: Record<string, string>;
}
```

---

### ROS Message Types

```typescript
// Image message
interface CompressedImage {
  header: {
    stamp: { sec: number; nanosec: number };
    frame_id: string;
  };
  format: string;
  data: Uint8Array; // CDR-decoded uint8[]
}

// Point cloud message
interface PointCloud2 {
  header: {
    stamp: { sec: number; nanosec: number };
    frame_id: string;
  };
  height: number;
  width: number;
  fields: PointField[];
  is_bigendian: boolean;
  point_step: number;
  row_step: number;
  data: Uint8Array; // CDR-decoded uint8[]
  is_dense: boolean;
}

// Transform message
interface TFMessage {
  transforms: TransformStamped[];
}
```

---

## Utilities

### Resource URLs

Resolve robot resource URIs to URLs the browser can fetch (`src/lib/scene/resources.ts`). Meshes are normally fetched through foxglove_bridge (`loadMeshResource` in `src/lib/scene/mesh-loader.ts`); these URLs are the fallback.

```typescript
function resolveResourceUrl(
  uri: string,
  options?: { meshBaseUrl?: string; packageMapping?: Record<string, string> }
): string;
```

- `package://pkg/path` → `packageMapping[pkg]/path`, else `meshBaseUrl/path`, else MITI's `/api/package/pkg/path`
- `file:///abs/path` → MITI's `/api/file?path=…`
- other URLs are returned unchanged

```typescript
resolveResourceUrl('package://my_robot/meshes/base.stl', {
  packageMapping: { my_robot: 'http://robot:8000/my_robot' },
});
// Returns: 'http://robot:8000/my_robot/meshes/base.stl'
```

---

### Image Parser

Decode `sensor_msgs/Image` and `CompressedImage` messages (`src/lib/parsers/image-parser.ts`).

```typescript
/** RGBA pixels for a raw image, honouring `step` and `is_bigendian`. */
function decodeImagePixels(image: sensor_msgs.Image): Uint8ClampedArray;

/** Draw a raw or compressed image onto a canvas, sized to the image. */
function drawImageMessage(
  canvas: HTMLCanvasElement,
  image: sensor_msgs.Image | sensor_msgs.CompressedImage
): Promise<{ width: number; height: number }>;
```

Supported raw encodings: rgb8, bgr8, rgba8, bgra8, mono8, mono16, 16UC1, 32FC1.

---

### Point Cloud Parser

Parse ROS PointCloud2 messages.

```typescript
function parsePointCloud2(message: PointCloud2): {
  positions: Float32Array;
  colors: Float32Array;
};
```

**Parameters:**

- `message`: PointCloud2 message

**Returns:**

- Object with positions and colors arrays

---

## BridgeClient API

`BridgeClient` (`src/lib/bridge/client.ts`) connects to foxglove_bridge with the WebSocket subprotocol `foxglove.sdk.v1` (falling back to `foxglove.websocket.v1` for older bridges). Messages arrive as CDR and are decoded with the schemas the bridge advertises. Subscriptions are shared per topic and survive reconnects and node restarts: they bind to a channel whenever the bridge advertises the topic. After a lost connection the client reconnects every 3 seconds until `disconnect()` is called.

```typescript
const client = new BridgeClient('ws://localhost:8765');
```

### Methods

#### connect()

```typescript
connect(): Promise<void>
```

Connect to foxglove_bridge. Resolves when the bridge sends its server info (capabilities are known from then).

---

#### disconnect()

```typescript
disconnect(): void
```

Disconnect from the bridge and stop reconnecting.

---

#### isConnected()

```typescript
isConnected(): boolean
```

Check connection status.

---

#### hasCapability()

```typescript
hasCapability(capability: string): boolean
```

Check a capability advertised by the bridge, e.g. `clientPublish`, `parameters`, `services` or `assets`.

---

#### getTopics()

```typescript
getTopics(): TopicInfo[]
```

Topics currently advertised by the bridge, sorted by name.

---

#### onTopicsChanged()

```typescript
onTopicsChanged(callback: (topics: TopicInfo[]) => void): () => void
```

Register a handler for topic advertisement changes; returns an unregister function.

---

#### subscribe()

```typescript
subscribe(
  topic: string,
  callback: MessageCallback,
  type?: string,
  options?: SubscribeOptions
): void
```

Subscribe to a topic. With `type`, only a channel of that type is bound. `options.retainTransforms` keeps the transforms of a TF topic and replays them to later subscribers (always on for topics whose name contains `static`).

---

#### unsubscribe()

```typescript
unsubscribe(topic: string, callback?: MessageCallback): void
```

Remove one callback, or every callback when omitted. The bridge subscription ends when the last callback is removed.

---

#### advertise()

```typescript
advertise(topic: string, type: string): void
```

Declare a topic to publish on. Repeated calls are free and the advertisement survives reconnects.

---

#### publish()

```typescript
publish(topic: string, message: unknown): void
```

Publish a message (JSON encoding) on an advertised topic. Requires the bridge's `clientPublish` capability; throws when not connected, not advertised or not allowed.

---

#### callService()

```typescript
callService(name: string, args?: unknown): Promise<unknown>
```

Call a ROS service advertised by the bridge. The request and response are CDR-encoded with the service schema. Rejects after 5 seconds without a response.

---

#### getParameter()

```typescript
getParameter(name: string): Promise<unknown>
```

Read a ROS parameter named `/node.parameter`, e.g. `/robot_state_publisher.robot_description`. Requires the bridge's `parameters` capability.

---

#### fetchAsset()

```typescript
fetchAsset(uri: string): Promise<Uint8Array>
```

Fetch a `package://` or `file://` resource from the robot, as foxglove_bridge resolves it. Requires the bridge's `assets` capability.

---

### Event Handlers

#### onConnection()

```typescript
onConnection(callback: ConnectionCallback): () => void
```

Register connection event handler.

---

#### onDisconnection()

```typescript
onDisconnection(callback: ConnectionCallback): () => void
```

Register disconnection event handler.

---

#### onError()

```typescript
onError(callback: ErrorCallback): () => void
```

Register error event handler.

---

## Examples

### Complete Example: Custom Widget

```typescript
import { useBridge } from '@/hooks/useBridge';
import { useTopic } from '@/hooks/useTopic';

function MyCustomWidget() {
  const { client, connected } = useBridge();
  const { data, lastUpdate } = useTopic(client, '/my_topic');

  if (!connected) {
    return <div>Not connected</div>;
  }

  return (
    <div>
      <h3>My Custom Widget</h3>
      <p>Last update: {lastUpdate?.toLocaleTimeString() ?? 'waiting'}</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### Complete Example: Custom Hook

```typescript
import { useState, useEffect } from 'react';
import type { BridgeClient } from '@/lib/bridge/client';

function useCustomRosHook(client: BridgeClient | null) {
  const [state, setState] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;

    const callback = (message: unknown) => {
      setState((message as { data: string }).data);
    };
    client.subscribe('/my_topic', callback, 'std_msgs/msg/String');

    return () => client.unsubscribe('/my_topic', callback);
  }, [client]);

  return state;
}
```
