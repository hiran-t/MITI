/** @jest-environment node */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { strToU8, zipSync } from 'fflate';
import { DELETE, GET, POST } from '../route';

const archive = zipSync({
  'manifest.json': strToU8(
    JSON.stringify({ id: 'acme', name: 'Acme', version: '1.0.0', miti: { apiVersion: 1 } })
  ),
  'index.js': strToU8('export default { panels: [] };'),
});

const post = (headers: Record<string, string>) =>
  POST(
    new Request('http://miti.local:3000/api/widgets', {
      method: 'POST',
      headers: { host: 'miti.local:3000', ...headers },
      body: archive,
    })
  );
const remove = (headers: Record<string, string> = {}) =>
  DELETE(
    new Request('http://miti.local:3000/api/widgets?id=acme', {
      method: 'DELETE',
      headers: { host: 'miti.local:3000', ...headers },
    })
  );
const binary = { 'content-type': 'application/octet-stream' };

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'miti-state-'));
  process.env.MITI_STATE_DIR = dir;
  delete process.env.MITI_WIDGET_IMPORT;
});
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('MITI itself and tools such as curl import, list and remove widgets', async () => {
  expect((await post({ ...binary, 'sec-fetch-site': 'same-origin' })).status).toBe(201);
  expect((await post({ ...binary, origin: 'http://miti.local:3000' })).status).toBe(201);
  expect((await post(binary)).status).toBe(201);
  const listing = await (await GET()).json();
  expect(listing).toMatchObject({ importAllowed: true, widgets: [{ id: 'acme' }], problems: [] });
  expect((await remove({ 'sec-fetch-site': 'same-origin' })).status).toBe(204);
  expect((await remove()).status).toBe(404);
});

test("another site's page cannot import or remove widgets", async () => {
  expect((await post({ ...binary, 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  expect((await post({ ...binary, origin: 'http://evil.example' })).status).toBe(403);
  // text/plain needs no CORS preflight, so another site could send it unnoticed
  expect((await post({ 'content-type': 'text/plain' })).status).toBe(415);
  expect((await GET().then((r) => r.json())).widgets).toEqual([]);
  await post(binary);
  expect((await remove({ 'sec-fetch-site': 'same-site' })).status).toBe(403);
});

test('MITI_WIDGET_IMPORT=off refuses importing and removing, but still lists', async () => {
  process.env.MITI_WIDGET_IMPORT = 'off';
  expect((await post(binary)).status).toBe(403);
  expect((await remove()).status).toBe(403);
  expect(await (await GET()).json()).toMatchObject({ importAllowed: false, widgets: [] });
});
