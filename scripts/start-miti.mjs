// Starts MITI (`pixi run miti`, or `miti run` from the apt package) and, with --bridge,
// foxglove_bridge beside it (`pixi run -e <distro> miti-bridge`, `miti run --bridge`). Runs the
// same on Linux, macOS and Windows; Ctrl+C stops both.
//
// Ports move out of each other's way: if the web port is taken, MITI uses the next free one; if
// the bridge port is taken by a foxglove_bridge, MITI uses that bridge, and if it is taken by
// something else, the bridge starts on the next free port. MITI learns the bridge port through
// MITI_BRIDGE_PORT, so the browser connects to it without any setting.
//
// A bridge started here can be given another ROS_DOMAIN_ID and robot address from MITI's
// connection settings: the page calls /api/bridge, which reaches the small control server below
// (127.0.0.1 only, with a per-run token); the settings are saved and the bridge restarts.
//
//   node scripts/start-miti.mjs [--port 3000] [--bridge]
//   env: BRIDGE_PORT (default 8765), MITI_HOST (default 0.0.0.0)
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describeSettings,
  loadSettings,
  parseSettings,
  saveSettings,
  settingsEnv,
} from './bridge-settings.mjs';

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
/** ROS settings changed in MITI's connection settings. */
const settingsFile = path.join(
  process.env.MITI_STATE_DIR || path.join(root, '.miti'),
  'bridge.json'
);
/** How to start a bridge beside MITI, for messages (the apt package says `miti run --bridge`). */
const bridgeHint = process.env.MITI_BRIDGE_HINT || 'pixi run -e <distro> miti-bridge';
/** Bridge output lines kept for the connection settings, to show why it stopped. */
const LOG_LINES = 12;

/** True when something accepts connections on the port at this machine's loopback address. */
function answers(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** True when the port can be opened on every address. */
function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

/**
 * True when nothing on this machine uses the port. Both checks are needed: on Windows a program
 * listening on one address (e.g. netsh portproxy on 127.0.0.1) does not stop another from
 * opening the same port on all addresses, but connections then still reach the first one.
 */
async function isFree(port) {
  return !(await answers(port)) && (await canListen(port));
}

/** True when a foxglove_bridge answers the WebSocket handshake on the port. */
function isBridge(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    let reply = '';
    let answered = false;
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
      if (answered) return;
      reply += chunk.toString('latin1');
      if (!reply.includes('\r\n\r\n')) return;
      answered = true;
      if (!/^HTTP\/1\.1 101/.test(reply) || !/sec-websocket-protocol:\s*foxglove/i.test(reply))
        return done(false);
      // Close the WebSocket properly (masked, empty close frame), so the bridge does not log a
      // reset connection; the timeout above still ends the socket if it does not answer.
      socket.end(Buffer.from([0x88, 0x80, 0, 0, 0, 0]));
      resolve(true);
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

const ros = loadSettings(settingsFile);
if (bridge.start && ros.saved)
  console.log(`ROS settings saved in MITI (${settingsFile}): ${describeSettings(ros)}`);

/** The bridge this launcher started; it is replaced when the ROS settings change. */
const bridgeRun = { child: null, state: 'stopped', exitCode: null, log: [], fromWeb: false };
let web = null;

const shutdown = (code = 0) => {
  stop(bridgeRun.child);
  stop(web);
  process.exit(code);
};
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function keepLog(chunk) {
  const lines = chunk
    .toString()
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split(/\r?\n/);
  bridgeRun.log.push(...lines.filter((line) => line.trim()));
  bridgeRun.log.splice(0, Math.max(0, bridgeRun.log.length - LOG_LINES));
}

function startBridge() {
  const script = isWindows
    ? [
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'ros/foxglove-bridge.ps1'],
      ]
    : ['bash', ['ros/foxglove-bridge.sh']];
  const child = spawn(script[0], script[1], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWindows,
    env: {
      ...process.env,
      ...settingsEnv(ros),
      // ros2 launch is Python: without this its output arrives in blocks through the pipe.
      PYTHONUNBUFFERED: '1',
      // BRIDGE_PORT_FIXED: fail rather than move, so the bridge stays on the port MITI was told.
      BRIDGE_PORT: String(bridge.port),
      BRIDGE_PORT_FIXED: '1',
    },
  });
  Object.assign(bridgeRun, { child, state: 'starting', exitCode: null, log: [] });
  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    keepLog(chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    keepLog(chunk);
  });
  child.on('exit', (code, signal) => {
    if (bridgeRun.child !== child) return; // replaced by a restart
    Object.assign(bridgeRun, { child: null, state: 'stopped', exitCode: code });
    const reason = code === null ? signal : `exit ${code}`;
    if (bridgeRun.fromWeb) {
      console.log(`foxglove_bridge stopped (${reason}); apply the ROS settings in MITI to retry.`);
      return;
    }
    console.log(`foxglove_bridge stopped (${reason}); stopping MITI.`);
    shutdown(code ?? 1);
  });
  // "running" once it answers the WebSocket handshake.
  const poll = async () => {
    if (bridgeRun.child !== child || bridgeRun.state !== 'starting') return;
    if (await isBridge(bridge.port)) {
      if (bridgeRun.child === child) bridgeRun.state = 'running';
    } else setTimeout(poll, 500);
  };
  setTimeout(poll, 500);
}

async function restartBridge() {
  const old = bridgeRun.child;
  Object.assign(bridgeRun, { child: null, state: 'starting', exitCode: null });
  if (old && old.exitCode === null && old.signalCode === null) {
    const exited = new Promise((resolve) => old.once('exit', resolve));
    stop(old);
    await exited;
  }
  // ros2 launch can exit before foxglove_bridge has let go of the port.
  for (let tries = 0; tries < 20 && (await answers(bridge.port)); tries++)
    await new Promise((resolve) => setTimeout(resolve, 500));
  startBridge();
}

function bridgeStatus() {
  return {
    available: true,
    domainId: ros.domainId,
    peers: ros.peers,
    distro: process.env.ROS_DISTRO || null,
    rmw: process.env.RMW_IMPLEMENTATION || 'rmw_fastrtps_cpp',
    port: bridge.port,
    state: bridgeRun.state,
    exitCode: bridgeRun.exitCode,
    log: bridgeRun.log,
  };
}

/** Serves GET/PUT /settings to MITI's server (src/app/api/bridge/route.ts). */
function startControl() {
  const token = crypto.randomBytes(24).toString('hex');
  let restarting = Promise.resolve();
  const server = http.createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (request.headers.authorization !== `Bearer ${token}`)
      return reply(401, { error: 'Unauthorized' });
    if (request.url !== '/settings') return reply(404, { error: 'Not found' });
    if (request.method === 'GET') return reply(200, bridgeStatus());
    if (request.method !== 'PUT') return reply(405, { error: 'Use GET or PUT' });
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 10_000) return reply(413, { error: 'Too large' });
    }
    let input;
    try {
      input = JSON.parse(body);
    } catch {
      return reply(400, { error: 'Expected JSON' });
    }
    const { settings, error } = parseSettings(input);
    if (error) return reply(400, { error });
    try {
      saveSettings(settingsFile, settings);
    } catch (saveError) {
      return reply(500, { error: `Cannot save ${settingsFile}: ${saveError.message}` });
    }
    Object.assign(ros, settings, { saved: true });
    bridgeRun.fromWeb = true;
    console.log(
      `ROS settings changed in MITI: ${describeSettings(ros)}; restarting foxglove_bridge.`
    );
    restarting = restarting.then(restartBridge);
    await restarting;
    reply(200, bridgeStatus());
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ url: `http://127.0.0.1:${server.address().port}`, token })
    )
  );
}

let control = null;
if (bridge.start) {
  startBridge();
  control = await startControl();
}

// The apt package carries Next.js's standalone server (server.js); a clone runs `next start`.
const standalone = path.join(root, 'server.js');
const server = fs.existsSync(standalone)
  ? [standalone]
  : [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start'];
web = spawn(process.execPath, [...server, '--hostname', host, '--port', String(webPort)], {
  cwd: root,
  stdio: 'inherit',
  detached: !isWindows,
  env: {
    ...process.env,
    // The standalone server reads these instead of --hostname and --port.
    HOSTNAME: host,
    PORT: String(webPort),
    MITI_BRIDGE_PORT: String(bridge.port),
    ...(control && { MITI_BRIDGE_CONTROL: control.url, MITI_BRIDGE_TOKEN: control.token }),
  },
});

const lan = lanAddress();
console.log(
  `\nMITI: http://localhost:${webPort}${lan ? `  (other computers: http://${lan}:${webPort})` : ''}` +
    `\nfoxglove_bridge: ws://<this machine>:${bridge.port}` +
    (bridge.start
      ? ` (${describeSettings(ros)}; change it in MITI's connection settings)`
      : bridge.found
        ? ' (already running)'
        : ` (none running here: start one on the robot, or use ${bridgeHint})`) +
    '\n'
);

// MITI ending ends the bridge; the bridge ending ends MITI unless it was restarted from MITI.
web.on('exit', (code) => {
  if (bridgeRun.child) console.log('MITI stopped; stopping foxglove_bridge.');
  shutdown(code ?? 0);
});
