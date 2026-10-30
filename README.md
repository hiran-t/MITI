<div align="center">
  <img src="public/main_logo.svg" alt="MITI Logo" width="800"/>

# MITI - ROS2 Web Visualization

**A modern, real-time web dashboard for visualizing ROS2 robots and sensor data.**

Built with Next.js 14, React 18, and Three.js.

[![ROS2](https://img.shields.io/badge/ROS2-Humble%20%7C%20Iron%20%7C%20Jazzy-blue)](https://docs.ros.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [ROS2 Integration](#ros2-integration)
- [Customization](#customization)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Features

**Visualization**

- URDF 3D robot model viewer with live joint state animation
- Point cloud rendering from depth cameras
- Camera feed viewer (color, depth, IR, detection) with Foxglove-style overlays of 3D topics, depth color maps, flip/rotation and rectify
- TF frame visualization
- State machine monitor (SMACC2 and BehaviorTree)

**Dashboard**

- IDE-style workspace (activity bar, tabbed panels, status bar) with MITI's own dark theme
- Tiled panels: drag a panel onto another panel's edge to split it, drag dividers to resize, and resize the sidebar
- Persistent configuration saved in localStorage
- Add/remove widgets on the fly
- Configurable ROS topics per widget

**Connectivity**

- Real-time ROS2 connection via [foxglove_bridge](https://github.com/foxglove/foxglove-sdk) (Foxglove WebSocket protocol, messages CDR-decoded in the browser)
- Auto-reconnection on connection loss
- Topic discovery, search, and live data monitoring

---

## Quick start

With [pixi](https://pixi.sh) (no Node.js or ROS install needed):

```bash
pixi run miti                    # MITI on http://<this machine>:3000
pixi run -e humble miti-bridge   # MITI plus foxglove_bridge on this machine (use -e jazzy for Jazzy)
```

With Docker Compose, as a service that restarts with the machine:

```bash
docker compose up -d                    # MITI only
docker compose --profile bridge up -d   # MITI plus foxglove_bridge (Linux, host networking)
```

Running foxglove_bridge on the MITI machine lets it read the robot's topics over DDS, so the robot does not run the bridge itself. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the robot's own message types, DDS settings and network tips.

---

## Prerequisites

- **Node.js** 20+ and **npm** (or [Bun](https://bun.sh/))
- **ROS2** Humble Hawksbill or later
- **foxglove_bridge** for WebSocket communication
- **robot_state_publisher** on the robot, if the robot model should load from `/robot_description`

Install foxglove_bridge on Ubuntu (replace `humble` with your ROS distro):

```bash
sudo apt install ros-humble-foxglove-bridge
```

---

## Installation

```bash
git clone https://github.com/hiran-t/miti.git
cd miti
npm install
```

### Configure Connection (optional)

**Option A** - Environment variable:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_BRIDGE_URL=ws://192.168.10.27:8765
```

**Option B** - UI settings (recommended):

Click the settings icon next to the connection status in the app to change the URL at runtime. The setting persists in localStorage. A rosbridge URL saved by an earlier MITI version is migrated to the same host on port 8765.

---

## Usage

### 1. Start foxglove_bridge

On the robot:

```bash
source /opt/ros/humble/setup.bash
ros2 launch foxglove_bridge foxglove_bridge_launch.xml
```

The bridge listens on port 8765 by default.

### 2. Start MITI

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Production build (web)

```bash
npm run build
npm start
```

---

## Project Structure

```
miti/
├── src/
│   ├── app/                     # Next.js App Router (layout, page, globals.css)
│   ├── components/features/     # Feature-based components
│   │   ├── connection/          #   Connection status & settings
│   │   ├── controls/            #   Button/switch widgets
│   │   ├── dashboard/           #   Main dashboard
│   │   ├── layout/              #   Grid layout, widget container
│   │   ├── topic-viewer/        #   Topic list, cards, data display
│   │   ├── logs/                #   Log panel (/rosout)
│   │   └── visualization/       #   Camera, point cloud, URDF, TF, state machine
│   ├── hooks/                   # React hooks (useBridge, useTopic, useTF, etc.)
│   ├── lib/                     # Core libraries (foxglove_bridge client, parsers)
│   ├── styles/                  # Centralized Tailwind style modules
│   ├── types/                   # TypeScript definitions
│   └── constants/               # ROS topic constants
├── public/                      # Static assets (logos, icons)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

---

## ROS2 Integration

### Supported message types

| Type                      | Used for                    |
| ------------------------- | --------------------------- |
| `std_msgs/String`         | URDF robot description      |
| `sensor_msgs/JointState`  | Joint positions (animation) |
| `sensor_msgs/PointCloud2` | Point cloud data            |
| `sensor_msgs/Image`       | Camera feeds                |
| `tf2_msgs/TFMessage`      | TF frame transforms         |

All standard ROS2 message types can be viewed in the topic browser.

### URDF loading

**From ROS topic** (default):

```bash
ros2 topic pub /robot_description std_msgs/msg/String \
  "data: '$(cat robot.urdf)'" --once
```

**From URL**:

1. Serve URDF files with a CORS-enabled HTTP server:

```bash
cd /path/to/robot_description
python3 -m http.server 8000
```

2. In MITI, switch to URL mode and enter:
   - URDF URL: `http://<host>:8000/robot.urdf`
   - Mesh Base URL: `http://<host>:8000`

Package paths like `package://robot_description/meshes/base.stl` are resolved against the mesh base URL automatically.

### Publishing test data

```bash
# String topic
ros2 topic pub /test std_msgs/msg/String "data: 'Hello MITI'"

# Joint states
ros2 topic pub /joint_states sensor_msgs/msg/JointState \
  "{name: ['joint1', 'joint2'], position: [0.5, 1.0], velocity: [], effort: []}"
```

---

## Customization

### Subscribing to a custom topic

```typescript
import { useTopic } from '@/hooks/useTopic';

function MyWidget({ client }) {
  const { data, lastUpdate } = useTopic(client, '/my_topic', 'std_msgs/String');
  return <div>{data?.data}</div>;
}
```

### Adding a new widget

1. Define props in `src/types/widget.ts`
2. Create component in `src/components/features/visualization/<name>/`
3. Register in `src/components/features/layout/WidgetContainer.tsx`
4. Add widget metadata to `WIDGET_TYPES` in `src/types/widget.ts`

### Modifying styles

All styles are centralized in `src/styles/`. Edit the relevant module:

- `common.styles.ts` - Buttons, inputs, cards, modals
- `visualization.styles.ts` - Camera, URDF, point cloud viewers
- `widget.styles.ts` - Panel tabs and containers
- `topic.styles.ts` - Topic list
- `connection.styles.ts` - Connection status and settings dialog

Colors come from the tokens in `src/lib/theme.ts`; the workspace shell is styled in `src/app/globals.css`.

### Connection settings

| Method       | File / Location                 | Persists       |
| ------------ | ------------------------------- | -------------- |
| `.env.local` | `NEXT_PUBLIC_BRIDGE_URL`        | Per deployment |
| UI settings  | Settings icon in the header bar | localStorage   |

---

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Type checking
npm run type-check

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check
```

---

## Troubleshooting

### Cannot connect to foxglove_bridge

- Verify foxglove_bridge is running: `ros2 node list | grep foxglove_bridge`
- Check the WebSocket URL (default: `ws://localhost:8765`)
- Check firewall settings for port 8765

### Topics list is empty

- Verify ROS2 nodes are running: `ros2 topic list`
- Click the refresh button in the topic browser
- Check foxglove_bridge logs for errors

### URDF not loading from URL

- Ensure the HTTP server sends CORS headers (`Access-Control-Allow-Origin: *`)
- Test the URL directly: `curl http://<host>:8000/robot.urdf`
- Check browser console for specific errors

### Point cloud not rendering

- Verify topic publishes `sensor_msgs/PointCloud2`
- Check data rate: `ros2 topic hz /camera/depth/points`

### Build errors

```bash
rm -rf node_modules .next
npm install
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [ROS2](https://docs.ros.org/) and the robotics community
- [foxglove_bridge](https://github.com/foxglove/foxglove-sdk) (MIT)
- [Three.js](https://threejs.org/) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [urdf-loader](https://github.com/gkjohnson/urdf-loaders)
