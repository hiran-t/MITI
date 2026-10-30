# Architecture

This document describes the architecture and design decisions of MITI.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Data Flow](#data-flow)
- [Key Components](#key-components)
- [State Management](#state-management)
- [Performance Considerations](#performance-considerations)

## Overview

MITI is a modern web application for visualizing ROS2 robots and sensor data in real-time. It connects over WebSocket to foxglove_bridge (Foxglove WebSocket protocol) on the robot and decodes the CDR messages in the browser using the schemas the bridge advertises.

```
┌─────────────┐         WebSocket         ┌──────────────┐
│   MITI Web  │ ◄──────────────────────►  │  foxglove_   │
│ Application │        (Port 8765)        │   bridge     │
└─────────────┘                           └──────────────┘
                                                 ▲
                                                 │
                                          ┌──────┴──────┐
                                          │   ROS2      │
                                          │   System    │
                                          └─────────────┘
```

OR

```
┌─────────────┐         ROS DDS           ┌──────────────┐
│  foxglove_  │ ◄──────────────────────►  │     ROS2     │
│   bridge    │                           │   Systems    │
└─────────────┘                           └──────────────┘
        ▲
        │
 ┌──────┴──────┐
 │   MITI      │
 │ Application │
 └─────────────┘
```

## Technology Stack

### Frontend

- **Next.js 14**: React framework with App Router
- **React 18**: UI library
- **TypeScript 5.9**: Type safety
- **Tailwind CSS**: Styling
- **Bun**: Runtime and package manager

### 3D Visualization

- **Three.js**: 3D rendering engine
- **React Three Fiber**: React renderer for Three.js
- **@react-three/drei**: Helper components for R3F
- **urdf-loader**: URDF file parsing

### State Management

- **Zustand**: Lightweight state management
- **React Hooks**: Local component state
- **LocalStorage**: Persistent configuration

### ROS2 Integration

- **foxglove_bridge**: WebSocket bridge to ROS2 (Foxglove WebSocket protocol, subprotocol `foxglove.sdk.v1` with `foxglove.websocket.v1` fallback)
- **@foxglove/ws-protocol**: Protocol client used by `BridgeClient`
- **@foxglove/rosmsg2-serialization**: CDR decoding/encoding from the advertised schemas

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
│
├── components/            # React components
│   └── features/
│       ├── connection/    # Connection management
│       ├── dashboard/     # Main dashboard
│       ├── layout/        # Layout & widgets
│       ├── topic-viewer/  # Topic browser
│       └── visualization/ # 3D viewers
│
├── hooks/                 # Custom React hooks
│   ├── useBridge.ts      # WebSocket connection
│   ├── useTopic.ts       # Topic subscription
│   ├── useTopicList.ts   # Topic discovery
│   ├── useTF.ts          # Transform handling
│   ├── useUrdfConfig.ts  # URDF configuration
│   ├── useLayoutConfig.ts # Layout state
│   └── useLocalStorage.ts # Persistent storage
│
├── lib/                   # Library code
│   ├── bridge/           # foxglove_bridge client
│   │   ├── client.ts     # BridgeClient (WebSocket client)
│   │   ├── codec.ts      # CDR decoders/encoders from schemas
│   │   ├── topics.ts     # Topic name/type helpers
│   │   └── types.ts      # Type definitions
│   └── parsers/          # Data parsers
│       ├── image-parser.ts
│       ├── pointcloud-parser.ts
│       └── urdf-parser/
│
├── types/                 # TypeScript types
│   ├── ros-messages.d.ts
│   ├── tf-messages.d.ts
│   ├── urdf-config.ts
│   └── widget.ts
│
├── styles/               # Style modules
│   └── *.styles.ts      # Tailwind class strings
│
└── utils/               # Utility functions
    └── package-path-resolver.ts
```

## Data Flow

### 1. Connection Establishment

```typescript
useBridge(url) → BridgeClient.connect() → WebSocket (foxglove.sdk.v1) → serverInfo + channel advertisements
```

### 2. Topic Subscription

```typescript
useTopic(client, topic) → client.subscribe() → bridge subscription to the advertised channel → CDR decode → Message callback
```

Subscriptions are shared per topic and rebind automatically when the bridge re-advertises the topic (reconnects, node restarts). The Foxglove protocol has no server-side throttling, so `useTopic` throttles React updates in the browser.

### 3. Data Processing

```typescript
Decoded ROS message → Parser (image/pointcloud/etc) → React state → UI update
```

### 4. 3D Rendering

```typescript
URDF data → urdf-loader → Three.js scene → React Three Fiber → Canvas
```

## Key Components

### 1. Dashboard

The main application container that manages:

- Connection state
- Layout configuration
- Widget management
- Topic list

### 2. BridgeClient

`BridgeClient` (`src/lib/bridge/client.ts`) is the foxglove_bridge client:

- Stream modes (Connection Settings → Streaming). The bridge queues each client's messages in order. **Synchronized** (default) keeps every topic on one connection, as the Foxglove app does, so cameras, TF and the 3D scene show the same moment. **Prioritize robot motion** gives every heavy topic (images, point clouds, maps) a connection of its own: TF stays real-time and point clouds are not queued behind camera frames on a slow link, but panels drift apart in time. Robot asset downloads always use a separate connection.
- Auto-reconnection (every 3 s, per connection)
- Shared per-topic subscriptions that rebind when the bridge advertises the topic
- Optional per-subscriber rate caps (`maxRate`): messages that arrive sooner are dropped before decoding. Subscriptions are never paused to throttle the robot — measured on a real robot, resubscribing between frames lost frames (a 10 Hz camera dropped to 2.7 fps)
- CDR decoding with the schemas the bridge advertises
- Static transform retention for late subscribers
- Publishing (JSON, requires the bridge's `clientPublish` capability), service calls, parameter reads and `package://`/`file://` asset fetching

### 3. Widget System

Panels tile the workspace like Foxglove's layout, powered by:

- `react-mosaic-component`: a split tree (`src/lib/layout/mosaic.ts`); drag a panel's header onto an edge of another panel to split it, drag dividers to resize
- Persistent layout storage (grid layouts from MITI 2.x are converted on load)
- Widget-specific configurations

### 4. Visualization Components

#### URDF Viewer

- Loads robot models from `/robot_description`
- Updates joint states from `/joint_states`
- Interactive 3D controls

#### Point Cloud Viewer

- Renders point cloud data
- Color mapping (depth/RGB)
- Configurable rendering options

#### TF Visualizer

- Subscribes to `/tf` and `/tf_static`
- Builds transform tree
- 3D coordinate frame visualization

#### Camera Viewer

- Displays image topics
- Supports compressed images
- Real-time updates

## State Management

### Global State (Zustand)

Not currently used, but recommended for:

- Connection status
- Global settings
- Shared widget data

### Local State (React Hooks)

Used for:

- Component-specific state
- Form inputs
- UI interactions

### Persistent State (LocalStorage)

Used for:

- Layout configuration
- Connection URL
- URDF settings
- Widget configurations

## Performance Considerations

### 1. Code Splitting

- Dynamic imports for heavy components
- Route-based splitting with Next.js

### 2. React Optimization

- `useMemo` for expensive computations
- `useCallback` for stable function references
- `React.memo` for component memoization

### 3. WebSocket Optimization

- Message throttling for high-frequency topics
- Efficient subscription management
- Connection pooling

### 4. 3D Rendering

- Frustum culling
- Level of Detail (LOD)
- Instanced rendering for repeated geometries
- RequestAnimationFrame optimization

### 5. Bundle Size

- Tree shaking
- Dynamic imports
- Minimize dependencies

## Design Patterns

### 1. Custom Hooks

Encapsulate complex logic:

```typescript
const { client, connected } = useBridge(url);
const { data, lastUpdate } = useTopic(client, topic);
```

### 2. Render Props

Flexible component composition:

```typescript
<WidgetContainer
  onRemove={() => removeWidget(id)}
  renderContent={() => <TopicList />}
/>
```

### 3. Compound Components

Related components working together:

```typescript
<SceneViewer>
  <SceneCanvas>{/* layers: RobotLayer, SceneLayer, GridLayer, TFVisualizer */}</SceneCanvas>
  <WidgetSettingsPortal>
    <SceneSettings />
  </WidgetSettingsPortal>
</SceneViewer>
```

## Error Handling

### 1. Connection Errors

- Auto-reconnection to foxglove_bridge (retries every 3 s)
- User-friendly error messages
- Connection status indicators

### 2. Parse Errors

- Graceful fallbacks
- Error boundaries for components
- Console warnings for debugging

### 3. Render Errors

- React Error Boundaries
- Fallback UI components
- Error reporting

## Security Considerations

### 1. WebSocket Security

- WSS support for encrypted connections
- Origin validation
- Input sanitization

### 2. XSS Protection

- React's built-in XSS protection
- Content Security Policy (CSP)
- Sanitize user inputs

### 3. Data Validation

- Type checking with TypeScript
- Runtime validation for ROS messages
- Safe parsing of JSON data

## Future Improvements

1. **State Management**: Migrate to Zustand for global state
2. **Testing**: Add comprehensive unit and integration tests
3. **Performance**: Implement virtual scrolling for large topic lists
4. **Accessibility**: Add ARIA labels and keyboard navigation
5. **Offline Support**: Add service workers for offline functionality
6. **Monitoring**: Add error tracking and analytics
7. **Documentation**: Add JSDoc comments and API documentation
