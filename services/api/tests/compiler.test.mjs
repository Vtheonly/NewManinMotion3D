/**
 * Compiler Architecture Tests (Issue #1 — Iteration 001)
 *
 * Run: npm test   (from services/api)  — uses the Node built-in test runner.
 *
 * Covers the Issue #1 testing requirements:
 *   - compiler/plugin registration (registries, duplicate rejection)
 *   - scene detection (JS side)
 *   - 2D scene generation
 *   - moving-camera scene generation
 *   - 3D scene generation
 *   - custom scene class names / custom base classes
 *   - unsupported/invalid scene + object handling
 *   - regression cases for previous 2D-only assumptions
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compileProject, generatePythonCode, validateProject, normalizeProject,
  detectScenes, pickScene, describeCapabilities, safeClassName,
  registries, createRegistry,
  registerObjectType, registerAnimation, registerSceneType
} from '../src/compiler/index.js';
import { getAnimation, animationKeys } from '../src/compiler/registry/animations.js';
import { resolveSceneType } from '../src/compiler/registry/scenes.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(overrides = {}) {
  return {
    id: 'proj_test',
    name: 'Test Project',
    editorMode: 'visual',
    codeSource: '',
    sceneType: 'scene_2d',
    scene: { className: 'MainScene' },
    camera: {},
    stage: { width: 1920, height: 1080, backgroundColor: '#0d1117' },
    assets: [],
    objects: [
      { id: 'obj_1', type: 'circle', name: 'Circle', x: 960, y: 540, width: 200, height: 200,
        fill: '#3b82f6', stroke: '#ffffff', enterAnim: 'fade_in', exitAnim: 'fade_out' },
      { id: 'obj_2', type: 'text', name: 'Text', x: 960, y: 800, width: 400, height: 80,
        fill: '#ffffff', content: 'Hello', enterAnim: 'write', exitAnim: 'none' }
    ],
    tracks: [
      { id: 't1', name: 'Track 1', clips: [
        { id: 'c1', type: 'move', startTime: 1, duration: 2, easing: 'ease_in_out',
          sourceId: 'obj_1', params: { targetX: 1400, targetY: 540 } }
      ]}
    ],
    sceneDuration: 10,
    ...overrides
  };
}

// ─── Registry architecture ────────────────────────────────────────────────────

test('registries: object types registered and queryable', () => {
  for (const type of ['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star',
                      'polygon', 'line', 'arrow', 'heart', 'dot', 'dot_grid', 'text',
                      'image', 'svg_asset', 'latex', 'axes']) {
    assert.ok(registries.objects.has(type), `object type "${type}" registered`);
  }
  assert.equal(registries.objects.get('nope'), undefined);
});

test('registries: duplicate registration is rejected', () => {
  const reg = createRegistry('test');
  reg.register('a', { x: 1 });
  assert.throws(() => reg.register('a', { x: 2 }), /duplicate key "a"/);
});

test('registries: plugin registration adds new object types without core changes', () => {
  const key = 'plugin_test_shape';
  // Cleanly capture prior state (registry has no unregister by design — use a
  // fresh registry to prove the generic extension point works)
  const reg = createRegistry('plugin');
  reg.register(key, { codegen: () => ['x = Circle()'] });
  assert.ok(reg.has(key));

  // The real object registry accepts new types via registerObjectType
  // (guarded so the global registry stays clean across test files)
  assert.doesNotThrow(() => {
    if (!registries.objects.has(key)) {
      registerObjectType(key, { label: 'Plugin Shape', codegen: () => [] });
      assert.ok(registries.objects.has(key));
    }
  });
});

test('registries: animation registration + lookup by phase', () => {
  assert.ok(getAnimation('enter', 'fade_in'));
  assert.ok(getAnimation('exit', 'fade_out'));
  assert.ok(getAnimation('clip', 'transform'));
  assert.equal(getAnimation('enter', 'nope'), undefined);
  assert.ok(animationKeys('enter').includes('write'));
  assert.ok(animationKeys('exit').includes('uncreate'));
  assert.ok(animationKeys('clip').includes('rotate'));
});

test('registries: scene types registered with base classes', () => {
  assert.equal(resolveSceneType(makeProject()).baseClass, 'Scene');
  assert.equal(resolveSceneType(makeProject({ sceneType: 'moving_camera' })).baseClass, 'MovingCameraScene');
  assert.equal(resolveSceneType(makeProject({ sceneType: 'three_d' })).baseClass, 'ThreeDScene');
  assert.equal(
    resolveSceneType(makeProject({ sceneType: 'custom', scene: { className: 'X', baseClass: 'MyBase' } })).baseClass,
    'MyBase'
  );
  // Unknown scene types fall back to plain Scene (never crash at codegen time)
  assert.equal(resolveSceneType(makeProject({ sceneType: 'bogus' })).baseClass, 'Scene');
});

test('registries: new scene type plugin registration', () => {
  assert.throws(() => registerSceneType('bad', { label: 'Bad' }), /baseClass/);
  if (!registries.scenes.has('vector_test')) {
    registerSceneType('vector_test', {
      label: 'Vector', baseClass: 'VectorScene', dimensionality: '2d'
    });
    assert.ok(registries.scenes.has('vector_test'));
    const project = makeProject({ sceneType: 'vector_test' });
    const result = compileProject(project, '/data/assets/x');
    assert.ok(result.success);
    assert.match(result.code, /class MainScene\(VectorScene\)/);
  }
});

test('capabilities snapshot lists registered capabilities', () => {
  const caps = describeCapabilities();
  assert.ok(caps.objectTypes.includes('circle'));
  assert.ok(caps.animations.enter.includes('fade_in'));
  assert.ok(caps.animations.exit.includes('fade_out'));
  assert.ok(caps.animations.clips.includes('transform'));
  assert.ok(caps.sceneTypes.some(s => s.key === 'three_d'));
});

// ─── Scene detection (JS) ─────────────────────────────────────────────────────

test('sceneDetect: finds known scene bases', () => {
  const { scenes } = detectScenes('class A(Scene):\n    pass\nclass B(ThreeDScene):\n    pass\n');
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].sceneType, 'scene_2d');
  assert.equal(scenes[1].sceneType, 'three_d');
});

test('sceneDetect: finds custom scene subclasses', () => {
  const { scenes } = detectScenes('class Demo(MyBaseScene):\n    def construct(self): pass\n');
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].name, 'Demo');
  assert.equal(scenes[0].known, false);
});

test('sceneDetect: ignores non-scene classes, comments, strings', () => {
  const src = [
    'class Helper: pass',
    'class Shape(VMobject): pass',
    '# class Ghost(Scene): pass',
    'doc = """class Fake(Scene): pass"""',
    'class Real(Scene): pass'
  ].join('\n');
  const { scenes } = detectScenes(src);
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].name, 'Real');
});

test('sceneDetect: dotted base paths (manim.Scene)', () => {
  const { scenes } = detectScenes('class D(manim.Scene):\n    pass\n');
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].name, 'D');
});

test('sceneDetect: empty / invalid sources', () => {
  assert.equal(detectScenes('').scenes.length, 0);
  assert.equal(detectScenes('x = 1').scenes.length, 0);
  assert.equal(detectScenes('class Broken(((').scenes.length, 0);
});

test('sceneDetect: pickScene priority and fallback', () => {
  const src = 'class First(Scene):\n    pass\nclass Second(ThreeDScene):\n    pass\n';
  assert.equal(pickScene(src, 'Second').name, 'Second');
  assert.equal(pickScene(src, 'Second').detected, false);
  assert.equal(pickScene(src, 'Missing').name, 'First');   // fallback to first
  assert.equal(pickScene(src, 'Missing').detected, true);
  assert.equal(pickScene(src, null).name, 'First');
  assert.equal(pickScene('x = 1', null), null);
});

// ─── 2D generation (regression) ───────────────────────────────────────────────

test('codegen: legacy 2D project generates class MainScene(Scene)', () => {
  const result = compileProject(makeProject(), '/data/assets/proj_test');
  assert.ok(result.success, result.errors?.join('; '));
  assert.equal(result.sceneName, 'MainScene');
  assert.equal(result.sceneType, 'scene_2d');
  assert.match(result.code, /class MainScene\(Scene\):/);
  assert.match(result.code, /def construct\(self\):/);
  assert.match(result.code, /self\.camera\.background_color = "#0d1117"/);
  assert.match(result.code, /obj_1 = Circle\(radius=/);
  assert.match(result.code, /obj_1\.move_to\(/);
  // Issue #36 timeline fidelity: both objects enter at t=0, so their enter
  // animations are batched into ONE parallel play (editor semantics) —
  // each carrying its own run_time, not two sequential 0.5s plays.
  assert.match(result.code, /self\.play\(FadeIn\(obj_1, run_time=0\.5\), Write\(obj_2, run_time=0\.5\)\)/);
  assert.doesNotMatch(result.code, /self\.play\(Write\(obj_2\)\s*$/m);
  assert.match(result.code, /obj_1\.animate\.move_to\(/);         // move clip
  assert.doesNotMatch(result.code, /MovingCameraScene|ThreeDScene/);
});

test('codegen: v2-era project JSON (no sceneType field) still compiles as 2D', () => {
  const legacy = makeProject();
  delete legacy.sceneType;
  delete legacy.scene;
  delete legacy.camera;
  const result = compileProject(legacy, '/data/assets/p');
  assert.ok(result.success, result.errors?.join('; '));
  assert.equal(result.sceneType, 'scene_2d');
  assert.match(result.code, /class MainScene\(Scene\):/);
});

test('codegen: empty project emits placeholder wait', () => {
  const result = compileProject(makeProject({ objects: [], tracks: [] }), '/data/assets/p');
  assert.ok(result.success);
  assert.match(result.code, /self\.wait\(1\)/);
});

test('codegen: unknown object type fails validation with registry message', () => {
  const bad = makeProject({ objects: [makeProject().objects[0]] });
  bad.objects[0].type = 'hologram';
  const result = compileProject(bad, '');
  assert.ok(!result.success);
  assert.ok(result.errors.some(e => e.includes('unknown type "hologram"')));
});

// ─── Moving camera generation ─────────────────────────────────────────────────

test('codegen: moving_camera scene type generates MovingCameraScene + frame setup', () => {
  const project = makeProject({
    sceneType: 'moving_camera',
    scene: { className: 'CameraDemo' },
    camera: { zoom: 0.75, centerX: 1.5, centerY: -2 }
  });
  const result = compileProject(project, '/data/assets/p');
  assert.ok(result.success, result.errors?.join('; '));
  assert.equal(result.sceneName, 'CameraDemo');
  assert.match(result.code, /class CameraDemo\(MovingCameraScene\):/);
  assert.match(result.code, /self\.camera\.frame\.scale\(0\.750\)/);
  assert.match(result.code, /self\.camera\.frame\.move_to\(\[1\.500, -2\.000, 0\]\)/);
});

test('codegen: moving_camera without camera config emits no frame lines', () => {
  const result = compileProject(makeProject({ sceneType: 'moving_camera' }), '');
  assert.ok(result.success);
  assert.match(result.code, /class MainScene\(MovingCameraScene\):/);
  assert.doesNotMatch(result.code, /self\.camera\.frame/);
});

// ─── 3D generation ────────────────────────────────────────────────────────────

test('codegen: three_d scene type generates ThreeDScene + camera orientation', () => {
  const project = makeProject({
    sceneType: 'three_d',
    scene: { className: 'ThreeDemo' },
    camera: { phi: 75, theta: 30 }
  });
  const result = compileProject(project, '/data/assets/p');
  assert.ok(result.success, result.errors?.join('; '));
  assert.match(result.code, /class ThreeDemo\(ThreeDScene\):/);
  assert.match(result.code, /self\.set_camera_orientation\(phi=1\.3090, theta=0\.5236\)/);
});

test('codegen: three_d without camera config emits no orientation call', () => {
  const result = compileProject(makeProject({ sceneType: 'three_d' }), '');
  assert.ok(result.success);
  assert.doesNotMatch(result.code, /set_camera_orientation/);
});

// ─── Custom scene classes ─────────────────────────────────────────────────────

test('codegen: custom base class renders as-is', () => {
  const project = makeProject({
    sceneType: 'custom',
    scene: { className: 'CustomDemo', baseClass: 'MyProjectScene' }
  });
  const result = compileProject(project, '/data/assets/p');
  assert.ok(result.success, result.errors?.join('; '));
  assert.match(result.code, /class CustomDemo\(MyProjectScene\):/);
});

test('codegen: custom scene type without baseClass fails validation', () => {
  const project = makeProject({ sceneType: 'custom', scene: { className: 'X' } });
  const v = validateProject(project);
  assert.ok(!v.valid);
  assert.ok(v.errors.some(e => e.includes('scene.baseClass')));
});

test('codegen: scene class names are validated and sanitized', () => {
  // Invalid class names are rejected at validation time with a clear message
  const project = makeProject({ scene: { className: 'My Scene! 2000' } });
  const result = compileProject(project, '');
  assert.ok(!result.success);
  assert.ok(result.errors.some(e => e.includes('className')));

  // safeClassName remains the codegen-side defence in depth
  assert.equal(safeClassName('My Scene! 2000'), 'My_Scene__2000');
  assert.equal(safeClassName(''), 'MainScene');
  assert.equal(safeClassName('9lives'), 'MainScene');
  assert.equal(safeClassName('Valid_Name'), 'Valid_Name');
});

// ─── Invalid / unsupported handling ───────────────────────────────────────────

test('validator: unknown sceneType rejected with available list', () => {
  const v = validateProject(makeProject({ sceneType: 'warp_4d' }));
  assert.ok(!v.valid);
  assert.ok(v.errors.some(e => e.includes('not a registered scene type')));
  assert.ok(v.errors.some(e => e.includes('scene_2d, moving_camera, three_d, custom')));
});

test('validator: unknown enter/exit animations rejected via registry', () => {
  const objs = [makeProject().objects[0]];
  objs[0] = { ...objs[0], enterAnim: 'teleport_in' };
  const v = validateProject(makeProject({ objects: objs }));
  assert.ok(!v.valid);
  assert.ok(v.errors.some(e => e.includes('unknown enterAnim "teleport_in"')));
});

test('validator: unknown clip type rejected via registry', () => {
  const tracks = [{ id: 't1', name: 'T', clips: [
    { id: 'c1', type: 'dissolve', startTime: 0, duration: 1, sourceId: 'obj_1' }
  ]}];
  const v = validateProject(makeProject({ tracks }));
  assert.ok(!v.valid);
  assert.ok(v.errors.some(e => e.includes('unknown clip type "dissolve"')));
});

test('validator: camera schema accepts known knobs, rejects garbage', () => {
  const v1 = validateProject(makeProject({
    sceneType: 'three_d',
    camera: { phi: 60, theta: 45, distance: 8, zoom: 1.2, gamma: 0 }
  }));
  assert.ok(v1.valid, v1.errors?.join('; '));

  const v2 = validateProject(makeProject({ camera: { phi: 'not-a-number' } }));
  assert.ok(!v2.valid);
});

test('normalizer: scene defaults + camera numeric coercion', () => {
  const project = makeProject({ sceneType: 'moving_camera', camera: { zoom: '1.5', centerX: null, centerY: 'abc' } });
  const norm = normalizeProject(project);
  assert.equal(norm.scene.className, 'MainScene');
  assert.equal(norm.camera.zoom, 1.5);        // numeric string coerced
  assert.equal(norm.camera.centerX, undefined); // null dropped
  assert.equal(norm.camera.centerY, undefined); // non-numeric dropped
  assert.equal(norm._resolvedScene.key, 'moving_camera');
  assert.equal(norm._resolvedScene.baseClass, 'MovingCameraScene');
});

// ─── Renderer integration contract ────────────────────────────────────────────

test('compileProject returns the scene name the renderer must use', () => {
  const result = compileProject(
    makeProject({ scene: { className: 'NamedScene' } }), '/data/assets/p');
  assert.ok(result.success);
  assert.equal(result.sceneName, 'NamedScene');
  // The generated code contains exactly that class -> pickScene finds it
  const picked = pickScene(result.code, result.sceneName);
  assert.equal(picked.name, 'NamedScene');
});

test('pickScene fallback: generated code always renders something', () => {
  const result = compileProject(makeProject(), '/data/assets/p');
  const picked = pickScene(result.code, 'WrongName');
  assert.equal(picked.name, 'MainScene');
});

test('generated 2D code is python-parseable scene structure (smoke)', () => {
  const result = compileProject(makeProject(), '/data/assets/p');
  assert.ok(result.success);
  const detected = detectScenes(result.code);
  assert.equal(detected.scenes.length, 1);
  assert.equal(detected.scenes[0].name, 'MainScene');
});

// ─── Timeline fidelity: same-time steps are parallel (issue #36) ──────────────

test('codegen: many simultaneous enters are ONE parallel play, not sequential', () => {
  const objects = [1, 2, 3, 4, 5].map((n) => ({
    id: `obj_${n}`, type: 'circle', name: `C${n}`, x: 960, y: 540, width: 100, height: 100,
    fill: '#3b82f6', stroke: '#ffffff', enterTime: 0, duration: 8,
    enterAnim: 'fade_in', enterAnimDur: 0.5, exitAnim: 'none'
  }));
  const result = compileProject(makeProject({ objects, tracks: [] }), '/data/assets/p');
  assert.ok(result.success);
  const plays = result.code.split('\n').filter((l) => l.trim().startsWith('self.play('));
  assert.equal(plays.length, 1, 'a single batched play covers all t=0 enters');
  assert.match(result.code, /self\.play\(FadeIn\(obj_1, run_time=0\.5\), FadeIn\(obj_2, run_time=0\.5\)/);
  // The exported timeline is 0.5s for the batch (was 5 × 0.5 = 2.5s sequential).
  assert.doesNotMatch(result.code, /self\.play\(FadeIn\(obj_2\)\)$/m, 'no sequential per-object plays');
});

test('codegen: exported timeline duration matches the editor timeline', () => {
  const objects = [1, 2, 3].map((n) => ({
    id: `obj_${n}`, type: 'circle', name: `C${n}`, x: 960, y: 540, width: 100, height: 100,
    fill: '#3b82f6', stroke: '#ffffff', enterTime: 0, duration: 5,
    enterAnim: 'fade_in', enterAnimDur: 0.5, exitAnim: 'fade_out', exitAnimDur: 0.5
  }));
  const result = compileProject(makeProject({ objects, tracks: [] }), '/data/assets/p');
  assert.ok(result.success);
  // Reconstruct the video timeline: sum waits + play run_times.
  let t = 0;
  for (const line of result.code.split('\n')) {
    const s = line.trim();
    const w = /^self\.wait\(([\d.]+)\)$/.exec(s);
    const p = /^self\.play\((.*)\)$/.exec(s);
    if (w) t += parseFloat(w[1]);
    else if (p) {
      const rts = [...p[1].matchAll(/run_time=([\d.]+)/g)].map((m) => parseFloat(m[1]));
      t += rts.length ? Math.max(...rts) : 1;
    }
  }
  // Editor timeline: enter batch 0.5 + visible until exit at t=5 (wait 4.5)
  // + exit batch 0.5 + final hold 1 = 6.5s — the exported video ends when the
  // editor timeline ends, instead of inflating by per-object sequential plays.
  assert.ok(Math.abs(t - 6.5) < 0.3, `exported duration ~ editor timeline (got ${t.toFixed(1)}s)`);
});

test('codegen: instant (none) enters merge into one zero-duration self.add', () => {
  const objects = [1, 2].map((n) => ({
    id: `obj_${n}`, type: 'circle', name: `C${n}`, x: 960, y: 540, width: 100, height: 100,
    fill: '#3b82f6', stroke: '#ffffff', enterTime: 0, duration: 8,
    enterAnim: 'none', exitAnim: 'none'
  }));
  const result = compileProject(makeProject({ objects, tracks: [] }), '/data/assets/p');
  assert.ok(result.success);
  assert.match(result.code, /self\.add\(obj_1, obj_2\)/, 'instant enters merge into one add');
  // adds consume zero timeline time — no 0.5s drift per add.
  const firstPlay = result.code.split('\n').find((l) => l.trim().startsWith('self.play('));
  assert.ok(!firstPlay, 'no play emitted for instant-only group');
});

test('codegen: simultaneous animations with different durations keep their own run_time', () => {
  const objects = [
    { id: 'obj_a', type: 'circle', name: 'A', x: 960, y: 540, width: 100, height: 100,
      fill: '#3b82f6', stroke: '#ffffff', enterTime: 0, duration: 8,
      enterAnim: 'fade_in', enterAnimDur: 0.3, exitAnim: 'none' },
    { id: 'obj_b', type: 'square', name: 'B', x: 960, y: 540, width: 100, height: 100,
      fill: '#3b82f6', stroke: '#ffffff', enterTime: 0, duration: 8,
      enterAnim: 'write', enterAnimDur: 1.2, exitAnim: 'none' }
  ];
  const result = compileProject(makeProject({ objects, tracks: [] }), '/data/assets/p');
  assert.ok(result.success);
  assert.match(result.code,
    /self\.play\(FadeIn\(obj_a, run_time=0\.3\), Write\(obj_b, run_time=1\.2\)\)/,
    'parallel independent durations preserved (editor semantics)');
});

test('codegen: mixed group with .animate uses play-level max run_time', () => {
  const objects = [
    { id: 'obj_a', type: 'circle', name: 'A', x: 960, y: 540, width: 100, height: 100,
      fill: '#3b82f6', stroke: '#ffffff', enterTime: 0, duration: 8,
      enterAnim: 'fade_in', enterAnimDur: 0.5, exitAnim: 'none' }
  ];
  const tracks = [{
    id: 't1', name: 'Track 1',
    clips: [{ id: 'c1', type: 'scale', startTime: 0, duration: 1.4, easing: 'ease_in_out',
      sourceId: 'obj_a', params: { targetScaleX: 2, targetScaleY: 2 } }]
  }];
  const result = compileProject(makeProject({ objects, tracks }), '/data/assets/p');
  assert.ok(result.success);
  assert.match(result.code, /self\.play\(FadeIn\(obj_a\), obj_a\.animate\.scale\([22.00]*\), run_time=1\.4\)/);
});

test('codegen: empty text content renders empty, never the placeholder "Text"', () => {
  const objects = [
    { id: 'obj_empty', type: 'text', name: 'Empty', x: 960, y: 200, width: 400, height: 80,
      content: '', fontSize: 48, fill: '#ffffff', stroke: 'transparent', opacity: 1,
      enterTime: 0, duration: 4, enterAnim: 'fade_in', enterAnimDur: 0.5, exitAnim: 'none' }
  ];
  const result = compileProject(makeProject({ objects, tracks: [] }), '/data/assets/p');
  assert.ok(result.success);
  assert.doesNotMatch(result.code, /Text\("Text"/, 'placeholder "Text" never emitted');
});
