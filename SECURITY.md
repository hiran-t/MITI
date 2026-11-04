# Security policy

## Supported versions

Security fixes go into the latest release.

| Version | Supported          |
| ------- | ------------------ |
| 3.4.x   | :white_check_mark: |
| < 3.4   | :x:                |

## Reporting a vulnerability

Use **Report a vulnerability** on the repository's [Security tab](https://github.com/hiran-t/MITI/security), or email the maintainer at thongpanchang.h@gmail.com with "MITI security" in the subject.

**Do not report security vulnerabilities in public GitHub issues.**

### What to include

- Type of issue (for example cross-site scripting, path traversal, unintended file access)
- The affected source files, and the version, tag or commit
- Any configuration needed to reproduce it (how MITI and miti_bridge run, environment variables)
- Steps to reproduce
- Proof-of-concept code, if you have it
- The impact, and how an attacker could use it

### What to expect

- Confirmation of receipt within 48 hours
- A detailed response within 7 days
- Updates while a fix is in progress
- Credit in the release notes, unless you prefer to stay anonymous

## Deployment advice

MITI has no login, and neither has miti_bridge. Anyone who can open MITI and reach miti_bridge can see every topic the bridge offers, publish (Button Switch panel, 3D Scene **Publish**), call services and read parameters where the bridge allows it.

Anyone who can open MITI can also use the server's write API:

- `PUT /api/bridge` changes the ROS 2 network settings of the bridge that MITI started (`miti run --bridge`, `pixi run -e <distro> miti-bridge`) and restarts it.
- `POST /api/widgets` installs a widget, uploaded or downloaded by the server from a URL, and `DELETE /api/widgets` removes one. A widget is code that runs in the browser of everyone who opens MITI. `MITI_WIDGET_IMPORT=off` turns both off; installed widgets still load.

Both refuse requests sent by other sites' pages, so a page the operator happens to open cannot use them, but they do not stop someone on the network.

1. Run MITI and miti_bridge only on a trusted network (the robot's network or a VPN); do not expose ports 3000 and 8765 to the internet.
2. Limit what miti_bridge offers with its `topic_whitelist`, `service_whitelist`, `param_whitelist`, `client_topic_whitelist` and `capabilities` parameters ([miti_bridge parameters](https://github.com/hiran-t/MITI-sdk/blob/main/ros/miti_bridge/README.md#parameters)); when it runs beside MITI, set `BRIDGE_TOPIC_WHITELIST` (see the [configuration reference](docs/reference/configuration.md#bridge-beside-miti)). Turn off publishing or service calls you do not need.
3. Set `MITI_WIDGET_IMPORT=off` once the widgets you need are installed.
4. miti_bridge serves plain `ws://`. When traffic crosses a network you do not control, put MITI and the bridge behind a reverse proxy with TLS (`https://`, `wss://`); see [Serve MITI over HTTPS](docs/how-to-guides/serve-miti-over-https.md).
5. Keep MITI and miti_bridge up to date.
6. Run MITI as an unprivileged user; the Docker image already runs as a non-root user.

## Known security considerations

- MITI's server serves `package://` and `file://` meshes (`/api/package`, `/api/file`) from the ROS package paths it is given (`AMENT_PREFIX_PATH`, `ROS_PACKAGE_PATH` or `MITI_PACKAGE_PATH`). Only mesh, texture and URDF files inside those directories are served, but do not point these variables at directories with private files.
- URDF files and meshes loaded from URLs are fetched by the browser; load them only from sources you trust.
- Layouts and connection settings are kept in the browser's localStorage. Do not put secrets in them.
