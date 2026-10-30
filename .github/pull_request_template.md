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
- [ ] Tested against foxglove_bridge with real robot data
- [ ] Tested under load with `scripts/heavy-bridge.js` (for performance-sensitive changes)
- [ ] Tested an older saved layout still loads (for changes to panel settings)

**Test setup**

- ROS 2 distro:
- foxglove_bridge: <!-- on the robot, or beside MITI with pixi or Docker -->
- Browser and OS:

## Screenshots

<!-- For UI changes, before and after -->

## Checklist

- [ ] Documentation updated (README.md, `docs/`) where behavior changed
- [ ] CHANGELOG.md has a line under `## [Unreleased]`
- [ ] `bun.lock` updated along with `package-lock.json` if dependencies changed
