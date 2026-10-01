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

/** Build the editor-object fields for a supported constructor. */
export function makeObject(Ctor, a, sw, sh) {
  const k = a.kw;
  const sz = (w, h) => ({ width: Math.round(w / FW * sw), height: Math.round(h / FH * sh) });
  const base = { x: sw / 2, y: sh / 2, fill: hexOf(k.color) || '#ffffff', stroke: 'transparent', strokeWidth: 2, opacity: 1, rotation: 0 };
  switch (Ctor) {
    case 'Text': return { type: 'text', content: qstr(a.pos[0]) || 'Text', fontSize: Math.round(num(k.font_size, 28)), width: 200, height: 50, ...base };
    case 'MathTex': case 'Tex': return { type: 'latex', latex: qstr(a.pos[0]) || '', width: 200, height: 80, ...base };
    case 'Rectangle': case 'RoundedRectangle': return { type: 'rectangle', ...sz(num(k.width, 4), num(k.height, 3)), ...base };
    case 'Square': return { type: 'square', ...sz(num(k.side_length, 2), num(k.side_length, 2)), ...base };
    case 'Circle': return { type: 'circle', ...sz(num(k.radius, 1) * 2, num(k.radius, 1) * 2), ...base };
    case 'Ellipse': return { type: 'ellipse', ...sz(num(k.width, 3), num(k.height, 2)), ...base };
    case 'Dot': {
      const r = num(k.radius, 0.08);
      return { type: 'dot', width: Math.round(r * 2 / (FW / 2) * sw), height: Math.round(r * 2 / (FH / 2) * sh), ...base };
    }
    case 'Line': case 'DashedLine': case 'Arrow': {
      const p0 = point(a.pos[0]);
      const p1 = point(a.pos[1]);
      const color = hexOf(k.color) || '#94a3b8';
      const w = p0 && p1 ? Math.max(20, Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / FW * sw)) : 200;
      const c = p0 && p1 ? toStage((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, sw, sh) : { x: sw / 2, y: sh / 2 };
      return {
        type: Ctor === 'Arrow' ? 'arrow' : 'line', width: w, height: 4,
        fill: color, stroke: color, strokeWidth: 3, opacity: 1,
        x: Math.round(c.x), y: Math.round(c.y),
        rotation: p0 && p1 ? Math.round(Math.atan2(-(p1.y - p0.y), p1.x - p0.x) * 180 / Math.PI * 10) / 10 : 0
      };
    }
    case 'Polygon': return { type: 'polygon', sides: 6, width: 120, height: 120, ...base };
    case 'RegularPolygon': return { type: 'polygon', sides: Math.round(num(k.n, 6)), width: 120, height: 120, ...base };
    case 'Star': return {
      type: 'star', starArms: Math.round(num(k.n, 5)),
      innerRatio: num(k.inner_radius, 1) / num(k.outer_radius, 2) || 0.4,
      width: 120, height: 120, ...base
    };
    case 'Triangle': return { type: 'triangle', width: 120, height: 120, ...base };
    case 'ImageMobject': return { type: 'image', src: qstr(a.pos[0]) || '', width: 200, height: 150, ...base };
    case 'SVGMobject': return { type: 'svg_asset', src: qstr(a.pos[0]) || '', width: 200, height: 200, ...base };
    case 'Axes': return { type: 'axes', width: 400, height: 300, xRange: [-5, 5, 1], yRange: [-3, 3, 1], ...base };
    default: return null;
  }
}

const CHAIN_RE = /\.\s*(move_to|scale|rotate|set_fill|set_stroke|set_color|set_opacity)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;

/** Apply a chained suffix like ".move_to([1,2,0]).scale(2)". */
export function applyChain(obj, chain, sw, sh) {
  let m;
  CHAIN_RE.lastIndex = 0;
  while ((m = CHAIN_RE.exec(chain))) {
    const a = parseArgs(m[2]);
    const p = point(a.pos[0]);
    if (m[1] === 'move_to' && p) { const s = toStage(p.x, p.y, sw, sh); obj.x = Math.round(s.x); obj.y = Math.round(s.y); }
    else if (m[1] === 'scale') { const f = num(a.pos[0], 1) || 1; obj.width = Math.round(obj.width * f); obj.height = Math.round(obj.height * f); }
    else if (m[1] === 'rotate') obj.rotation = Math.round(num(a.kw.angle ?? (a.pos.length > 1 ? a.pos[0] : a.pos[0]), 0) * 180 / Math.PI * 10) / 10;
    else if (m[1] === 'set_fill' || m[1] === 'set_color') {
      const c = hexOf(a.pos[0]) || hexOf(a.kw.color);
      if (c) obj.fill = c;
      const o = num(a.pos[1] ?? a.kw.opacity);
      if (o !== null && o <= 1) obj.opacity = o;
    } else if (m[1] === 'set_stroke') {
      const c = hexOf(a.pos[0]) || hexOf(a.kw.color);
      if (c) obj.stroke = c;
      const w = num(a.kw.width ?? a.pos[1]);
      if (w !== null) obj.strokeWidth = w;
    } else if (m[1] === 'set_opacity') { const o = num(a.pos[0], 1); if (o !== null) obj.opacity = o; }
  }
}
