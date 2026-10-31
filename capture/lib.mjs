// Drives the headless Chrome on port 9333 for documentation screenshots.
import fs from 'node:fs';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const target = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); const w = m.id && pending.get(m.id); if (w) { pending.delete(m.id); w(m); } };
export const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
export async function js(expression) {
  const m = await send('Runtime.evaluate', { expression: `(async () => { ${HELPERS}; return (${expression}); })()`, awaitPromise: true, returnByValue: true });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? 'eval failed');
  return m.result?.result?.value;
}
// In-page helpers: find elements by text or aria-label.
const HELPERS = `
  const all = (sel) => [...document.querySelectorAll(sel)];
  const byText = (text, sel = '*') => all(sel).filter((e) => e.children.length === 0 || e.matches('button,a,[role=tab]')).find((e) => e.textContent.trim() === text);
  const byLabel = (label) => document.querySelector('[aria-label="' + label + '"]');
  const rect = (e) => { if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; };
`;
export async function clickAt(x, y) {
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
}
/** Clicks the element an in-page expression returns (e.g. `byLabel("Expand panel")`). */
export async function click(expr, wait = 400) {
  const at = await js(`rect(${expr})`);
  if (!at) throw new Error('not found: ' + expr);
  await clickAt(at[0], at[1]);
  await sleep(wait);
}
export async function key(k, mods = 0) {
  const codes = { Enter: 13, Escape: 27, Tab: 9, a: 65 };
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, windowsVirtualKeyCode: codes[k] ?? 0, modifiers: mods });
}
/** Replaces the text of an input the expression returns, then commits it with Enter. */
export async function fill(expr, text) {
  await click(expr, 150);
  await js(`(${expr}).select()`);
  await send('Input.insertText', { text });
  await key('Enter');
  await sleep(300);
}
export async function setStorage(entries) {
  await js(`(${JSON.stringify(entries)}).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v))) || true`);
}
export async function load(url = 'http://localhost:3000/') {
  await send('Page.navigate', { url });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try { if (await js(`!!document.querySelector('.connection-status') && !document.querySelector('.connection-status.is-disconnected')`)) return true; } catch {}
  }
  return false;
}
export async function shot(file) {
  const m = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(file, Buffer.from(m.result.data, 'base64'));
  console.log('saved', file);
}
export const close = () => ws.close();
