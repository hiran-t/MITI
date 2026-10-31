// Screenshots for the MITI manual (docs/manual), taken from MITI connected to a robot.
//
// 1. Serve MITI on http://localhost:3000 (pixi run miti) and start headless Chrome:
//      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//        --remote-debugging-port=9333 --user-data-dir=/tmp/miti-capture --window-size=1440,987 \
//        --force-device-scale-factor=2 --hide-scrollbars about:blank &
// 2. For the State Machine scenes, start the stand-in bridge: NODE_PATH=<MITI>/node_modules node sm-bridge.cjs
// 3. Run scenes with Node 22 (MITI_BRIDGE=ws://<robot>:8765): node scenes.mjs overview camera ... → out/<scene>.png
// 4. Convert to 1920 × 1200 WebP (quality 82) into ../images and commit to this branch.
//
// Scenes: overview disconnected problems connection-settings sources add-panel camera depth camera-cloud
// camera-costmap camera-tf scene-frames scene-robot scene-cloud scene-costmap scene-odom scene-camera log
// pointcloud sm-smacc2 sm-behavior-tree button-switch
import { fillIn, closeSection, chooseIn, openSection, W, start, settings, expand, search, clearSearch, show, hide, choose, activity, seg, sleep, shot, click, js, fill } from './steps.mjs';
import { close, send } from './lib.mjs';
import fs from 'node:fs';
const out = (name) => { const dir = new URL('./out/', import.meta.url).pathname; fs.mkdirSync(dir, { recursive: true }); return dir + name + '.png'; };
const CLOUD = '/livox/lidar', COSTMAP = '/local_costmap/costmap';
const one = (id) => id;
const row = (a, b, pct = 50) => ({ direction: 'row', first: a, second: b, splitPercentage: pct });
const col = (a, b, pct = 50) => ({ direction: 'column', first: a, second: b, splitPercentage: pct });

async function scene3d({ costmap = true, cloud = true } = {}) {
  await settings('3D Scene');
  await choose('Fixed frame', 'map'); await choose('Display frame', 'pelvis');
  await seg('Sync timestamps', 'Off');
  await hide('Transforms');
  if (cloud) { await search(CLOUD); await show(CLOUD); }
  if (costmap) { await search(COSTMAP); await show(COSTMAP); console.log('costmap colors', await chooseIn(COSTMAP, 'Color mode', 'Costmap')); }
  await clearSearch();
}
async function sceneCamera(title = 'Camera · Color', { cloud = true } = {}) {
  await settings(title);
  await seg('Sync timestamps', 'Off');
  await hide('Transforms');
  if (cloud) { await search(CLOUD); await show(CLOUD); await clearSearch(); }
}
const base = [W.scene(), W.color(), W.log()];
const CAMINFO = '/camera/camera/color/camera_info';
/** Shows only one topic's settings in the sidebar, through the settings search. */
async function focus(topic) { await search(topic); await openSection(topic); }
const overviewMosaic = col(row('urdf-viewer-1', 'camera-viewer-1', 52), 'log-1', 70);

const scenes = {
  async overview() {
    await start(overviewMosaic, base);
    await scene3d(); await sceneCamera(); await activity('Topics');
    await sleep(45000);
  },
  async disconnected() {
    await start(overviewMosaic, base, { bridge: 'ws://localhost:8765' });
    await activity('Topics'); await sleep(4000);
  },
  async problems() {
    await start(overviewMosaic, base, { bridge: 'ws://localhost:8765' });
    await activity('Problems'); await sleep(4000);
  },
  async 'connection-settings'() {
    await start(overviewMosaic, base, { bridge: 'ws://localhost:8765' });
    await click(`document.querySelector('.connection-status button[aria-label="Connection settings"]')`, 800);
    await click(`document.querySelector('#bridge-url')`, 200);
    await js(`document.querySelector('#bridge-url').select() || true`);
    await send('Input.insertText', { text: 'ws://100.99.81.13:8765' });
    await sleep(800);
  },
  async sources() {
    await start(overviewMosaic, base);
    await scene3d(); await sceneCamera(); await activity('Sources');
    await sleep(20000);
  },
  async 'add-panel'() {
    await start(overviewMosaic, base);
    await scene3d(); await sceneCamera(); await activity('Topics');
    await sleep(20000);
    await click(`byLabel('Add panel')`, 800);
  },
  async camera() {
    await start(one('camera-viewer-1'), [W.color()]);
    await sceneCamera('Camera · Color', { cloud: false });
    await sleep(15000);
  },
  async depth() {
    await start(one('camera-viewer-2'), [W.depth()]);
    await settings('Camera · Depth');
    console.log('depth colors', await choose('Color mode', 'Color map'));
    await sleep(20000);
  },
  async 'camera-cloud'() {
    await start('camera-viewer-1', [W.color()]);
    await sceneCamera(); await focus(CLOUD);
    console.log(await chooseIn(CLOUD, 'Color mode', 'Flat'));
    await fillIn(CLOUD, 'Point size', '3');
    await sleep(25000);
  },
  async 'camera-costmap'() {
    await start('camera-viewer-1', [W.color()]);
    await sceneCamera('Camera · Color', { cloud: false });
    await search(COSTMAP); await show(COSTMAP); await openSection(COSTMAP);
    console.log(await chooseIn(COSTMAP, 'Color mode', 'Costmap'));
    await fillIn(COSTMAP, 'Opacity', '0.45');
    await sleep(25000);
  },
  async 'camera-tf'() {
    await start('camera-viewer-1', [W.color()]);
    await settings('Camera · Color');
    await seg('Sync timestamps', 'Off');
    await show('Transforms');
    await closeSection('General'); await closeSection('Topics'); await openSection('Transforms');
    await sleep(20000);
  },
  async 'scene-frames'() {
    await start('urdf-viewer-1', [W.scene()]);
    await scene3d();
    await closeSection('Topics'); await closeSection('Custom layers (1)'); await openSection('Frame'); await openSection('Transforms');
    await sleep(25000);
  },
  async 'scene-robot'() {
    await start('urdf-viewer-1', [W.scene()]);
    await scene3d({ cloud: false, costmap: false }); await focus('/robot_description');
    await sleep(15000);
  },
  async 'scene-cloud'() {
    await start('urdf-viewer-1', [W.scene()]);
    await scene3d({ costmap: false }); await focus(CLOUD);
    await sleep(25000);
  },
  async 'scene-costmap'() {
    await start('urdf-viewer-1', [W.scene()]);
    await scene3d({ cloud: false }); await focus(COSTMAP);
    await sleep(25000);
  },
  async 'scene-odom'() {
    await start('urdf-viewer-1', [W.scene()]);
    await scene3d({ cloud: false, costmap: false });
    await search('/odom'); await show('/odom'); await openSection('/odom');
    await sleep(20000);
  },
  async 'scene-camera'() {
    await start('urdf-viewer-1', [W.scene()]);
    await scene3d({ cloud: false, costmap: false });
    await search(CAMINFO); await show(CAMINFO); await openSection(CAMINFO);
    await fillIn(CAMINFO, 'Image topic for ' + CAMINFO, '/camera/camera/color/image_raw');
    await sleep(25000);
  },
  async log() {
    await start('log-1', [W.log()]);
    await settings('Log');
    await sleep(15000);
  },
  async pointcloud() {
    await start('pointcloud-viewer-1', [{ ...W.cloud(), props: { topic: CLOUD } }]);
    await settings('Point Cloud');
    await sleep(25000);
  },
  async 'state-machine'() {
    await start('state-machine-1', [W.sm()]);
    await settings('State Machine');
    await sleep(3000);
  },
  async 'sm-smacc2'() {
    await start('state-machine-1', [W.sm()], { bridge: 'ws://127.0.0.1:8799' });
    await settings('State Machine');
    await sleep(6000);
  },
  async 'sm-behavior-tree'() {
    await start('state-machine-1', [W.sm()], { bridge: 'ws://127.0.0.1:8799' });
    await settings('State Machine');
    await click(`all('button').find((b) => b.textContent.trim() === 'Behavior Tree')`, 800);
    await sleep(5500);
  },
  async 'button-switch'() {
    await start('button-switch-1', [W.button()]);
    await settings('Button Switch');
    await sleep(2000);
  },
};
for (const name of process.argv.slice(2)) {
  console.log('scene', name);
  await scenes[name]();
  await shot(out(name));
}
close();
