/**
 * Shared codegen helpers used by registry entries and the scene assembler.
 * Extracted from the former monolithic codegen so that both the server
 * generator and future plugin codegen functions share one implementation.
 */

/** Easing name -> Manim rate function expression. */
export const EASING_MAP = {
  linear: 'linear', ease_in: 'rate_functions.ease_in_sine',
  ease_out: 'rate_functions.ease_out_sine', ease_in_out: 'rate_functions.smooth',
  ease_in_cubic: 'rate_functions.ease_in_cubic', ease_out_cubic: 'rate_functions.ease_out_cubic',
  ease_in_out_cubic: 'rate_functions.smooth', ease_in_back: 'rate_functions.ease_in_back',
  ease_out_back: 'rate_functions.ease_out_back', ease_out_bounce: 'rate_functions.ease_out_bounce',
  spring: 'rate_functions.smooth'
};

export function rf(e)    { return EASING_MAP[e] || 'rate_functions.smooth'; }
export function rfOpt(e) { const r = rf(e); return r === 'rate_functions.smooth' ? '' : `, rate_func=${r}`; }

/** Object id -> valid Python identifier. */
export function vn(id)   { let n = String(id).replace(/[^a-zA-Z0-9_]/g, '_'); return /^[0-9]/.test(n) ? 'o_' + n : n; }

/** Optional run_time argument (omitted when ~1s). */
export function rtOpt(d) { return Math.abs(d - 1) < 0.01 ? '' : `, run_time=${d.toFixed(1)}`; }

/** Validate and format a color value for Manim. Returns quoted hex string or null. */
export function hex(h) {
  if (!h || typeof h !== 'string') return null;
  const s = h.trim();
  if (!s || s === 'transparent' || s === 'none') return null;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return `"${s}"`;
  return null;
}

/** Ensure a numeric value is valid and positive, with a fallback. */
export function safeNum(v, fallback) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return (Number.isFinite(n) && n > 0) ? n : fallback;
}

/** Clamp opacity to [0, 1]. */
export function safeOpacity(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/** Sanitise text for Python string literals. Empty/missing content renders
 *  empty — a placeholder "Text" string must never appear in a render unless
 *  the user actually typed it (issue #36). */
export function safeText(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

/** Stage pixel coordinates -> Manim frame coordinates (14 x 8 frame). */
export function stageToManim(x, y, sw, sh) {
  return { x: ((x / sw) - 0.5) * 14, y: -((y / sh) - 0.5) * 8 };
}

/** Manim frame coordinates -> stage pixels (inverse mapping). */
export function manimToStage(mx, my, sw, sh) {
  return { x: ((mx / 14) + 0.5) * sw, y: (-(my / 8) + 0.5) * sh };
}

/** Common system fonts that do not require Google Fonts registration. */
const SYSTEM_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Georgia',
  'Courier New', 'Courier', 'Verdana', 'Tahoma', 'Trebuchet MS',
  'Impact', 'Comic Sans MS', 'Lucida Console', 'Monaco',
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'
];

export function isSystemFont(fontFamily) {
  if (!fontFamily) return false;
  return SYSTEM_FONTS.some(f => f.toLowerCase() === fontFamily.toLowerCase());
}
