#!/usr/bin/env node
/**
 * End-to-end checks of MITI in headless Chrome, against the production build (`npm run build`
 * first) and the stand-in bridge (scripts/heavy-bridge.js), driven over the DevTools protocol:
 *
 *   npm run e2e    (env CHROME_PATH to use another Chrome)
 *
 * It starts MITI twice, plain and with a branding folder, each with an empty state folder, and
 * checks the built-in panels, importing, using and removing a widget, saving and opening a layout,
 * and branding. Prints one line per check and exits 1 when one fails.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { strToU8, zipSync } = require('fflate');

const root = path.resolve(__dirname, '..');
const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'google-chrome');
const APP_PORT = 3990;
const BRIDGE_PORT = 8890;
const DEBUG_PORT = 9990;
const APP = `http://127.0.0.1:${APP_PORT}`;
const sleep = (ms) => new Promise((wake) => setTimeout(wake, ms));
const temp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `miti-e2e-${name}-`));

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failed += 1;
}

/** A widget written without a build: it reads React and the SDK as built widgets do. */
function probeWidget() {
  const code = `
const { jsx } = window.__MITI_MODULES__['react/jsx-runtime'];
const sdk = window.__MITI_MODULES__['@miti/sdk'];
function Probe({ client, config }) {
  const { data } = sdk.useTopic(client, config.topic, undefined, { throttleRate: 100 });
  const x = data?.transforms?.[1]?.transform?.translation?.x;
  return jsx('output', { className: 'e2e-probe', children: typeof x === 'number' ? x.toFixed(3) : 'none' });
}
export default sdk.defineWidget({
  panels: [sdk.definePanel({ type: 'e2e.probe/value', label: 'Probe', defaultConfig: () => ({ topic: '/tf' }), component: Probe })],
});`;
  const manifest = { id: 'e2e.probe', name: 'Probe', version: '1.0.0', miti: { apiVersion: 1 } };
  const file = path.join(temp('widget'), 'e2e.probe-1.0.0.miti-widget');
  fs.writeFileSync(
    file,
    zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'index.js': strToU8(code) })
  );
  return file;
}

async function waitFor(what, test, timeout = 20000) {
  const start = Date.now();
  for (;;) {
    const value = await test().catch(() => null);
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${what}`);
    await sleep(250);
  }
}

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'ignore',
  });
  return child;
}

async function startMiti(env) {
  const server = start(
    process.execPath,
    [
      path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'start',
      '-p',
      String(APP_PORT),
      '-H',
      '127.0.0.1',
    ],
    { MITI_STATE_DIR: temp('state'), ...env }
  );
  await waitFor('MITI', async () => (await fetch(`${APP}/api/widgets`)).ok);
  return server;
}

/** Chrome with a fresh profile, and helpers for its one page. */
async function openChrome() {
  const downloads = temp('downloads');
  const chrome = start(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${temp('profile')}`,
    '--window-size=1280,800',
    '--no-first-run',
    '--no-default-browser-check',
    ...(process.env.CI ? ['--no-sandbox'] : []),
    'about:blank',
  ]);
  const target = await waitFor('Chrome', async () =>
    (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()).find(
      (t) => t.type === 'page'
    )
  );
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
  let nextId = 1;
  const pending = new Map();
  const dialogs = [];
  const errors = [];
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.method === 'Page.javascriptDialogOpening') {
      dialogs.push(msg.params.message);
      send('Page.handleJavaScriptDialog', { accept: true });
    }
    if (msg.method === 'Runtime.exceptionThrown')
      errors.push(msg.params.exceptionDetails.exception?.description ?? 'exception');
    const waiter = msg.id && pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(msg.error.message));
    else waiter.resolve(msg.result);
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
  await send('DOM.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const setFile = async (selector, file) => {
    const { root: doc } = await send('DOM.getDocument');
    const { nodeId } = await send('DOM.querySelector', { nodeId: doc.nodeId, selector });
    await send('DOM.setFileInputFiles', { nodeId, files: [file] });
  };
  const close = () => {
    ws.close();
    chrome.kill();
  };
  return { send, evaluate, setFile, dialogs, errors, downloads, close };
}

/** Load MITI with a bridge address and, optionally, a layout. */
async function load(page, layout) {
  await page.send('Page.navigate', { url: APP });
  await waitFor('the page', () => page.evaluate('document.readyState === "complete"'));
  await page.evaluate(
    `localStorage.setItem('miti_bridge_url', ${JSON.stringify(JSON.stringify(`ws://127.0.0.1:${BRIDGE_PORT}`))});` +
      (layout
        ? `localStorage.setItem('miti_layout_config', ${JSON.stringify(JSON.stringify(layout))});`
        : '') +
      'true'
  );
  await page.send('Page.reload');
  await waitFor('the workspace', () =>
    page.evaluate('!!document.querySelector(".miti-workspace")')
  );
}

const text = (page) => page.evaluate('document.body.innerText');
const probeValue = (page) =>
  page.evaluate(
    `(() => { const v = document.querySelector('.e2e-probe')?.textContent; return v && v !== 'none' ? v : null; })()`
  );
const probeLayout = {
  widgets: [
    { i: 'log-1', type: 'log', title: 'Log', x: 0, y: 0, w: 6, h: 8 },
    {
      i: 'probe-1',
      type: 'e2e.probe/value',
      title: 'Probe',
      x: 6,
      y: 0,
      w: 6,
      h: 8,
      props: { topic: '/tf' },
    },
  ],
  mosaic: { direction: 'row', first: 'log-1', second: 'probe-1' },
};

async function builtInPanels(page) {
  await load(page);
  await waitFor('log lines', async () => (await text(page)).includes('[INFO]'));
  const body = await text(page);
  check(
    'the default layout shows the 3D Scene, cameras and log',
    ['3D Scene', 'Camera · Color', 'Log'].every((t) => body.includes(t))
  );
  check('the bridge is connected and the log reads /rosout', body.includes('[INFO]'));
}

async function widgets(page, widget) {
  await load(page, probeLayout);
  await waitFor('placeholder', async () => (await text(page)).includes('Widget not installed'));
  check('a panel of a missing widget waits with its settings', true);

  await page.evaluate(`document.getElementById('sidebar-tab-Widgets').click(), true`);
  await page.setFile('input[aria-label="Widget file"]', widget);
  await waitFor('import', async () => (await text(page)).includes('Imported Probe 1.0.0'));
  check(
    'importing asks first, naming the widget',
    page.dialogs.some((d) => d.startsWith('Import Probe 1.0.0 (e2e.probe)'))
  );
  const first = await waitFor('a value', () => probeValue(page));
  await sleep(2000);
  const second = await probeValue(page);
  check("the widget's panel shows live data", first !== second, `${first} → ${second}`);

  await page.send('Page.reload');
  check(
    'the widget is still there after a reload',
    !!(await waitFor('a value after reload', () => probeValue(page)))
  );

  await page.evaluate(`document.getElementById('sidebar-tab-Widgets').click(), true`);
  await page.evaluate(
    `[...document.querySelectorAll('.widget-item button')].find((b) => b.textContent === 'Remove').click(), true`
  );
  await waitFor('removal', async () => (await text(page)).includes('Widget not installed'));
  const saved = JSON.parse(await page.evaluate(`localStorage.getItem('miti_layout_config')`));
  check(
    'a removed widget’s panel keeps its settings',
    saved.widgets.find((w) => w.i === 'probe-1')?.props?.topic === '/tf'
  );

  await page.setFile('input[aria-label="Widget file"]', widget);
  check(
    'a reimported widget shows its panel again',
    !!(await waitFor('a value after reimport', () => probeValue(page)))
  );

  const crossSite = await fetch(`${APP}/api/widgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'Sec-Fetch-Site': 'cross-site' },
    body: fs.readFileSync(widget),
  });
  check("another site's page cannot import a widget", crossSite.status === 403);
}

async function layoutFiles(page) {
  await page.evaluate(`document.querySelector('[aria-label="Export layout"]').click(), true`);
  const file = await waitFor('the layout file', async () => {
    const name = fs.readdirSync(page.downloads).find((f) => f.endsWith('.json'));
    return name && path.join(page.downloads, name);
  });
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  check(
    'export saves the layout and the widgets it needs',
    saved.layout.widgets.length === 2 && saved.widgets[0]?.id === 'e2e.probe'
  );
  await page.evaluate(`document.querySelector('[aria-label="Reset layout"]').click(), true`);
  await waitFor('the default layout', async () => (await text(page)).includes('3D Scene'));
  await page.setFile('input[aria-label="Layout file"]', file);
  await waitFor('the imported layout', async () => !(await text(page)).includes('3D Scene'));
  check('import opens a saved layout', !!(await waitFor('the probe', () => probeValue(page))));
}

async function branding(page) {
  await page.send('Page.navigate', { url: APP });
  await waitFor('the workspace', () =>
    page.evaluate('!!document.querySelector(".miti-workspace")')
  );
  const look = await page.evaluate(`({
    title: document.title,
    logo: document.querySelector('.workspace-brand img')?.getAttribute('src'),
    logoSize: (() => {
      const box = document.querySelector('.workspace-brand img')?.getBoundingClientRect();
      return box && [Math.round(box.width), Math.round(box.height)];
    })(),
    alt: document.querySelector('.workspace-brand img')?.getAttribute('alt'),
    icon: document.querySelector('link[rel="icon"]')?.getAttribute('href'),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--miti-accent').trim(),
  })`);
  return look;
}

async function main() {
  const bridge = start(process.execPath, [
    path.join(root, 'scripts', 'heavy-bridge.js'),
    '--port',
    String(BRIDGE_PORT),
    '--cams',
    '1',
    '--cam-hz',
    '1',
    '--width',
    '320',
    '--height',
    '240',
    '--points',
    '1000',
    '--cloud-hz',
    '1',
    '--tf-hz',
    '20',
    '--log-hz',
    '2',
  ]);
  const processes = [bridge];
  try {
    await waitFor(
      'the bridge',
      async () => (await fetch(`http://127.0.0.1:${BRIDGE_PORT + 1}/stats`)).ok
    );
    let server = await startMiti({});
    processes.push(server);
    let page = await openChrome();
    processes.push({ kill: page.close });
    await builtInPanels(page);
    await widgets(page, probeWidget());
    await layoutFiles(page);
    const plain = await branding(page);
    check(
      'without branding MITI shows its own logo, title and teal',
      plain.logo?.includes('main_logo') &&
        plain.title.startsWith('MITI') &&
        plain.accent === '#2fb4c4',
      JSON.stringify(plain)
    );
    check('no panel stopped working', !(await text(page)).includes('This panel stopped working'));
    check('no uncaught errors in the page', page.errors.length === 0, page.errors[0]);
    page.close();
    server.kill();

    const brand = temp('branding');
    fs.writeFileSync(
      path.join(brand, 'branding.json'),
      JSON.stringify({
        name: 'Acme Robots',
        title: 'Acme Console',
        logo: 'logo.svg',
        logoHeight: 30,
        icon: 'icon.svg',
        accent: '#e30613',
      })
    );
    fs.writeFileSync(
      path.join(brand, 'logo.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#e30613"/></svg>'
    );
    fs.writeFileSync(
      path.join(brand, 'icon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>'
    );
    await sleep(500);
    server = await startMiti({ MITI_BRANDING_DIR: brand });
    processes.push(server);
    page = await openChrome();
    processes.push({ kill: page.close });
    const branded = await branding(page);
    check(
      'MITI_BRANDING_DIR sets the logo, title, icon and accent',
      branded.logo === '/api/branding/logo' &&
        branded.alt === 'Acme Robots' &&
        branded.title === 'Acme Console' &&
        branded.icon?.startsWith('/api/branding/icon') &&
        branded.accent === '#e30613',
      JSON.stringify(branded)
    );
    // The test logo is 120 × 40, so 30 px high is 90 px wide.
    check(
      'logoHeight sets the logo’s height, and its width follows the image',
      branded.logoSize?.[0] === 90 && branded.logoSize?.[1] === 30,
      JSON.stringify(branded.logoSize)
    );
    const logo = await fetch(`${APP}/api/branding/logo`);
    check(
      'the branded logo is served',
      logo.ok && logo.headers.get('content-type') === 'image/svg+xml'
    );
  } finally {
    for (const child of processes) child.kill();
  }
  console.log(failed ? `${failed} check(s) failed` : 'All checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
