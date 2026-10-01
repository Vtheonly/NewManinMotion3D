/**
 * Python literal formatting — JS mirror of scientific/export/literals.py.
 *
 * Cross-language rules (see docs/development/architecture/AUTHORING-MODEL.md):
 *   - None/True/False map to Python spellings;
 *   - strings use JSON escaping;
 *   - ints print bare; floats use shortest round-trip form, always with a
 *     '.' or exponent so they stay floats;
 *   - lists/dicts recurse (insertion order preserved).
 */

function formatFloat (value) {
  if (!Number.isFinite(value)) {
    throw new Error(`non-finite float ${value} is not exportable`);
  }
  let text = String(value);
  if (!text.includes('.') && !text.includes('e') && !text.includes('E')) {
    text += '.0';
  }
  return text;
}

function pyLiteral (value) {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Number.isInteger(value)) return String(value);
  if (typeof value === 'number') return formatFloat(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => pyLiteral(v)).join(', ') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();  // canonical: sorted keys
    if (keys.length === 0) return '{}';
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}: ${pyLiteral(value[k])}`);
    return '{' + parts.join(', ') + '}';
  }
  throw new Error(`cannot export value: ${String(value)}`);
}

export { pyLiteral, formatFloat };
