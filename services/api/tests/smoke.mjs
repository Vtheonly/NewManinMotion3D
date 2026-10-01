/**
 * Smoke test for the refactored compiler pipeline (Issue #1 Iteration 001).
 * Real assertions live in services/api/tests/compiler.test.mjs — this script
 * prints generated code for quick eyeballing during development.
 */
import { compileProject, detectScenes, describeCapabilities } from '../src/compiler/index.js';

const legacyProject = {
  id: 'proj_demo',
  name: 'Legacy 2D Demo',
  editorMode: 'visual',
  codeSource: '',
  stage: { width: 1920, height: 1080, backgroundColor: '#0d1117' },
  assets: [],
  objects: [
    { id: 'obj_1', type: 'circle', x: 960, y: 540, width: 200, height: 200, fill: '#3b82f6', stroke: '#ffffff' },
    { id: 'obj_2', type: 'text', x: 960, y: 800, width: 400, height: 80, content: 'Hello', fill: '#ffffff' }
  ],
  tracks: [{ id: 't1', name: 'Track 1', clips: [
    { id: 'c1', type: 'move', startTime: 1, duration: 2, easing: 'ease_in_out', sourceId: 'obj_1', params: { targetX: 1400, targetY: 540 } }
  ]}],
  sceneDuration: 10
};

console.log('=== capabilities ===');
console.log(JSON.stringify(describeCapabilities(), null, 2));

console.log('\n=== legacy 2D project compiles ===');
const r1 = compileProject(legacyProject, '/data/assets/proj_demo');
console.log('success:', r1.success, '| sceneName:', r1.sceneName, '| sceneType:', r1.sceneType);
console.log(r1.code);

console.log('\n=== moving camera project ===');
const r2 = compileProject({
  ...legacyProject,
  sceneType: 'moving_camera',
  scene: { className: 'CameraDemo' },
  camera: { zoom: 0.8, centerX: 2, centerY: 1 }
}, '/data/assets/proj_demo');
console.log('success:', r2.success, '| sceneName:', r2.sceneName);
console.log(r2.code.split('\n').slice(0, 20).join('\n'));

console.log('\n=== 3D project ===');
const r3 = compileProject({
  ...legacyProject,
  sceneType: 'three_d',
  scene: { className: 'ThreeDDemo' },
  camera: { phi: 60, theta: 45, zoom: 0.9 }
}, '/data/assets/proj_demo');
console.log('success:', r3.success, '| sceneName:', r3.sceneName);
console.log(r3.code.split('\n').slice(0, 20).join('\n'));

console.log('\n=== custom base class ===');
const r4 = compileProject({
  ...legacyProject,
  sceneType: 'custom',
  scene: { className: 'CustomDemo', baseClass: 'MyProjectScene' }
}, '/data/assets/proj_demo');
console.log('success:', r4.success, '| sceneName:', r4.sceneName);
console.log(r4.code.split('\n').slice(0, 16).join('\n'));

console.log('\n=== scene detection ===');
console.log(JSON.stringify(detectScenes(`
from manim import *

class Helper:
    pass

# class Commented(Scene):  <- not a real class
class Intro(MovingCameraScene):
    def construct(self):
        pass

class DemoScene(MyBaseScene):
    def construct(self):
        pass

class NotAScene(VMobject):
    pass
`), null, 2));

console.log('\n=== invalid project rejected ===');
const bad = compileProject({ ...legacyProject, sceneType: 'nonexistent_type' }, '');
console.log('success:', bad.success, '| errors:', bad.errors);
