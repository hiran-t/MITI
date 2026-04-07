<div align="center">
  <img src="public/main_logo.svg" alt="MITI Logo" width="800"/>
  
  # MITI - ROS2 Web Visualization
  
  **A modern, real-time web application for visualizing ROS2 robots and sensor data**
  
  Built with Next.js 14, React 18, and Three.js for high-performance 3D visualization
  
  [![ROS2](https://img.shields.io/badge/ROS2-Humble%20%7C%20Iron%20%7C%20Jazzy-blue)](https://docs.ros.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-14+-black)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue)](https://www.typescriptlang.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
  
  [Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Documentation](#-documentation) • [Contributing](#-contributing)
  
</div>

---

## 📖 Table of Contents

- [Features](#-features)
- [Demo](#-demo)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [ROS2 Integration](#-ros2-integration)
- [Customization](#-customization)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Production Build](#-production-build)
  - [Web Build](#web-build-nextjs-server)
  - [Desktop App Build (Electron)](#️-desktop-app-build-electron)
    - [macOS](#macos-produces-dmg)
    - [Windows](#windows-produces-exe-installer)
    - [Ubuntu / Linux](#ubuntu--linux-produces-deb-and-appimage)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)
- [Support](#-support)

## 🚀 Features

### Core Features

- **Real-time ROS2 Connection**: Connect to ROS2 via rosbridge_server WebSocket
- **Auto-reconnection**: Automatic reconnection on connection loss
- **Topic Management**: Browse, search, and subscribe to ROS2 topics
- **Live Data Monitoring**: View real-time topic data in JSON format

### Visualization

- **URDF 3D Viewer**: Visualize robot models from `/robot_description` topic
- **Live Robot Motion**: Robot model automatically updates with `/joint_states` topic
- **Point Cloud Viewer**: Real-time point cloud visualization from depth cameras
- **Interactive 3D Controls**: Pan, zoom, and rotate with mouse controls
- **Color Mapping**: Depth-based or RGB coloring for point clouds

### UI/UX

- **Modern Dark Theme**: Beautiful gradient-based dark interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Live connection status and message counts
- **Search & Filter**: Quickly find topics with instant search
- **Draggable Widgets**: Customizable dashboard layout with drag-and-drop
- **Persistent Configuration**: Layout and settings saved in browser localStorage

## 🎬 Demo

> **Note**: Add screenshots or GIF demonstrations of MITI in action here.

<details>
<summary>📸 Click to view screenshots</summary>

<!-- Add your screenshots here -->

```
Screenshots coming soon!
- Dashboard with multiple widgets
- URDF robot visualization
- Point cloud viewer
- Topic browser
```

</details>

## 📋 Prerequisites

Before running MITI, ensure you have the following installed:

### ROS2

- **ROS2 Distribution**: Humble Hawksbill or later
- **rosbridge_suite**: For WebSocket communication

````bash
# Install ROS2 (Ubuntu)
### Option 1: Clone from GitHub

```bash
# Clone the repository
git clone https://github.com/yourusername/miti.git
cd miti
````

### Option 2: Download Release

Download the latest release from the [Releases page](https://github.com/yourusername/miti/releases).

### Install Dependencies

Using Bun (recommended):

```bash
bun install
```

Or using npm:

```bash
npm install
```

> **Note**: This project uses **Bun** as the primary package manager and runtime. While npm/yarn will work, Bun provides significantly better performance and is recommended for development.
>
> Install Bun: `curl -fsSL https://bun.sh/install | bash`

### Configure Connection (O

```bash
git clone https://github.com/thongpanchang/miti.git
cd miti
```

2. **Install dependencies**

Using Bun (recommended):

```bash
bun install
```

Or using npm:

```bash
npm install
```

> **Note**: This project uses **Bun** as the primary package manager and runtime. While npm/yarn will work, Bun provides better performance and is recommended.

3. **Configure rosbridge connection** (optional)

You can configure the rosbridge server URL in two ways:

**Option 1: Using environment variables** (for default connection)

Copy the example environment file and edit it:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set your rosbridge URL:

```env
NEXT_PUBLIC_ROSBRIDGE_URL=ws://192.168.10.27:9090
```

**Option 2: Using the UI settings** (recommended for easy switching)

Once the app is running, click the settings icon (⚙️) next to the connection status to change the rosbridge URL without editing files. The URL is saved in your browser's localStorage and persists across sessions.

Examples:

- Local development: `ws://localhost:9090`
- Remote rosbidge: `ws://192.168.10.27:9090`
- Docker container: `ws://ros-bridge:9090` (network=host)

## 🚦 Usage

### 1. Start ROS2 and rosbridge_server

First, source your ROS2 workspace and start rosbridge:

```bash
# Source ROS2
source /opt/ros/humble/setup.bash

# Start rosbridge_server
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

The rosbridge server will start on `ws://localhost:9090` by default.

### 2. Run the MITI Dashboard

In a new terminal, start the Next.js development server:

Using Bun (recommended):

```bash
bun dev
```

Or using npm:

```bash
npm run dev
```

> **Building for production:**
>
> ```bash
> bun run build  # Build optimized production bundle
> bun start      # Start production server
> ```

### 3. Open your browser

Navigate to [http://localhost:3000](http://localhost:3000)

You should see:

- ✅ Connection status showing "Connected"
- 📋 List of available ROS2 topics
- 🎨 3D visualization panels ready

## 🏗️ Architecture

### Project Structure

```
miti/
├── src/                         # Source directory (Next.js 14 App Router)
│   ├── app/                    # Next.js App Router
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   │
│   ├── components/             # React components (feature-based organization)
│   │   └── features/           # Feature-specific components
│   │       ├── connection/     # Connection management
│   │       │   ├── ConnectionStatus.tsx
│   │       │   └── ConnectionSettings.tsx
│   │       ├── dashboard/      # Main dashboard
│   │       │   └── Dashboard.tsx
│   │       ├── layout/         # Layout and grid system
│   │       │   ├── DraggableGridLayout.tsx
│   │       │   ├── WidgetContainer.tsx
│   │       │   ├── AddWidgetButton.tsx
│   │       │   └── LayoutConfig.tsx
│   │       ├── topic-viewer/   # Topic browsing and monitoring
│   │       │   ├── TopicList.tsx
│   │       │   ├── TopicCard.tsx
│   │       │   └── TopicDataDisplay.tsx
│   │       └── visualization/  # 3D visualization components
│   │           ├── camera/     # Camera feed viewer
│   │           │   └── CameraViewer.tsx
│   │           ├── pointcloud/ # Point cloud visualization
│   │           │   ├── PointCloudViewer.tsx
│   │           │   └── PointCloudRenderer.tsx
│   │           ├── tf/         # TF frame visualization
│   │           │   └── TFVisualizer.tsx
│   │           ├── urdf/       # URDF robot model viewer
│   │           │   ├── URDFViewer.tsx
│   │           │   ├── URDFModel.tsx
│   │           │   ├── URDFSettings.tsx
│   │           │   ├── URDFSourceSelector.tsx
│   │           │   ├── URDFLoadStatus.tsx
│   │           │   └── Scene3D.tsx
│   │           ├── shared/     # Shared visualization components
│   │           │   └── ViewerControls.tsx
│   │           └── hooks/       # Visualization-specific hooks
│   │               └── useUrdfUrlLoader.ts
│   │
│   ├── hooks/                    # Global React hooks
│   │   ├── useRosbridge.ts     # ROS connection management
│   │   ├── useTopic.ts         # Topic subscription
│   │   ├── useTopicList.ts     # Topic discovery
│   │   ├── useTF.ts            # TF frame handling
│   │   ├── useLayoutConfig.ts  # Widget layout management
│   │   ├── useLocalStorage.ts  # Local storage utilities
│   │   └── useUrdfConfig.ts    # URDF configuration state
│   │
│   ├── lib/                      # Core libraries
│   │   ├── rosbridge/          # rosbridge client
│   │   │   ├── client.ts       # WebSocket client
│   │   │   ├── types.ts        # TypeScript types
│   │   │   └── messages.ts     # Message builders
│   │   └── parsers/                        # Data parsers
│   │       ├── image-parser.ts
│   │       ├── pointcloud-parser.ts
│   │       └── urdf-parser/              # URDF loading utilities
│   │           ├── urdf-url-loader.ts
│   │           └── urdf-loader-helper.ts
│   │
│   ├── styles/                       # Centralized style modules
│   │   ├── index.ts                # Main style exports
│   │   ├── common.styles.ts        # Reusable UI patterns
│   │   ├── widget.styles.ts        # Widget container styles
│   │   ├── topic.styles.ts         # Topic viewer styles
│   │   ├── connection.styles.ts    # Connection UI styles
│   │   ├── dashboard.styles.ts     # Dashboard layout styles
│   │   ├── layout-config.styles.ts # Layout config styles
│   │   └── visualization.styles.ts # Visualization styles
│   │
│   └── types/                    # TypeScript definitions
│       ├── ros-messages.d.ts   # ROS message types
│       ├── tf-messages.d.ts    # TF frame types
│       ├── urdf-config.ts      # URDF configuration
│       ├── urdf-loader.d.ts    # URDF loader types
│       └── widget.ts           # Widget configuration
│
├── public/                     # Static assets
│   ├── main_logo.svg
│   └── ...
│
├── bunfig.toml                   # Bun configuration
├── next.config.js              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
├── LICENSE                     # MIT License
└── CONTRIBUTING.md             # Contribution guidelines
```

### Key Architecture Decisions

#### 1. Feature-Based Component Organization

Components are organized by feature rather than by type, making it easier to:

- Locate related components
- Understand feature boundaries
- Scale the application
- Maintain and refactor code

#### 2. Centralized Style Management

All component styles are extracted into TypeScript constant modules in `src/styles/`:

- **Consistency**: Single source of truth for design patterns
- **Maintainability**: Easy to update styles across components
- **Type Safety**: Full TypeScript support with intellisense
- **Reusability**: Common patterns defined once in `common.styles.ts`
- **Organization**: Feature-specific styles in separate modules

Example usage:

```typescript
import { visualizationStyles, cn } from '@/styles';

<div className={visualizationStyles.camera.container}>
  <button className={cn(
    commonStyles.button.primary,
    isActive && commonStyles.button.active
  )}>
    Click me
  </button>
</div>
```

#### 3. Path Aliases

The project uses TypeScript path aliases for clean imports:

- `@/components/*` → `src/components/*`
- `@/hooks/*` → `src/hooks/*`
- `@/lib/*` → `src/lib/*`
- `@/styles/*` → `src/styles/*`
- `@/types/*` → `src/types/*`
- `@/utils/*` → `src/utils/\* └── utils/ # Utility functions
  │ ├── pointcloud-parser.ts
  │ └── urdf-loader-helper.ts
  ├── types/ # TypeScript definitions
  │ └── ros-messages.d.ts # ROS message types
  └── public/ # Static assets

````

### Technology Stack

- **Frontend Framework**: Next.js 14 (App Router with `src/` directory)
- **Language**: TypeScript 5.9+
- **Runtime**: Bun (recommended) / Node.js 20+
- **Styling**: Tailwind CSS 3.4+ with centralized style modules
- **3D Graphics**: Three.js, React Three Fiber (@react-three/fiber), Drei (@react-three/drei)
- **State Management**: React hooks + localStorage
- **Grid Layout**: react-grid-layout (for draggable widget system)
- **Icons**: Lucide React
- **URDF Parsing**: urdf-loader (with custom URL loader extensions)
- **ROS Integration**: Custom rosbridge WebSocket client

## 📡 ROS2 Integration

### Supported Message Types

MITI currently supports:

- `std_msgs/String` - For URDF robot descriptions
- `sensor_msgs/JointState` - For robot joint positions (motion monitoring)
- `sensor_msgs/PointCloud2` - For point cloud data
- All standard ROS2 message types (view-only)

### URDF Loading and Motion Monitoring

MITI supports loading URDF robot models and monitoring their motion in real-time.

#### Joint States Motion Monitoring

Once a URDF model is loaded, MITI automatically subscribes to the `/joint_states` topic to animate the robot:

```bash
# The robot will automatically move as joint states are published
ros2 topic pub /joint_states sensor_msgs/msg/JointState "{name: ['joint1', 'joint2'], position: [0.5, 1.0]}"
````

**Features:**

- Real-time joint position updates
- Automatic joint name mapping
- Supports all joint types (revolute, prismatic, continuous, etc.)
- No configuration required - just publish to `/joint_states`

### URDF Loading Options

MITI supports multiple ways to load URDF robot descriptions:

#### 1. From ROS Topic (Default)

Subscribe to `/robot_description` topic or any custom topic:

```bash
# Publish URDF to ROS topic
ros2 topic pub /robot_description std_msgs/msg/String "data: '$(cat robot.urdf)'" --once
```

**In MITI:**

1. Ensure "ROS Topic" mode is selected
2. Enter your topic name (dehooks/useTopic';

function MyComponent({ client }) {
const { data, lastUpdate } = useTopic(
client,
'/my_topic',
'std_msgs/String'
);

return <div>{data?.data}</div>;
}

````

### Creating Custom Widgets

To add a new widget to the dashboard:

**Option 1: Environment Variable** (for default connection)

Edit `.env.local`:
```env
NEXT_PUBLIC_ROSBRIDGE_URL=ws://your-robot-ip:9090
````

**Option 2: UI Settings** (recommended)

Click the settings icon (⚙️) next to the connection status to change the URL dynamically. Settings are persisted in browser localStorage.

### Customizing Styles

The project uses a centralized style system for consistency and maintainability.

**Modifying Existing Styles:**
Edit the appropriate style module in `src/styles/`:

```typescript
// src/styles/visualization.styles.ts
export const visualizationStyles = {
  camera: {
    container: 'relative w-full h-full bg-gray-950 rounded-lg', // Modify here
    // ...
  },
};
```

**Adding New Style Patterns:**
Add to `src/styles/common.styles.ts` for reusable patterns:

```typescript
export const commonStyles = {
  button: {
    custom: 'px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg',
  },
};
```

**Theme Configuration:**
Edit global theme settings in:

- `src/app/globals.css` - Global CSS variables and base styles
- `tailwind.config.ts` - Tailwind theme extensions and color palette

### Adding New Visualizations

1. Create component in `src/components/features/visualization/`
2. Add feature-specific styles to `src/styles/visualization.styles.ts`
3. Use hooks from `src/hooks/` to subscribe to ROS topics
4. Register in widget system via `src/types/widget.ts`
5. Add to `WidgetContainer.tsx` for dashboard integration

Example structure:

```
src/components/features/visualization/
└── my-viz/
    ├── MyVizViewer.tsx      # Main component
    ├── MyVizRenderer.tsx    # Rendering logic
    └── MyVizControls.tsx    # User controls
```

    </div>

) 3. Enter URDF URL: `http://192.168.10.27:8000/robot.urdf` 4. Enter Mesh Base URL: `http://192.168.10.27:8000` 5. Click "Load URDF"

**Example: Using Python HTTP Server**

```bash
# In your robot description package
cd /path/to/robot_description
python3 -m http.server 8000 --bind 0.0.0.0
```

**Example: Using Python HTTP Server with CORS**

```python
# server.py
from http.server import HTTPServer, SimpleHTTPRequestHandler

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    print('Starting server on http://0.0.0.0:8000')
    HTTPServer(('0.0.0.0', 8000), CORSRequestHandler).serve_forever()
```

Run with: `python3 server.py`

#### 3. Package Path Resolution

URDF files often reference meshes using ROS package paths. MITI automatically converts these to HTTP URLs:

```
Input:  package://robot_description/meshes/base_link.stl
Base:   http://192.168.10.27:8000
Output: http://192.168.10.27:8000/meshes/base_link.stl
```

**For Complex Setups with Multiple Packages:**

You can configure package mappings for robots that use multiple packages:

```json
{
  "robot_description": "http://192.168.10.27:8000",
  "gripper_description": "http://192.168.10.27:8001",
  "sensor_description": "http://192.168.10.27:8002"
}
```

Example resolution with package mapping:

```
Input:  package://gripper_description/models/gripper.dae
Mapping: { "gripper_description": "http://192.168.10.27:8001" }
Output: http://192.168.10.27:8001/models/gripper.dae
```

#### CORS Configuration

If loading URDF from a different origin, you must configure CORS on your server. The Python example above shows how to enable CORS.

**For NGINX:**

```nginx
location / {
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
    add_header 'Access-Control-Allow-Headers' '*';
}
```

**For Apache:**

```apache
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, OPTIONS"
Header set Access-Control-Allow-Headers "*"
```

### Adding Custom Topic Subscriptions

```typescript
import { useTopic } from '@/app/hooks/useTopic';

function MyComponent({ client }) {
  const { data, lastUpdate } = useTopic(
    client,
    '/my_topic',
    'std_msgs/String'
  );

  return <div>{data?.data}</div>;
}
```

Build and deploy MITI for production:

```bash
# Build optimized production bundle
bun run build

# Start production server
bun start

# Or using npm
npm run build
npm start
```

The production build will:

- Optimize and minify all code
- Generate static assets
- Enable production-grade performance
- Tree-shake unused code
- Optimize images and assets

**Build Output:**

- Next.js generates optimized bundles in `.next/`
- Static assets are served from `.next/static/`
- Server-side rendering ready

**Environment Variables for Production:**
Create `.env.production`:

```env
NEXT_PUBLIC_ROSBRIDGE_URL=ws://your-production-robot:9090
```

**Docker Deployment** (optional):

````dockerfile
FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN bun run build

# Start
EXPOSE 3000
CMD ["bun", "start"]mizing the Theme

Edit `app/globals.css` or Tailwind configuration in `tailwind.config.ts`

### Adding New Visualizations

1. Create a new component in `app/components/Visualization/`
2. Use the `useTopic` hook to subscribe to your topic
3. Add it to the Dashboard grid layout

## 🧪 Testing

### Manual Testing Checklist

- [ ] rosbridge_server connection works
- [ ] Topics list loads correctly
- [ ] Can subscribe/unsubscribe to topics
- [ ] Topic data displays in real-time
- [ ] URDF viewer loads robot models
- [ ] Robot joints move with /joint_states topic
- [ ] Point cloud renders correctly
- [ ] Reconnection works after disconnect
- [ ] Search and filter topics works
- [ ] Responsive on mobile devices
- [ ] No console errors

### Publishing Test Data

```bash
# Publish test string
ros2 topic pub /test_topic std_msgs/msg/String "data: 'Hello MITI'"

# Publish robot description (example)
ros2 topic pub /robot_description std_msgs/msg/String "data: '$(cat robot.urdf)'"

# Publish joint states for robot motion
ros2 topic pub /joint_states sensor_msgs/msg/JointState "{header: {stamp: {sec: 0, nanosec: 0}, frame_id: ''}, name: ['joint1', 'joint2'], position: [0.5, 1.0], velocity: [], effort: []}"
````

## 🐛 Troubleshooting

### Connection Issues

**Problem**: Cannot connect to rosbridge_server

**Solutions**:

- Ensure rosbridge_server is running: `ros2 node list | grep rosbridge`
- Check the WebSocket URL in `.env.local`
- Verify firewall settings allow WebSocket connections
- Check browser console for detailed error messages

### No Topics Showing

**Problem**: Topics list is empty

**Solutions**:

- Verify ROS2 nodes are running: `ros2 node list`
- Check if topics exist: `ros2 topic list`
- Try refreshing the topics list (click refresh button)
- Ensure rosbridge_server is properly connected to ROS2

### Point Cloud Not Rendering

**Problem**: Point cloud viewer shows "No data"

**Solutions**:

- Verify topic name matches your camera: `/camera/depth/points`
- Check message type is `sensor_msgs/PointCloud2`
- Ensure point cloud data is being published: `ros2 topic hz /camera/depth/points`
- Check browser console for parsing errors

### URDF Not Loading from URL

**Problem**: Cannot load URDF from URL

**Solutions**:

1. **CORS Error**: Your server needs to allow cross-origin requests
   - Use the Python CORS server example provided above
   - Configure your web server (NGINX, Apache) to send CORS headers
   - For development, you can use a CORS proxy

2. **Network Error**:
   - Verify the URL is correct and accessible
   - Test URL in browser: `curl http://192.168.10.27:8000/robot.urdf`
   - Check if server is running and reachable
   - Verify firewall/network settings

3. **Mesh Loading Failures**:
   - Ensure Mesh Base URL is set correctly
   - Check that mesh files are accessible from the base URL
   - Verify package:// paths are being resolved correctly
   - Check browser console for specific mesh file errors

4. **URDF Parse Error**:
   - Verify URDF file is valid XML
   - Check for syntax errors in URDF file
   - Ensure file is complete (not truncated)

**Testing URDF URL Loading:**

```bash
# 1. Create test directory
mkdir -p /tmp/urdf_test/meshes
cd /tmp/urdf_test

# 2. Create simple URDF (save as robot.urdf)
cat > robot.urdf << 'EOF'
<?xml version="1.0"?>
<robot name="test_robot">
  <link name="base_link">
    <visual>
      <geometry>
        <box size="1 1 1"/>
      </geometry>
    </visual>
  </link>
</robot>
EOF

# 3. Start server with CORS
python3 -c "
from http.server import HTTPServer, SimpleHTTPRequestHandler

class CORSHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

HTTPServer(('0.0.0.0', 8000), CORSHandler).serve_forever()
"

# 4. In MITI:
#    - Switch to URL mode
#    - URDF URL: http://localhost:8000/robot.urdf
#    - Click Load URDF
```

### Build Errors

**Problem**: Build fails with dependency errors

**Solutions**:

```bash
# Clear cache and reinstall
rm -rf node_modules .next
bun install
# or
npm install

# If using Bun and it crashes, use npm instead
npm run dev
```

## 🚀 Production Build

### Web Build (Next.js Server)

```bash
# Build optimized production bundle
npm run build

# Start production server
npm start
```

---

### 🖥️ Desktop App Build (Electron)

MITI can be packaged as a standalone desktop application for macOS, Windows, and Ubuntu using Electron.
End users do not need to install Node.js or any server — just the installer.

#### Prerequisites

- **Node.js** 20+ and **npm**
- **Git**
- Each platform must be built on its own native machine (see cross-compile notes below)

---

#### macOS (produces `.dmg`)

Run on a **macOS** machine only.

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/yourusername/miti.git
cd miti
npm install

# 2. Build — Next.js static export + Electron packaging in one command
npm run electron:build:mac

# 3. Output installers
#    dist-electron/MITI-0.1.0.dmg          (Intel x64)
#    dist-electron/MITI-0.1.0-arm64.dmg    (Apple Silicon)
```

> End users install by opening the `.dmg` file and dragging **MITI.app** into Applications.

---

#### Windows (produces `.exe` installer)

Run on a **Windows** machine only.

```powershell
# 1. Clone the repository and install dependencies
git clone https://github.com/yourusername/miti.git
cd miti
npm install

# 2. Build
npm run electron:build:win

# 3. Output installer
#    dist-electron\MITI-0.1.0-Setup.exe
```

> End users install by double-clicking `MITI-0.1.0-Setup.exe`.

---

#### Ubuntu / Linux (produces `.deb` and `.AppImage`)

Run on an **Ubuntu/Linux** machine only.

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/yourusername/miti.git
cd miti
npm install

# 2. Build
npm run electron:build:linux

# 3. Output installers
#    dist-electron/MITI-0.1.0-amd64.deb
#    dist-electron/MITI-0.1.0.AppImage
```

Install on Ubuntu:

```bash
# Option 1: .deb (recommended — installs system-wide)
sudo dpkg -i dist-electron/MITI-0.1.0-amd64.deb

# Option 2: .AppImage (portable — no installation required)
chmod +x dist-electron/MITI-0.1.0.AppImage
./dist-electron/MITI-0.1.0.AppImage
```

---

#### What happens during the build

Each `electron:build:*` command runs three steps automatically:

```
npm run electron:build:mac
  └─ 1. next build           → generates static HTML/CSS/JS in out/
  └─ 2. electron-prepare.js  → copies out/ → app-out/
  └─ 3. electron-builder     → packages app-out/ + electron/ into an installer
```

> **Do not commit `app-out/`, `out/`, or `dist-electron/` to git.**
> All of these directories are generated at build time and are already listed in `.gitignore`.

---

#### Cross-Compile Notes

| Build machine | macOS            | Windows                    | Ubuntu           |
| ------------- | ---------------- | -------------------------- | ---------------- |
| **macOS**     | ✅ Native        | ⚠️ Requires Wine installed | ❌ Not supported |
| **Windows**   | ❌ Not supported | ✅ Native                  | ❌ Not supported |
| **Ubuntu**    | ❌ Not supported | ❌ Not supported           | ✅ Native        |

It is recommended to build each platform on its own native machine, or use GitHub Actions CI/CD to automate builds for all three platforms.

## 📚 Additional Resources

We love contributions! MITI is a community-driven project, and we welcome contributions of all kinds:

- 🐛 **Bug reports** - Found a bug? [Open an issue](https://github.com/yourusername/miti/issues/new)
- 💡 **Feature requests** - Have an idea? [Start a discussion](https://github.com/yourusername/miti/discussions)
- 📖 **Documentation** - Improve our docs
- 🔧 **Code contributions** - Submit a pull request

### How to Contribute

1. **Fork** the repository
2. **Clone** your fork: `git clone **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 MITI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

## 🙏 Acknowledgments

MITI stands on the shoulders of giants. We are grateful to:

- **[ROS2](https://docs.ros.org/)** - Robot Operating System community and maintainers
- **[rosbridge_suite](https://github.com/RobotWebTools/rosbridge_suite)** - WebSocket bridge for ROS
- **[Three.js](https://threejs.org/)** - 3D graphics library
- **[React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)** - React renderer for Three.js
- **[Next.js](https://nextjs.org/)** - React framework by Vercel
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Lucide](https://lucide.dev/)** - Beautiful icon set
- **[Bun](https://bun.sh/)** - Fast JavaScript runtime
- **[urdf-loader](https://github.com/gkjohnson/urdf-loaders)** - URDF parsing for Three.js

Special thanks to all [contributors](https://github.com/yourusername/miti/graphs/contributors) who have helped make MITI better!

## 💬 Support

### Getting Help

- 📚 **Documentation**: Start with this README and check our [wiki](https://github.com/yourusername/miti/wiki) (if available)
- 🐛 **Bug Reports**: [Open an issue](https://github.com/yourusername/miti/issues/new) with detailed reproduction steps
- 💡 **Feature Requests**: [Start a discussion](https://github.com/yourusername/miti/discussions) to propose new ideas
- ❓ **Questions**: Check [existing issues](https://github.com/yourusername/miti/issues) or open a new one

### Community

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and community support
- **Pull Requests**: For code contributions

### Stay Updated

- ⭐ **Star** this repository to show support
- 👁️ **Watch** for updates and new releases
- 🍴 **Fork** to create your own customized version

---

<div align="center">
  
### Made with ❤️ for the ROS2 Community

**[⬆ back to top](#miti---ros2-web-visualization)**

</div>
All contributors will be recognized in our release notes and README. Thank you for making MITI better! 🎉

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- ROS2 and the Robot Operating System community
- rosbridge_suite developers
- Three.js and React Three Fiber teams
- Next.js and Vercel teams

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Made with ❤️ for the ROS2 community**
