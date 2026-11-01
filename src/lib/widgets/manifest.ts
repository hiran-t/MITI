/**
 * The manifest of a widget package (`<id>-<version>.miti-widget`, a zip with `manifest.json` at
 * its root), checked by the browser and the server. `miti-widget build` (hiran-t/MITI-sdk,
 * lib/manifest.mjs) checks the same, so a package that builds is a package that installs.
 */

/** The `@miti/sdk` API version this MITI provides; widgets declare it as `miti.apiVersion`. */
export const WIDGET_API_VERSION = 1;
export const WIDGET_FILE_EXTENSION = '.miti-widget';

export interface WidgetManifest {
  /** Lowercase words joined by dots or dashes, e.g. `acme.vision`; its panels' types start with it. */
  id: string;
  name: string;
  /** `major.minor.patch`, with an optional `-prerelease`. */
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  /** The ES module whose default export is the widget, relative to the package root. */
  main: string;
  miti: { apiVersion: number };
}

const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SEGMENT = /^[\w@+-][\w.@+-]*$/;

/** A path inside a package: relative, with plain names, and never leaving the package. */
export function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 200) return false;
  return value.split('/').every((part) => SEGMENT.test(part) && part !== '..' && part !== '.');
}

const text = (value: unknown, field: string, max: number, required = false): string | undefined => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`"${field}" must be a text`);
  if (value.length > max) throw new Error(`"${field}" is longer than ${max} characters`);
  return value.trim();
};

/** The manifest, checked; throws an Error that says what is wrong. */
export function parseWidgetManifest(value: unknown): WidgetManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('manifest.json must hold an object');
  const raw = value as Record<string, unknown>;
  const id = text(raw.id, 'id', 100, true)!;
  if (!ID.test(id))
    throw new Error(`"id" must be lowercase words joined by dots or dashes, e.g. acme.vision`);
  const version = text(raw.version, 'version', 50, true)!;
  if (!VERSION.test(version)) throw new Error(`"version" must look like 1.0.0`);
  const main = raw.main ?? 'index.js';
  if (!isSafeRelativePath(main) || !/\.m?js$/.test(main))
    throw new Error('"main" must be a .js file inside the package');
  const homepage = text(raw.homepage, 'homepage', 300);
  if (homepage && !/^https?:\/\//.test(homepage))
    throw new Error('"homepage" must be an http or https address');
  const miti = raw.miti as { apiVersion?: unknown } | undefined;
  const apiVersion = miti?.apiVersion;
  if (typeof apiVersion !== 'number' || !Number.isInteger(apiVersion))
    throw new Error('"miti.apiVersion" must be a whole number');
  if (apiVersion !== WIDGET_API_VERSION)
    throw new Error(
      `the widget needs widget API ${apiVersion}; this MITI provides API ${WIDGET_API_VERSION}`
    );
  return {
    id,
    name: text(raw.name, 'name', 80, true)!,
    version,
    description: text(raw.description, 'description', 500),
    author: text(raw.author, 'author', 200),
    homepage,
    license: text(raw.license, 'license', 100),
    main,
    miti: { apiVersion },
  };
}
