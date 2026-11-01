/** @jest-environment node */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { accentVariables, readBranding, readBrandingImage } from '../branding';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'miti-branding-'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  jest.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

const write = (files: Record<string, string>) =>
  Promise.all(
    Object.entries(files).map(([name, text]) => fs.writeFile(path.join(dir, name), text))
  );

test('MITI keeps its own look without MITI_BRANDING_DIR', () => {
  expect(readBranding({})).toBeNull();
});

test('reads the name, title, images and accent of branding.json', async () => {
  await write({
    'branding.json': JSON.stringify({
      name: 'MITI Pro',
      title: 'MITI Pro · Pacen',
      logo: 'logo.svg',
      icon: 'icon.png',
      accent: '#E30613',
    }),
    'logo.svg': '<svg/>',
    'icon.png': 'png',
  });
  const branding = readBranding({ MITI_BRANDING_DIR: dir });
  expect(branding).toEqual({
    name: 'MITI Pro',
    title: 'MITI Pro · Pacen',
    logo: 'logo.svg',
    icon: 'icon.png',
    accent: '#e30613',
    dir,
  });
  expect(readBrandingImage(branding, 'logo')).toEqual({
    data: Buffer.from('<svg/>'),
    contentType: 'image/svg+xml',
  });
  expect(readBrandingImage(branding, 'icon')?.contentType).toBe('image/png');
});

test('leaves out what is wrong and keeps the rest', async () => {
  await write({
    'branding.json': JSON.stringify({
      name: 'Acme',
      logo: '../outside.svg',
      icon: 'missing.svg',
      accent: 'red',
    }),
  });
  const branding = readBranding({ MITI_BRANDING_DIR: dir });
  expect(branding).toMatchObject({
    name: 'Acme',
    title: 'Acme',
    logo: null,
    icon: null,
    accent: null,
  });
  expect(readBrandingImage(branding, 'logo')).toBeNull();
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"logo" must name'));
});

test('a folder without a readable branding.json is ignored', async () => {
  expect(readBranding({ MITI_BRANDING_DIR: dir })).toBeNull();
  await write({ 'branding.json': '[1]' });
  expect(readBranding({ MITI_BRANDING_DIR: dir })).toBeNull();
});

test("shades an accent the way MITI's teal is shaded", () => {
  expect(accentVariables('#2fb4c4')).toEqual({
    '--miti-accent': '#2fb4c4',
    '--miti-accent-rgb': '47 180 196',
    '--miti-accent-hover': expect.stringMatching(/^#[0-9a-f]{6}$/),
    '--miti-accent-muted': expect.stringMatching(/^#[0-9a-f]{6}$/),
    '--miti-accent-strong': expect.stringMatching(/^#[0-9a-f]{6}$/),
    '--miti-on-accent-strong': expect.stringMatching(/^#[0-9a-f]{6}$/),
  });
  // Black stays black when darkened; white is a lighter hover than the color itself.
  expect(accentVariables('#000000')['--miti-accent-strong']).toBe('#000000');
  expect(accentVariables('#808080')['--miti-accent-hover']).toBe('#939393');
});
