/**
 * Legacy Manim API compatibility boundary (issue #36).
 *
 * Code-sourced projects render their Python verbatim. Scenes written
 * against older Manim CE APIs must still render on the current engine,
 * so the render boundary applies a *documented, idempotent, reported*
 * shim — never a silent rewrite. The project's canonical `codeSource`
 * is never modified; only the scene.py copy handed to the worker.
 *
 * Rules (extend only with a matching test + registry entry):
 *  - `self.camera_frame` (removed in Manim CE 0.15; now `self.camera.frame`)
 *    gets a read/write alias property injected after the manim import.
 *  - 2-element point literals passed to point-taking constructors
 *    (`Polygon((x, y), ...)`, `Dot((x, y))`, …) are padded to 3D
 *    (`[x, y, 0]`) — older Manim auto-padded, current CE requires 3D.
 */

const MARKER = '# manim-compat: applied';

/** Constructors whose positional point literals must be 3D in current Manim. */
const POINT_CTORS = ['Polygon', 'Line', 'DashedLine', 'Arrow', 'Dot', 'ArcBetweenPoints'];

const TUPLE_2D = /\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g;
const LIST_2D = /\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g;
const CTOR_START = new RegExp(`\\b(${POINT_CTORS.join('|')})\\s*\\(`, 'g');

/** Index of the ')' matching the '(' at `open` (-1 when unbalanced). */
function matchParen (s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth += 1;
    if (s[i] === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * Pad 2-element numeric point literals inside whitelisted constructor calls
 * (span-aware: handles multi-line calls). Only literal tuples/lists of two
 * numbers are touched — computed points and 3D literals pass through.
 */
function padPointLiterals (src) {
  let out = '';
  let rest = src;
  let guard = 0;
  while (guard++ < 500) {
    CTOR_START.lastIndex = 0;
    const m = CTOR_START.exec(rest);
    if (!m) { out += rest; break; }
    const open = m.index + m[0].length - 1;
    const close = matchParen(rest, open);
    if (close === -1) { out += rest; break; }
    const head = rest.slice(0, open + 1);
    const span = rest.slice(open + 1, close);
    const padded = span
      .replace(TUPLE_2D, '[$1, $2, 0]')
      .replace(LIST_2D, '[$1, $2, 0]');
    out += head + padded;
    rest = rest.slice(close);
  }
  return out;
}

/** True when a whitelisted constructor call carries a 2D point literal. */
function has2DPointLiterals (src) {
  let probe = src;
  let guard = 0;
  while (guard++ < 200) {
    CTOR_START.lastIndex = 0;
    const m = CTOR_START.exec(probe);
    if (!m) return false;
    const open = m.index + m[0].length - 1;
    const close = matchParen(probe, open);
    if (close === -1) return false;
    const span = probe.slice(open + 1, close);
    if (TUPLE_2D.test(span) || LIST_2D.test(span)) {
      TUPLE_2D.lastIndex = 0; LIST_2D.lastIndex = 0;
      return true;
    }
    TUPLE_2D.lastIndex = 0; LIST_2D.lastIndex = 0;
    probe = probe.slice(close + 1);
  }
  return false;
}

const RULES = [
  {
    key: 'camera_frame',
    detect: (src) => /self\.camera_frame\b/.test(src) && /\bMovingCameraScene\b/.test(src),
    // Injected after the last `from manim import ...` so the subclass
    // declared in the same file picks up the alias.
    inject: (src) => injectAfterManimImport(src, [
      'class _MovingCameraCompat(MovingCameraScene):',
      '    @property',
      '    def camera_frame(self):',
      '        return self.camera.frame',
      '    @camera_frame.setter',
      '    def camera_frame(self, frame):',
      '        self.camera.frame = frame',
      'MovingCameraScene = _MovingCameraCompat'
    ]),
    note: 'self.camera_frame -> self.camera.frame (removed in Manim CE 0.15)'
  },
  {
    key: 'point_2d_literals',
    detect: (src) => has2DPointLiterals(src),
    inject: (src) => padPointLiterals(src),
    note: '2D point literals padded to 3D for point-taking constructors (Manim CE requires 3D points)'
  },
  {
    key: 'move_to_2d',
    // 2-element points can reach move_to indirectly (helper args, variables),
    // so the shim pads at runtime — exactly the pre-CE behaviour.
    detect: (src) => /\.move_to\s*\(/.test(src) && /(\[|\()\s*-?[\d.]+\s*,\s*-?[\d.]+\s*(\]|\))/.test(src),
    inject: (src) => injectAfterManimImport(src, [
      '_orig_move_to = Mobject.move_to',
      'def _compat_move_to(self, point_or_mobject, *args, **kwargs):',
      '    if isinstance(point_or_mobject, (list, tuple)) and len(point_or_mobject) == 2:',
      '        point_or_mobject = [point_or_mobject[0], point_or_mobject[1], 0.0]',
      '    return _orig_move_to(self, point_or_mobject, *args, **kwargs)',
      'Mobject.move_to = _compat_move_to'
    ]),
    note: 'move_to() pads 2D points to 3D at runtime (removed auto-padding in Manim CE)'
  },
  {
    key: 'wiggle_angle',
    // Pre-CE Wiggle used `angle=`; current signature is `rotation_angle=`.
    detect: (src) => /Wiggle\s*\([^)\n]*\bangle\s*=/.test(src),
    inject: (src) => rewriteKwargInCalls(src, 'Wiggle', 'angle', 'rotation_angle'),
    note: 'Wiggle(angle=…) renamed to Wiggle(rotation_angle=…) in Manim CE'
  }
];

/** Rename `oldKw=` to `newKw=` inside every `Ctor(…)` call span. */
function rewriteKwargInCalls (src, ctor, oldKw, newKw) {
  const re = new RegExp(`\\b${ctor}\\s*\\(`, 'g');
  let out = '';
  let rest = src;
  let guard = 0;
  while (guard++ < 200) {
    re.lastIndex = 0;
    const m = re.exec(rest);
    if (!m) { out += rest; break; }
    const open = m.index + m[0].length - 1;
    const close = matchParen(rest, open);
    if (close === -1) { out += rest; break; }
    const head = rest.slice(0, open + 1);
    const span = rest.slice(open + 1, close)
      .replace(new RegExp(`\\b${oldKw}\\s*=`, 'g'), `${newKw}=`);
    out += head + span;
    rest = rest.slice(close);
  }
  return out;
}

function injectAfterManimImport (src, lines) {
  const out = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < out.length; i++) {
    if (/^\s*(from manim[^\n]*import|import manim)\b/.test(out[i])) lastImport = i;
  }
  if (lastImport === -1) return src; // no manim import: leave untouched
  out.splice(lastImport + 1, 0, '', MARKER, ...lines);
  return out.join('\n');
}

/**
 * Detect which compat rules a scene source needs.
 * @returns {string[]} rule keys
 */
export function detectLegacyApi (source) {
  if (!source || typeof source !== 'string') return [];
  if (source.includes(MARKER)) return []; // already applied (idempotent)
  return RULES.filter((r) => r.detect(source)).map((r) => r.key);
}

/**
 * Apply the compat shim to a scene source copy.
 * @returns {{ source: string, applied: string[] }} applied rule keys
 */
export function applyLegacyCompat (source) {
  const keys = detectLegacyApi(source);
  if (keys.length === 0) return { source, applied: [] };
  let out = source;
  for (const rule of RULES) {
    if (keys.includes(rule.key)) out = rule.inject(out);
  }
  return { source: out, applied: keys };
}

/** Human-readable notes for reporting applied rules. */
export function legacyCompatNotes (keys) {
  return RULES.filter((r) => keys.includes(r.key)).map((r) => r.note);
}

export const LEGACY_COMPAT_MARKER = MARKER;
