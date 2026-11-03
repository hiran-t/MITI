import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { unzipSync } from 'fflate';
import {
  isSafeRelativePath,
  parseWidgetManifest,
  type WidgetManifest,
} from '@/lib/widgets/manifest';

/**
 * Widgets imported into MITI, one folder per widget id under `<state dir>/widgets`, holding the
 * unpacked package of the version installed last. The browser loads them from there through
 * /api/widgets; every browser that opens this MITI gets the same widgets.
 */
type Env = Record<string, string | undefined>;

/** Largest package accepted, and the most its files may unpack to. */
export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 64 * 1024 * 1024;
const MAX_FILES = 500;
const MANIFEST = 'manifest.json';
/** Written next to the files when a widget is installed. */
const INSTALLED = '.installed';

export interface InstalledWidget extends WidgetManifest {
  /** When it was imported, in ms; part of its file URLs, so a reimport is never served stale. */
  installedAt: number;
}

// The state folder is found at run time, so the build must not trace it (turbopackIgnore), or
// Turbopack copies the whole project into the standalone output.
export const stateDir = (env: Env = process.env) =>
  env.MITI_STATE_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), '.miti');
export const widgetsDir = (env: Env = process.env) => path.join(stateDir(env), 'widgets');

/** Whether widgets may be imported and removed from the browser (MITI_WIDGET_IMPORT=off stops it). */
export const widgetImportAllowed = (env: Env = process.env) =>
  !/^(off|false|0|no)$/i.test(env.MITI_WIDGET_IMPORT ?? '');

const CONTENT_TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json',
  css: 'text/css; charset=utf-8',
  map: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  wasm: 'application/wasm',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
};

export const widgetContentType = (file: string) =>
  CONTENT_TYPES[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream';

/** The package's files by path, checked for size, count and names. */
function unpack(archive: Uint8Array): Map<string, Uint8Array> {
  if (archive.byteLength > MAX_PACKAGE_BYTES)
    throw new Error(`The package is larger than ${MAX_PACKAGE_BYTES / 1024 / 1024} MB`);
  let unpacked = 0;
  let count = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(archive, {
      filter: (file) => {
        // Folders, and what archivers add on their own (__MACOSX/, .DS_Store), are left out.
        if (file.name.endsWith('/') || file.name.startsWith('__MACOSX/')) return false;
        if (file.name.split('/').some((part) => part.startsWith('.') && part !== '..'))
          return false;
        if (!isSafeRelativePath(file.name))
          throw new Error(`The package holds a file outside it or with an odd name: ${file.name}`);
        count += 1;
        unpacked += file.originalSize;
        if (count > MAX_FILES) throw new Error(`The package holds more than ${MAX_FILES} files`);
        if (unpacked > MAX_UNPACKED_BYTES)
          throw new Error(
            `The package unpacks to more than ${MAX_UNPACKED_BYTES / 1024 / 1024} MB`
          );
        return true;
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The package')) throw error;
    throw new Error(`The file is not a widget package (a zip with ${MANIFEST})`);
  }
  return new Map(Object.entries(entries));
}

/** The manifest of a package, checked, and its files. */
export function readPackage(archive: Uint8Array): {
  manifest: WidgetManifest;
  files: Map<string, Uint8Array>;
} {
  const files = unpack(archive);
  const raw = files.get(MANIFEST);
  if (!raw) throw new Error(`The package has no ${MANIFEST} at its root`);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error(`${MANIFEST} is not valid JSON`);
  }
  let manifest: WidgetManifest;
  try {
    manifest = parseWidgetManifest(json);
  } catch (error) {
    throw new Error(`${MANIFEST}: ${(error as Error).message}`);
  }
  if (!files.has(manifest.main)) throw new Error(`The package has no ${manifest.main}`);
  return { manifest, files };
}

/** Install a package, replacing any version of the same widget. */
export async function installWidget(
  archive: Uint8Array,
  dir: string = widgetsDir()
): Promise<InstalledWidget> {
  const { manifest, files } = readPackage(archive);
  await fs.mkdir(dir, { recursive: true });
  // Unpack beside the widgets and swap folders, so a widget is never served half-written.
  const staging = path.join(dir, `.staging-${randomUUID()}`);
  const retired = path.join(dir, `.retired-${randomUUID()}`);
  const target = path.join(dir, manifest.id);
  const installedAt = Date.now();
  try {
    for (const [name, data] of Array.from(files)) {
      const file = path.join(staging, ...name.split('/'));
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, data);
    }
    await fs.writeFile(path.join(staging, INSTALLED), JSON.stringify({ installedAt }));
    const replacing = await fs.stat(target).then(
      () => true,
      () => false
    );
    if (replacing) await fs.rename(target, retired);
    await fs.rename(staging, target);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
    await fs.rm(retired, { recursive: true, force: true });
  }
  return { ...manifest, installedAt };
}

/** The installed widget `id`; throws when it is not installed or cannot be read. */
async function readInstalled(dir: string, id: string): Promise<InstalledWidget> {
  const folder = path.join(dir, id);
  const manifest = parseWidgetManifest(
    JSON.parse(await fs.readFile(path.join(folder, MANIFEST), 'utf8'))
  );
  if (manifest.id !== id) throw new Error(`its manifest names it ${manifest.id}`);
  const { installedAt } = JSON.parse(await fs.readFile(path.join(folder, INSTALLED), 'utf8'));
  return { ...manifest, installedAt: Number(installedAt) || 0 };
}

/** Installed widgets, and the folders that cannot be read as one, with why. */
export async function listWidgets(dir: string = widgetsDir()): Promise<{
  widgets: InstalledWidget[];
  problems: { id: string; error: string }[];
}> {
  const names = await fs
    .readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true })
    .catch(() => []);
  const widgets: InstalledWidget[] = [];
  const problems: { id: string; error: string }[] = [];
  for (const entry of names) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    try {
      widgets.push(await readInstalled(dir, entry.name));
    } catch (error) {
      problems.push({ id: entry.name, error: (error as Error).message });
    }
  }
  widgets.sort((a, b) => a.name.localeCompare(b.name));
  return { widgets, problems };
}

/** Remove a widget; false when it was not installed. */
export async function removeWidget(id: string, dir: string = widgetsDir()): Promise<boolean> {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id)) return false;
  const folder = path.join(dir, id);
  const exists = await fs.stat(folder).then(
    (stat) => stat.isDirectory(),
    () => false
  );
  if (exists) await fs.rm(folder, { recursive: true, force: true });
  return exists;
}

/**
 * A file of an installed widget, or null. `version` must be the installed one, so a browser that
 * still asks for an older version's file is not given the newer version's code under its name.
 */
export async function readWidgetFile(
  id: string,
  version: string,
  file: string,
  dir: string = widgetsDir()
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id) || !isSafeRelativePath(file)) return null;
  if (file === INSTALLED) return null;
  try {
    const installed = await readInstalled(dir, id);
    if (installed.version !== version) return null;
    const folder = path.join(dir, id);
    const target = path.resolve(folder, ...file.split('/'));
    if (!target.startsWith(folder + path.sep)) return null;
    return { data: await fs.readFile(target), contentType: widgetContentType(file) };
  } catch {
    return null;
  }
}
