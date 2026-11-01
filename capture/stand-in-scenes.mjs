// node --experimental-websocket stand-in-scenes.mjs <scene> → out/<scene>.png, against the stand-in bridge (doc-bridge.cjs) through proxy.cjs.
import { fillIn, hide, W, settings, search, clearSearch, show, choose, activity, seg, sleep, shot, click, js, openSection, closeSection } from './steps.mjs';
import { close, setStorage, load } from './lib.mjs';
const out = (name) => new URL(`./out/${name}.png`, import.meta.url).pathname;
const URL_ = 'http://localhost:3010/', BRIDGE = process.env.BRIDGE ?? 'ws://127.0.0.1:8798';
const row = (a, b, pct = 50) => ({ direction: 'row', first: a, second: b, splitPercentage: pct });
async function start(mosaic, widgets, sidebar = 400) {
  await load(URL_);
  await setStorage([['miti_bridge_url', BRIDGE], ['miti_layout_config', { mosaic, widgets }], ['miti_sidebar_width', sidebar]]);
  console.log('connected:', await load(URL_));
  await sleep(2500);
}
async function scene({ sync = 'Off' } = {}) {
  await settings('3D Scene');
  console.log(await choose('Fixed frame', 'map'), await choose('Display frame', 'base_link'));
  await seg('Sync timestamps', sync);
  await hide('Transforms');
  for (const t of ['/points', '/map']) { await search(t); await show(t); }
  await search('/map'); await openSection('/map'); await fillIn('/map', 'Opacity', '0.25'); await closeSection('/map');
  await clearSearch();
}
async function zoom(ticks, x = 1300, y = 650) {
  const { send } = await import('./lib.mjs');
  for (let i = 0; i < ticks; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: -120 }); await sleep(60); }
}
const scenes = {
  async probe() { await start('urdf-viewer-1', [W.scene()]); await scene(); await zoom(3); await sleep(2000); },
  async 'no-transform'() {
    await start('urdf-viewer-1', [W.scene()]); await scene(); await zoom(3);
    await search('/cloud_registered'); await show('/cloud_registered'); await openSection('/cloud_registered'); await sleep(2500);
  },
  async 'tf-too-old'() {
    await start('urdf-viewer-1', [W.scene()]); await scene({ sync: 'On' }); await zoom(3);
    await search('/points'); await openSection('/points'); await sleep(2500);
  },
  async publish() {
    await start('urdf-viewer-1', [W.scene()]); await scene(); await zoom(3);
    await closeSection('Topics'); await closeSection('Frame'); await closeSection('Custom layers (1)');
    await click(`all('.tree-title').find((t) => t.textContent.trim() === 'Publish')`, 600);
    console.log(await choose('Type', 'pose')); await sleep(1500);
  },
  async 'ros-network'() {
    await start('urdf-viewer-1', [W.scene()]); await scene(); await zoom(3); await activity('Topics');
    await click(`document.querySelector('.connection-status button[aria-label="Connection settings"]')`, 1500);
  },
};
await scenes[process.argv[2]]();
await shot(out(process.argv[2]));
close();
