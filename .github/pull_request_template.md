## Description

<!-- What this pull request changes and why -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change (existing layouts, settings or deployments stop working as before)
- [ ] Performance improvement
- [ ] Refactoring
- [ ] Documentation
- [ ] Deployment (pixi, Docker, `ros/`, `scripts/`)

## Testing

<!-- How you tested it. Mark what applies. -->

- [ ] `npm run lint`, `npm run type-check`, `npm test` and `npm run build` pass
- [ ] Tested with real robot data through miti_bridge
- [ ] Tested through foxglove_bridge too (for changes to the bridge client or to what a panel subscribes to)
- [ ] Tested under load with `scripts/heavy-bridge.js` (for performance-sensitive changes)
- [ ] Tested an older saved layout still loads (for changes to panel settings)

**Test setup**

- ROS 2 distro:
- Bridge: <!-- miti_bridge or foxglove_bridge, and its version; on the robot, or beside MITI with pixi or Docker -->
- Browser and OS:

## Screenshots

<!-- For UI changes, before and after -->

## Checklist

- [ ] Documentation updated (README.md, `docs/`) where behavior changed
- [ ] CHANGELOG.md has a line under `## [Unreleased]`
- [ ] `package-lock.json` updated with npm if dependencies changed
