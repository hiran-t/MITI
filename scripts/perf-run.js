#!/usr/bin/env node
/**
 * Measures MITI under the heavy-load bridge (scripts/heavy-bridge.js) in Chrome, driven over the
 * DevTools protocol with a throwaway profile:
 *
 *   node scripts/perf-run.js [--app http://localhost:3000] [--bridge ws://localhost:8790]
 *     [--cams 3] [--seconds 20] [--warmup 8] [--expand camera-0] [--cpu-throttle 4] [--profile] [--screenshot out.png]
 *     [--headful]
 *
 * Prints one JSON line: frame rate, frame-time percentiles, worst frame, long tasks and how busy
 * the main thread was (DevTools' TaskDuration / ScriptDuration over the run), plus the WebGL renderer so runs on different GPUs are not compared by mistake.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const APP = opt('app', 'http://localhost:3000');
const BRIDGE = opt('bridge', 'ws://localhost:8790');
/** heavy-bridge.js's counters, on the port after the bridge's. */
const STATS = opt(
  'stats',
  BRIDGE.replace(/^ws/, 'http').replace(/:(\d+)/, (_, p) => `:${+p + 1}`) + '/stats'
);
const CAMS = Number(opt('cams', 3));
const SECONDS = Number(opt('seconds', 20));
const WARMUP = Number(opt('warmup', 8));
const EXPAND = opt('expand', '');
const HEADFUL = argv.includes('--headful');
/** Print the functions that used the most main-thread time during the run. */
const PROFILE = argv.includes('--profile');
/** Save a PNG of the page after the run. */
const SCREENSHOT = opt('screenshot', '');
/** Slow the CPU down this many times, to approximate a robot's or kiosk's weaker computer. */
const CPU_THROTTLE = Number(opt('cpu-throttle', 1));
const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'google-chrome');
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((wake) => setTimeout(wake, ms));

const probe = fs.readFileSync(path.join(__dirname, 'perf-probe.js'), 'utf8');

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'miti-perf-'));
  const chrome = spawn(
    CHROME,
    [
      ...(HEADFUL ? [] : ['--headless=new']),
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--window-size=1440,900',
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      // Measure the page as if it were in front, whatever the window is doing.
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
        target = list.find((t) => t.type === 'page');
      } catch {
        /* Chrome is still starting. */
      }
    }
    if (!target) throw new Error('Chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
    await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
    let nextId = 1;
    const pending = new Map();
    const consoleErrors = [];
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.method === 'Runtime.exceptionThrown')
        consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? 'exception');
      if (
        msg.method === 'Runtime.consoleAPICalled' &&
        ['error', 'warning'].includes(msg.params.type)
      )
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      const waiter = msg.id && pending.get(msg.id);
      if (!waiter) return;
      pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error.message));
      else waiter.resolve(msg.result);
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'eval');
      return result.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: probe });
    await send('Page.navigate', { url: APP });
    await sleep(3000);
    await evaluate(
      `localStorage.setItem('miti_bridge_url', JSON.stringify(${JSON.stringify(BRIDGE)}));` +
        `localStorage.setItem('miti_layout_config', JSON.stringify(mitiPerf.layout(${CAMS})));`
    );
    await send('Page.reload');
    await sleep(WARMUP * 1000);
    if (EXPAND) {
      await evaluate(`document.querySelector('[aria-label="Expand ${EXPAND}"]')?.click()`);
      await sleep(1000);
      if (!(await evaluate(`!!document.querySelector('.has-expanded-panel')`)))
        throw new Error(`Cannot expand the panel titled ${EXPAND}`);
    }
    const renderer = await evaluate(`(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    })()`);
    const status = await evaluate(
      `Array.from(document.querySelectorAll('.mosaic-window-toolbar')).map((el) => el.innerText.replace(/\\s+/g, ' ').trim()).join(' | ')`
    );
    // Set after the reload, which would reset it; the page warms up unthrottled.
    if (CPU_THROTTLE > 1) {
      await send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
      await sleep(3000);
    }
    await send('Performance.enable');
    const metrics = async () =>
      Object.fromEntries(
        (await send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value])
      );
    if (PROFILE) {
      await send('Profiler.enable');
      await send('Profiler.setSamplingInterval', { interval: 200 });
      await send('Profiler.start');
    }
    const stats = () =>
      fetch(STATS)
        .then((r) => r.json())
        .catch(() => null);
    const sentBefore = await stats();
    const before = await metrics();
    const result = await evaluate(`mitiPerf.measure(${SECONDS})`);
    const after = await metrics();
    const sentAfter = await stats();
    if (PROFILE) {
      const { profile } = await send('Profiler.stop');
      if (process.env.PROFILE_OUT)
        fs.writeFileSync(process.env.PROFILE_OUT, JSON.stringify(profile));
      printProfile(profile);
    }
    // Share of wall time the page's main thread spent in tasks, and in JavaScript.
    const busy = (name) =>
      Math.round(((after[name] - before[name]) / (after.Timestamp - before.Timestamp)) * 1000) / 10;
    console.log(
      JSON.stringify({
        ...result,
        ...delivered(sentBefore, sentAfter, SECONDS),
        mainThreadBusyPct: busy('TaskDuration'),
        scriptPct: busy('ScriptDuration'),
        layoutPct: busy('LayoutDuration'),
        heapMB: Math.round(after.JSHeapUsedSize / 1e6),
        consoleErrors: consoleErrors.length,
        cpuThrottle: CPU_THROTTLE,
        renderer,
        panels: status,
      })
    );
    if (SCREENSHOT) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(SCREENSHOT, Buffer.from(data, 'base64'));
    }
    consoleErrors.slice(0, 5).forEach((error) => console.error('console:', error.slice(0, 300)));
    ws.close();
  } finally {
    chrome.kill();
    await sleep(500);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

/** What the bridge got through to the page during the run, per second. */
function delivered(before, after, seconds) {
  if (!before || !after) return {};
  const rate = (pick) =>
    Object.keys(after).reduce((sum, topic) => sum + pick(after[topic]) - pick(before[topic]), 0) /
    seconds;
  const cameras = Object.keys(after).filter((topic) => topic.includes('image'));
  return {
    receivedMBps: Math.round(rate((t) => t.bytes) / 1e5) / 10,
    cameraFramesPerS: Math.round(
      cameras.reduce((sum, t) => sum + after[t].sent - before[t].sent, 0) / seconds
    ),
    droppedByBridgePerS: Math.round(rate((t) => t.dropped)),
  };
}

/** Self time per function, top 25, as a share of the profiled wall time. */
function printProfile({ nodes, samples, timeDeltas }) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const self = new Map();
  let total = 0;
  samples.forEach((id, i) => {
    const { functionName, url, lineNumber } = byId.get(id).callFrame;
    const key = `${functionName || '(anonymous)'} ${url.split('/').slice(-2).join('/')}:${lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + timeDeltas[i]);
    total += timeDeltas[i];
  });
  Array.from(self.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([key, us]) =>
      console.error(`${((us / total) * 100).toFixed(1).padStart(5)}%  ${key}`)
    );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
