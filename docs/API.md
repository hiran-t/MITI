# API Documentation

This document provides detailed information about the MITI API, including hooks, components, and utilities.

## Table of Contents
- [Hooks](#hooks)
- [Components](#components)
- [Types](#types)
- [Utilities](#utilities)

## Hooks

### useRosbridge

Connect to a ROS2 system via rosbridge WebSocket.

```typescript
function useRosbridge(url?: string): {
  client: ROSBridge | null;
  connected: boolean;
  error: Error | null;
}
```

**Parameters:**
- `url` (optional): WebSocket URL. Defaults to `NEXT_PUBLIC_ROSBRIDGE_URL` or `ws://localhost:9090`

**Returns:**
- `client`: ROSBridge client instance
- `connected`: Connection status
- `error`: Last error encountered

**Example:**
```typescript
const { client, connected, error } = useRosbridge('ws://192.168.1.100:9090');
```

---

### useTopic

Subscribe to a ROS2 topic and receive messages.

```typescript
function useTopic<T = any>(
  topic: string | null,
  rosbridgeClient: ROSBridge | null,
  options?: { throttleRate?: number }
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  messageCount: number;
}
```

**Parameters:**
- `topic`: Topic name to subscribe to
- `rosbridgeClient`: ROSBridge client instance
- `options.throttleRate` (optional): Message rate limit in ms

**Returns:**
- `data`: Latest message data
- `loading`: Loading state
- `error`: Subscription error
- `messageCount`: Total messages received

**Example:**
```typescript
const { data, messageCount } = useTopic('/camera/image_raw', client);
```

---

### useTopicList

Get list of available ROS2 topics.

```typescript
function useTopicList(
  rosbridgeClient: ROSBridge | null
): {
  topics: TopicInfo[];
  loading: boolean;
  error: Error | null;
  refreshTopics: () => void;
}
```

**Returns:**
- `topics`: Array of available topics
- `loading`: Loading state
- `error`: Fetch error
- `refreshTopics`: Function to refresh topic list

**Example:**
```typescript
const { topics, refreshTopics } = useTopicList(client);
```

---

### useTF

Subscribe to TF (transform) data.

```typescript
function useTF(
  rosbridgeClient: ROSBridge | null,
  enabled?: boolean
): {
  transforms: Map<string, TFTransform>;
  loading: boolean;
  error: Error | null;
}
```

**Parameters:**
- `rosbridgeClient`: ROSBridge client instance
- `enabled` (optional): Enable/disable TF subscription

**Returns:**
- `transforms`: Map of transform data
- `loading`: Loading state
- `error`: Subscription error

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
}
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
}
```

---

### useLocalStorage

Persist state in browser localStorage.

```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void]
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
function Dashboard(): JSX.Element
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

function ConnectionStatus(props: ConnectionStatusProps): JSX.Element
```

---

### URDFViewer

3D robot model viewer.

```typescript
interface URDFViewerProps {
  config: UrdfConfig;
  client: ROSBridge | null;
  onConfigChange: {
    onModeChange: (mode: 'topic' | 'url') => void;
    onTopicChange: (topic: string) => void;
    onUrdfUrlChange: (url: string) => void;
    onMeshBaseUrlChange: (url: string) => void;
    onPackageMapping: (mapping: Record<string, string>) => void;
  };
}

function URDFViewer(props: URDFViewerProps): JSX.Element
```

---

### PointCloudViewer

Point cloud visualization component.

```typescript
interface PointCloudViewerProps {
  topic: string;
  client: ROSBridge | null;
}

function PointCloudViewer(props: PointCloudViewerProps): JSX.Element
```

---

### CameraViewer

Camera image display component.

```typescript
interface CameraViewerProps {
  topic: string;
  client: ROSBridge | null;
}

function CameraViewer(props: CameraViewerProps): JSX.Element
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

function TopicList(props: TopicListProps): JSX.Element
```

---

## Types

### ROSBridge Types

```typescript
interface TopicInfo {
  name: string;
  type: string;
}

interface ROSMessage {
  op: string;
  topic?: string;
  type?: string;
  msg?: any;
  [key: string]: any;
}

type MessageCallback = (message: any) => void;
type ConnectionCallback = () => void;
type ErrorCallback = (error: Error) => void;
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
  data: number[];
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
  data: number[];
  is_dense: boolean;
}

// Transform message
interface TFMessage {
  transforms: TransformStamped[];
}
```

---

## Utilities

### Package Path Resolver

Resolve ROS package paths to URLs.

```typescript
function resolvePackagePath(
  packagePath: string,
  meshBaseUrl: string,
  packageMapping: Record<string, string>
): string
```

**Parameters:**
- `packagePath`: ROS package path (e.g., `package://robot_description/meshes/base.stl`)
- `meshBaseUrl`: Base URL for mesh files
- `packageMapping`: Map of package names to URLs

**Returns:**
- Resolved absolute URL

**Example:**
```typescript
const url = resolvePackagePath(
  'package://my_robot/meshes/base.stl',
  'http://localhost:8000',
  { my_robot: 'http://localhost:8000/robots/my_robot' }
);
// Returns: 'http://localhost:8000/robots/my_robot/meshes/base.stl'
```

---

### Image Parser

Parse ROS image messages to displayable format.

```typescript
function parseCompressedImage(data: number[]): string
```

**Parameters:**
- `data`: Compressed image data array

**Returns:**
- Base64 encoded image data URL

---

### Point Cloud Parser

Parse ROS PointCloud2 messages.

```typescript
function parsePointCloud2(message: PointCloud2): {
  positions: Float32Array;
  colors: Float32Array;
}
```

**Parameters:**
- `message`: PointCloud2 message

**Returns:**
- Object with positions and colors arrays

---

## ROSBridge Client API

### Methods

#### connect()
```typescript
connect(): Promise<void>
```

Connect to rosbridge server.

---

#### disconnect()
```typescript
disconnect(): void
```

Disconnect from server and cleanup.

---

#### subscribe()
```typescript
subscribe(
  topic: string,
  messageType: string,
  callback: MessageCallback
): () => void
```

Subscribe to a topic and return unsubscribe function.

---

#### unsubscribe()
```typescript
unsubscribe(topic: string): void
```

Unsubscribe from a topic.

---

#### getTopics()
```typescript
getTopics(): Promise<TopicInfo[]>
```

Get list of available topics.

---

#### isConnected()
```typescript
isConnected(): boolean
```

Check connection status.

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
import { useRosbridge, useTopic } from '@/hooks';

function MyCustomWidget() {
  const { client, connected } = useRosbridge();
  const { data, messageCount } = useTopic('/my_topic', client);

  if (!connected) {
    return <div>Not connected</div>;
  }

  return (
    <div>
      <h3>My Custom Widget</h3>
      <p>Messages: {messageCount}</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### Complete Example: Custom Hook

```typescript
import { useState, useEffect } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';

function useCustomRosHook(client: ROSBridge | null) {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.subscribe(
      '/my_topic',
      'std_msgs/String',
      (message) => {
        setState(message.data);
      }
    );

    return () => unsubscribe();
  }, [client]);

  return state;
}
```
