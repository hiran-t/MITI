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

MITI is a modern web application for visualizing ROS2 robots and sensor data in real-time. It uses WebSocket connections via rosbridge_server to communicate with ROS2 systems.

```
┌─────────────┐         WebSocket         ┌──────────────┐
│   MITI Web  │ ◄──────────────────────►  │  rosbridge   │
│ Application │        (Port 9090)        │   server     │
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
│  rosbridge  │ ◄──────────────────────►  │     ROS2     │
│   server    │                           │   Systems    │
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

- **rosbridge_suite**: WebSocket bridge to ROS2
- **Custom rosbridge client**: TypeScript client implementation

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
│   ├── useRosbridge.ts   # WebSocket connection
│   ├── useTopic.ts       # Topic subscription
│   ├── useTopicList.ts   # Topic discovery
│   ├── useTF.ts          # Transform handling
│   ├── useUrdfConfig.ts  # URDF configuration
│   ├── useLayoutConfig.ts # Layout state
│   └── useLocalStorage.ts # Persistent storage
│
├── lib/                   # Library code
│   ├── rosbridge/        # ROS bridge client
│   │   ├── client.ts     # WebSocket client
│   │   ├── types.ts      # Type definitions
│   │   └── messages.ts   # Message builders
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
useRosbridge(url) → ROSBridge.connect() → WebSocket connection
```

### 2. Topic Subscription

```typescript
useTopic(topic, client) → client.subscribe() → Message callback
```

### 3. Data Processing

```typescript
Raw ROS message → Parser (image/pointcloud/etc) → React state → UI update
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

### 2. ROSBridge Client

Custom WebSocket client with features:

- Auto-reconnection
- Message queuing
- Subscription management
- Type-safe message handling

### 3. Widget System

Draggable, resizable widgets powered by:

- `react-grid-layout`
- Persistent layout storage
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
const { client, connected } = useRosbridge(url);
const { data, loading } = useTopic(topic, client);
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
<URDFViewer>
  <URDFSettings />
  <Scene3D />
</URDFViewer>
```

## Error Handling

### 1. Connection Errors

- Auto-reconnection with exponential backoff
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
