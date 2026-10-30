/**
 * Coloring for point clouds, laser scans and occupancy grids, following Foxglove's 3D panel
 * (which follows RViz): flat, gradient, color map and per-point RGB(A) for points; Map, Costmap,
 * Raw and Custom palettes for grids.
 */
import type { PointData } from '@/lib/parsers/pointcloud-parser';

export type PointColorMode = 'flat' | 'gradient' | 'colormap' | 'rgb' | 'rgba';
export type ColorMapName = 'turbo' | 'rainbow';
export type MapColorMode = 'custom' | 'map' | 'costmap' | 'raw';

export interface PointColorSettings {
  colorMode: PointColorMode;
  /** Color for flat mode. */
  color: string;
  colorField: string;
  colorMap: ColorMapName;
  gradient: [string, string];
  /** undefined takes the field's range in each message. */
  valueMin?: number;
  valueMax?: number;
}

export interface MapColorSettings {
  colorMode: MapColorMode;
  minColor: string;
  maxColor: string;
  unknownColor: string;
  invalidColor: string;
}

export const DEFAULT_GRADIENT: [string, string] = ['#15d6ff', '#ff2a68'];
export const DEFAULT_MAP_COLORS: Omit<MapColorSettings, 'colorMode'> = {
  minColor: '#ffffff',
  maxColor: '#000000',
  unknownColor: '#80808080',
  invalidColor: '#ff00ff',
};

type Rgb = [number, number, number];

/** `#rgb`, `#rrggbb` or `#rrggbbaa` to 0–1 channels; alpha defaults to 1. */
export function parseHex(hex: string): [number, number, number, number] {
  let h = (hex ?? '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return [1, 1, 1, 1];
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
}

/** Polynomial approximation of Google's Turbo color map. */
function turbo(t: number): Rgb {
  const x = Math.min(1, Math.max(0, t));
  const x2 = x * x,
    x3 = x2 * x,
    x4 = x2 * x2,
    x5 = x4 * x;
  return [
    0.13572138 +
      4.6153926 * x -
      42.66032258 * x2 +
      132.13108234 * x3 -
      152.94239396 * x4 +
      59.28637943 * x5,
    0.09140261 +
      2.19418839 * x +
      4.84296658 * x2 -
      14.18503333 * x3 +
      4.27729857 * x4 +
      2.82956604 * x5,
    0.1066733 +
      12.64194608 * x -
      60.58204836 * x2 +
      110.36276771 * x3 -
      89.90310912 * x4 +
      27.34824973 * x5,
  ].map((c) => Math.min(1, Math.max(0, c))) as Rgb;
}

/** RViz's intensity rainbow. */
function rainbow(t: number): Rgb {
  const h = (1 - Math.min(1, Math.max(0, t))) * 5 + 1;
  const i = Math.floor(h);
  let f = h - i;
  if (!(i & 1)) f = 1 - f;
  const n = 1 - f;
  if (i <= 1) return [n, 0, 1];
  if (i === 2) return [0, n, 1];
  if (i === 3) return [0, 1, n];
  if (i === 4) return [n, 1, 0];
  return [1, n, 0];
}

export const COLOR_MAPS: Record<ColorMapName, (t: number) => Rgb> = { turbo, rainbow };

/** Entries in a sampled color map; neighbours differ by less than one 8-bit step. */
const COLOR_TABLE_SIZE = 4096;
const colorTables: Partial<Record<ColorMapName, Float32Array>> = {};
/** r, g, b of the color map sampled evenly over 0–1. */
function colorMapTable(name: ColorMapName): Float32Array {
  const key = COLOR_MAPS[name] ? name : 'turbo';
  let table = colorTables[key];
  if (!table) {
    table = new Float32Array(COLOR_TABLE_SIZE * 3);
    for (let i = 0; i < COLOR_TABLE_SIZE; i++)
      table.set(COLOR_MAPS[key](i / (COLOR_TABLE_SIZE - 1)), i * 3);
    colorTables[key] = table;
  }
  return table;
}

/** The color settings Foxglove starts with: the message's own colors, else intensity, else flat. */
export function autoPointColors(fields: string[], hasColors: boolean) {
  if (hasColors) return { colorMode: 'rgb' as const, colorField: 'intensity' };
  const field = fields.find((name) => ['intensity', 'i'].includes(name));
  return field
    ? { colorMode: 'colormap' as const, colorField: field }
    : { colorMode: 'flat' as const, colorField: fields.includes('z') ? 'z' : (fields[0] ?? 'x') };
}

export interface PointColors {
  /** r, g, b, a per point. */
  colors: Float32Array;
  /** Set when the settings cannot apply to this message; the points are drawn flat. */
  error?: string;
  /** Range the color field was mapped from. */
  range?: [number, number];
}

export function pointColors(
  points: PointData,
  settings: PointColorSettings,
  opacity = 1
): PointColors {
  const { count } = points;
  const out = new Float32Array(count * 4);
  const flat = (error?: string) => {
    const [r, g, b, a] = parseHex(settings.color);
    for (let i = 0; i < count * 4; i += 4) {
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a * opacity;
    }
    return { colors: out, error };
  };
  const mode = settings.colorMode;
  if (mode === 'flat') return flat();
  if (mode === 'rgb' || mode === 'rgba') {
    const colors = points.colors();
    if (!colors) return flat('Message has no rgb, rgba or r/g/b fields');
    for (let i = 0; i < count; i++) {
      out[i * 4] = colors[i * 4];
      out[i * 4 + 1] = colors[i * 4 + 1];
      out[i * 4 + 2] = colors[i * 4 + 2];
      out[i * 4 + 3] = (mode === 'rgba' ? colors[i * 4 + 3] : 1) * opacity;
    }
    return { colors: out };
  }
  const values = points.values(settings.colorField);
  if (!values) return flat(`Field "${settings.colorField}" is not in the message`);
  let min = settings.valueMin,
    max = settings.valueMax;
  if (min === undefined || max === undefined) {
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 0; i < count; i++) {
      const v = values[i];
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min ??= Number.isFinite(lo) ? lo : 0;
    max ??= Number.isFinite(hi) ? hi : 1;
  }
  const span = max - min || 1;
  if (mode === 'gradient') {
    const a = parseHex(settings.gradient[0]),
      b = parseHex(settings.gradient[1]);
    for (let i = 0; i < count; i++) {
      const t = Math.min(1, Math.max(0, (values[i] - min) / span)) || 0;
      for (let c = 0; c < 4; c++) out[i * 4 + c] = a[c] + (b[c] - a[c]) * t;
      out[i * 4 + 3] *= opacity;
    }
  } else {
    // A table of the map: computing it per point allocates and costs ~2 ms per 100k points.
    const table = colorMapTable(settings.colorMap);
    const last = COLOR_TABLE_SIZE - 1;
    for (let i = 0; i < count; i++) {
      const t = (values[i] - min) / span || 0;
      const k = 3 * Math.round(Math.min(1, Math.max(0, t)) * last);
      out[i * 4] = table[k];
      out[i * 4 + 1] = table[k + 1];
      out[i * 4 + 2] = table[k + 2];
      out[i * 4 + 3] = opacity;
    }
  }
  return { colors: out, range: [min, max] };
}

const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);

/** RViz's map and costmap palettes: 256 RGBA entries indexed by the cell value as a byte. */
function rvizPalette(costmap: boolean) {
  const p = new Uint8Array(256 * 4);
  const set = (i: number, r: number, g: number, b: number, a = 255) => p.set([r, g, b, a], i * 4);
  for (let i = 0; i <= 100; i++) {
    if (!costmap) {
      const v = 255 - Math.floor((255 * i) / 100);
      set(i, v, v, v);
    } else if (i === 0) set(0, 0, 0, 0, 0);
    else if (i <= 98) {
      const v = Math.floor((255 * i) / 100);
      set(i, v, 0, 255 - v);
    }
  }
  if (costmap) {
    set(99, 0, 255, 255); // inscribed obstacle
    set(100, 255, 0, 255); // lethal obstacle
  }
  for (let i = 101; i <= 127; i++) set(i, 0, 255, 0); // illegal positive values
  for (let i = 128; i <= 254; i++) set(i, 255, Math.floor((255 * (i - 128)) / 126), 0); // illegal negative values
  set(255, 0x70, 0x89, 0x86); // unknown (-1)
  return p;
}

const rvizPalettes: Partial<Record<'map' | 'costmap', Uint8Array>> = {};

/** 256 RGBA entries indexed by the cell value as a byte (-1 → 255). */
export function occupancyPalette(settings: MapColorSettings): Uint8Array {
  if (settings.colorMode === 'map' || settings.colorMode === 'costmap')
    return (rvizPalettes[settings.colorMode] ??= rvizPalette(settings.colorMode === 'costmap'));
  const palette = new Uint8Array(256 * 4);
  if (settings.colorMode === 'raw') {
    for (let i = 0; i < 256; i++) palette.set([i, i, i, 255], i * 4);
  } else {
    const min = parseHex(settings.minColor),
      max = parseHex(settings.maxColor),
      unknown = parseHex(settings.unknownColor),
      invalid = parseHex(settings.invalidColor);
    for (let i = 0; i < 256; i++) {
      const c =
        i <= 100 ? min.map((v, k) => v + (max[k] - v) * (i / 100)) : i === 255 ? unknown : invalid;
      palette.set(c.map(byte), i * 4);
    }
  }
  return palette;
}
