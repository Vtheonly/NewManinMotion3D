/**
 * Manim constructor → visual editor object mapping (legacy importer).
 *
 * One constructed mobject becomes one editor object; chained suffix calls
 * (.set_fill() / .move_to() / .scale() …) mutate it in place. Entrance
 * constructors map onto the editor's enter/exit animation vocabulary.
 */

import { parseArgs, num, qstr, hexOf, point } from './parseLegacy.js';

const FW = 14 + 2 / 9;
const FH = 8;
export const toStage = (mx, my, sw, sh) => ({ x: (mx / FW + 0.5) * sw, y: (-my / FH + 0.5) * sh });

/** Constructors the importer can turn into editor objects. */
export const KNOWN_CTORS = new Set(['Text', 'MathTex', 'Tex', 'Rectangle',
  'RoundedRectangle', 'Square', 'Circle', 'Ellipse', 'Dot', 'Line',
  'DashedLine', 'Arrow', 'Polygon', 'RegularPolygon', 'Star', 'Triangle',
  'ImageMobject', 'SVGMobject', 'Axes']);

/** Entrance/exit animation constructors → editor enterAnim/exitAnim. */
export const ENTRANCE = {
  FadeIn: (a) => {
    const raw = String(a.kw.shift || a.pos[1] || '');
    const dir = /UP/.test(raw) ? 'top'
      : /DOWN/.test(raw) ? 'bottom'
        : /LEFT/.test(raw) ? 'left'
          : /RIGHT/.test(raw) ? 'right' : null;
    return { anim: dir ? 'fly_in_' + dir : 'fade_in', dur: 0.5 };
  },
  Create: () => ({ anim: 'draw', dur: 1 }),
  Write: () => ({ anim: 'write', dur: 1 }),
  DrawBorderThenFill: () => ({ anim: 'draw', dur: 1 }),
  GrowFromCenter: () => ({ anim: 'grow_in', dur: 1 }),
  GrowFromPoint: () => ({ anim: 'grow_in', dur: 1 }),
  FadeOut: () => ({ anim: 'fade_out', dur: 0.5, exit: true })
};

/** Build the editor-object fields for a supported constructor.
 *
 * Approximation flags (issue #36): when a source value is not a literal the
 * scaffold falls back to a default and marks the object via `approx` — the
 * caller renders from the original source anyway; the flags make the loss
 * visible in the editor and the import report.
 */
export function makeObject(Ctor, a, sw, sh) {
  const k = a.kw;
  const approx = [];
  const sz = (w, h) => ({ width: Math.round(w / FW * sw), height: Math.round(h / FH * sh) });
  const approxSz = (wName, hName, w, h) => {
    const wNum = num(k[wName], null); const hNum = num(k[hName] ?? k[wName], null);
    if (wNum === null || hNum === null) approx.push('size');
    return sz(wNum ?? w, hNum ?? h);
  };
  const base = { x: sw / 2, y: sh / 2, fill: hexOf(k.color) || '#ffffff', stroke: 'transparent', strokeWidth: 2, opacity: 1, rotation: 0 };
  if (k.color && !hexOf(k.color)) approx.push('color');
  let out;
  switch (Ctor) {
    case 'Text': {
      const lit = qstr(a.pos[0]);
      if (!lit) approx.push('text');
      out = { type: 'text', content: lit || a.pos[0] || 'Text', fontSize: Math.round(num(k.font_size, 28)), width: 200, height: 50, ...base };
      break;
    }
    case 'MathTex': case 'Tex': {
      const lit = qstr(a.pos[0]);
      if (!lit) approx.push('text');
      out = { type: 'latex', latex: lit || a.pos[0] || '', width: 200, height: 80, ...base };
      break;
    }
    case 'Rectangle': case 'RoundedRectangle': out = { type: 'rectangle', ...approxSz('width', 'height', 4, 3), ...base }; break;
    case 'Square': out = { type: 'square', ...approxSz('side_length', 'side_length', 2, 2), ...base }; break;
    case 'Circle': {
      const r = num(k.radius, null);
      if (r === null) approx.push('size');
      const rr = r ?? 1;
      out = { type: 'circle', ...sz(rr * 2, rr * 2), ...base };
      break;
    }
    case 'Ellipse': out = { type: 'ellipse', ...approxSz('width', 'height', 3, 2), ...base }; break;
    case 'Dot': {
      const r = num(k.radius, null);
      if (r === null) approx.push('size');
      const rr = r ?? 0.08;
      out = { type: 'dot', width: Math.round(rr * 2 / (FW / 2) * sw), height: Math.round(rr * 2 / (FH / 2) * sh), ...base };
      break;
    }
    case 'Line': case 'DashedLine': case 'Arrow': {
      const p0 = point(a.pos[0]);
      const p1 = point(a.pos[1]);
      if (!p0 || !p1) approx.push('geometry');
      const color = hexOf(k.color) || '#94a3b8';
      if (k.color && !hexOf(k.color)) approx.push('color');
      const w = p0 && p1 ? Math.max(20, Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / FW * sw)) : 200;
      const c = p0 && p1 ? toStage((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, sw, sh) : { x: sw / 2, y: sh / 2 };
      out = {
        type: Ctor === 'Arrow' ? 'arrow' : 'line', width: w, height: 4,
        fill: color, stroke: color, strokeWidth: 3, opacity: 1,
        x: Math.round(c.x), y: Math.round(c.y),
        rotation: p0 && p1 ? Math.round(Math.atan2(-(p1.y - p0.y), p1.x - p0.x) * 180 / Math.PI * 10) / 10 : 0
      };
      break;
    }
    case 'Polygon': out = { type: 'polygon', sides: 6, width: 120, height: 120, ...approxSizeDefault(approx), ...base }; break;
    case 'RegularPolygon': out = { type: 'polygon', sides: Math.round(num(k.n, 6)), width: 120, height: 120, ...approxSizeDefault(approx), ...base }; break;
    case 'Star': out = {
      type: 'star', starArms: Math.round(num(k.n, 5)),
      innerRatio: num(k.inner_radius, 1) / num(k.outer_radius, 2) || 0.4,
      width: 120, height: 120, ...approxSizeDefault(approx), ...base
    }; break;
    case 'Triangle': out = { type: 'triangle', width: 120, height: 120, ...approxSizeDefault(approx), ...base }; break;
    case 'ImageMobject': out = { type: 'image', src: qstr(a.pos[0]) || '', width: 200, height: 150, ...base }; break;
    case 'SVGMobject': out = { type: 'svg_asset', src: qstr(a.pos[0]) || '', width: 200, height: 200, ...base }; break;
    case 'Axes': out = { type: 'axes', width: 400, height: 300, xRange: [-5, 5, 1], yRange: [-3, 3, 1], ...base }; break;
    default: out = null;
  }
  if (out && approx.length) out.approx = approx;
  return out;
}

/** Size-less ctors (polygon/star/triangle) always use editor defaults. */
function approxSizeDefault(approx) { approx.push('size'); return {}; }

const CHAIN_RE = /\.\s*(move_to|scale|rotate|set_fill|set_stroke|set_color|set_opacity)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;

/** Apply a chained suffix like ".move_to([1,2,0]).scale(2)". */
export function applyChain(obj, chain, sw, sh) {
  let m;
  CHAIN_RE.lastIndex = 0;
  while ((m = CHAIN_RE.exec(chain))) {
    const a = parseArgs(m[2]);
    const p = point(a.pos[0]);
    if (m[1] === 'move_to' && p) { const s = toStage(p.x, p.y, sw, sh); obj.x = Math.round(s.x); obj.y = Math.round(s.y); }
    else if (m[1] === 'move_to') mark(obj, 'position');
    else if (m[1] === 'scale') { const f = num(a.pos[0], 1) || 1; obj.width = Math.round(obj.width * f); obj.height = Math.round(obj.height * f); }
    else if (m[1] === 'rotate') obj.rotation = Math.round(num(a.kw.angle ?? (a.pos.length > 1 ? a.pos[0] : a.pos[0]), 0) * 180 / Math.PI * 10) / 10;
    else if (m[1] === 'set_fill' || m[1] === 'set_color') {
      const c = hexOf(a.pos[0]) || hexOf(a.kw.color);
      if (a.pos[0] && !c) mark(obj, 'color');
      if (c) obj.fill = c;
      const o = num(a.pos[1] ?? a.kw.opacity);
      if (o !== null && o <= 1) obj.opacity = o;
    } else if (m[1] === 'set_stroke') {
      const c = hexOf(a.pos[0]) || hexOf(a.kw.color);
      if (a.pos[0] && !c) mark(obj, 'color');
      if (c) obj.stroke = c;
      const w = num(a.kw.width ?? a.pos[1]);
      if (w !== null) obj.strokeWidth = w;
    } else if (m[1] === 'set_opacity') { const o = num(a.pos[0], 1); if (o !== null) obj.opacity = o; }
  }
}

/** Attach an approximation flag to an imported object. */
function mark(obj, why) {
  if (!obj) return;
  if (!Array.isArray(obj.approx)) obj.approx = [];
  if (!obj.approx.includes(why)) obj.approx.push(why);
}
