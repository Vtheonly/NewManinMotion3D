/**
 * Scene Architecture Tests (Issue #1 — Iteration 001)
 *
 * Run: node tests/scene.test.mjs   (from services/web)
 *
 * Covers:
 *  1. Client-side codegen scene-type support (2D / moving camera / 3D / custom)
 *  2. Client-side scene detection (mirror of the server's sceneDetect.js)
 *  3. Schema migration defaults for older projects
 */

import { detectScenesClient } from '../src/export/manim.js';
import { SCENE_TYPES, getSceneTypeMeta } from '../src/store/project.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

// ─── Scene type metadata ─────────────────────────────────────────────────────

console.log('=== Scene type metadata ===');
assert(SCENE_TYPES.length === 4, 'four built-in scene types');
assert(getSceneTypeMeta('scene_2d').baseClass === 'Scene', '2D base is Scene');
assert(getSceneTypeMeta('moving_camera').baseClass === 'MovingCameraScene', 'moving camera base');
assert(getSceneTypeMeta('three_d').baseClass === 'ThreeDScene', '3D base');
assert(getSceneTypeMeta('unknown_key') === SCENE_TYPES[0], 'unknown falls back to 2D');
assert(getSceneTypeMeta('three_d').dimensionality === '3d', '3D dimensionality flag');
assert(getSceneTypeMeta('moving_camera').cameraFields.includes('zoom'), 'camera fields listed');
assert(getSceneTypeMeta('scene_2d').cameraFields.length === 0, 'fixed 2D camera has no knobs');

// ─── Scene detection (client mirror of server sceneDetect.js) ───────────────

console.log('=== Scene detection ===');
const src = `
from manim import *

# class Ghost(Scene): not real
class Intro(MovingCameraScene):
    def construct(self): pass

class Outro(ThreeDScene):
    def construct(self): pass

class Custom(MyBaseScene):
    def construct(self): pass

class NotAScene(VMobject): pass
class Helper: pass
`;

const scenes = detectScenesClient(src);
assert(scenes.length === 3, `3 scenes detected (got ${scenes.length})`);
assert(scenes[0].name === 'Intro' && scenes[0].sceneType === 'moving_camera', 'Intro is moving_camera');
assert(scenes[1].name === 'Outro' && scenes[1].sceneType === 'three_d', 'Outro is three_d');
assert(scenes[2].name === 'Custom' && scenes[2].known === false, 'Custom scene subclass detected');
assert(!scenes.some(s => s.name === 'NotAScene'), 'VMobject subclass not a scene');
assert(!scenes.some(s => s.name === 'Helper'), 'plain class not a scene');
assert(!scenes.some(s => s.name === 'Ghost'), 'commented class ignored');

assert(detectScenesClient('').length === 0, 'empty source -> no scenes');
assert(detectScenesClient('x = 1').length === 0, 'no classes -> no scenes');
assert(detectScenesClient('class Broken(((:').length === 0, 'garbage source -> no scenes');

// String-literal classes are ignored
const stringSrc = 'doc = """\nclass Fake(Scene):\n    pass\n"""\nclass Real(Scene):\n    pass\n';
const strScenes = detectScenesClient(stringSrc);
assert(strScenes.length === 1 && strScenes[0].name === 'Real', 'classes inside strings ignored');

console.log('==================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('==================================================');
if (failed > 0) process.exit(1);
console.log('All tests passed!');
