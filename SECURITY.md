# Security policy

## Supported versions

Security fixes go into the latest release.

| Version | Supported          |
| ------- | ------------------ |
| 3.3.x   | :white_check_mark: |
| < 3.3   | :x:                |

## Reporting a vulnerability

Email the maintainer at thongpanchang.h@gmail.com with "MITI security" in the subject.

**Do not report security vulnerabilities in public GitHub issues.**

### What to include

- Type of issue (for example cross-site scripting, path traversal, unintended file access)
- The affected source files, and the version, tag or commit
- Any configuration needed to reproduce it (how MITI and foxglove_bridge run, environment variables)
- Steps to reproduce
- Proof-of-concept code, if you have it
- The impact, and how an attacker could use it

### What to expect

- Confirmation of receipt within 48 hours
- A detailed response within 7 days
- Updates while a fix is in progress
- Credit in the release notes, unless you prefer to stay anonymous

## Deployment advice

MITI has no login. Anyone who can open MITI and reach foxglove_bridge can see every topic the bridge offers, and can publish (Button Switch panel, 3D Scene **Publish**) and call services where the bridge allows it. foxglove_bridge itself has no authentication.

1. Run MITI and foxglove_bridge only on a trusted network (the robot's network or a VPN); do not expose ports 3000 and 8765 to the internet.
2. Limit what the bridge offers with its `topic_whitelist` (and, when it runs beside MITI, `BRIDGE_TOPIC_WHITELIST`; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)). Use foxglove_bridge's `capabilities` and service whitelist parameters to turn off publishing or service calls you do not need.
3. Use `wss://` (foxglove_bridge's TLS options, or a reverse proxy with TLS) when traffic crosses a network you do not control.
4. Keep MITI, its npm dependencies and foxglove_bridge up to date.
5. Run MITI as an unprivileged user; the Docker image already runs as a non-root user.

## Known security considerations

- MITI's server serves `package://` and `file://` meshes (`/api/package`, `/api/file`) from the ROS package paths it is given (`AMENT_PREFIX_PATH`, `ROS_PACKAGE_PATH` or `MITI_PACKAGE_PATH`). Only mesh, texture and URDF files inside those directories are served, but do not point these variables at directories with private files.
- URDF files and meshes loaded from URLs are fetched by the browser; load them only from sources you trust.
- Layouts and connection settings are kept in the browser's localStorage. Do not put secrets in them.
