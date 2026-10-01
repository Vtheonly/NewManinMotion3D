/**
 * Tolerant Manim CE tokenizer (legacy importer support — issue #33 follow-up).
 *
 * Splits hand-written Python into balanced single-line statements and parses
 * argument lists with arbitrary kwargs. Pure text utilities; the importer
 * itself lives in importManim.js / importShapes.js.
 */

const NUM = /^[-+]?[\d.]+/;

/** Remove a trailing # comment that is not inside a string literal. */
export function stripComment(l) {
  let q = null;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '#') return l.slice(0, i);
  }
  return l;
}

/** Join source lines into statements until brackets balance. */
export function statements(code) {
  const out = [];
  let buf = '';
  for (const raw of code.split('\n')) {
    const line = stripComment(raw).trim();
    if (!buf && (!line || /^(import |from |@|"""|''')/.test(line))) continue;
    buf = buf ? buf + ' ' + line : line;
    if (!buf) continue;
    let depth = 0;
    for (const c of buf) {
      if ('([{'.includes(c)) depth += 1;
      if (')]}'.includes(c)) depth -= 1;
    }
    if (depth <= 0 && !buf.endsWith('\\') && !/[=+,(\[]\s*$/.test(buf)) { out.push(buf); buf = ''; }
  }
  if (buf) out.push(buf);
  return out;
}

/** Split "a, b=1, c=[1,2]" into { pos:[raw…], kw:{name:raw} }. */
export function parseArgs(text) {
  const pos = [];
  const kw = {};
  let depth = 0;
  let q = null;
  let cur = '';
  const parts = [];
  for (const c of String(text)) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if ('([{'.includes(c)) depth += 1;
    if (')]}'.includes(c)) depth -= 1;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += c;
  }
  parts.push(cur);
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    const m = s.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (m && !/^(==|!=|<=|>=)/.test(m[2].slice(0, 2))) kw[m[1]] = m[2];
    else pos.push(s);
  }
  return { pos, kw };
}

/** Index of the ')' matching the '(' at `open` (-1 when unbalanced). */
export function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth += 1;
    if (s[i] === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

export const num = (raw, fb = null) => {
  const m = NUM.exec(String(raw ?? '').trim());
  return m ? parseFloat(m[0]) : fb;
};
export const qstr = (raw) => {
  const m = /^r?["']([^"']*)["']/.exec(String(raw ?? '').trim());
  return m ? m[1] : null;
};
export const hexOf = (raw) => {
  const s = qstr(raw);
  return s && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : null;
};
export const point = (raw) => {
  const m = /\[\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*(?:,\s*[-0-9.]+)?\s*\]/.exec(String(raw ?? ''));
  return m ? { x: +m[1], y: +m[2] } : null;
};
