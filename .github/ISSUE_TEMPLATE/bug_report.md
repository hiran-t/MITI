---
name: Bug report
about: Report something in MITI that does not work as expected
title: '[BUG] '
labels: bug
assignees: ''
---

## What happened

A clear description of the bug.

## Steps to reproduce

1. Open panel '...'
2. Set '...' to '...'
3. See the error

## Expected behavior

What you expected to happen.

## Screenshots

If they help, add screenshots or a short recording.

## Environment

- **MITI version**: [e.g. 3.2.0, or the commit]
- **How MITI runs**: [`pixi run miti`, Docker Compose, `npm run dev`, `npm start`]
- **Browser**: [e.g. Chrome 142]
- **OS of the MITI machine**: [e.g. Ubuntu 22.04, macOS 15]

## Robot and foxglove_bridge

- **ROS 2 distro**: [Humble, Jazzy, ...]
- **Where foxglove_bridge runs**: [on the robot / beside MITI with pixi (`pixi run -e humble miti-bridge`) / beside MITI with Docker (`docker compose --profile bridge up -d`)]
- **foxglove_bridge version**: [e.g. 3.6.0]
- **Bridge address in MITI**: [e.g. ws://192.168.1.10:8765]
- **Topics and message types involved**: [e.g. /camera/color/image_raw, sensor_msgs/msg/Image]
- **Network**: [same machine, wired, Wi-Fi, VPN]

## Logs

```
Browser console errors, and MITI or foxglove_bridge output if relevant
```

## Additional context

Anything else that might help, or an idea for a fix.
