import fs from 'fs';
import path from 'path';

/**
 * Another name, logo, browser icon and accent color for MITI, e.g. for a company that delivers
 * MITI to its customers. MITI_BRANDING_DIR names a folder with `branding.json`:
 *
 *   { "name": "MITI Pro", "title": "MITI Pro", "logo": "logo.svg", "icon": "icon.svg",
 *     "accent": "#e30613" }
 *
 * and the image files it names. Every field is optional; the page reads them on each request, so
 * a change shows on the next reload without rebuilding MITI.
 */
type Env = Record<string, string | undefined>;

export interface Branding {
  /** Shown as the logo's text alternative. */
  name: string;
  /** The browser tab's title. */
  title: string;
  /** File names inside the folder, or null for MITI's own. */
  logo: string | null;
  icon: string | null;
  /** `#rrggbb`, or null for MITI's teal. */
  accent: string | null;
  dir: string;
}

const IMAGE_TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  ico: 'image/x-icon',
};
const FILE_NAME = /^[\w][\w.-]*$/;
const ACCENT = /^#[0-9a-f]{6}$/i;

/** Each problem is logged once, not on every page load. */
const reported = new Set<string>();
function report(problem: string) {
  if (reported.has(problem)) return;
  reported.add(problem);
  console.warn(`MITI_BRANDING_DIR: ${problem}`);
}

const imageType = (file: string) => IMAGE_TYPES[path.extname(file).slice(1).toLowerCase()];

function text(value: unknown, field: string, max: number): string | null {
  if (value === undefined) return null;
  if (typeof value === 'string' && value.trim() && value.length <= max) return value.trim();
  report(`"${field}" must be a text of at most ${max} characters; it is left out`);
  return null;
}

function image(dir: string, value: unknown, field: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !FILE_NAME.test(value) || !imageType(value)) {
    report(`"${field}" must name an .svg, .png, .webp or .ico file in the folder; it is left out`);
    return null;
  }
  if (!fs.existsSync(path.join(dir, value))) {
    report(`"${field}": ${path.join(dir, value)} does not exist; it is left out`);
    return null;
  }
  return value;
}

/** The branding in MITI_BRANDING_DIR, or null when it is not set or cannot be read. */
export function readBranding(env: Env = process.env): Branding | null {
  const dir = env.MITI_BRANDING_DIR;
  if (!dir) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dir, 'branding.json'), 'utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not an object');
  } catch (error) {
    report(`cannot read ${path.join(dir, 'branding.json')} (${(error as Error).message})`);
    return null;
  }
  const name = text(raw.name, 'name', 40) ?? 'MITI';
  let accent: string | null = null;
  if (raw.accent !== undefined) {
    if (typeof raw.accent === 'string' && ACCENT.test(raw.accent))
      accent = raw.accent.toLowerCase();
    else report('"accent" must be a color like #2fb4c4; it is left out');
  }
  return {
    name,
    title: text(raw.title, 'title', 80) ?? name,
    logo: image(dir, raw.logo, 'logo'),
    icon: image(dir, raw.icon, 'icon'),
    accent,
    dir,
  };
}

/** The logo or icon file of the branding, or null. */
export function readBrandingImage(
  branding: Branding | null,
  which: 'logo' | 'icon'
): { data: Buffer; contentType: string } | null {
  const file = branding?.[which];
  if (!branding || !file) return null;
  try {
    return { data: fs.readFileSync(path.join(branding.dir, file)), contentType: imageType(file) };
  } catch {
    return null;
  }
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
/** `amount` of the way from `from` to `to`. */
const mix = (from: number[], to: number[], amount: number) =>
  from.map((c, i) => c + (to[i] - c) * amount);

/**
 * The accent CSS variables for an accent color, shaded the way MITI's teal is: a lighter hover,
 * a dark tint of the chrome for selections, a deep shade for filled controls and a light text on it.
 */
export function accentVariables(accent: string): Record<string, string> {
  const rgb = channels(accent);
  const chrome = channels('#191a1c');
  return {
    '--miti-accent': accent,
    '--miti-accent-rgb': rgb.join(' '),
    '--miti-accent-hover': toHex(mix(rgb, [255, 255, 255], 0.15)),
    '--miti-accent-muted': toHex(mix(rgb, chrome, 0.82)),
    '--miti-accent-strong': toHex(mix(rgb, [0, 0, 0], 0.45)),
    '--miti-on-accent-strong': toHex(mix(rgb, [255, 255, 255], 0.9)),
  };
}
