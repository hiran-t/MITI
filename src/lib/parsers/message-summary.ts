const MAX_ITEMS = 32;
const MAX_STRING = 256;

/**
 * Shrink bulk fields (image and cloud `data`, long arrays) so a message can be stringified for
 * display without blocking the UI. Small messages are returned unchanged.
 */
export function summarizeMessage(value: unknown): unknown {
  // CDR decoding yields typed arrays for numeric arrays and BigInt for 64-bit integers.
  if (typeof value === 'bigint') return value.toString();
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const items = value as unknown as ArrayLike<number | bigint>;
    return items.length > MAX_ITEMS
      ? `[${value.constructor.name} × ${items.length}]`
      : Array.from(items, (item) => (typeof item === 'bigint' ? item.toString() : item));
  }
  if (typeof value === 'string')
    return value.length > MAX_STRING ? `${value.slice(0, 64)}… (${value.length} chars)` : value;
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map(summarizeMessage);
    return value.length > MAX_ITEMS ? [...items, `… ${value.length - MAX_ITEMS} more`] : items;
  }
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, summarizeMessage(field)])
    );
  return value;
}
