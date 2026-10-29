# Deployment Guide

This guide covers different deployment options for MITI.

## Table of Contents

- [Development](#development)
- [Production Build](#production-build)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

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

### Build Docker Image

```bash
docker build -t miti:latest .
```

### Run Container

```bash
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_BRIDGE_URL=ws://your-robot-ip:8765 \
  --name miti \
  miti:latest
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Update Configuration

Edit [docker-compose.yml](docker-compose.yml):

```yaml
environment:
  - NEXT_PUBLIC_BRIDGE_URL=ws://your-robot-ip:8765
```

The MITI container only needs `NEXT_PUBLIC_BRIDGE_URL` pointing at the robot's foxglove_bridge. [docker-compose.yml](docker-compose.yml) also contains an optional, commented-out `foxglove-bridge` service.

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

### Required

- `NEXT_PUBLIC_BRIDGE_URL`: foxglove_bridge WebSocket URL (default: `ws://localhost:8765`). Replaces the former `NEXT_PUBLIC_ROSBRIDGE_URL`.

### Optional

- `NODE_ENV`: `development` or `production`
- `PORT`: Server port (default: 3000)
- `MITI_PACKAGE_PATH`: Extra ROS package directories for MITI's `/api/package` mesh fallback (also reads `AMENT_PREFIX_PATH` / `ROS_PACKAGE_PATH` on the machine running MITI). Meshes are normally fetched through foxglove_bridge.

### Setting Environment Variables

#### Development (.env.local)

```bash
NEXT_PUBLIC_BRIDGE_URL=ws://localhost:8765
```

#### Production (Docker)

```bash
docker run -e NEXT_PUBLIC_BRIDGE_URL=ws://robot:8765 miti:latest
```

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
