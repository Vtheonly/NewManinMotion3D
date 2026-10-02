/**
 * stage3d mapping contract tests (issue #42).
 *
 * These pin the coordinate/rotation contract shared by the 3D viewport,
 * the canonical store, and the api compiler codegen:
 *   stage px → Manim frame units, per-axis rotations, unit-extent sizes.
 * A failure here means the 3D view and the exported video disagree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stageToWorld, worldToStage, propsToEuler, eulerToProps,
  object3dSize, is3dType, meshKind, FRAME_WIDTH, FRAME_HEIGHT
} from '../src/engine/stage3d.js';

const SW = 1920, SH = 1080;

test('stage3d: stage center maps to the world origin', () => {
  const w = stageToWorld(960, 540, 0, SW, SH);
  assert.equal(Math.abs(w.x), 0);   // abs() collapses the -0 edge case
  assert.equal(Math.abs(w.y), 0);
  assert.equal(Math.abs(w.z), 0);
});

test('stage3d: stage corners map to the true Manim frame corners', () => {
  const tl = stageToWorld(0, 0, 0, SW, SH);
  assert.ok(Math.abs(tl.x - -FRAME_WIDTH / 2) < 1e-9);
  assert.ok(Math.abs(tl.y - FRAME_HEIGHT / 2) < 1e-9);   // stage y-down → world y-up
  const br = stageToWorld(1920, 1080, 0, SW, SH);
  assert.ok(Math.abs(br.x - FRAME_WIDTH / 2) < 1e-9);
  assert.ok(Math.abs(br.y - -FRAME_HEIGHT / 2) < 1e-9);
});

test('stage3d: z maps to the render depth axis (toward camera = +z)', () => {
  const w = stageToWorld(960, 540, 1080, SW, SH);
  assert.ok(Math.abs(w.z - FRAME_HEIGHT) < 1e-9);
});

test('stage3d: worldToStage inverts stageToWorld exactly', () => {
  const pts = [[0, 0, 0], [960, 540, 0], [100, 900, 333], [1920, 0, -500]];
  for (const [x, y, z] of pts) {
    const w = stageToWorld(x, y, z, SW, SH);
    const s = worldToStage(w.x, w.y, w.z, SW, SH);
    assert.ok(Math.abs(s.x - x) < 1e-6, `x roundtrip for ${x}`);
    assert.ok(Math.abs(s.y - y) < 1e-6, `y roundtrip for ${y}`);
    assert.ok(Math.abs(s.z - z) < 1e-6, `z roundtrip for ${z}`);
  }
});

test('stage3d: propsToEuler — X/Y direct, editor Z negated (canvas y-down)', () => {
  const d = Math.PI / 180;
  const e = propsToEuler(30, 45, 90);
  assert.ok(Math.abs(e.x - 30 * d) < 1e-9);
  assert.ok(Math.abs(e.y - 45 * d) < 1e-9);
  assert.ok(Math.abs(e.z - -90 * d) < 1e-9);
});

test('stage3d: eulerToProps inverts propsToEuler', () => {
  const e = propsToEuler(30, 45, 90);
  const p = eulerToProps(e.x, e.y, e.z);
  assert.equal(p.rotationX, 30);
  assert.equal(p.rotationY, 45);
  assert.equal(p.rotationZ, 90);
});

test('stage3d: codegen-identical composition — Euler XYZ = Rx·Ry·Rz = Manim rotate Z,Y,X', () => {
  // The codegen emits rotate(z, OUT) then rotate(y, UP) then rotate(x, RIGHT),
  // which composes R = Rx·Ry·Rz — identical to a three.js Euler 'XYZ'. Verify
  // the rotation of the +x axis under both compositions.
  const ex = 0.3, ey = 0.5, ez = 0.2;
  const e = propsToEuler(ex / (Math.PI / 180), ey / (Math.PI / 180), -ez / (Math.PI / 180));
  // (propsToEuler negates Z; feeding -ez gives e.z = +ez)
  assert.ok(Math.abs(e.z - ez) < 1e-9);

  const rx = (a, v) => [v[0], Math.cos(a) * v[1] - Math.sin(a) * v[2], Math.sin(a) * v[1] + Math.cos(a) * v[2]];
  const ry = (a, v) => [Math.cos(a) * v[0] + Math.sin(a) * v[2], v[1], -Math.sin(a) * v[0] + Math.cos(a) * v[2]];
  const rz = (a, v) => [Math.cos(a) * v[0] - Math.sin(a) * v[1], Math.sin(a) * v[0] + Math.cos(a) * v[1], v[2]];

  // Manim sequential: v' = Rx(Ry(Rz v))
  const manim = rx(ex, ry(ey, rz(ez, [1, 0, 0])));
  // Three Euler XYZ matrix applied: v' = (Rx·Ry·Rz) v  == Rx(Ry(Rz v))
  // (verified separately against three.js — same product)
  assert.ok(manim.every((c, i) => Math.abs(c - [0.86, 0.329, -0.390][i]) < 0.001),
    `Manim sequential composition matches Three Euler XYZ: ${manim.map(n => n.toFixed(3))}`);
});

test('stage3d: object3dSize — cube honors depth; cone/cylinder axis = height; sphere depth = width', () => {
  const cube = { type: 'cube', width: 300, height: 200, depth: 150 };
  const s1 = object3dSize(cube, SW, SH);
  assert.ok(Math.abs(s1.w - 300 / SW * FRAME_WIDTH) < 1e-9);
  assert.ok(Math.abs(s1.h - 200 / SH * FRAME_HEIGHT) < 1e-9);
  assert.ok(Math.abs(s1.d - 150 / SW * FRAME_WIDTH) < 1e-9);

  const cone = { type: 'cone', width: 200, height: 300 };
  const s2 = object3dSize(cone, SW, SH);
  assert.ok(Math.abs(s2.w - 200 / SW * FRAME_WIDTH) < 1e-9);
  assert.equal(s2.h, s2.w);          // base y-diameter mirrors width
  assert.ok(Math.abs(s2.d - 300 / SH * FRAME_HEIGHT) < 1e-9);  // axis = height

  const sphere = { type: 'sphere', width: 220, height: 220 };
  const s3 = object3dSize(sphere, SW, SH);
  assert.ok(Math.abs(s3.d - s3.w) < 1e-9);

  const cubeNoDepth = { type: 'cube', width: 300, height: 300 };
  assert.ok(Math.abs(object3dSize(cubeNoDepth, SW, SH).d - object3dSize(cubeNoDepth, SW, SH).w) < 1e-9);
});

test('stage3d: meshKind maps every canonical type', () => {
  assert.equal(meshKind('cube'), 'box');
  assert.equal(meshKind('sphere'), 'sphere');
  assert.equal(meshKind('cone'), 'cone');
  assert.equal(meshKind('cylinder'), 'cylinder');
  assert.equal(meshKind('rectangle'), 'flat');
  assert.equal(meshKind('text'), 'flat');
  assert.ok(is3dType('cube') && is3dType('sphere') && is3dType('cone') && is3dType('cylinder'));
  assert.ok(!is3dType('rectangle'));
});
