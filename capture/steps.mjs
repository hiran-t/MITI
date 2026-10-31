// Higher-level steps for MITI screenshots.
import { js, click, fill, setStorage, load, sleep, shot } from './lib.mjs';
/** The robot's foxglove_bridge. */
export const BRIDGE = process.env.MITI_BRIDGE ?? 'ws://100.99.81.13:8765';
export const COLOR = '/camera/camera/color/image_raw';
export const DEPTH = '/camera/camera/aligned_depth_to_color/image_raw';
const widget = (i, type, title, props = {}) => ({ i, type, title, x: 0, y: 0, w: 6, h: 9, minW: 2, minH: 6, props });
export const W = {
  scene: () => widget('urdf-viewer-1', 'urdf-viewer', '3D Scene', { mode: 'topic', topic: '/robot_description', urdfUrl: '', meshBaseUrl: '', packageMapping: {} }),
  color: () => widget('camera-viewer-1', 'camera-viewer', 'Camera · Color', { topic: COLOR }),
  depth: () => widget('camera-viewer-2', 'camera-viewer', 'Camera · Depth', { topic: DEPTH }),
  log: () => widget('log-1', 'log', 'Log', {}),
  cloud: () => widget('pointcloud-viewer-1', 'pointcloud-viewer', 'Point Cloud', { topic: '/cloud_registered' }),
  sm: () => widget('state-machine-1', 'state-machine', 'State Machine', {}),
  button: () => widget('button-switch-1', 'button-switch', 'Button Switch', {}),
  topics: () => widget('topics-1', 'topics', 'Topics', {}),
};
export async function start(mosaic, widgets, { bridge = BRIDGE, sidebar = 380 } = {}) {
  await load();
  await setStorage([['miti_bridge_url', bridge], ['miti_layout_config', { mosaic, widgets }], ['miti_sidebar_width', sidebar]]);
  const ok = await load();
  console.log('connected:', ok);
  await sleep(3000);
}
export const settings = (title) => click(`byLabel(${JSON.stringify('Settings for ' + title)})`, 800);
export const expand = (title) => click(`byLabel(${JSON.stringify('Expand ' + title)})`, 800);
/** Opens a sidebar view; clicking the view that is already open would close the sidebar. */
export async function activity(name) {
  const open = await js(`byLabel(${JSON.stringify(name)})?.getAttribute('aria-selected') === 'true' && !!document.querySelector('.settings-open')`);
  if (!open) await click(`byLabel(${JSON.stringify(name)})`, 600);
}
export const search = (text) => fill('byLabel("Search panel settings")', text);
export async function clearSearch() { await search(''); }
/** Turns a topic or layer on with its eye button, if it is off. */
export async function show(name) {
  const off = await js(`!!byLabel(${JSON.stringify('Show ' + name)})`);
  if (off) await click(`byLabel(${JSON.stringify('Show ' + name)})`, 500);
}
export async function hide(name) {
  const on = await js(`!!byLabel(${JSON.stringify('Hide ' + name)})`);
  if (on) await click(`byLabel(${JSON.stringify('Hide ' + name)})`, 500);
}
/** Sets a <select> by its aria-label. */
export async function choose(label, value) {
  return js(`(() => { const want = ${JSON.stringify(value)};
    const s = all('select[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']').find((x) => [...x.options].some((o) => o.value === want || o.textContent.trim() === want));
    if (!s) return 'no ' + ${JSON.stringify(label)} + ' with ' + want;
    const opt = [...s.options].find((o) => o.value === ${JSON.stringify(value)} || o.textContent.trim() === ${JSON.stringify(value)});
    if (!opt) return 'options: ' + [...s.options].map((o) => o.value).join(',');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, opt.value);
    s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
}
/** Clicks a settings tree row by its visible text (to open or close it). */
export const row = (text) => click(`byText(${JSON.stringify(text)})`, 500);
export { sleep, shot, js, click, fill };
/** Clicks an option of a segmented control (e.g. Sync timestamps → Off). */
export const seg = (label, text) =>
  click(`[...byLabel(${JSON.stringify(label)}).querySelectorAll('button,[role=radio]')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`, 500);
/** Sets a text setting by its aria-label (found through the settings search). */
export async function setText(label, text) {
  await search(label);
  await fill(`byLabel(${JSON.stringify(label)})`, text);
  await clearSearch();
}
/** The robot's TF: FAST-LIO publishes camera_init on its own topic. */
export const TF_TOPICS = '/tf, /tf_static, /fast_lio/tf';
/** The settings section of a topic or group, by its title. */
export const sectionOf = (title) =>
  `all('.tree-title').find((t) => t.textContent.trim() === ${JSON.stringify(title)})?.closest('section.tree-section')`;
/** Sets a <select> inside a topic's settings. */
export async function chooseIn(title, label, value) {
  return js(`(() => { const sec = ${sectionOf(title)}; if (!sec) return 'no section ' + ${JSON.stringify(title)};
    const s = sec.querySelector('select[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']'); if (!s) return 'no select';
    const opt = [...s.options].find((o) => o.value === ${JSON.stringify(value)} || o.textContent.trim() === ${JSON.stringify(value)});
    if (!opt) return 'options: ' + [...s.options].map((o) => o.textContent.trim()).join(',');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, opt.value);
    s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
}
/** Opens a topic's settings (its title toggles them) if they are closed. */
export async function openSection(title) {
  const closed = await js(`!(${sectionOf(title)})?.querySelector('.tree-toggle-open')`);
  if (closed) await click(`all('.tree-title').find((t) => t.textContent.trim() === ${JSON.stringify(title)})`, 500);
}
/** Fills a text setting inside a topic's settings. */
export const fillIn = (title, label, text) =>
  fill(`(${sectionOf(title)}).querySelector('input[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']')`, text);
/** Closes a settings group if it is open. */
export async function closeSection(title) {
  const open = await js(`!!(${sectionOf(title)})?.querySelector(':scope > .tree-header .tree-toggle-open')`);
  if (open) await click(`all('.tree-title').find((t) => t.textContent.trim() === ${JSON.stringify(title)})`, 400);
}
