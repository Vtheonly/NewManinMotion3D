/**
 * Canonical render-source contract tests (issue #36).
 * Run: npm test (from services/api) — Node built-in test runner.
 *
 * Covers:
 *   - legacyCompat: detection + injection + idempotence + reporting
 *   - /render routing: a code-sourced project renders its exact codeSource
 *     (server-side enforcement; the visual scaffold is never compiled)
 *   - /render-code: applies and reports the compat boundary
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { detectLegacyApi, applyLegacyCompat, legacyCompatNotes, LEGACY_COMPAT_MARKER } from '../src/compiler/legacyCompat.js';

const LEGACY_SOURCE = `from manim import *

class SynthesizabilityWall(MovingCameraScene):
    def construct(self):
        self.camera_frame.scale(1.2).move_to([-2.0, 0.25, 0])
        t = Text("hi")
        self.play(FadeIn(t))
`;

const MODERN_SOURCE = `from manim import *

class MainScene(Scene):
    def construct(self):
        t = Text("hi")
        self.play(FadeIn(t))
`;

// ─── legacyCompat ─────────────────────────────────────────────────────────────

test('legacyCompat: detects removed camera_frame API with MovingCameraScene', () => {
  assert.deepEqual(detectLegacyApi(LEGACY_SOURCE), ['camera_frame']);
});

test('legacyCompat: modern source needs no compat', () => {
  assert.deepEqual(detectLegacyApi(MODERN_SOURCE), []);
});

test('legacyCompat: camera_frame without MovingCameraScene is not patched', () => {
  assert.deepEqual(detectLegacyApi(LEGACY_SOURCE.replace('MovingCameraScene', 'Scene')), []);
});

test('legacyCompat: injection keeps the source and adds an alias after imports', () => {
  const { source, applied } = applyLegacyCompat(LEGACY_SOURCE);
  assert.deepEqual(applied, ['camera_frame']);
  assert(source.includes(LEGACY_COMPAT_MARKER), 'marker comment present');
  assert(source.includes('def camera_frame(self):'), 'alias property injected');
  assert(source.indexOf('def camera_frame(self):') > source.indexOf('from manim import *'),
    'injected after the manim import so the file-level subclass picks it up');
  // The user's canonical text is untouched apart from the shim:
  assert(source.includes('self.camera_frame.scale(1.2)'), 'original statements preserved');
});

test('legacyCompat: idempotent — already-patched source is not patched twice', () => {
  const once = applyLegacyCompat(LEGACY_SOURCE);
  assert.deepEqual(detectLegacyApi(once.source), []);
  const twice = applyLegacyCompat(once.source);
  assert.equal((twice.source.match(new RegExp(LEGACY_COMPAT_MARKER, 'g')) || []).length, 1);
});

test('legacyCompat: notes map rule keys to human-readable explanations', () => {
  assert.deepEqual(legacyCompatNotes(['camera_frame']),
    ['self.camera_frame -> self.camera.frame (removed in Manim CE 0.15)']);
});

test('legacyCompat: 2D point literals inside point ctors are padded to 3D', () => {
  const src = 'from manim import *\nbody = Polygon((-0.13, 0.55), (0.13, 0.55),\n               (0.5, -0.5), stroke_width=3)\n';
  const { source, applied } = applyLegacyCompat(src);
  assert.deepEqual(applied, ['point_2d_literals']);
  assert(source.includes('Polygon([-0.13, 0.55, 0], [0.13, 0.55, 0],'));
  assert(source.includes('[0.5, -0.5, 0]'), 'continuation-line literals padded too');
});

test('legacyCompat: 3D point literals pass through untouched', () => {
  const src = 'l = Line([-0.58, -0.42, 0], [0.62, -0.42, 0])\n';
  assert.deepEqual(detectLegacyApi(src), []);
});

test('legacyCompat: 2-element numeric lists in point ctors are padded', () => {
  const src = 'd = Dot([1.5, -0.2])\n';
  const { applied } = applyLegacyCompat(src);
  assert.deepEqual(applied, ['point_2d_literals']);
});

test('legacyCompat: non-point 2-tuples outside point ctors are untouched', () => {
  const src = 'for t in (-0.52, -0.18):\n    x = 1\n';
  assert.deepEqual(detectLegacyApi(src), []);
});

test('legacyCompat: move_to gets a runtime 2D-pad shim when 2D points exist', () => {
  const src = 'from manim import *\nclass S(MovingCameraScene):\n    def construct(self):\n        self.zoom(10.8, [2.1, 0.2])\n        self.camera_frame.animate.move_to([-2.0, 0.25, 0])\n';
  const { source, applied } = applyLegacyCompat(src);
  assert.ok(applied.includes('move_to_2d'));
  assert(source.includes('def _compat_move_to'), 'runtime shim injected');
  assert(source.includes('[2.1, 0.2]'), 'argument literals are NOT rewritten (runtime pad)');
});

test('legacyCompat: Wiggle angle kwarg is renamed to rotation_angle', () => {
  const src = 'from manim import *\nself.play(Wiggle(wall.bricks, scale_value=1.015, angle=0.012))\n';
  const { source, applied } = applyLegacyCompat(src);
  assert.deepEqual(applied, ['wiggle_angle']);
  assert(source.includes('rotation_angle=0.012'));
  assert(!/\bangle\s*=/.test(source), 'bare angle= kwarg is gone');
});

test('legacyCompat: the real legacy fixture applies all four rules and stays valid Python', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = await readFile(new URL('../fixtures/../../web/tests/fixtures/legacy_synth_wall.py', import.meta.url), 'utf-8');
  const { source, applied } = applyLegacyCompat(fixture);
  assert.deepEqual(applied, ['camera_frame', 'point_2d_literals', 'move_to_2d', 'wiggle_angle']);
  assert(source.includes('class _MovingCameraCompat(MovingCameraScene):'));
  assert(source.includes('Polygon([-0.13, 0.55, 0]'));
  assert(source.includes('rotation_angle=0.012'));
  // The user's code is preserved verbatim apart from the documented shims.
  assert(source.includes('self.camera_frame.scale(13.4 / self._cw)'));
});

// ─── /render routing (server-side contract enforcement) ───────────────────────

import { spawn } from 'node:child_process';

async function withServer (fn) {
  // Minimal harness: boot the express app on a random port with a temp data
  // dir and a fake RESP server standing in for Redis (answers +OK to every
  // command — enough for enqueue), run real HTTP assertions, then stop both.
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs');
  const net = await import('node:net');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mstudio-test-'));
  const port = String(20000 + Math.floor(Math.random() * 20000));
  const redisPort = Number(port) + 1;

  const fakeRedis = net.createServer((socket) => {
    let buf = '';
    socket.on('data', (d) => {
      buf += String(d);
      // RESP commands are *N\r\n...; reply once per complete command.
      let idx;
      while ((idx = buf.indexOf('\r\n')) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (line.startsWith('*')) {
          const n = parseInt(line.slice(1), 10);
          // consume the n bulk strings that follow
          for (let i = 0; i < n; i++) {
            const h = buf.indexOf('\r\n');
            const len = parseInt(buf.slice(1, h), 10); // $len
            buf = buf.slice(h + 2 + len + 2);
          }
          socket.write('+OK\r\n');
        }
      }
    });
  });
  await new Promise((resolve) => fakeRedis.listen(redisPort, resolve));

  const proc = spawn(process.execPath, ['src/index.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, DATA_DIR: dataDir, PORT: port, REDIS_URL: `redis://127.0.0.1:${redisPort}` },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let started = false;
  await new Promise((resolve) => {
    proc.stdout.on('data', (d) => {
      if (String(d).includes('Server running')) { started = true; resolve(); }
    });
    setTimeout(() => resolve(), 3000);
  });
  try {
    await fn(started ? port : null, dataDir);
  } finally {
    proc.kill('SIGKILL');
    fakeRedis.close();
  }
}

test('render route: code-sourced project renders its exact codeSource (issue #36)', async () => {
  await withServer(async (port, dataDir) => {
    if (!port) return; // server log format changed — skip gracefully
    const fs = await import('node:fs');
    const path = await import('node:path');
    const base = `http://127.0.0.1:${port}/api`;

    const create = await fetch(`${base}/projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Imported', editorMode: 'visual', sceneType: 'scene_2d' })
    }).then((r) => r.json());
    const id = create.id;

    // A code-sourced project (as saved by the web client after import):
    const project = {
      name: 'Imported', editorMode: 'visual', sceneType: 'scene_2d',
      sourceMode: 'code', codeSource: LEGACY_SOURCE,
      scene: { className: 'SynthesizabilityWall' }, camera: {},
      stage: { width: 1920, height: 1080, backgroundColor: '#070b17' },
      objects: [], groups: [], tracks: [], assets: []
    };
    await fetch(`${base}/projects/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });

    const res = await fetch(`${base}/projects/${id}/render`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality: 'low' })
    });
    const body = await res.json();
    assert.equal(res.status, 202);
    assert.equal(body.renderSource, 'code', 'response declares code render source');
    assert.ok(body.legacyCompat.length === 1, 'compat rule reported to the caller');

    // The written scene.py must be the source (plus compat shim), NOT codegen.
    const scenePy = readFileSync(path.join(dataDir, 'projects', id, 'scene.py'), 'utf-8');
    assert(scenePy.includes('self.camera_frame.scale(1.2)'),
      'scene.py carries the exact user source');
    assert(scenePy.includes(LEGACY_COMPAT_MARKER), 'compat shim applied to the render copy');
    assert(!scenePy.includes('Manim Studio'), 'not a codegen artefact');
  });
});

test('render-code route: applies and reports the compat boundary', async () => {
  await withServer(async (port) => {
    if (!port) return;
    const base = `http://127.0.0.1:${port}/api`;
    const create = await fetch(`${base}/projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Code', editorMode: 'code', sceneType: 'scene_2d' })
    }).then((r) => r.json());

    const res = await fetch(`${base}/projects/${create.id}/render-code`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality: 'low', codeSource: LEGACY_SOURCE })
    });
    const body = await res.json();
    assert.equal(res.status, 202);
    assert.equal(body.renderSource, 'code');
    assert.equal(body.legacyCompat.length, 1);
  });
});
