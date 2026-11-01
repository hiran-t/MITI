/** @jest-environment node */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { strToU8, zipSync } from 'fflate';
import {
  MAX_PACKAGE_BYTES,
  installWidget,
  listWidgets,
  readWidgetFile,
  removeWidget,
  widgetImportAllowed,
} from '../widget-store';

const manifest = {
  id: 'acme.vision',
  name: 'Acme Vision',
  version: '1.0.0',
  main: 'index.js',
  miti: { apiVersion: 1 },
};

const pack = (files: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));

const widget = (overrides: Record<string, unknown> = {}, files: Record<string, string> = {}) =>
  pack({
    'manifest.json': JSON.stringify({ ...manifest, ...overrides }),
    'index.js': 'export default { panels: [] };',
    ...files,
  });

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'miti-widgets-'));
});
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('installs a package, lists it and serves its files for the installed version only', async () => {
  const installed = await installWidget(widget({}, { 'lib/chunk.js': 'export const x = 1;' }), dir);
  expect(installed).toMatchObject({ id: 'acme.vision', version: '1.0.0', main: 'index.js' });
  expect(await listWidgets(dir)).toEqual({ widgets: [installed], problems: [] });

  const main = await readWidgetFile('acme.vision', '1.0.0', 'index.js', dir);
  expect(main?.contentType).toBe('text/javascript; charset=utf-8');
  expect(main?.data.toString()).toContain('panels');
  expect(await readWidgetFile('acme.vision', '1.0.0', 'lib/chunk.js', dir)).not.toBeNull();
  expect(await readWidgetFile('acme.vision', '0.9.0', 'index.js', dir)).toBeNull();
  expect(await readWidgetFile('acme.vision', '1.0.0', '../acme.vision/index.js', dir)).toBeNull();
  expect(await readWidgetFile('acme.vision', '1.0.0', '.installed', dir)).toBeNull();
  expect(await readWidgetFile('../etc', '1.0.0', 'passwd', dir)).toBeNull();
});

test('a new import replaces the previous version and its files', async () => {
  const first = await installWidget(widget({}, { 'old.js': '' }), dir);
  await new Promise((resolve) => setTimeout(resolve, 2));
  const second = await installWidget(widget({ version: '1.1.0' }), dir);
  expect(second.installedAt).toBeGreaterThan(first.installedAt);
  expect((await listWidgets(dir)).widgets).toEqual([second]);
  expect(await readWidgetFile('acme.vision', '1.1.0', 'old.js', dir)).toBeNull();
  expect((await fs.readdir(dir)).filter((name) => name.startsWith('.'))).toEqual([]);
});

test.each([
  ['a file that is not a zip', new TextEncoder().encode('hello'), 'not a widget package'],
  ['a zip without a manifest', pack({ 'index.js': '' }), 'no manifest.json'],
  ['a manifest that is not JSON', pack({ 'manifest.json': '{', 'index.js': '' }), 'not valid JSON'],
  ['an id with capitals', widget({ id: 'Acme' }), '"id" must be lowercase'],
  ['a version that is not semver', widget({ version: 'v1' }), '"version" must look like 1.0.0'],
  ['another widget API', widget({ miti: { apiVersion: 2 } }), 'needs widget API 2'],
  ['a main file it does not hold', widget({ main: 'dist/index.js' }), 'no dist/index.js'],
  ['a file outside the package', widget({}, { '../evil.js': '' }), 'outside it'],
])('rejects %s', async (_name, archive, message) => {
  await expect(installWidget(archive, dir)).rejects.toThrow(message);
  expect((await listWidgets(dir)).widgets).toEqual([]);
});

test('rejects a package that is too large before unpacking it', async () => {
  await expect(installWidget(new Uint8Array(MAX_PACKAGE_BYTES + 1), dir)).rejects.toThrow(
    'larger than 20 MB'
  );
});

test('leaves out what archivers add on their own', async () => {
  await installWidget(widget({}, { '__MACOSX/._index.js': '', '.DS_Store': '' }), dir);
  expect(await fs.readdir(path.join(dir, 'acme.vision'))).toEqual(
    expect.not.arrayContaining(['__MACOSX', '.DS_Store'])
  );
});

test('removes a widget, and reports folders it cannot read', async () => {
  await installWidget(widget(), dir);
  await fs.mkdir(path.join(dir, 'broken'));
  expect((await listWidgets(dir)).problems).toEqual([
    { id: 'broken', error: expect.stringContaining('manifest.json') },
  ]);
  expect(await removeWidget('acme.vision', dir)).toBe(true);
  expect(await removeWidget('acme.vision', dir)).toBe(false);
  expect(await removeWidget('../outside', dir)).toBe(false);
  expect((await listWidgets(dir)).widgets).toEqual([]);
});

test('MITI_WIDGET_IMPORT=off stops importing and removing from the browser', () => {
  expect(widgetImportAllowed({})).toBe(true);
  expect(widgetImportAllowed({ MITI_WIDGET_IMPORT: 'off' })).toBe(false);
  expect(widgetImportAllowed({ MITI_WIDGET_IMPORT: 'on' })).toBe(true);
});
