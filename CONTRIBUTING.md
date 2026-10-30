# Contributing to MITI

Thank you for considering a contribution to MITI, a web dashboard for ROS 2 robots.

## Code of conduct

By taking part in this project you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## How to contribute

### Reporting bugs

Check the existing issues first to avoid duplicates. Then open an issue with the **Bug report** template; it asks for what MITI needs to reproduce the problem:

- MITI version, browser and operating system
- ROS 2 distro, and how foxglove_bridge runs (on the robot, or beside MITI with pixi or Docker)
- Steps to reproduce, what you expected and what happened
- Errors from the browser console and from the MITI or foxglove_bridge logs

Report security problems privately instead; see [SECURITY.md](SECURITY.md).

### Suggesting features

Open an issue with the **Feature request** template. Check first whether it has been suggested already, and describe the use case: which robot data or task it is for, and how you work around it today.

### Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep the change focused on one fix or feature.
3. Run the checks below and make sure they pass.
4. Update the documentation (README.md, files in `docs/`) when behavior changes, and add a line under `## [Unreleased]` in CHANGELOG.md.
5. Open the pull request with the template filled in, including how you tested it.

CI (`.github/workflows/ci.yml`) runs lint, type check, build and tests on every pull request to `main`, and `.github/workflows/docker.yml` builds the Docker image.

## Development setup

You need Node.js 22 and npm. [Bun](https://bun.sh) also works, and [pixi](https://pixi.sh) can provide Node.js for you.

```bash
git clone https://github.com/YOUR_USERNAME/MITI.git
cd MITI
npm ci                 # or: bun install
npm run dev            # http://localhost:3000, with hot reload
```

With pixi instead of a system Node.js, run `pixi run dev`.

npm is the primary package manager: CI and the Docker image install with `npm ci` from `package-lock.json`. If you change dependencies, update `package-lock.json` with npm and keep `bun.lock` in sync with `bun install`.

### A robot or test data to connect to

MITI talks to [foxglove_bridge](https://github.com/foxglove/foxglove-sdk) over the Foxglove WebSocket protocol (default port 8765). Enter the bridge address in the connection box in the status bar, or set `NEXT_PUBLIC_BRIDGE_URL` (see `.env.example`). Without it, MITI connects to `ws://<host MITI was served from>:8765`.

- On a robot: `ros2 launch foxglove_bridge foxglove_bridge_launch.xml`
- Beside MITI, joined to the robot over DDS: `pixi run -e humble bridge` (or `-e jazzy`); see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Without a robot: `node scripts/heavy-bridge.js` streams robot-sized test data on `ws://localhost:8790`; see [docs/PERFORMANCE.md](docs/PERFORMANCE.md)

### Checks

```bash
npm run lint          # ESLint
npm run type-check    # TypeScript
npm test              # Jest
npm run build         # production build
npm run format        # Prettier on src/
```

Stop `npm run dev` before running `npm run build` in the same folder: both write to `.next`, and a build breaks the running dev server.

A Husky pre-commit hook runs lint-staged (ESLint with `--fix` and Prettier on staged files). The hook calls `bun run lint-staged`, so it needs Bun installed.

## Coding style

### TypeScript and React

- Write new code in TypeScript.
- Use function components and hooks.
- Prefer `const`; do not use `var`.
- Use `async`/`await` rather than chained promises.
- Subscribe to topics through the hooks in `src/hooks/` (`useTopic`, `useTopicList`, `useTF`) instead of talking to the bridge client directly.

### Component structure

```typescript
'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { commonStyles } from '@/styles';

interface MyPanelProps {
  topic: string;
  label?: string;
}

export default function MyPanel({ topic, label = 'Status' }: MyPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={commonStyles.card.base} onClick={() => setExpanded(!expanded)}>
      <Activity className="h-4 w-4" /> {label}: {topic}
    </div>
  );
}
```

### Styling

- Shared class strings live in the style modules in `src/styles/`; import them from `@/styles`.
- Use Tailwind classes, and the `cn()` helper from `@/styles` for conditional classes.

```typescript
import { visualizationStyles, cn } from '@/styles';

<div className={cn(visualizationStyles.camera.title, isActive && 'border-accent')} />
```

### File naming

- Components: PascalCase (`LogPanel.tsx`)
- Hooks: `useSomething.ts`
- Other modules: kebab-case or camelCase as in the surrounding folder (`pointcloud-parser.ts`, `theme.ts`)
- Style modules: kebab-case with a `.styles.ts` suffix (`visualization.styles.ts`)
- Tests: in a `__tests__` folder beside the code, named `*.test.ts` or `*.test.tsx`

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` a new feature
- `fix:` a bug fix
- `perf:` a performance improvement
- `docs:` documentation only
- `refactor:` code changes that neither fix a bug nor add a feature
- `test:` adding or updating tests
- `chore:` maintenance (dependencies, tooling, releases without new features)

Examples:

```
feat: add color map options to the Point Cloud panel
fix: keep TF frames after reconnecting to foxglove_bridge
docs: describe running foxglove_bridge beside MITI
```

## Project structure

```
src/
├── app/                    # Next.js app and API routes (package:// and file:// meshes)
├── components/features/    # UI by feature: dashboard, layout, connection, topic-viewer,
│                           # visualization (3D Scene, camera, point cloud, state machine), logs, controls
├── constants/              # Default topic names
├── hooks/                  # React hooks (bridge connection, topics, TF, layout)
├── lib/                    # Bridge client, parsers, scene, camera, layout, logs, server helpers
├── styles/                 # Shared style modules
└── types/                  # TypeScript types
ros/                        # foxglove_bridge beside MITI (pixi and Docker)
scripts/                    # Deployment helpers and the performance harness
docs/                       # Documentation and release notes
```

## Testing

Unit tests use Jest and Testing Library and live in `__tests__` folders. Add tests for parsers, transforms and other logic you change.

Also test by hand:

- With real ROS 2 topics through foxglove_bridge, when the change touches robot data
- Edge cases: no connection, empty or missing topics, large messages, missing transforms
- Performance under heavy data, with `scripts/heavy-bridge.js` and `scripts/perf-run.js`
- Current Chrome, Edge, Firefox or Safari

## Documentation

When you add or change a feature:

1. Update README.md or the relevant file in `docs/`.
2. Add a line to CHANGELOG.md under `## [Unreleased]`.
3. Comment code whose purpose is not obvious, and update types for new interfaces.

## Questions

Open an issue, or ask in the comments of a related issue or pull request.
