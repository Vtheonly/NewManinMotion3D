/**
 * Node test for the tolerant legacy Manim importer (issue #33 follow-up).
 * Run: node services/web/tests/import.test.mjs
 */
import { readFileSync } from 'fs';
import { parseManimScript } from '../src/export/manim.js';
import { statements, parseArgs } from '../src/export/parseLegacy.js';

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.error(`  FAIL: ${msg}`); } };

// ── tokenizer ───────────────────────────────────────────────────────────
console.log('=== statements() ===');
const sts = statements(`def f(x):
    y = Square(side_length=1)
    return y

self.play(FadeIn(y, shift=UP * 0.25),
          run_time=0.8)
self.wait(2)
`);
ok(sts.filter((s) => s.startsWith('def ')).length === 1, 'def statement kept (scope reset)');
ok(sts.some((s) => s.startsWith('self.play(FadeIn') && s.includes('run_time=0.8')), 'multi-line play joined');
ok(sts.some((s) => s === 'self.wait(2)'), 'wait kept');

console.log('=== parseArgs() ===');
const a = parseArgs('title, shift=UP * 0.25, run_time=0.8, color="#fff"');
ok(a.pos[0] === 'title', 'positional');
ok(a.kw.run_time === '0.8', 'kwarg raw');
ok(a.kw.color === '"#fff"', 'quoted kwarg');
const b = parseArgs('width=30, height=12');
ok(b.kw.width === '30' && b.kw.height === '12', 'ctor kwargs');

// ── minimal scene ────────────────────────────────────────────────────────
console.log('=== minimal scene ===');
const r = parseManimScript(`
from manim import *
config.background_color = "#070b17"

class Main(Scene):
    def construct(self):
        title = Text("Hello", font_size=50, weight=BOLD, color=WHITEISH)
        sub = Text("world", font_size=22, color=MUTED)
        box = Rectangle(width=30, height=12).set_fill("#0b1226", 1)
        title.move_to([-2, 0.55, 0])
        self.play(FadeIn(title, shift=UP * 0.25), run_time=0.8)
        self.play(FadeIn(sub), run_time=0.6)
        self.wait(1.2)
        self.play(FadeOut(title), FadeOut(sub), run_time=0.6)
        self.play(sub.animate.move_to([1, 1, 0]), run_time=1.0)
`);
ok(r.objects.length === 3, `3 objects parsed (got ${r.objects.length})`);
ok(r.stage.backgroundColor === '#070b17', 'background from config');
const title = r.objects.find((o) => o.name === 'title');
ok(title && title.type === 'text' && title.content === 'Hello', 'Text with weight=BOLD kwarg parsed');
ok(title && title.enterTime === 0, 'enterTime from first play');
ok(title && title.enterAnim === 'fly_in_top', 'shift=UP mapped to fly_in_top');
ok(title && Math.abs(title.x - (-2 / (14 + 2 / 9) + 0.5) * 1920) < 2, 'separate .move_to line applied');
const sub = r.objects.find((o) => o.name === 'sub');
ok(sub && sub.exitAnim === 'fade_out', 'FadeOut sets exitAnim');
ok(r.tracks[0] && r.tracks[0].clips.some((c) => c.type === 'move' && c.sourceId === sub.id),
  'animate.move_to produces a move clip on its own row');

// ── the real SYNTH-WALL file ─────────────────────────────────────────────
console.log('=== synth_wall.py (issue #33 regression) ===');
const src = readFileSync(new URL('./fixtures/legacy_synth_wall.py', import.meta.url), 'utf-8');
const w = parseManimScript(src);
console.log(`  objects: ${w.objects.length}, clips: ${w.tracks.reduce((s, t) => s + t.clips.length, 0)}`);
ok(w.objects.length >= 15, `many objects extracted (got ${w.objects.length}, was ~1)`);
ok(w.objects.filter((o) => o.type === 'text').length >= 8, 'texts with weight=/var colors extracted');
ok(w.objects.some((o) => o.type === 'rectangle'), 'chained Rectangle(...) extracted');
ok(w.tracks[0] && w.tracks[0].clips.length >= 2, 'animation clips extracted');
const pulse = w.objects.find((o) => o.name === 'pulse');
ok(pulse && w.tracks[0].clips.some((c) => c.type === 'move' && c.sourceId === pulse.id),
  'pulse.animate.move_to clip lands on the pulse row');
const ring = w.objects.find((o) => o.name === 'ring');
ok(ring && w.tracks[0].clips.some((c) => c.type === 'scale' && c.sourceId === ring.id),
  'ring.animate.scale clip lands on the ring row');
const names = new Set(w.objects.map((o) => o.name));
ok(names.has('title') && names.has('subtitle') && names.has('d_tag'), 'construct-scoped locals present');
ok(!names.has('g'), 'helper-function loop internals not leaked (grid `g` virtual)');
const totalDur = w.objects.reduce((m, o) => Math.max(m, (o.enterTime || 0) + (o.duration || 0)), 0);
ok(totalDur > 20, `timeline spans the scene (total ${totalDur.toFixed(1)}s > 20s)`);

// ── coverage contract (issue #36) ─────────────────────────────────────────
console.log('=== coverage report (issue #36) ===');
ok(w.coverage && typeof w.coverage === 'object', 'importer returns a coverage report');
ok(w.coverage.dropped.length > 0, 'dropped constructs reported (composites, camera, helpers)');
ok(w.coverage.approximated > 0, 'approximated objects reported');
ok(w.coverage.complete === false, 'synth wall is honestly reported as lossy');
const droppedNames = new Set(w.coverage.dropped.map((d) => d.name));
ok(droppedNames.has('protein') && droppedNames.has('net') && droppedNames.has('wall'),
  'the big composites (protein / net / wall) are named as dropped');
ok(droppedNames.has('camera_frame'), 'camera motion loss is named');
ok(!w.objects.some((o) => o.type === 'text' && o.content === 'Text'),
  'no literal "Text" placeholder content (raw expressions + approx flags instead)');
ok(w.objects.filter((o) => Array.isArray(o.approx) && o.approx.length).length === w.coverage.approximated,
  'approximated count matches flagged objects');
const digitalBg = w.objects.find((o) => o.name === 'digital_bg');
ok(digitalBg && digitalBg.approx && digitalBg.approx.includes('color'),
  'unresolvable named colors are flagged on the object (no silent white)');

// A fully representable scene must report complete coverage.
console.log('=== coverage: representable scene is complete ===');
const clean = parseManimScript(`
from manim import *
class Main(Scene):
    def construct(self):
        title = Text("Hello", font_size=50)
        box = Rectangle(width=2, height=1).set_fill("#0b1226", 1)
        box.move_to([1, 1, 0])
        self.play(FadeIn(title), FadeIn(box), run_time=0.8)
        self.wait(1.2)
        self.play(FadeOut(title), FadeOut(box), run_time=0.6)
`);
ok(clean.coverage.complete === true, 'no drops/approximations for a representable scene');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
