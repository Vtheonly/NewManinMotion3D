/**
 * END-TO-END RENDER VERIFICATION — the exported video matches the editor
 * ===================================================================
 *
 * The strongest check available without human eyes: compile a scene that
 * exercises the canonical features (timeline windows, hierarchy propagation,
 * layering, move/rotate family clips), render it with REAL Manim, extract
 * frames with ffmpeg, and assert pixel content at the exact positions the
 * PREVIEW ENGINE predicts. A failure here means the exported video and the
 * editor disagree — the core acceptance criterion of the whole system.
 *
 * Run: node --test tests/e2e.render.test.mjs     (from services/api)
 * Env: RENDER_E2E=0 skips (CI without manim); MANIM_PY defaults to the venv.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProject } from '../src/compiler/index.js';
import { PlaybackEngine } from '../../web/src/engine/playback.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIM_PY = process.env.MANIM_PY || '/home/z/.venv/bin/python';
const FFMPEG = 'ffmpeg';
const W = 1920, H = 1080;

/** Can we run manim + ffmpeg here? */
function renderToolsAvailable() {
  try {
    const py = spawnSync(MANIM_PY, ['-c', 'import manim'], { timeout: 30000 });
    if (py.status !== 0) return false;
    const ff = spawnSync(FFMPEG, ['-version'], { timeout: 10000 });
    return ff.status === 0;
  } catch {
    return false;
  }
}

// ── The verification scene ──────────────────────────────────────────────────
// Distinct colors at known positions; timing chosen so each feature is
// verifiable at a stable sampling time (clips completed, no mid-animation).
const BG = '#101418';                       // (16, 20, 24)
const objects = [
  { id: 'circleA', type: 'circle', name: 'A', x: 400, y: 540, width: 240, height: 240,
    fill: '#ff3366', stroke: 'transparent', strokeWidth: 0, opacity: 1, zOrder: 1, visible: true,
    parentId: null, enterTime: 0, duration: 12, enterAnim: 'fade_in', exitAnim: 'fade_out',
    enterAnimDur: 0.5, exitAnimDur: 0.5 },
  { id: 'squareB', type: 'square', name: 'B', x: 1500, y: 300, width: 200, height: 200,
    fill: '#00ccff', stroke: 'transparent', strokeWidth: 0, opacity: 1, zOrder: 1, visible: true,
    parentId: null, enterTime: 2, duration: 3, enterAnim: 'fade_in', exitAnim: 'fade_out',
    enterAnimDur: 0.5, exitAnimDur: 0.5 },                     // window [2, 5)
  { id: 'rectP', type: 'rectangle', name: 'P', x: 960, y: 540, width: 200, height: 120,
    fill: '#ffcc00', stroke: 'transparent', strokeWidth: 0, opacity: 1, zOrder: 1, visible: true,
    parentId: null, enterTime: 0, duration: 12, enterAnim: 'fade_in', exitAnim: 'none',
    enterAnimDur: 0.5, exitAnimDur: 0.5 },
  { id: 'starC', type: 'star', name: 'C', x: 1260, y: 540, width: 140, height: 140,
    fill: '#ff66aa', stroke: 'transparent', strokeWidth: 0, opacity: 1, zOrder: 1, visible: true,
    parentId: 'rectP', enterTime: 0, duration: 12, enterAnim: 'fade_in', exitAnim: 'none',
    enterAnimDur: 0.5, exitAnimDur: 0.5, starArms: 5, innerRatio: 0.45 },
  { id: 'rotP', type: 'rectangle', name: 'RP', x: 500, y: 900, width: 160, height: 90,
    fill: '#8844ff', stroke: 'transparent', strokeWidth: 0, opacity: 1, zOrder: 1, visible: true,
    parentId: null, enterTime: 0, duration: 12, enterAnim: 'fade_in', exitAnim: 'none',
    enterAnimDur: 0.5, exitAnimDur: 0.5 },
  { id: 'dotC', type: 'dot', name: 'DC', x: 700, y: 900, width: 60, height: 60,
    fill: '#ffffff', stroke: 'transparent', strokeWidth: 0, opacity: 1, zOrder: 1, visible: true,
    parentId: 'rotP', enterTime: 0, duration: 12, enterAnim: 'fade_in', exitAnim: 'none',
    enterAnimDur: 0.5, exitAnimDur: 0.5 },
  { id: 'underL', type: 'circle', name: 'U', x: 840, y: 240, width: 240, height: 240,
    fill: '#112233', stroke: 'transparent', strokeWidth: 0, opacity: 1, zOrder: 2, visible: true,
    parentId: null, enterTime: 0, duration: 12, enterAnim: 'fade_in', exitAnim: 'none',
    enterAnimDur: 0.5, exitAnimDur: 0.5 },
  { id: 'overL', type: 'circle', name: 'O', x: 880, y: 270, width: 240, height: 240,
    fill: '#44ff88', stroke: 'transparent', strokeWidth: 0, opacity: 1, zOrder: 5, visible: true,
    parentId: null, enterTime: 0, duration: 12, enterAnim: 'fade_in', exitAnim: 'none',
    enterAnimDur: 0.5, exitAnimDur: 0.5 }
];

const clips = [
  { id: 'mv1', type: 'move', startTime: 1, duration: 2, easing: 'linear',
    sourceId: 'rectP', targetId: null, params: { targetX: 1160, targetY: 540 } },
  { id: 'rt1', type: 'rotate', startTime: 2, duration: 2, easing: 'linear',
    sourceId: 'rotP', targetId: null, params: { targetRotation: 180 } }
];

const project = {
  name: 'E2E Render Verification', editorMode: 'visual', sourceMode: 'canvas',
  sceneType: 'scene_2d', scene: { className: 'MainScene' }, camera: {},
  stage: { width: W, height: H, backgroundColor: BG },
  assets: [], groups: [],
  objects, tracks: [{ id: 't1', name: 'Track 1', clips }], sceneDuration: 14
};

// The 3D structural scene: a cube + sphere under the 3D camera.
const project3d = {
  name: 'E2E 3D Render', editorMode: 'visual', sourceMode: 'canvas',
  sceneType: 'three_d', scene: { className: 'MainScene' }, camera: { phi: 60, theta: 45 },
  stage: { width: W, height: H, backgroundColor: BG },
  assets: [], groups: [],
  objects: [
    { id: 'cube', type: 'cube', name: 'Cube', x: 960, y: 540, width: 300, height: 300,
      fill: '#ff8800', stroke: '#ffffff', strokeWidth: 2, opacity: 1, zOrder: 1, visible: true,
      parentId: null, z: 0, enterTime: 0, duration: 6, enterAnim: 'fade_in', exitAnim: 'none',
      enterAnimDur: 0.5, exitAnimDur: 0.5 },
    { id: 'sphere', type: 'sphere', name: 'Sphere', x: 1300, y: 400, width: 220, height: 220,
      fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2, opacity: 1, zOrder: 2, visible: true,
      parentId: null, z: 150, resolution: 24, enterTime: 0, duration: 6, enterAnim: 'fade_in',
      exitAnim: 'none', enterAnimDur: 0.5, exitAnimDur: 0.5 }
  ],
  tracks: [{ id: 't1', name: 'Track 1', clips: [] }], sceneDuration: 7
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Render a project with manim; returns the mp4 path (throws on failure). */
async function renderManim(proj, workDir) {
  const compiled = compileProject(proj);
  assert.equal(compiled.success, true, `compile failed: ${JSON.stringify(compiled.errors)}`);
  const sceneFile = join(workDir, 'scene.py');
  writeFileSync(sceneFile, compiled.code);
  const mediaDir = join(workDir, 'media');
  const args = ['-m', 'manim', 'render', '-ql', '--disable_caching', '--media_dir', mediaDir,
    sceneFile, compiled.sceneName];
  const res = await new Promise((resolve) => {
    const p = spawn(MANIM_PY, args, { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('close', c => resolve({ code: c, out, err }));
    p.on('error', e => resolve({ code: -1, out, err: String(e) }));
    setTimeout(() => { try { p.kill(); } catch {} resolve({ code: -2, out, err: 'timeout' }); }, 420000);
  });
  assert.equal(res.code, 0, `manim failed:\n${(res.err || res.out).slice(-2000)}`);
  // manim output: <media>/videos/scene/480p15/<SceneName>.mp4
  const video = join(mediaDir, 'videos', 'scene', '480p15', `${compiled.sceneName}.mp4`);
  assert.ok(existsSync(video), `rendered video missing: ${video}`);
  return video;
}

/** Extract the frame at time t as raw RGB (1920x1080). */
async function extractFrame(video, t) {
  const res = await new Promise((resolve) => {
    const p = spawn(FFMPEG, ['-ss', String(t), '-i', video, '-frames:v', '1',
      '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    p.stdout.on('data', d => chunks.push(d));
    p.stderr.on('data', d => { err += d; });
    p.on('close', () => resolve({ buf: Buffer.concat(chunks), err }));
    p.on('error', e => resolve({ buf: Buffer.alloc(0), err: String(e) }));
  });
  assert.ok(res.buf.length >= W * H * 3, `frame extraction failed at t=${t}: ${res.err.slice(-300)}`);
  return res.buf;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Sample a small box around (x, y): returns { avg: [r,g,b], ratio } where
 * ratio = fraction of pixels within tolerance of the expected color.
 */
function sample(frame, x, y, expectedHex, box = 10, tol = 70) {
  const exp = hexToRgb(expectedHex);
  let r = 0, g = 0, b = 0, n = 0, close = 0;
  for (let dy = -box; dy <= box; dy += 2) {
    for (let dx = -box; dx <= box; dx += 2) {
      const px = Math.min(W - 1, Math.max(0, Math.round(x + dx)));
      const py = Math.min(H - 1, Math.max(0, Math.round(y + dy)));
      const i = (py * W + px) * 3;
      const R = frame[i], G = frame[i + 1], B = frame[i + 2];
      r += R; g += G; b += B; n++;
      if (Math.abs(R - exp[0]) <= tol && Math.abs(G - exp[1]) <= tol && Math.abs(B - exp[2]) <= tol) close++;
    }
  }
  return { avg: [r / n, g / n, b / n], ratio: close / n };
}

/** Fraction of a region that differs from the background. */
function fractionNonBackground(frame, x, y, box = 80) {
  const bg = hexToRgb(BG);
  let diff = 0, n = 0;
  for (let dy = -box; dy <= box; dy += 4) {
    for (let dx = -box; dx <= box; dx += 4) {
      const px = Math.min(W - 1, Math.max(0, Math.round(x + dx)));
      const py = Math.min(H - 1, Math.max(0, Math.round(y + dy)));
      const i = (py * W + px) * 3;
      if (Math.abs(frame[i] - bg[0]) > 45 || Math.abs(frame[i + 1] - bg[1]) > 45 || Math.abs(frame[i + 2] - bg[2]) > 45) diff++;
      n++;
    }
  }
  return diff / n;
}

// ── The tests ───────────────────────────────────────────────────────────────

const canRender = renderToolsAvailable();
const run = canRender && process.env.RENDER_E2E !== '0';

test('E2E render: exported video matches the editor preview (2D canonical scene)', { skip: !run && 'manim/ffmpeg unavailable — set RENDER_E2E=1 to force' }, async () => {
  const workDir = mkdtempSync(join(tmpdir(), 'e2e-render-'));
  try {
    // 1. What does the PREVIEW say the scene looks like? (the canonical truth)
    const engine = new PlaybackEngine();
    const tracks = project.tracks;

    // 2. Compile + render with real Manim
    const video = await renderManim(project, workDir);

    // 3. Frame at t=4: all long-window objects present, move clip completed
    const f4 = await extractFrame(video, 4);

    // circleA at (400,540) — pink
    let s = sample(f4, 400, 540, '#ff3366');
    assert.ok(s.ratio > 0.5, `circleA pink at its preview position (ratio=${s.ratio.toFixed(2)}, avg=${s.avg.map(v => v | 0)})`);

    // squareB still in window [2,5) at t=4 — cyan at (1500,300)
    s = sample(f4, 1500, 300, '#00ccff');
    assert.ok(s.ratio > 0.5, `squareB present at t=4 (ratio=${s.ratio.toFixed(2)})`);

    // Parent move clip (1→3) completed: family shifted +200px → star child now
    // at (1460,540) — pink star, parent yellow at (1160,540)
    s = sample(f4, 1460, 540, '#ff66aa');
    assert.ok(s.ratio > 0.4, `child star followed the parent move to the preview-predicted spot (ratio=${s.ratio.toFixed(2)})`);
    s = sample(f4, 1160, 540, '#ffcc00');
    assert.ok(s.ratio > 0.4, `parent rect landed at its move target (ratio=${s.ratio.toFixed(2)})`);

    // Rotation family clip (2→4) completed 180°: dot child orbited from
    // (700,900) around (500,900) → (300,900) — white dot
    s = sample(f4, 300, 900, '#ffffff');
    assert.ok(s.ratio > 0.3, `dot child orbited 180° around the parent to the predicted spot (ratio=${s.ratio.toFixed(2)})`);

    // zOrder: overlapping circles — the HIGHER zOrder circle wins the center
    s = sample(f4, 880, 270, '#44ff88');
    assert.ok(s.ratio > 0.5, `layering: top circle covers the lower one (ratio=${s.ratio.toFixed(2)})`);

    // 4. Frame at t=6: squareB's window [2,5) has ENDED — background there
    const f6 = await extractFrame(video, 6);
    s = sample(f6, 1500, 300, BG);
    assert.ok(s.ratio > 0.6, `squareB gone after its window ended — timeline contract holds in the render (ratio=${s.ratio.toFixed(2)}, avg=${s.avg.map(v => v | 0)})`);
    // And the long-lived circle is still there
    s = sample(f6, 400, 540, '#ff3366');
    assert.ok(s.ratio > 0.5, `circleA still visible at t=6 (ratio=${s.ratio.toFixed(2)})`);

    // 5. Duration sanity: the timeline ends with the last exit + trailing 1s
    const dur = await new Promise((resolve) => {
      const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]);
      let out = '';
      p.stdout.on('data', d => { out += d; });
      p.on('close', () => resolve(parseFloat(out)));
    });
    // Longest window: rectP family exits at 12 + 0.5 fade + trailing wait 1 ≈ 13.5s
    assert.ok(dur > 12 && dur < 16, `video duration ${dur.toFixed(1)}s matches the editor timeline`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('E2E render: 3D scene renders cube + sphere through the 3D camera', { skip: !run && 'manim/ffmpeg unavailable — set RENDER_E2E=1 to force' }, async () => {
  const workDir = mkdtempSync(join(tmpdir(), 'e2e-render3d-'));
  try {
    const video = await renderManim(project3d, workDir);
    const f = await extractFrame(video, 3);
    // Structural: substantial non-background ink inside the cube region
    // (exact pixels depend on the 3D camera projection — position parity is
    // verified structurally, orientation by successful ThreeDScene render)
    const cubeInk = fractionNonBackground(f, 960, 540, 90);
    assert.ok(cubeInk > 0.25, `cube region has rendered content (ink=${cubeInk.toFixed(2)})`);
    // The sphere (z toward camera, 3D-projected): find its pixels anywhere in
    // the frame — the camera decides the projected position.
    const exp = hexToRgb('#38bdf8');
    let hits = 0, sx = 0, sy = 0;
    for (let y = 0; y < H; y += 3) {
      for (let x = 0; x < W; x += 3) {
        const i = (y * W + x) * 3;
        if (Math.abs(f[i] - exp[0]) < 60 && Math.abs(f[i + 1] - exp[1]) < 60 && Math.abs(f[i + 2] - exp[2]) < 60) {
          hits++; sx += x; sy += y;
        }
      }
    }
    assert.ok(hits > 150, `sphere rendered somewhere in the 3D projection (hits=${hits})`);
    const centroid = hits ? [sx / hits | 0, sy / hits | 0] : null;
    console.log(`    sphere projected centroid: ${JSON.stringify(centroid)} (3D camera decides placement — documented)`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('E2E render: preview engine and codegen agree on the verification scene (no manim needed)', async () => {
  // Belt and braces: the exact expectations sampled above are derived from the
  // same playback engine — this test pins the predictions themselves so a
  // preview regression can never silently "pass" the render test.
  const engine = new PlaybackEngine();
  const at4 = engine.computeFrame(4, project.tracks, project.objects);
  assert.equal(at4.hiddenIds.has('squareB'), false, 'preview: squareB in window at t=4');
  const starOv = at4.objectOverrides.starC || {};
  assert.ok(Math.abs(starOv.x - 1460) < 1 && Math.abs(starOv.y - 540) < 1, `preview: star child at (1460,540), got (${starOv.x},${starOv.y})`);
  const dotOv = at4.objectOverrides.dotC || {};
  assert.ok(Math.abs(dotOv.x - 300) < 1 && Math.abs(dotOv.y - 900) < 1, `preview: dot child at (300,900), got (${dotOv.x},${dotOv.y})`);
  const at6 = engine.computeFrame(6, project.tracks, project.objects);
  assert.equal(at6.hiddenIds.has('squareB'), true, 'preview: squareB out of window at t=6');

  const compiled = compileProject(project);
  assert.equal(compiled.success, true);
  assert.ok(compiled.code.includes('fam_rectP = VGroup(rectP, starC)'), 'family wrapper for the move test');
  assert.ok(compiled.code.includes('Rotate(fam_rotP'), 'rotate clip targets the family');
  assert.ok(compiled.code.includes('squareB')), 'squareB emitted';
});

test('render tools availability probe', () => {
  // Diagnosability: when the render tests skip, this says why.
  if (!canRender) {
    console.log('  [e2e.render] manim or ffmpeg unavailable — render verification skipped');
  } else {
    console.log('  [e2e.render] manim + ffmpeg available — full render verification active');
  }
});
