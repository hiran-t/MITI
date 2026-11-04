/**
 * ROS 2 message definitions as bridges advertise them (`ros2msg`): the `.msg` text of a type, then
 * each type it uses after a line of `=` and a `MSG: package/Type` line. miti_bridge and
 * foxglove_bridge write them the same way.
 *
 * Field lines follow the `.msg` format of rosidl: `type name`, `type name default`, or
 * `type NAME=value` for a constant, with `string<=N`, `T[N]`, `T[<=N]` and `T[]` for bounded
 * strings and fixed, bounded and unbounded arrays, and `#` starting a comment.
 */

export type LiteralValue = boolean | number | bigint | string;
export type DefaultValue = LiteralValue | LiteralValue[];

export interface MessageField {
  name: string;
  /** A primitive type (see `PRIMITIVE_TYPES`) or the name of a message type, `package/Type`. */
  type: string;
  isComplex: boolean;
  isArray: boolean;
  /** `T[N]`: always N items, without a length on the wire. */
  arrayLength?: number;
  /** `T[<=N]`: at most N items. */
  arrayUpperBound?: number;
  /** `string<=N`: at most N characters. */
  upperBound?: number;
  /** The value written when a message leaves the field out. */
  defaultValue?: DefaultValue;
}

export interface MessageConstant {
  name: string;
  type: string;
  value: LiteralValue;
  /** The value as written in the definition. */
  valueText: string;
}

export interface MessageDefinition {
  /** `package/Type`; the first definition (the message itself) usually has no name. */
  name?: string;
  fields: MessageField[];
  constants: MessageConstant[];
}

/**
 * The types fields can have besides messages. `byte` and `char` are read as `uint8`, and
 * `builtin_interfaces/Time` and `Duration` as `time` and `duration`: `{ sec, nanosec }`.
 */
export const PRIMITIVE_TYPES = new Set([
  'bool',
  'int8',
  'uint8',
  'int16',
  'uint16',
  'int32',
  'uint32',
  'int64',
  'uint64',
  'float32',
  'float64',
  'string',
  'wstring',
  'time',
  'duration',
]);

const ALIASES: Record<string, string> = {
  byte: 'uint8',
  char: 'uint8',
  'builtin_interfaces/Time': 'time',
  'builtin_interfaces/msg/Time': 'time',
  'builtin_interfaces/Duration': 'duration',
  'builtin_interfaces/msg/Duration': 'duration',
};

/** `type`, `type<=N`, then `[N]`, `[<=N]` or `[]`. */
const TYPE_PATTERN = /^([A-Za-z][A-Za-z0-9_/]*)(?:<=(\d+))?(?:\[(<=)?(\d*)\])?$/;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*/;

/** `pkg/msg/Type` and `pkg/Type` name the same type. */
function typeKey(name: string): string {
  const parts = name.split('/');
  return parts.length === 3 && parts[1] === 'msg' ? `${parts[0]}/${parts[2]}` : name;
}

/** Parses a definition and its dependencies; the first one returned is the message itself. */
export function parseMessageDefinition(text: string): MessageDefinition[] {
  const sections: { name?: string; lines: string[] }[] = [{ lines: [] }];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('==')) {
      sections.push({ lines: [] });
      continue;
    }
    const msg = /^MSG:\s*(\S+)/.exec(line);
    if (msg) sections[sections.length - 1].name = typeKey(msg[1]);
    else sections[sections.length - 1].lines.push(line);
  }
  // A section with neither name nor fields (text that starts with a separator) is not a type.
  const used = sections.filter((section, i) => i === 0 || section.name || section.lines.length);
  const definitions: MessageDefinition[] = [];
  const seen = new Set<string>();
  for (const { name, lines } of used) {
    // Repeated dependencies are kept once.
    if (name !== undefined && seen.has(name)) continue;
    if (name !== undefined) seen.add(name);
    const definition: MessageDefinition = { name, fields: [], constants: [] };
    for (const line of lines) parseLine(line, definition);
    definitions.push(definition);
  }
  for (const definition of definitions)
    for (const field of definition.fields)
      if (field.isComplex) field.type = resolveType(definitions, field.type, definition.name);
  return definitions;
}

/** The full name of the definition a field's type refers to, as fields may leave the package out. */
function resolveType(definitions: MessageDefinition[], type: string, owner?: string): string {
  const names = definitions.flatMap((definition) => (definition.name ? [definition.name] : []));
  const key = typeKey(type);
  if (key.includes('/')) {
    if (names.includes(key)) return key;
    throw new Error(`No definition for type ${type}`);
  }
  // A type of the same package, then std_msgs/Header for Header, then the only type of that name.
  const ownPackage = owner?.split('/')[0];
  if (ownPackage && names.includes(`${ownPackage}/${key}`)) return `${ownPackage}/${key}`;
  if (key === 'Header' && names.includes('std_msgs/Header')) return 'std_msgs/Header';
  const matches = names.filter((name) => name.endsWith(`/${key}`));
  if (matches.length > 1) throw new Error(`Ambiguous type ${type}: ${matches.join(', ')}`);
  if (!matches.length) throw new Error(`No definition for type ${type}`);
  return matches[0];
}

function fail(line: string, why: string): never {
  throw new Error(`Cannot parse definition line '${line}': ${why}`);
}

function parseLine(line: string, definition: MessageDefinition): void {
  const typeText = line.split(/\s/, 1)[0];
  const typeMatch = TYPE_PATTERN.exec(typeText);
  if (!typeMatch) fail(line, 'not a type');
  const [, rawType, stringBound, bounded, length] = typeMatch;
  const type = ALIASES[rawType] ?? rawType;
  const isArray = typeText.includes('[');
  const isComplex = !PRIMITIVE_TYPES.has(type);
  if (stringBound !== undefined && type !== 'string' && type !== 'wstring')
    fail(line, 'only strings have a <= bound');
  if (bounded && !length) fail(line, 'a bounded array needs its bound');

  const rest = line.slice(typeText.length).trimStart();
  const name = NAME_PATTERN.exec(rest)?.[0];
  if (!name) fail(line, 'no name');
  const afterName = rest.slice(name.length);
  const after = afterName.trimStart();

  if (after.startsWith('=')) {
    if (isArray || isComplex) fail(line, 'constants are single primitive values');
    const valueText = literalText(line, after.slice(1).trimStart());
    definition.constants.push({ name, type, value: parseLiteral(type, valueText), valueText });
    return;
  }
  if (after && !after.startsWith('#') && !/^\s/.test(afterName))
    fail(line, 'unexpected characters after the name');

  const field: MessageField = { name, type, isComplex, isArray };
  if (isArray && length) {
    if (bounded) field.arrayUpperBound = Number(length);
    else field.arrayLength = Number(length);
  }
  if (stringBound !== undefined) field.upperBound = Number(stringBound);
  if (after && !after.startsWith('#')) {
    if (isComplex) fail(line, 'message fields have no default');
    const text = literalText(line, after);
    field.defaultValue = isArray ? parseArrayLiteral(line, type, text) : parseLiteral(type, text);
  }
  definition.fields.push(field);
}

/**
 * The value at the start of `text`, without a trailing comment: a quoted string, a `[...]` list,
 * or everything up to `#`.
 */
function literalText(line: string, text: string): string {
  let end: number;
  if (text.startsWith("'") || text.startsWith('"')) end = quotedEnd(line, text, 0);
  else if (text.startsWith('[')) {
    end = 1;
    for (;;) {
      while (end < text.length && /\s/.test(text[end])) end++;
      if (text[end] === "'" || text[end] === '"') end = quotedEnd(line, text, end);
      while (end < text.length && text[end] !== ',' && text[end] !== ']') end++;
      if (end >= text.length) fail(line, 'unterminated list');
      if (text[end++] === ']') break;
    }
  } else {
    end = 0;
    while (end < text.length && text[end] !== '#') end += text[end] === '\\' ? 2 : 1;
    return text.slice(0, end).trim();
  }
  const rest = text.slice(end).trim();
  if (rest && !rest.startsWith('#')) fail(line, `unexpected '${rest}' after the value`);
  return text.slice(0, end);
}

/** Where the quoted string that starts at `start` ends (after its closing quote). */
function quotedEnd(line: string, text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === quote) return i + 1;
  }
  return fail(line, 'unterminated string');
}

/** The items of a `[a, b, c]` list. */
function parseArrayLiteral(line: string, type: string, text: string): LiteralValue[] {
  const inner = text.slice(1, -1);
  if (!inner.trim()) return [];
  const items: string[] = [];
  let start = 0;
  for (let i = 0; i <= inner.length; i++) {
    const char = inner[i];
    if ((char === "'" || char === '"') && !inner.slice(start, i).trim())
      i = quotedEnd(line, inner, i) - 1;
    else if (char === ',' || i === inner.length) {
      items.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  return items.map((item) => parseLiteral(type, item));
}

const INTEGER_RANGES: Record<string, [number, number]> = {
  int8: [-0x80, 0x7f],
  uint8: [0, 0xff],
  int16: [-0x8000, 0x7fff],
  uint16: [0, 0xffff],
  int32: [-0x80000000, 0x7fffffff],
  uint32: [0, 0xffffffff],
};

/** A constant's or default's value, as rosidl reads it. */
export function parseLiteral(type: string, text: string): LiteralValue {
  const invalid = () => new Error(`Invalid ${type} value: ${text}`);
  switch (type) {
    case 'bool':
      if (['true', 'True', '1'].includes(text)) return true;
      if (['false', 'False', '0'].includes(text)) return false;
      throw invalid();
    case 'float32':
    case 'float64': {
      if (/^[+-]?(inf|infinity)$/i.test(text)) return text.startsWith('-') ? -Infinity : Infinity;
      if (/^[+-]?nan$/i.test(text)) return NaN;
      const value = Number(text);
      if (!text || Number.isNaN(value)) throw invalid();
      return value;
    }
    case 'int64':
    case 'uint64': {
      let value: bigint;
      try {
        value = BigInt(text);
      } catch {
        throw invalid();
      }
      const signed = type === 'int64';
      const min = signed ? -(BigInt(1) << BigInt(63)) : BigInt(0);
      const max = (BigInt(1) << BigInt(signed ? 63 : 64)) - BigInt(1);
      if (!text || value < min || value > max) throw invalid();
      return value;
    }
    case 'string':
    case 'wstring':
      return unquote(text);
  }
  const range = INTEGER_RANGES[type];
  if (!range) throw new Error(`${type} has no literal values`);
  const value = Number(text);
  if (!text || !Number.isInteger(value) || value < range[0] || value > range[1]) throw invalid();
  return value;
}

const ESCAPES: Record<string, string> = {
  a: '\x07',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

/** A string literal's text: quotes removed and escapes (`\n`, `\x41`, `é`, `\101`) applied. */
function unquote(text: string): string {
  const quote = text[0];
  if ((quote !== "'" && quote !== '"') || text.length < 2 || !text.endsWith(quote)) return text;
  return text
    .slice(1, -1)
    .replace(
      /\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|([0-7]{1,3})|(.))/g,
      (_, hex2, hex4, hex8, octal, char: string) => {
        const hex = hex2 ?? hex4 ?? hex8;
        if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
        if (octal !== undefined) return String.fromCodePoint(parseInt(octal, 8));
        return ESCAPES[char] ?? char;
      }
    );
}
