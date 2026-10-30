# Deployment Guide

This guide covers different deployment options for MITI.

## Table of Contents

- [Quick Start](#quick-start)
- [foxglove_bridge Beside MITI](#foxglove_bridge-beside-miti)
- [Development](#development)
- [Production Build](#production-build)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Quick Start

Two ways to run MITI on a machine, neither needing Node.js or ROS installed system-wide.

### pixi

Install [pixi](https://pixi.sh) once (`curl -fsSL https://pixi.sh/install.sh | bash`), then in this repository:

```bash
pixi run miti            # install, build and serve MITI on http://<this machine>:3000
pixi run miti 8080       # on another port
```

The first run installs Node.js and the npm packages and builds MITI; later runs start in seconds and rebuild only when the source changed. Linux (x86-64, ARM64) and macOS (Apple silicon) are supported.

### Docker Compose (as a service)

```bash
docker compose up -d     # build and start MITI on port 3000; restarts with the machine
```

Both serve MITI to any browser on the network. By default the browser connects to foxglove_bridge on port 8765 of the machine that served MITI; open the connection settings (status bar, bottom left) to connect to a robot's own bridge instead, or set `NEXT_PUBLIC_BRIDGE_URL` (see [Environment Variables](#environment-variables)).

## foxglove_bridge Beside MITI

Instead of running foxglove_bridge on the robot, run it on the MITI machine. It joins the robot's ROS 2 network over DDS and subscribes only to the topics someone is viewing; the robot just publishes as usual, and the bridge's work (subscribing, encoding, one WebSocket stream per browser) moves off the robot.

```
robot (ROS 2 nodes) ──DDS──▶ MITI machine: foxglove_bridge :8765 + MITI :3000 ◀── browsers
```

### With pixi

Pick the environment that matches the robot's ROS 2 distro (`humble` or `jazzy`; nodes of different distros do not discover each other reliably):

```bash
pixi run -e humble miti-bridge   # MITI and foxglove_bridge together
pixi run -e humble bridge        # foxglove_bridge only
```

### With Docker Compose

```bash
docker compose --profile bridge up -d
```

Set the distro and DDS settings in `.env` first (copy [.env.example](../.env.example)); put `COMPOSE_PROFILES=bridge` there to start the bridge on every `docker compose up`. The bridge container uses host networking, which DDS discovery needs, so this runs on Linux; Docker Desktop on macOS and Windows cannot join the robot's DDS network.

### Settings

Environment variables, read by `ros/foxglove-bridge.sh` (pixi and Docker alike):

| Variable                   | Default            |                                                                                  |
| -------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `ROS_DOMAIN_ID`            | `0`                | Must match the robot                                                             |
| `RMW_IMPLEMENTATION`       | `rmw_fastrtps_cpp` | Or `rmw_cyclonedds_cpp`, which reads [ros/cyclonedds.xml](../ros/cyclonedds.xml) |
| `ROS_DISTRO`               | `humble`           | Docker only; with pixi choose `-e humble` / `-e jazzy`                           |
| `BRIDGE_PORT`              | `8765`             | WebSocket port                                                                   |
| `BRIDGE_TOPIC_WHITELIST`   | `['.*']`           | Regexes of topics to offer                                                       |
| `BRIDGE_SEND_BUFFER_LIMIT` | `10000000`         | Bytes queued per browser before messages are dropped                             |

### The robot's own message types

The bridge can only offer topics whose message definitions are installed beside it. The standard packages (`common_interfaces`, `tf2_msgs`, `nav2_msgs`, `map_msgs`, `moveit_msgs`, `foxglove_msgs`, `control_msgs`, `vision_msgs`) are included. For the robot's own packages (for example `oc_g1_msgs`), copy their source into `ros/overlay/src` and build them:

```bash
pixi run -e humble build-msgs            # pixi; restart the bridge afterwards
docker compose --profile bridge build    # Docker builds them into the image
```

Topics of types that are still missing are left out, and the bridge logs `package '...' not found`.

### Network and DDS

DDS carries every message the bridge subscribes to from the robot to this machine, so the link still decides how much fits:

- **Use compressed images.** A raw 1280×720 image is 2.7 MB; on a test network a raw camera reached this machine at about 2.5 frames per second, while joint states (40 Hz), TF and odometry arrived in full. Subscribe MITI to `/compressed` image topics, or offer only those with `BRIDGE_TOPIC_WHITELIST`.
- **Large messages over Wi-Fi** need big socket buffers. With Cyclone DDS, [ros/cyclonedds.xml](../ros/cyclonedds.xml) asks for up to 16 MB; raise the kernel limit once on Linux: `sudo sysctl -w net.core.rmem_max=16777216` (add it to `/etc/sysctl.conf` to keep it).
- **Several networks** (Wi-Fi, Ethernet, Docker): pin the robot's network with `<NetworkInterface name="..."/>` in `ros/cyclonedds.xml` if discovery picks the wrong one.
- The first subscription can take a few seconds while DDS discovery settles; later ones are immediate.

## Development

### Local Development

1. Install dependencies:

```bash
bun install
```

2. Start development server:

```bash
bun run dev
```

3. Open http://localhost:3000

### With Custom foxglove_bridge URL

```bash
NEXT_PUBLIC_BRIDGE_URL=ws://192.168.1.100:8765 bun run dev
```

On the robot, run foxglove_bridge (package `ros-<distro>-foxglove-bridge`, port 8765 by default):

```bash
ros2 launch foxglove_bridge foxglove_bridge_launch.xml
```

## Production Build

### Standard Build

```bash
# Build the application
bun run build

# Start production server
bun run start
```

### Optimize for Production

1. Update [next.config.js](next.config.js):

```javascript
module.exports = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  // Add other optimizations
};
```

2. Build:

```bash
bun run build
```

## Docker Deployment

[docker-compose.yml](../docker-compose.yml) runs MITI as a service (`restart: unless-stopped`), optionally with foxglove_bridge beside it (see [foxglove_bridge Beside MITI](#foxglove_bridge-beside-miti)).

```bash
cp .env.example .env              # optional: port, bridge address, ROS settings
docker compose up -d              # MITI only
docker compose --profile bridge up -d   # MITI and foxglove_bridge
docker compose logs -f            # follow logs
docker compose up -d --build      # rebuild after updating MITI
docker compose down               # stop
```

Make sure Docker itself starts at boot (`sudo systemctl enable docker`) so the services come back after a restart.

### Without Compose

```bash
docker build -t miti:latest .
docker run -d --restart unless-stopped -p 3000:3000 --name miti miti:latest
```

`NEXT_PUBLIC_BRIDGE_URL` is built into the app, so pass it as a build argument, not a runtime variable: `docker build --build-arg NEXT_PUBLIC_BRIDGE_URL=ws://robot:8765 -t miti:latest .`

## Cloud Deployment

### Vercel

1. Install Vercel CLI:

```bash
npm i -g vercel
```

2. Deploy:

```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_BRIDGE_URL`

### AWS (EC2)

1. Launch Ubuntu EC2 instance

2. Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

3. Clone and build:

```bash
git clone https://github.com/yourusername/miti.git
cd miti
bun install
bun run build
```

4. Use PM2 for process management:

```bash
npm install -g pm2
pm2 start "bun run start" --name miti
pm2 save
pm2 startup
```

### DigitalOcean

1. Create Droplet with Docker

2. SSH into droplet:

```bash
ssh root@your-droplet-ip
```

3. Pull and run:

```bash
git clone https://github.com/yourusername/miti.git
cd miti
docker-compose up -d
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name miti.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support (foxglove_bridge)
    location /ws {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## Environment Variables

### Optional

- `NEXT_PUBLIC_BRIDGE_URL`: foxglove_bridge WebSocket URL MITI opens by default. Unset, it is `ws://<host MITI was served from>:8765`, which reaches a bridge running beside MITI. Built into the app at build time. Replaces the former `NEXT_PUBLIC_ROSBRIDGE_URL`. Users can always change the address in the connection settings; their choice is remembered in the browser.

- `NODE_ENV`: `development` or `production`
- `PORT`: Server port (default: 3000)
- `MITI_PACKAGE_PATH`: Extra ROS package directories for MITI's `/api/package` mesh fallback (also reads `AMENT_PREFIX_PATH` / `ROS_PACKAGE_PATH` on the machine running MITI). Meshes are normally fetched through foxglove_bridge.

### Setting Environment Variables

#### Development (.env.local)

```bash
NEXT_PUBLIC_BRIDGE_URL=ws://localhost:8765
```

#### Production (Docker)

Set it in `.env` before `docker compose up -d --build`, or `docker build --build-arg NEXT_PUBLIC_BRIDGE_URL=ws://robot:8765 .`

#### Production (Vercel)

Set in Vercel dashboard under Settings > Environment Variables

## Performance Optimization

### Enable Caching

Add to [next.config.js](next.config.js):

```javascript
module.exports = {
  experimental: {
    optimizeCss: true,
  },
  images: {
    minimumCacheTTL: 60,
  },
};
```

### CDN Integration

1. Upload static assets to CDN
2. Update [next.config.js](next.config.js):

```javascript
module.exports = {
  assetPrefix: 'https://cdn.example.com',
};
```

### Compression

Enable gzip/brotli in production:

```javascript
// next.config.js
module.exports = {
  compress: true,
};
```

## Security Considerations

### HTTPS/WSS

Always use secure connections in production:

```bash
NEXT_PUBLIC_BRIDGE_URL=wss://secure-robot:8765
```

### Bridge Configuration

Configure the foxglove_bridge address and port if needed:

```bash
ros2 launch foxglove_bridge foxglove_bridge_launch.xml \
  port:=8765 \
  address:=0.0.0.0
```

### Firewall Rules

Open only necessary ports:

```bash
# Allow MITI web interface
sudo ufw allow 3000/tcp

# Allow foxglove_bridge (if remote)
sudo ufw allow 8765/tcp
```

## Troubleshooting

### Build Failures

**Issue**: Out of memory during build

```bash
# Increase Node memory
NODE_OPTIONS=--max_old_space_size=4096 bun run build
```

### Connection Issues

**Issue**: Cannot connect to foxglove_bridge

1. Check foxglove_bridge is running:

```bash
ros2 node list | grep foxglove_bridge
```

2. Check WebSocket is accessible:

```bash
# foxglove_bridge 3.x; use -s foxglove.websocket.v1 for older bridges
wscat -c ws://localhost:8765 -s foxglove.sdk.v1
```

3. Check firewall:

```bash
sudo ufw status
```

### Docker Issues

**Issue**: Container crashes

View logs:

```bash
docker logs miti
```

Check resource limits:

```bash
docker stats miti
```

### Performance Issues

1. Enable production mode:

```bash
NODE_ENV=production bun run start
```

2. Monitor resource usage:

```bash
# CPU/Memory
htop

# Network
iftop
```

3. Check browser console for errors

## Monitoring

### Basic Health Check

Create [/api/health/route.ts](src/app/api/health/route.ts):

```typescript
export async function GET() {
  return Response.json({ status: 'ok' });
}
```

### Uptime Monitoring

Use services like:

- UptimeRobot
- Pingdom
- StatusCake

### Logging

Add structured logging:

```typescript
// lib/logger.ts
export const logger = {
  info: (msg: string, meta?: any) => {
    console.log(JSON.stringify({ level: 'info', msg, ...meta }));
  },
  error: (msg: string, error?: Error) => {
    console.error(JSON.stringify({ level: 'error', msg, error }));
  },
};
```

## Scaling

### Horizontal Scaling

Use load balancer with multiple MITI instances:

```yaml
# docker-compose-scale.yml
version: '3.8'
services:
  miti:
    image: miti:latest
    deploy:
      replicas: 3
    environment:
      - NEXT_PUBLIC_BRIDGE_URL=ws://robot:8765

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### Vertical Scaling

Increase container resources:

```yaml
services:
  miti:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Backup

### Configuration Backup

Important files to backup:

- `.env.local`
- User settings (localStorage)
- Custom configurations

### Automated Backup

```bash
#!/bin/bash
# backup.sh
tar -czf miti-backup-$(date +%Y%m%d).tar.gz \
  .env.local \
  docker-compose.yml \
  nginx.conf
```

## Updates

### Application Updates

```bash
# Pull latest code
git pull origin main

# Rebuild
docker-compose down
docker-compose build
docker-compose up -d
```

### Dependency Updates

```bash
# Check for updates
bun update --latest

# Update specific package
bun update <package-name>@latest
```
