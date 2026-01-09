# Vizzy - ROS2 Web Dashboard

A modern web application for visualizing and monitoring ROS2 topics in real-time. Built with Next.js 14, React 18, and Three.js for high-performance 3D visualization.

![Vizzy Dashboard](https://img.shields.io/badge/ROS2-Humble%20%7C%20Iron-blue)
![Next.js](https://img.shields.io/badge/Next.js-14+-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Features

### Core Features
- **Real-time ROS2 Connection**: Connect to ROS2 via rosbridge_server WebSocket
- **Auto-reconnection**: Automatic reconnection on connection loss
- **Topic Management**: Browse, search, and subscribe to ROS2 topics
- **Live Data Monitoring**: View real-time topic data in JSON format

### Visualization
- **URDF 3D Viewer**: Visualize robot models from `/robot_description` topic
- **Point Cloud Viewer**: Real-time point cloud visualization from depth cameras
- **Interactive 3D Controls**: Pan, zoom, and rotate with mouse controls
- **Color Mapping**: Depth-based or RGB coloring for point clouds

### UI/UX
- **Modern Dark Theme**: Beautiful gradient-based dark interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Live connection status and message counts
- **Search & Filter**: Quickly find topics with instant search

## 📋 Prerequisites

Before running Vizzy, ensure you have the following installed:

### ROS2
- **ROS2 Distribution**: Humble Hawksbill or later
- **rosbridge_suite**: For WebSocket communication

```bash
# Install ROS2 (Ubuntu)
# Follow official ROS2 installation guide for your distribution
# https://docs.ros.org/en/humble/Installation.html

# Install rosbridge_suite
sudo apt install ros-${ROS_DISTRO}-rosbridge-suite
```

### Node.js & Bun
- **Node.js**: 20.x or later
- **Bun**: 1.0 or later (optional but recommended)

```bash
# Install Bun (optional)
curl -fsSL https://bun.sh/install | bash

# Or use npm (comes with Node.js)
```

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone https://github.com/thongpanchang/vizzy.git
cd vizzy
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

3. **Configure environment variables** (optional)

Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_ROSBRIDGE_URL=ws://localhost:9090
```

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

### 2. Run the Vizzy Dashboard

In a new terminal, start the Next.js development server:

Using Bun:
```bash
bun dev
```

Or using npm:
```bash
npm run dev
```

### 3. Open your browser

Navigate to [http://localhost:3000](http://localhost:3000)

You should see:
- ✅ Connection status showing "Connected"
- 📋 List of available ROS2 topics
- 🎨 3D visualization panels ready

## 🏗️ Architecture

### Project Structure

```
vizzy/
├── app/                          # Next.js App Router
│   ├── components/              # React components
│   │   ├── Dashboard.tsx        # Main dashboard layout
│   │   ├── ConnectionStatus.tsx # Connection indicator
│   │   ├── TopicViewer/        # Topic browsing components
│   │   │   ├── TopicList.tsx
│   │   │   ├── TopicCard.tsx
│   │   │   └── TopicDataDisplay.tsx
│   │   └── Visualization/       # 3D visualization components
│   │       ├── Scene3D.tsx      # Three.js scene wrapper
│   │       ├── URDFViewer.tsx   # URDF model viewer
│   │       ├── PointCloudViewer.tsx
│   │       └── ViewerControls.tsx
│   ├── hooks/                   # React hooks
│   │   ├── useRosbridge.ts     # ROS connection management
│   │   ├── useTopic.ts         # Topic subscription
│   │   └── useTopicList.ts     # Topic discovery
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page
├── lib/                         # Core libraries
│   ├── rosbridge/              # rosbridge client
│   │   ├── client.ts           # WebSocket client
│   │   ├── types.ts            # TypeScript types
│   │   └── messages.ts         # Message builders
│   └── utils/                  # Utility functions
│       ├── pointcloud-parser.ts
│       └── urdf-loader-helper.ts
├── types/                       # TypeScript definitions
│   └── ros-messages.d.ts       # ROS message types
└── public/                      # Static assets
```

### Technology Stack

- **Frontend Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **3D Graphics**: Three.js, React Three Fiber, Drei
- **State Management**: Zustand (for future use)
- **Icons**: Lucide React
- **Runtime**: Bun / Node.js

## 📡 ROS2 Integration

### Supported Message Types

Vizzy currently supports:

- `std_msgs/String` - For URDF robot descriptions
- `sensor_msgs/PointCloud2` - For point cloud data
- All standard ROS2 message types (view-only)

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

## 🎨 Customization

### Changing the rosbridge URL

Edit `.env.local`:
```env
NEXT_PUBLIC_ROSBRIDGE_URL=ws://your-robot-ip:9090
```

### Customizing the Theme

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
- [ ] Point cloud renders correctly
- [ ] Reconnection works after disconnect
- [ ] Search and filter topics works
- [ ] Responsive on mobile devices
- [ ] No console errors

### Publishing Test Data

```bash
# Publish test string
ros2 topic pub /test_topic std_msgs/msg/String "data: 'Hello Vizzy'"

# Publish robot description (example)
ros2 topic pub /robot_description std_msgs/msg/String "data: '$(cat robot.urdf)'"
```

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

```bash
# Build for production
bun run build
# or
npm run build

# Start production server
bun start
# or
npm start
```

## 📚 Additional Resources

- [ROS2 Documentation](https://docs.ros.org/en/humble/)
- [rosbridge_suite](https://github.com/RobotWebTools/rosbridge_suite)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [Three.js](https://threejs.org/docs/)

## 🤝 Contributing

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
