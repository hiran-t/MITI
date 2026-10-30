// Starts MITI (`pixi run miti`) and, with --bridge, foxglove_bridge beside it
// (`pixi run -e <distro> miti-bridge`). Runs the same on Linux, macOS and Windows.
//
// Ports move out of each other's way: if the web port is taken, MITI uses the next free one; if
// the bridge port is taken by a foxglove_bridge, MITI uses that bridge, and if it is taken by
// something else, the bridge starts on the next free port. MITI learns the bridge port through
// MITI_BRIDGE_PORT, so the browser connects to it without any setting.
//
//   node scripts/start-miti.mjs [--port 3000] [--bridge]
//   env: BRIDGE_PORT (default 8765), MITI_HOST (default 0.0.0.0)
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const withBridge = args.includes('--bridge');
const portArg = args.indexOf('--port');
const webPreferred = Number(portArg >= 0 ? args[portArg + 1] : process.env.MITI_PORT) || 3000;
const bridgePreferred = Number(process.env.BRIDGE_PORT) || 8765;
const host = process.env.MITI_HOST || '0.0.0.0';
const isWindows = process.platform === 'win32';
/** How many ports above the preferred one to try. */
const SEARCH = 20;

/** True when nothing on this machine listens on the port. */
function isFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

/** True when a foxglove_bridge answers the WebSocket handshake on the port. */
function isBridge(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    let reply = '';
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1500, () => done(false));
    socket.once('error', () => done(false));
    socket.once('connect', () =>
      socket.write(
        'GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n' +
          'Sec-WebSocket-Protocol: foxglove.sdk.v1, foxglove.websocket.v1\r\n\r\n'
      )
    );
    socket.on('data', (chunk) => {
      reply += chunk.toString('latin1');
      if (!reply.includes('\r\n\r\n')) return;
      done(/^HTTP\/1\.1 101/.test(reply) && /sec-websocket-protocol:\s*foxglove/i.test(reply));
    });
  });
}

async function firstFree(from) {
  for (let port = from; port <= from + SEARCH; port++) if (await isFree(port)) return port;
  throw new Error(`No free port between ${from} and ${from + SEARCH}`);
}

/** Bridge port to use, and whether to start a bridge there. */
async function chooseBridge() {
  if (withBridge) {
    if (await isFree(bridgePreferred)) return { port: bridgePreferred, start: true };
    if (await isBridge(bridgePreferred)) {
      console.log(`foxglove_bridge already runs on port ${bridgePreferred}; MITI uses it.`);
      return { port: bridgePreferred, start: false, found: true };
    }
    const port = await firstFree(bridgePreferred + 1);
    console.log(
      `Port ${bridgePreferred} is used by another program; foxglove_bridge uses ${port}.`
    );
    return { port, start: true };
  }
  // MITI only: point it at a bridge already running here, if there is one.
  for (let port = bridgePreferred; port <= bridgePreferred + SEARCH; port++)
    if (await isBridge(port)) return { port, start: false, found: true };
  return { port: bridgePreferred, start: false, found: false };
}

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return null;
}

/** Ends a child and everything it started (ros2 launch starts foxglove_bridge, npm starts node). */
function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (isWindows)
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

const webPort = await firstFree(webPreferred);
if (webPort !== webPreferred) console.log(`Port ${webPreferred} is in use; MITI uses ${webPort}.`);
const bridge = await chooseBridge();

const children = [];
const shutdown = (code = 0) => {
  children.forEach(stop);
  process.exit(code);
};
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

let bridgeChild = null;
if (bridge.start) {
  const script = isWindows
    ? [
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'ros/foxglove-bridge.ps1'],
      ]
    : ['bash', ['ros/foxglove-bridge.sh']];
  bridgeChild = spawn(script[0], script[1], {
    cwd: root,
    stdio: 'inherit',
    detached: !isWindows,
    env: { ...process.env, BRIDGE_PORT: String(bridge.port) },
  });
  children.push(bridgeChild);
}

const next = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const web = spawn(
  process.execPath,
  [next, 'start', '--hostname', host, '--port', String(webPort)],
  {
    cwd: root,
    stdio: 'inherit',
    detached: !isWindows,
    env: { ...process.env, MITI_BRIDGE_PORT: String(bridge.port) },
  }
);
children.push(web);

const lan = lanAddress();
console.log(
  `\nMITI: http://localhost:${webPort}${lan ? `  (other computers: http://${lan}:${webPort})` : ''}` +
    `\nfoxglove_bridge: ws://<this machine>:${bridge.port}` +
    (bridge.start
      ? ''
      : bridge.found
        ? ' (already running)'
        : ' (none running here: start one on the robot, or use pixi run -e <distro> miti-bridge)') +
    '\n'
);

// Either one ending ends both.
bridgeChild?.on('exit', (code) => {
  console.log(`foxglove_bridge stopped (exit ${code}); stopping MITI.`);
  shutdown(code ?? 1);
});
web.on('exit', (code) => {
  if (bridgeChild) console.log('MITI stopped; stopping foxglove_bridge.');
  shutdown(code ?? 0);
});
