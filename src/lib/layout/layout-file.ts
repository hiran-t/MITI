import type { LayoutConfig } from '@/types/widget';
import { normalizeLayout } from '@/hooks/useLayoutConfig';

/**
 * The format of layout files this MITI writes. Version 2 stores how panels tile as react-mosaic 7's
 * n-ary tree (`children`, `splitPercentages`). Version 1, written by MITI 3.4.5 and earlier, stores
 * a binary tree (`first`, `second`, `splitPercentage`); it is still read, and converted.
 */
export const LAYOUT_FILE_VERSION = 2;

/**
 * A layout saved as a file, to move it to another browser or deliver it with the widgets its
 * panels need. The widgets are listed so a MITI without them can say which to import.
 */
export interface LayoutFile {
  miti: 'layout';
  version: 1 | typeof LAYOUT_FILE_VERSION;
  layout: LayoutConfig;
  /** Widgets whose panels the layout holds, as they were installed when it was saved. */
  widgets: { id: string; name: string; version: string }[];
}

/** The widget a panel type belongs to: the part before the slash, if any. */
const widgetOf = (type: string) => (type.includes('/') ? type.slice(0, type.indexOf('/')) : null);

export function layoutToFile(
  layout: LayoutConfig,
  installed: { id: string; name: string; version: string }[]
): string {
  const used = new Set(layout.widgets.map((widget) => widgetOf(widget.type)));
  const file: LayoutFile = {
    miti: 'layout',
    version: LAYOUT_FILE_VERSION,
    layout,
    widgets: installed
      .filter((widget) => used.has(widget.id))
      .map(({ id, name, version }) => ({ id, name, version })),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * The layout in a file, checked and with its panel tree in the current format; throws an Error that
 * says what is wrong.
 */
export function layoutFromFile(text: string): Omit<LayoutFile, 'miti' | 'version'> {
  let file: Partial<LayoutFile>;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('The file is not JSON');
  }
  if (!file || file.miti !== 'layout' || !file.layout || !Array.isArray(file.layout.widgets))
    throw new Error('The file is not a MITI layout');
  if (file.version !== 1 && file.version !== LAYOUT_FILE_VERSION)
    throw new Error(
      `The layout is version ${file.version}; this MITI reads versions 1 to ${LAYOUT_FILE_VERSION}`
    );
  const widgets = Array.isArray(file.widgets)
    ? file.widgets.filter(
        (widget) =>
          widget &&
          typeof widget.id === 'string' &&
          typeof widget.name === 'string' &&
          typeof widget.version === 'string'
      )
    : [];
  return { layout: normalizeLayout(file.layout), widgets };
}

/** The layout's widgets that are not installed here. */
export function missingWidgets(
  needed: { id: string; name: string; version: string }[],
  installed: { id: string }[]
) {
  const here = new Set(installed.map((widget) => widget.id));
  return needed.filter((widget) => !here.has(widget.id));
}
