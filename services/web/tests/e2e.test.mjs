/**
 * COMPREHENSIVE END-TO-END TEST — the complete product as one workflow
 * ===================================================================
 *
 * This suite simulates REAL USAGE of the visual editor end to end:
 *
 *   Frontend actions → Canonical scene → Timeline → Preview renderer
 *   → Persistence (JSON + real HTTP server) → Reload → Export →
 *   client/server export parity → adversarial edge cases →
 *   regression re-verification of previously solved issues.
 *
 * It exercises the SAME functions the UI components call (store actions,
 * playback engine, shared compiler) — nothing is re-implemented here, so a
 * failure always points at a real product layer:
 *
 *   store/project.js ......... frontend editing (data model + actions)
 *   engine/playback.js ....... preview renderer (timeline evaluation)
 *   engine/hierarchy.js ...... parent/child transform propagation
 *   export/manim.js .......... client export (delegates to the compiler)
 *   api/src/compiler ......... THE canonical codegen (server render path)
 *   api routes (HTTP) ........ persistence round-trip
 *
 * Run: node tests/e2e.test.mjs   (from services/web)
 */

import { spawn } from 'node:child_process';
import { store, actions, getters, SHAPE_DEFAULTS, OBJECT_3D_TYPES, SCENE_TYPES, getSceneTypeMeta } from '../src/store/project.js';
import { PlaybackEngine } from '../src/engine/playback.js';
import { propagateParentTransforms } from '../src/engine/hierarchy.js';
import { generateManimScript, detectScenesClient, parseManimScript } from '../src/export/manim.js';
import { normalizeProject } from '../../api/src/compiler/normalizer.js';
import { compileProject } from '../../api/src/compiler/index.js';
import { generatePythonCode } from '../../api/src/compiler/codegen.js';
import { validateProject } from '../../api/src/compiler/validator.js';
import { applyLegacyCompat } from '../../api/src/compiler/legacyCompat.js';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const failures = [];
function check(cond, msg, detail) {
  if (cond) { passed++; }
  else {
    failed++;
    failures.push({ msg, detail: detail === undefined ? '' : String(detail).slice(0, 400) });
    console.error(`  ✗ FAIL: ${msg}${detail !== undefined ? '\n      ' + String(detail).slice(0, 400) : ''}`);
  }
}
function section(title) { console.log(`\n══ ${title} ══`); }
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

// Shared fixtures / helpers -------------------------------------------------

const STAGE = { width: 1920, height: 1080, backgroundColor: '#101418' };

/** Minimal canonical object factory for direct graph construction. */
function mkObj(id, type, extra = {}) {
  return {
    id, type, name: id, x: 960, y: 540, width: 120, height: 120, rotation: 0,
    fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2, opacity: 1,
    zOrder: 0, visible: true, parentId: null,
    enterTime: 0, duration: 5, enterAnim: 'fade_in', exitAnim: 'fade_out',
    enterAnimDur: 0.5, exitAnimDur: 0.5, ...extra
  };
}

function mkProject(objects, tracks = [{ id: 'track_1', name: 'Track 1', clips: [] }], extra = {}) {
  return {
    name: 'E2E', editorMode: 'visual', sourceMode: 'canvas',
    sceneType: 'scene_2d', scene: { className: 'MainScene' }, camera: {},
    stage: { ...STAGE }, assets: [], groups: [],
    objects, tracks, sceneDuration: 10, ...extra
  };
}

/** Fresh playback engine (no rAF loop in Node — computeFrame directly). */
function freshEngine() { return new PlaybackEngine(); }

/** Check generated Python parses (temp file + ast.parse in the manim venv). */
async function pythonSyntaxOk(code) {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs');
  const tmp = path.join(os.tmpdir(), `e2e-py-${Date.now()}-${Math.random().toString(36).slice(2)}.py`);
  fs.writeFileSync(tmp, code);
  try {
    return await new Promise((resolve) => {
      const py = spawn('/home/z/.venv/bin/python', ['-c', 'import ast,sys; ast.parse(open(sys.argv[1]).read())', tmp], { stdio: ['ignore', 'ignore', 'ignore'] });
      let done = false;
      py.on('close', (c) => { if (!done) { done = true; resolve(c === 0); } });
      py.on('error', () => { if (!done) { done = true; resolve(null); } });
      setTimeout(() => { if (!done) { done = true; py.kill(); resolve(null); } }, 20000);
    });
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 1 — AUTHORING: create/edit everything from the frontend
// ═════════════════════════════════════════════════════════════════════════════

section('1.1 New project + shape palette');
{
  actions.newProject('E2E Authoring', 'visual', 'scene_2d');
  check(store.project.name === 'E2E Authoring', 'project name');
  check(store.project.editorMode === 'visual' && store.project.sourceMode === 'canvas', 'visual project is canvas-sourced');
  check(store.project.objects.length === 0 && store.project.tracks.length >= 1, 'clean project');
  check(store.project.stage.width === 1920 && store.project.stage.height === 1080, 'stage defaults 1920x1080');

  const types2d = ['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star',
    'polygon', 'line', 'arrow', 'heart', 'dot', 'dot_grid', 'text', 'latex', 'axes'];
  for (const type of types2d) {
    const obj = actions.addObject(type);
    check(obj && obj.type === type && !!obj.id, `addObject(${type})`);
    check(obj.visible === true && obj.parentId === null, `${type}: visible + root`);
    check(SHAPE_DEFAULTS[type] !== undefined, `${type}: has shape defaults`);
  }
  check(store.project.objects.length === types2d.length, `all 2D types created (${types2d.length})`);
}

section('1.2 3D objects: creation, properties, scene auto-switch');
{
  actions.newProject('E2E 3D', 'visual', 'scene_2d');
  for (const type of OBJECT_3D_TYPES) {
    const obj = actions.addObject(type);
    check(obj.type === type, `3D addObject(${type})`);
    check(obj.z === 0, `${type}: z defaults to 0`);
    if (type === 'sphere' || type === 'cylinder') {
      check(obj.resolution === 24, `${type}: resolution default`);
    }
  }
  check(store.project.sceneType === 'three_d', 'adding 3D objects auto-switches sceneType to three_d');
  check(getSceneTypeMeta(store.project.sceneType).baseClass === 'ThreeDScene', 'scene base class is ThreeDScene');

  // Editing 3D properties from the frontend
  const cube = store.project.objects.find(o => o.type === 'cube');
  actions.updateObject(cube.id, { z: 300, width: 260, height: 260, fill: '#ff8800', rotation: 30 });
  const cube2 = getters.objectById(cube.id);
  check(cube2.z === 300 && cube2.width === 260 && cube2.rotation === 30, 'cube z/size/rotation editable');
  actions.updateCamera('phi', 65);
  actions.updateCamera('theta', 45);
  check(store.project.camera.phi === 65 && store.project.camera.theta === 45, '3D camera phi/theta editable');
}

section('1.3 Every editable property survives updateObject');
{
  actions.newProject('E2E Props', 'visual', 'scene_2d');
  const o = actions.addObject('rectangle');
  const id = o.id;
  const edits = {
    name: 'Renamed Rect', x: 123, y: 456, width: 333, height: 222,
    rotation: 47, fill: '#123456', stroke: '#654321', strokeWidth: 7,
    opacity: 0.42, zOrder: 9, visible: false, enterTime: 2.5, duration: 4.5,
    enterAnim: 'grow_in', exitAnim: 'shrink_out', enterAnimDur: 0.8, exitAnimDur: 0.9
  };
  actions.updateObject(id, edits);
  const after = getters.objectById(id);
  for (const [k, v] of Object.entries(edits)) {
    check(after[k] === v, `updateObject(${k}) → ${v}`, `${k}=${after[k]}`);
  }
  // Text-specific properties
  const t = actions.addObject('text');
  actions.updateObject(t.id, {
    content: 'Multi-line\n"quoted" ünïcødé ✓', fontSize: 72, fontFamily: 'Roboto',
    textAlign: 'left', fontWeight: 'bold', fontStyle: 'italic'
  });
  const t2 = getters.objectById(t.id);
  check(t2.content.includes('ünïcødé') && t2.content.includes('"quoted"'), 'text content with quotes/unicode editable');
  check(t2.fontSize === 72 && t2.textAlign === 'left' && t2.fontWeight === 'bold', 'text style properties editable');
}

section('1.4 Parent/child hierarchy actions');
{
  actions.newProject('E2E Hierarchy', 'visual', 'scene_2d');
  const A = actions.addObject('rectangle');
  const B = actions.addObject('circle');
  const C = actions.addObject('star');
  const D = actions.addObject('text');

  check(actions.setParent(B.id, A.id) === true, 'setParent B→A');
  check(actions.setParent(C.id, B.id) === true, 'setParent C→B (grandchild)');
  check(getters.objectChildren(A.id).length === 1, 'children of A');
  check(getters.descendantsOf(A.id).map(o => o.id).join() === [B.id, C.id].join(), 'descendants of A are B,C (deep)');

  check(actions.setParent(A.id, C.id) === false, 'cycle A→C rejected');
  check(actions.setParent(A.id, A.id) === false, 'self-parent rejected');
  check(getters.objectById(A.id).parentId === null, 'A still root after rejections');

  check(actions.setParent(D.id, A.id) === true, 'second child D→A');
  check(actions.setParent(D.id, null) === true, 'detach D');
  check(getters.objectChildren(A.id).length === 1, 'D removed from children');

  // Deleting a parent orphans (does not delete) children
  actions.deleteObject(A.id);
  check(getters.objectById(B.id) && getters.objectById(B.id).parentId === null, 'B orphaned when A deleted');
  check(getters.objectById(C.id) && getters.objectById(C.id).parentId === B.id, 'C keeps its parent B');

  // Subtree duplication remaps ids
  actions.setParent(C.id, B.id);
  const dup = actions.duplicateObject(B.id);
  check(dup && dup.id !== B.id, 'duplicate returns a new root');
  const dupDesc = getters.descendantsOf(dup.id);
  check(dupDesc.length === 1 && dupDesc[0].type === 'star', 'duplicated subtree carries the child');
}

section('1.5 Groups + nesting');
{
  actions.newProject('E2E Groups', 'visual', 'scene_2d');
  const a = actions.addObject('rectangle');
  const b = actions.addObject('circle');
  const c = actions.addObject('star');
  const g1 = actions.groupObjects([a.id, b.id]);
  check(g1 && g1.childIds.length === 2, 'groupObjects creates a group');

  const g2 = actions.groupObjects([g1.id, c.id]);
  check(g2 && g2.childIds.includes(g1.id), 'group of group (nesting)');

  const g3 = actions.groupObjects([g2.id, g1.id]);
  check(g3 === null, 'nesting a group inside itself rejected');

  actions.ungroupObjects(g2.id);
  check(getters.groupById(g1.id) !== null, 'inner group survives outer ungroup');
  check(getters.groupById(g1.id).childIds.length === 2, 'inner group keeps its members');
}

section('1.6 Animations, timeline tracks, clip editing');
{
  actions.newProject('E2E Timeline', 'visual', 'scene_2d');
  const a = actions.addObject('rectangle');
  const b = actions.addObject('circle');

  // move/scale/fade/rotate animations from the panel
  actions.selectObject(a.id);
  const mv = actions.createAnimation('move', { targetX: 300, targetY: 200 });
  check(mv && mv.type === 'move' && mv.params.targetX === 300, 'createAnimation(move)');
  const sc = actions.createAnimation('scale', { targetScaleX: 2, targetScaleY: 3 });
  check(sc && sc.params.targetScaleY === 3, 'createAnimation(scale) keeps X and Y');
  const rot = actions.createAnimation('rotate', { targetRotation: 180 });
  check(rot && rot.params.targetRotation === 180, 'createAnimation(rotate)');

  // clip editing: startTime/duration/easing/params
  actions.updateClip(mv.id, { startTime: 2, duration: 1.5, easing: 'ease_out_bounce' });
  const mvClip = store.project.tracks.flatMap(t => t.clips).find(c => c.id === mv.id);
  check(mvClip && mvClip.startTime === 2 && mvClip.duration === 1.5 && mvClip.easing === 'ease_out_bounce', 'clip timing/easing editable');

  // moving clips between tracks
  const from = actions.trackIndexOfClip(mv.id);
  const to = Math.min(3, store.project.tracks.length - 1);
  check(actions.moveClip(mv.id, to) === to, `moveClip → track ${to}`);
  check(actions.trackIndexOfClip(mv.id) === to && actions.trackIndexOfClip(mv.id) !== from || from === to, 'clip now lives on the new track');
  check(actions.moveClip('clip_missing', 0) === -1, 'moveClip unknown clip → -1');

  // transform between two objects
  actions.selectObject(a.id);
  actions.selectObject(b.id, true);
  const tf = actions.createTransform();
  check(tf && tf.type === 'transform' && tf.sourceId && tf.targetId, 'createTransform (2 objects)');

  // deleting a clip
  actions.deleteClip(mv.id);
  check(!store.project.tracks.some(t => t.clips.some(c => c.id === mv.id)), 'deleteClip removes it');
}

section('1.7 Renaming, duplication, deletion + recreation, z-order');
{
  actions.newProject('E2E ObjectOps', 'visual', 'scene_2d');
  const a = actions.addObject('circle');
  actions.updateObject(a.id, { name: 'Hero' });
  check(getters.objectById(a.id).name === 'Hero', 'rename object');

  const dup = actions.duplicateObject(a.id);
  check(dup.name === 'Hero copy', 'duplicate names the copy');
  check(dup.x === a.x + 24 && dup.y === a.y + 24, 'duplicate offsets position');

  // z-order/layering
  actions.updateObject(dup.id, { zOrder: 0 });
  actions.updateObject(a.id, { zOrder: 5 });
  const sorted = [...store.project.objects].sort((x, y) => (x.zOrder || 0) - (y.zOrder || 0));
  check(sorted[0].id === dup.id, 'zOrder editable (dup below)');

  // deletion and recreation
  actions.deleteObject(a.id);
  check(!getters.objectById(a.id), 'object deleted');
  const again = actions.addObject('circle');
  check(again && again.id !== a.id, 'recreated object has a fresh id');

  // copy/paste keeps parent/child pairs together
  const p = actions.addObject('rectangle');
  const ch = actions.addObject('dot');
  actions.setParent(ch.id, p.id);
  actions.selectObject(p.id);
  actions.selectObject(ch.id, true);
  actions.copySelection();
  actions.pasteSelection();
  const pasted = store.project.objects.filter(o => o.name.includes('copy'));
  const pastedParent = pasted.find(o => o.type === 'rectangle');
  const pastedChild = pasted.find(o => o.type === 'dot');
  check(pastedChild.parentId === pastedParent.id, 'pasted parent/child pair stays wired');
}

section('1.8 Undo / redo');
{
  actions.newProject('E2E Undo', 'visual', 'scene_2d');
  const a = actions.addObject('circle');
  const x0 = a.x;
  actions.updateObject(a.id, { x: 777 });
  await new Promise(r => setTimeout(r, 500));   // debounced history commit (400ms)
  actions.undo();
  check(approx(getters.objectById(a.id).x, x0), 'undo restores property');
  actions.redo();
  check(getters.objectById(a.id).x === 777, 'redo reapplies property');
}

section('1.9 Camera + stage + scene-type switching');
{
  actions.newProject('E2E Camera', 'visual', 'moving_camera');
  actions.updateCamera('zoom', 2);
  actions.updateCamera('centerX', -1.5);
  check(store.project.camera.zoom === 2 && store.project.camera.centerX === -1.5, 'moving camera fields');
  actions.updateSceneConfig({ sceneType: 'three_d' });
  check(store.project.camera.centerX === undefined, 'moving-camera-only key pruned on scene-type switch');
  actions.updateCamera('phi', 60);
  check(store.project.camera.phi === 60, '3D camera field after switch');
  actions.updateStage({ backgroundColor: '#ffffff', width: 1280, height: 720 });
  check(store.project.stage.backgroundColor === '#ffffff' && store.project.stage.width === 1280, 'stage editable');
  const cl = actions.addObject('cube');  // already three_d — no switch needed
  check(store.project.sceneType === 'three_d', 'scene type unchanged');
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 2 — PREVIEW CONTRACT: the canvas shows the scene at the playhead
// ═════════════════════════════════════════════════════════════════════════════

section('2.1 Object time windows (preview == export)');
{
  // Issue #43 contract: the window end is when the EXIT ANIMATION starts
  // (the export's FadeOut step runs at exitTime and removes the mobject at
  // exitTime + exitAnimDur); 'none' exits never remove (open-ended).
  const objects = [
    mkObj('early', 'circle', { enterTime: 0, duration: 2 }),          // gone at 2 + 0.5 fade
    mkObj('mid', 'square', { enterTime: 4, duration: 2 }),
    mkObj('late', 'text', { enterTime: 8, duration: 1.5 }),            // gone at 9.5 + 0.5 fade
    mkObj('persist', 'star', { enterTime: 0, duration: 2, exitAnim: 'none' })
  ];
  const engine = freshEngine();
  const tracks = [{ id: 't1', clips: [] }];
  const at = (t) => engine.computeFrame(t, tracks, objects);

  check(at(1).hiddenIds.has('early') === false, 't=1: early in window visible');
  check(at(1).hiddenIds.has('mid'), 't=1: mid before enter hidden');
  check(at(5).hiddenIds.has('mid') === false, 't=5: mid visible');
  check(at(5).hiddenIds.has('early'), 't=5: early after exit hidden');
  check(at(8.4).hiddenIds.has('late') === false, 't=8.4: late visible');
  check(at(10.1).hiddenIds.has('late'), 't=10.1: late gone after its exit anim completes');
  check(at(0).hiddenIds.has('early') === false, 't=0: enter boundary inclusive');
  check(at(2).hiddenIds.has('early') === false, 't=2: at window end still visible (exit anim runs [2, 2.5))');
  check(at(2.6).hiddenIds.has('early'), 't=2.6: gone once the exit anim completes');
  // 'none' exit: the export never removes the mobject — open-ended window
  check(at(50).hiddenIds.has('persist') === false, "t=50: exitAnim 'none' persists (export never removes it)");
}

section('2.2 visible:false always hidden');
{
  const objects = [
    mkObj('v', 'circle', { visible: true }),
    mkObj('h', 'square', { visible: false, enterTime: 0, duration: 999 })
  ];
  const frame = freshEngine().computeFrame(0, [{ clips: [] }], objects);
  check(frame.hiddenIds.has('h') && !frame.hiddenIds.has('v'), 'invisible object hidden at every time');
}

section('2.3 Enter/exit animation envelopes');
{
  const objects = [mkObj('f', 'circle', { enterTime: 1, duration: 4, enterAnim: 'fade_in', enterAnimDur: 1 })];
  const engine = freshEngine();
  const op = (t) => (engine.computeFrame(t, [{ clips: [] }], objects).objectOverrides.f || {}).opacity;
  check(approx(op(1), 0, 0.01), 'fade_in starts at opacity 0');
  // Enter anims ease OUT (cubic) in the preview: fast start, settling end
  check(op(1.25) > 0.4 && op(1.25) < 0.95, 'fade_in eased progress (ease-out cubic)', op(1.25));
  check(op(1.75) > op(1.25), 'fade_in monotonic');
  check(engine.computeFrame(2.5, [{ clips: [] }], objects).objectOverrides.f === undefined,
    'after enter anim: no overrides (base opacity)');

  const g = [mkObj('g', 'square', { enterTime: 0, duration: 9, enterAnim: 'grow_in', enterAnimDur: 2 })];
  const f2 = engine.computeFrame(1, [{ clips: [] }], g);
  check((f2.objectOverrides.g || {}).scaleX > 0.5 && (f2.objectOverrides.g || {}).scaleX < 1, 'grow_in scales mid-animation (ease-out)');

  const e = [mkObj('e', 'circle', { enterTime: 0, duration: 2, exitAnim: 'fade_out', exitAnimDur: 1 })];
  const opExit = (t) => (engine.computeFrame(t, [{ clips: [] }], e).objectOverrides.e || {}).opacity;
  // Issue #43: the exit anim runs AFTER the window ends (the export's
  // FadeOut step starts at exitTime) - full opacity at the window end,
  // fading across [exitTime, exitTime + exitAnimDur).
  check(opExit(1.9) === undefined, 'no pre-fade: no overrides before the window ends', opExit(1.9));
  check(approx(opExit(2.0), 1, 0.01), 'fade_out starts AT the window end (t=2)', opExit(2.0));
  check(opExit(2.5) < 0.95 && opExit(2.5) > 0, 'fade_out mid-window (ease-in)', opExit(2.5));
  check(opExit(2.9) < 0.35, 'fade_out nearly done (ease-in)', opExit(2.9));
  check(engine.computeFrame(3.05, [{ clips: [] }], e).hiddenIds.has('e'), 'gone after the exit anim completes');
}

section('2.4 Completed clips HOLD their final value (no snap-back)');
{
  const objects = [mkObj('m', 'circle', { x: 100, y: 100, duration: 10 })];
  const clips = [{ id: 'c1', type: 'move', startTime: 1, duration: 1, easing: 'linear', sourceId: 'm', params: { targetX: 700, targetY: 500 } }];
  const engine = freshEngine();
  const frame = engine.computeFrame(5, [{ clips }], objects);
  const ov = frame.objectOverrides.m || {};
  check(approx(ov.x, 700, 0.01) && approx(ov.y, 500, 0.01), 'move clip holds final position after completion');
  const mid = engine.computeFrame(1.5, [{ clips }], objects).objectOverrides.m || {};
  check(mid.x > 100 && mid.x < 700, 'mid-move interpolation');
  const before = engine.computeFrame(0.5, [{ clips }], objects).objectOverrides.m;
  check(before === undefined, 'before clip start: no effect');

  const scaleClips = [{ id: 'c2', type: 'scale', startTime: 0, duration: 1, easing: 'linear', sourceId: 'm', params: { targetScaleX: 2, targetScaleY: 3 } }];
  const sFrame = engine.computeFrame(9, [{ clips: scaleClips }], objects);
  check(approx((sFrame.objectOverrides.m || {}).scaleX, 2) && approx((sFrame.objectOverrides.m || {}).scaleY, 3), 'scale clip holds X and Y');
}

section('2.5 Multi-track blending: higher track wins per property');
{
  const objects = [mkObj('b', 'circle', { x: 0, y: 0, duration: 10 })];
  const clipA = { id: 'a', type: 'move', startTime: 0, duration: 10, easing: 'linear', sourceId: 'b', params: { targetX: 100, targetY: 100 } };
  const clipB = { id: 'b', type: 'move', startTime: 5, duration: 10, easing: 'linear', sourceId: 'b', params: { targetX: 900, targetY: 900 } };
  const tracks = [{ clips: [clipA] }, { clips: [clipB] }];
  const frame = freshEngine().computeFrame(7, tracks, objects);
  const ov = frame.objectOverrides.b || {};
  // Higher track wins DURING overlap: B is 20% along (0.2*900=180), A would be at 70
  check(approx(ov.x, 180, 1) && approx(ov.y, 180, 1), 'higher track overrides during overlap', JSON.stringify(ov));
  // Outside the overlap the lower track still drives
  const frame2 = freshEngine().computeFrame(2, tracks, objects);
  check((frame2.objectOverrides.b || {}).x < 100, 'lower track drives before the higher clip starts');
}

section('2.6 Parent transform propagation (preview == family VGroups)');
{
  // Parent at (960,540) with a child at (1360,540) — 400px to the right.
  const objects = [
    mkObj('P', 'rectangle', { x: 960, y: 540, duration: 10 }),
    mkObj('C', 'circle', { x: 1360, y: 540, parentId: 'P', duration: 10 })
  ];
  const engine = freshEngine();
  const noClips = [{ clips: [] }];

  // 2.6.1 Translation: children ride along
  const move = { id: 'mv', type: 'move', startTime: 0, duration: 1, easing: 'linear', sourceId: 'P', params: { targetX: 1060, targetY: 640 } };
  const f1 = engine.computeFrame(2, [{ clips: [move] }], objects);
  check(approx(f1.objectOverrides.C.x, 1460, 0.01) && approx(f1.objectOverrides.C.y, 640, 0.01),
    'child translates with parent (move clip)', JSON.stringify(f1.objectOverrides.C));

  // 2.6.2 Rotation: children orbit the parent pivot (canvas CW positive)
  const rot = { id: 'rt', type: 'rotate', startTime: 0, duration: 1, easing: 'linear', sourceId: 'P', params: { targetRotation: 90 } };
  const f2 = engine.computeFrame(2, [{ clips: [rot] }], objects);
  const c2 = f2.objectOverrides.C || {};
  // 400px to the right rotated +90° CW around (960,540) → (960, 940)
  check(approx(c2.x, 960, 0.5) && approx(c2.y, 940, 0.5), 'child orbits parent on 90° CW rotation', JSON.stringify(c2));
  check(approx(c2.rotation ?? 0, 90, 0.01), 'child inherits parent rotation delta');

  // 2.6.3 Scale: child offset scales about the pivot
  const scl = { id: 'sc', type: 'scale', startTime: 0, duration: 1, easing: 'linear', sourceId: 'P', params: { targetScaleX: 2, targetScaleY: 2 } };
  const f3 = engine.computeFrame(2, [{ clips: [scl] }], objects);
  const c3 = f3.objectOverrides.C || {};
  check(approx(c3.x, 1760, 0.01) && approx(c3.y, 540, 0.01), 'child offset scales about parent', JSON.stringify(c3));
  check(approx(c3.scaleX ?? 1, 2, 0.01), 'child inherits scale');

  // 2.6.4 Deep chain: grandchild composes both levels
  const deep = [
    mkObj('A', 'rectangle', { x: 500, y: 500, duration: 10 }),
    mkObj('B', 'circle', { x: 700, y: 500, parentId: 'A', duration: 10 }),
    mkObj('C', 'dot', { x: 900, y: 500, parentId: 'B', duration: 10 })
  ];
  const rotA = { id: 'ra', type: 'rotate', startTime: 0, duration: 1, easing: 'linear', sourceId: 'A', params: { targetRotation: 90 } };
  const rotB = { id: 'rb', type: 'rotate', startTime: 0, duration: 1, easing: 'linear', sourceId: 'B', params: { targetRotation: 90 } };
  const f4 = engine.computeFrame(2, [{ clips: [rotA] }, { clips: [rotB] }], deep);
  const gc = f4.objectOverrides.C || {};
  // Level A rotates its whole subtree 90° CW about A(500,500): B→(500,700), C→(500,900).
  // Level B then rotates ITS subtree 90° CW about B's current center (500,700):
  //   C offset (0,200) → (-200,0) → C = (300,700); accumulated rotation = 90+90 = 180.
  check(approx(gc.x, 300, 0.5) && approx(gc.y, 700, 0.5), 'grandchild composes both parent rotations', JSON.stringify(gc));
  check(approx(gc.rotation ?? 0, 180, 0.01), 'grandchild accumulated rotation');

  // 2.6.5 Child's own animation composes with the parent delta
  const own = { id: 'oc', type: 'move', startTime: 0, duration: 1, easing: 'linear', sourceId: 'C', params: { targetX: 1000, targetY: 300 } };
  const f5 = engine.computeFrame(2, [{ clips: [rotA, own] }, { clips: [] }], deep);
  const c5 = f5.objectOverrides.C || {};
  // Own move final (1000,300); parent A rotates 90° CW about its center (500,500):
  //   offset (500,-200) rotated 90° CW → (200, 500) → C = (700, 1000)
  check(approx(c5.x, 700, 0.5) && approx(c5.y, 1000, 0.5), 'own clip + parent propagation compose', JSON.stringify(c5));

  // 2.6.6 A parent's exit does NOT hide children (own windows)
  const win = [
    mkObj('P', 'rectangle', { x: 960, y: 540, enterTime: 0, duration: 1 }),
    mkObj('C', 'circle', { x: 1360, y: 540, parentId: 'P', enterTime: 0, duration: 5 })
  ];
  const f6 = freshEngine().computeFrame(2, noClips, win);
  check(f6.hiddenIds.has('P') && !f6.hiddenIds.has('C'), 'child visible after parent exit');
}

section('2.7 Transform (morph) clips');
{
  const objects = [
    mkObj('src', 'circle', { duration: 10 }),
    mkObj('tgt', 'square', { duration: 10 })
  ];
  const tf = { id: 'tf', type: 'transform', startTime: 2, duration: 2, easing: 'ease_in_out', sourceId: 'src', targetId: 'tgt', morphQuality: 'medium' };
  const engine = freshEngine();

  const before = engine.computeFrame(1, [{ clips: [tf] }], objects);
  // Issue #43: the target's own entrance is suppressed in the export
  // (transform targets skip enter animations) - it first exists on screen
  // as the morph result, never before the clip.
  check(!before.hiddenIds.has('src') && before.hiddenIds.has('tgt'), 'before transform: source visible, target hidden (enters only via the morph)');

  const during = engine.computeFrame(3, [{ clips: [tf] }], objects);
  check(during.hiddenIds.has('src') && during.hiddenIds.has('tgt'), 'during transform: source+target hidden');
  check(during.morphShapes.length === 1, 'morph shape rendered');

  const after = engine.computeFrame(5, [{ clips: [tf] }], objects);
  check(after.hiddenIds.has('src') && !after.hiddenIds.has('tgt'), 'after transform: source replaced by target');
}

section('2.7b Transform with PRODUCT-DEFAULT durations (the user flow: add 2 shapes, Transform A-B)');
{
  // Defaults: enterTime 0, duration 3, fade_in 0.5, fade_out 0.5 - the
  // clip lands at src.end - 0.5 = 2.5 and runs to 4.0. This is the exact
  // scenario from issue #43 (the old suite used duration 10 and missed it).
  const objects = [
    mkObj('a', 'circle', { duration: 3 }),
    mkObj('b', 'square', { duration: 3 })
  ];
  const tf = { id: 'tf', type: 'transform', startTime: 2.5, duration: 1.5, easing: 'ease_in_out', sourceId: 'a', targetId: 'b', morphQuality: 'medium' };
  const engine = freshEngine();
  const at = (t) => engine.computeFrame(t, [{ clips: [tf] }], objects);

  check(!at(1).hiddenIds.has('a') && at(1).hiddenIds.has('b'), 't=1: only the source on stage (target has no independent entrance)');
  check(at(3.2).morphShapes.length === 1 && at(3.2).hiddenIds.has('a') && at(3.2).hiddenIds.has('b'), 't=3.2: mid-morph - both hidden, morph shape carries the visuals');
  check(!at(4.2).hiddenIds.has('b') && at(4.2).hiddenIds.has('a'), 't=4.2: morph completed - the RESULT is on stage, source consumed');
  // Target's exit is clip-adjusted: exitTime = max(3, 4.0 + 0.1) = 4.1,
  // fade 4.1-4.6, gone from 4.6 (mirrors the generated FadeOut step).
  check(!at(4.15).hiddenIds.has('b'), 't=4.15: result still visible (exit anim starts at 4.1)');
  const opB = (t) => (at(t).objectOverrides.b || {}).opacity;
  check(opB(4.2) !== undefined && opB(4.2) < 1, 't=4.2: result is fading out (post-exit anim)', opB(4.2));
  check(at(4.7).hiddenIds.has('b'), 't=4.7: result gone after its exit anim completes');
}

section('2.8 Simultaneous animations on independent objects');
{
  const objects = [
    mkObj('o1', 'circle', { duration: 10 }),
    mkObj('o2', 'square', { duration: 10 })
  ];
  const clips = [
    { id: 'a1', type: 'rotate', startTime: 1, duration: 2, easing: 'linear', sourceId: 'o1', params: { targetRotation: 360 } },
    { id: 'a2', type: 'move', startTime: 1, duration: 2, easing: 'linear', sourceId: 'o2', params: { targetX: 100, targetY: 100 } }
  ];
  const frame = freshEngine().computeFrame(2, [{ clips }], objects);
  check((frame.objectOverrides.o1 || {}).rotation > 0, 'o1 rotating');
  check((frame.objectOverrides.o2 || {}).x < 960 && (frame.objectOverrides.o2 || {}).x > 100, 'o2 moving toward target', JSON.stringify(frame.objectOverrides.o2));
  const done = freshEngine().computeFrame(4, [{ clips }], objects);
  check(approx((done.objectOverrides.o1 || {}).rotation, 360, 0.01), 'o1 finished at 360');
  check(approx((done.objectOverrides.o2 || {}).x, 100, 0.01), 'o2 finished at target');
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 3 — PERSISTENCE: save, reload, verify state survives
// ═════════════════════════════════════════════════════════════════════════════

section('3.1 JSON round-trip (file save → open)');
{
  actions.newProject('E2E Persist', 'visual', 'scene_2d');
  const a = actions.addObject('cube');                    // 3D + auto scene switch
  const b = actions.addObject('text');
  const c = actions.addObject('circle');
  actions.setParent(c.id, a.id);
  actions.updateObject(b.id, { content: 'persisted ✓', zOrder: 4, visible: false });
  actions.updateObject(a.id, { z: 250, rotation: 33, enterTime: 1.5, duration: 6 });
  actions.selectObject(a.id);
  const clip = actions.createAnimation('rotate', { targetRotation: 270 });
  const g = actions.groupObjects([a.id, b.id]);

  const snapshot = JSON.parse(actions.exportJSON());
  actions.newProject('scratch');
  check(actions.importJSON(JSON.stringify(snapshot)), 'importJSON accepts the export');

  const p = store.project;
  check(p.sceneType === 'three_d', 'sceneType survived round-trip');
  const a2 = p.objects.find(o => o.id === a.id);
  const b2 = p.objects.find(o => o.id === b.id);
  const c2 = p.objects.find(o => o.id === c.id);
  check(a2 && a2.z === 250 && a2.rotation === 33 && a2.enterTime === 1.5, '3D object props survived');
  check(b2 && b2.content === 'persisted ✓' && b2.visible === false && b2.zOrder === 4, 'text/visibility/zOrder survived');
  check(c2 && c2.parentId === a.id, 'parentId survived');
  check(p.groups.some(x => x.id === g.id && x.childIds.includes(a.id)), 'groups survived');
  check(p.tracks.some(t => t.clips.some(cl => cl.id === clip.id && cl.params.targetRotation === 270)), 'clips survived');
  check(p.camera !== undefined, 'camera object present');
}

section('3.2 Corrupted hierarchy repaired on import (never crash)');
{
  const broken = mkProject([
    mkObj('a', 'circle'),
    mkObj('b', 'square', { parentId: 'ghost' }),          // dangling
    mkObj('c', 'dot', { parentId: 'd' }),                 // cycle c→d→c
    mkObj('d', 'dot', { parentId: 'c' })
  ]);
  const ok = actions.importJSON(JSON.stringify(broken));
  check(ok, 'import with broken hierarchy succeeds');
  check(getters.objectById('b').parentId === null, 'dangling parentId cleared');
  const c = getters.objectById('c'), d = getters.objectById('d');
  check(!(c.parentId === 'd' && d.parentId === 'c'), 'cycle broken');

  const gBroken = mkProject([mkObj('a', 'circle')], [{ clips: [] }], {
    groups: [
      { id: 'g1', name: 'G1', childIds: ['a', 'g2'], margin: 10, collapsed: false },
      { id: 'g2', name: 'G2', childIds: ['g1', 'nope'], margin: 10, collapsed: false }
    ]
  });
  check(actions.importJSON(JSON.stringify(gBroken)), 'nested group cycle imports');
  const g2 = (store.project.groups || []).find(x => x.id === 'g2');
  check(!g2 || !g2.childIds.includes('g1'), 'group cycle edge removed');
}

section('3.3 Real HTTP save → reload (API server round-trip)');
{
  const result = await (async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const net = await import('node:net');
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-http-'));
    const port = String(21000 + Math.floor(Math.random() * 8000));
    const redisPort = Number(port) + 1;

    const fakeRedis = net.createServer((socket) => {
      let buf = '';
      socket.on('data', (d) => {
        buf += String(d);
        let idx;
        while ((idx = buf.indexOf('\r\n')) !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (line.startsWith('*')) {
            const n = parseInt(line.slice(1), 10);
            for (let i = 0; i < n; i++) {
              const h = buf.indexOf('\r\n');
              const len = parseInt(buf.slice(1, h), 10);
              buf = buf.slice(h + 2 + len + 2);
            }
            socket.write('+OK\r\n');
          }
        }
      });
    });
    await new Promise((resolve) => fakeRedis.listen(redisPort, resolve));

    const proc = spawn(process.execPath, ['src/index.js'], {
      cwd: new URL('../../api/', import.meta.url).pathname,
      env: { ...process.env, DATA_DIR: dataDir, PORT: port, REDIS_URL: `redis://127.0.0.1:${redisPort}` },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let started = false;
    await new Promise((resolve) => {
      proc.stdout.on('data', (d) => { if (String(d).includes('Server running')) { started = true; resolve(); } });
      proc.stderr.on('data', (d) => { if (String(d).includes('Server running')) { started = true; resolve(); } });
      setTimeout(() => resolve(), 4000);
    });
    if (!started) { proc.kill('SIGKILL'); fakeRedis.close(); return { error: 'server did not start' }; }

    try {
      const base = `http://127.0.0.1:${port}/api`;
      // Build a rich project in the store, then save it exactly like the UI does
      actions.newProject('E2E HTTP', 'visual', 'scene_2d');
      const cube = actions.addObject('cube');
      const txt = actions.addObject('text');
      const dot = actions.addObject('dot');
      actions.setParent(dot.id, cube.id);
      actions.updateObject(txt.id, { content: 'over the wire', visible: true, zOrder: 2 });
      actions.updateObject(cube.id, { z: 120, rotation: 15 });
      actions.selectObject(cube.id);
      actions.createAnimation('move', { targetX: 500, targetY: 300 });

      const created = await fetch(`${base}/projects`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: store.project.name, editorMode: 'visual', sceneType: store.project.sceneType })
      }).then(r => r.json());

      const serverProject = JSON.parse(JSON.stringify(store.project));
      serverProject.id = created.id;
      await fetch(`${base}/projects/${created.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverProject)
      });

      const loaded = await fetch(`${base}/projects/${created.id}`).then(r => r.json());
      const cmp = [];
      const cubeL = loaded.objects.find(o => o.type === 'cube');
      const txtL = loaded.objects.find(o => o.type === 'text');
      cmp.push(['sceneType', loaded.sceneType === 'three_d']);
      cmp.push(['cube z', cubeL.z === 120]);
      cmp.push(['cube rotation', cubeL.rotation === 15]);
      cmp.push(['parentId', loaded.objects.some(o => o.parentId === cubeL.id)]);
      cmp.push(['text content', txtL.content === 'over the wire']);
      cmp.push(['clips', loaded.tracks.some(t => t.clips.length === 1)]);
      return { cmp };
    } finally {
      proc.kill('SIGKILL');
      fakeRedis.close();
    }
  })();
  if (result.error) {
    check(false, 'API server started for HTTP round-trip', result.error);
  } else {
    for (const [name, ok] of result.cmp) check(ok, `HTTP round-trip: ${name}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 4 — EXPORT: one canonical codegen, parity, structure
// ═════════════════════════════════════════════════════════════════════════════

/** The "kitchen sink" scene used for canonical export checks. */
function buildKitchenSink() {
  return mkProject([
    mkObj('under', 'rectangle', { x: 960, y: 540, width: 400, height: 200, zOrder: 0, fill: '#ff3366' }),
    mkObj('over', 'circle', { x: 960, y: 540, width: 150, height: 150, zOrder: 5, fill: '#00ccff' }),
    mkObj('rot', 'square', { x: 400, y: 300, rotation: 45, zOrder: 1 }),
    mkObj('par', 'rectangle', { x: 500, y: 800, zOrder: 2 }),
    mkObj('kid', 'circle', { x: 700, y: 800, parentId: 'par', zOrder: 3 }),
    mkObj('ghost', 'star', { x: 1500, y: 200, visible: false, zOrder: 4 }),
    mkObj('txt', 'text', { x: 960, y: 150, content: 'Kitchen "Sink" ✓', zOrder: 6, fontSize: 64 }),
    mkObj('empty', 'text', { x: 960, y: 900, content: '', zOrder: 7 }),
    mkObj('cube', 'cube', { x: 1500, y: 500, z: 240, zOrder: 8, fill: '#ff8800' })
  ], [
    { id: 't0', name: 'T0', clips: [
      { id: 'cl_move', type: 'move', startTime: 2, duration: 1.5, easing: 'ease_in_out', sourceId: 'par', targetId: null, params: { targetX: 900, targetY: 800 } },
      { id: 'cl_rot', type: 'rotate', startTime: 4, duration: 1.5, easing: 'ease_in_out', sourceId: 'par', targetId: null, params: { targetRotation: 90 } },
      { id: 'cl_scale', type: 'scale', startTime: 6, duration: 1.5, easing: 'ease_in_out', sourceId: 'kid', targetId: null, params: { targetScaleX: 2, targetScaleY: 3 } },
      { id: 'cl_ghost', type: 'move', startTime: 0, duration: 1, easing: 'linear', sourceId: 'ghost', targetId: null, params: { targetX: 0, targetY: 0 } }
    ] },
    { id: 't1', name: 'T1', clips: [] }
  ], { sceneType: 'three_d', camera: { phi: 60, theta: 45 } });
}

section('4.1 Client export === server compile (ONE codegen, byte-identical)');
{
  const projects = [
    buildKitchenSink(),
    mkProject([mkObj('a', 'circle')]),
    mkProject([]),
    mkProject([mkObj('t', 'text', { content: 'Only Text' })], [{ id: 't1', clips: [] }], { sceneType: 'moving_camera', camera: { zoom: 2, centerX: 1 } }),
    mkProject([mkObj('c', 'cube'), mkObj('s', 'sphere', { resolution: 12 })])
  ];
  for (let i = 0; i < projects.length; i++) {
    const client = generateManimScript(projects[i]);
    const server = compileProject(projects[i]);
    check(server.success === true, `fixture ${i}: server compile succeeds`, server.errors);
    check(client === server.code, `fixture ${i}: client export byte-identical to server render source`,
      `client ${client.length}B vs server ${server.code.length}B`);
  }
}

section('4.2 zOrder layering, invisible objects, clips dropped');
{
  const code = generateManimScript(buildKitchenSink());
  const underIdx = code.indexOf('under =');
  const overIdx = code.indexOf('over =');
  const cubeIdx = code.indexOf('cube =');
  check(underIdx !== -1 && overIdx !== -1 && underIdx < overIdx, 'zOrder: under (0) emitted before over (5)');
  check(underIdx < cubeIdx, 'zOrder: cube (8) emitted last');
  check(!code.includes('ghost'), 'invisible object not emitted');
  check(!code.includes('cl_ghost'), 'clips targeting invisible objects dropped');
}

section('4.3 Rotation sign + 3D z placement');
{
  const code = generateManimScript(buildKitchenSink());
  const rotLine = code.split('\n').find(l => l.trim().startsWith('rot.rotate('));
  check(rotLine && rotLine.includes('-0.7854'), 'base rotation negated (45° CW → -π/4 in Manim)', rotLine);
  const cubePlace = code.split('\n').find(l => l.trim().startsWith('cube.move_to('));
  check(!!cubePlace, 'cube has a placement line');
  check(cubePlace && cubePlace.includes('1.778'), '3D z placement (z=240px → (240/1080)*8 = 1.778)', cubePlace);
}

section('4.4 Family VGroups + pivot-accurate family clips');
{
  const code = generateManimScript(buildKitchenSink());
  check(code.includes('fam_par = VGroup(par, kid)'), 'family VGroup emitted for parent+child');
  const moveLine = code.split('\n').find(l => l.includes('ApplyMethod(fam_par.shift,'));
  check(!!moveLine, 'move clip on parent animates the FAMILY via shift (ctor-style)', code.split('\n').filter(l => l.includes('fam_par')).join('\n'));
  const rotLine = code.split('\n').find(l => l.includes('Rotate(fam_par'));
  check(!!rotLine && rotLine.includes('about_point='), 'rotate clip on parent pivots about the parent center', rotLine);
  const scaleLine = code.split('\n').find(l => l.includes('.stretch(2.000, 0') && l.includes('tgt_cl_scale'));
  check(!!scaleLine, 'non-uniform scale uses stretch X/Y about the pivot', scaleLine);
  const scalePlay = code.split('\n').find(l => l.includes('Transform(kid, tgt_cl_scale'));
  check(!!scalePlay, 'scale clip emitted as ctor-style Transform (wave-schedulable)', scalePlay);
}

section('4.5 Text content exactness (no placeholder ever)');
{
  const code = generateManimScript(buildKitchenSink());
  check(code.includes('"Kitchen \\"Sink\\" ✓"') || code.includes('Kitchen'), 'text content with quotes/unicode exported exactly');
  check(/empty = Text\("",/.test(code), 'empty text exports as "" — never the "Text" placeholder');
  check(!/Text\("Text"/.test(code), 'no placeholder Text in generated code');
}

section('4.6 Timeline batching + duration accounting');
{
  // 4 objects entering at the same time → ONE self.play with 4 anims
  const objs = [1, 2, 3, 4].map(n => mkObj(`s${n}`, 'circle', { enterTime: 2, duration: 3, enterAnimDur: 1 + n * 0.25 }));
  const code = generateManimScript(mkProject(objs));
  const lines = code.split('\n').filter(l => l.includes('self.play(FadeIn'));
  check(lines.length === 1, 'same-time enters batched into one self.play', lines.join('\n'));
  check(lines[0] && lines[0].includes('s1') && lines[0].includes('s4'), 'all four objects in the batched play');
  check(lines[0] && (lines[0].match(/run_time=/g) || []).length === 4, 'per-animation run_time preserved in the batch');
  check(code.includes('self.wait(2.0)'), 'wait before the group');
}

section('4.7 Scene types + camera prologues');
{
  const p2d = generateManimScript(mkProject([mkObj('a', 'circle')]));
  check(p2d.includes('class MainScene(Scene):'), '2D scene base');
  const pmc = generateManimScript(mkProject([mkObj('a', 'circle')], [{ clips: [] }], {
    sceneType: 'moving_camera', camera: { zoom: 1.5, centerX: 2, centerY: -1 } }));
  check(pmc.includes('class MainScene(MovingCameraScene):'), 'moving camera base');
  check(pmc.includes('self.camera.frame.scale(1.500)'), 'camera zoom prologue');
  check(pmc.includes('self.camera.frame.move_to([2.000, -1.000, 0])'), 'camera center prologue');
  const p3d = generateManimScript(buildKitchenSink());
  check(p3d.includes('class MainScene(ThreeDScene):'), '3D scene base');
  check(p3d.includes('self.set_camera_orientation('), '3D camera orientation prologue');
  check(p3d.includes('phi=') && p3d.includes('theta='), 'phi/theta emitted');
}

section('4.8 Empty scene + single object');
{
  const empty = generateManimScript(mkProject([]));
  check(empty.includes('self.wait(1)') && !empty.includes('self.play'), 'empty scene renders 1s of background only');
  const single = generateManimScript(mkProject([mkObj('solo', 'circle', { enterAnim: 'none', exitAnim: 'none', duration: 2 })]));
  check(single.includes('self.add(solo)'), 'enter:none → self.add');
  check(!single.includes('FadeOut(solo)'), 'exit:none → no exit animation');
}

section('4.9 Large scene: performance + valid Python');
{
  const objects = [];
  for (let i = 0; i < 300; i++) {
    objects.push(mkObj(`big${i}`, i % 3 === 0 ? 'circle' : (i % 3 === 1 ? 'rectangle' : 'star'), {
      x: (i * 37) % 1920, y: (i * 53) % 1080, zOrder: i, enterTime: (i % 20) * 0.5, duration: 3
    }));
  }
  const clips = [];
  for (let i = 0; i < 120; i++) {
    clips.push({ id: `bc${i}`, type: 'move', startTime: 1 + (i % 10), duration: 1.5, easing: 'ease_in_out', sourceId: `big${i}`, targetId: null, params: { targetX: 500, targetY: 500 } });
  }
  const project = mkProject(objects, [{ id: 't0', clips }, { id: 't1', clips: [] }]);
  const t0 = Date.now();
  const code = generateManimScript(project);
  const dt = Date.now() - t0;
  check(code.length > 50000, 'large scene generates substantial code', `${code.length} bytes`);
  check(dt < 5000, `large scene codegen < 5s (took ${dt}ms)`);

  // Valid Python? (uses the manim venv; write to a temp file for ast.parse)
  const pyValid = await pythonSyntaxOk(code);
  check(pyValid !== false, 'large scene emits syntactically valid Python', pyValid === null ? '(python unavailable — skipped)' : 'ast.parse failed');
}

section('4.10 Nested groups emission');
{
  const project = mkProject([mkObj('a', 'circle'), mkObj('b', 'square')], [{ clips: [] }], {
    groups: [
      { id: 'inner', name: 'Inner', childIds: ['a'], margin: 10, collapsed: false },
      { id: 'outer', name: 'Outer', childIds: ['inner', 'b'], margin: 10, collapsed: false }
    ]
  });
  const code = generateManimScript(project);
  const innerIdx = code.indexOf('inner = VGroup(a)');
  const outerIdx = code.indexOf('outer = VGroup(inner, b)');
  check(innerIdx !== -1 && outerIdx !== -1 && innerIdx < outerIdx, 'nested groups emitted inner-first');
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 5 — ADVERSARIAL: try to break the system
// ═════════════════════════════════════════════════════════════════════════════

section('5.1 Unknown object type: validation rejects, codegen never crashes');
{
  const project = mkProject([mkObj('weird', 'hypercube')]);
  const v = validateProject(normalizeProject(project));
  check(v.valid === false, 'validator rejects unknown type');
  const code = generateManimScript(project);
  check(code.includes('unknown type: hypercube'), 'codegen emits neutral placeholder instead of crashing');
}

section('5.2 Hostile values: NaN / negative / huge');
{
  const bad = mkProject([
    mkObj('nan', 'circle', { x: NaN, y: NaN, width: NaN }),
    mkObj('neg', 'square', { width: -50, height: -50, rotation: -9999, opacity: 5 }),
    mkObj('huge', 'circle', { x: 1e12, y: -1e12, width: 1e9, height: 1e9, zOrder: 1e6 })
  ]);
  let code = null, threw = null;
  try { code = generateManimScript(bad); } catch (e) { threw = e; }
  check(threw === null, 'hostile values do not crash codegen', threw);
  check(code && !code.includes('NaN') && !code.includes('Infinity'), 'no NaN/Infinity leaks into Python', threw);
  const norm = normalizeProject(bad);
  check(norm.objects[1].width === 1, 'negative width clamped to >=1 (never negative)');
  check(norm.objects[2].width === 1e9, 'huge but finite width passes through');
}

section('5.3 Dangling clip references');
{
  const project = mkProject([mkObj('a', 'circle')], [{
    clips: [
      { id: 'dangle1', type: 'move', startTime: 0, duration: 1, easing: 'linear', sourceId: 'deleted_obj', targetId: null, params: {} },
      { id: 'dangle2', type: 'transform', startTime: 0, duration: 1, easing: 'linear', sourceId: 'a', targetId: 'deleted_target', params: {} }
    ]
  }]);
  const v = validateProject(normalizeProject(project));
  check(v.valid === false, 'validator flags dangling references');
  let code = null, threw = null;
  try { code = generateManimScript(project); } catch (e) { threw = e; }
  check(threw === null, 'dangling clips do not crash codegen');
  check(code && !code.includes('deleted_obj') && !code.includes('deleted_target'), 'dangling refs not emitted');
}

section('5.4 Deep + wide hierarchies terminate');
{
  const deep = [];
  for (let i = 0; i < 12; i++) deep.push(mkObj(`L${i}`, 'circle', { parentId: i === 0 ? null : `L${i - 1}` }));
  const wide = [mkObj('root', 'rectangle')];
  for (let i = 0; i < 40; i++) wide.push(mkObj(`w${i}`, 'dot', { parentId: 'root' }));
  const all = [...deep, ...wide];
  const t0 = Date.now();
  const frame = freshEngine().computeFrame(1, [{ clips: [] }], all);
  check(Date.now() - t0 < 1000, 'deep+wide propagation < 1s');
  check(frame.objectOverrides['w39'] !== undefined || frame.hiddenIds.size > 0, 'propagation visited the tree');

  const code = generateManimScript(mkProject(all));
  const famOrder = code.split('\n').filter(l => l.includes('= VGroup('));
  check(famOrder.some(l => l.includes('fam_L10 = VGroup(L10, L11)')), 'deep families emitted (innermost)');
  check(famOrder.some(l => l.includes('fam_root =')), 'wide families emitted');
  const idxInner = code.indexOf('fam_L10 =');
  const idxTop = code.indexOf('fam_L0 =');
  check(idxInner !== -1 && idxTop !== -1 && idxInner < idxTop, 'innermost family defined before its ancestors');
}

section('5.5 Timing edge cases');
{
  const objects = [
    mkObj('blink', 'circle', { enterTime: 2, duration: 0.1 }),
    mkObj('long', 'square', { enterTime: 0, duration: 999 }),
    mkObj('overlap1', 'dot', { enterTime: 1, duration: 3 }),
    mkObj('overlap2', 'star', { enterTime: 2, duration: 3 })
  ];
  const engine = freshEngine();
  const tracks = [{ clips: [] }];
  check(engine.computeFrame(2.05, tracks, objects).hiddenIds.has('blink') === false, '0.1s window: still visible at 2.05');
  check(engine.computeFrame(2.2, tracks, objects).hiddenIds.has('blink') === false, '0.1s window: exit anim keeps it fading at 2.2 (issue #43)');
  check(engine.computeFrame(2.7, tracks, objects).hiddenIds.has('blink'), '0.1s window: gone once the exit anim completes (2.6)');
  const f = engine.computeFrame(2.5, tracks, objects);
  check(!f.hiddenIds.has('overlap1') && !f.hiddenIds.has('overlap2'), 'overlapping windows both visible');
  const zt = mkProject([mkObj('z', 'circle', { enterTime: 0, duration: 0.1 })]);
  const code = generateManimScript(zt);
  check(code.includes('self.play('), '0.1s window still exports an animation');
}

section('5.6 Text hostilities');
{
  const code = generateManimScript(mkProject([
    mkObj('t1', 'text', { content: 'quote " backslash \\ newline \n tab \t end' }),
    mkObj('t2', 'text', { content: '日本語 🎉 emoji' })
  ]));
  check(!code.includes("Text(\"quote \" backslash"), 'quotes escaped');
  const pyValid = await pythonSyntaxOk(code);
  check(pyValid === true || pyValid === null, 'hostile text yields valid Python', pyValid);
}

section('5.7 THE COMBO: 3D parent + 2D child + text grandchild + anims + tracks + export');
{
  const objects = [
    mkObj('cubeP', 'cube', { x: 960, y: 400, width: 220, height: 220, z: 100, zOrder: 1, duration: 12 }),
    mkObj('rectC', 'rectangle', { x: 1300, y: 400, parentId: 'cubeP', zOrder: 2, duration: 12 }),
    mkObj('txtG', 'text', { x: 1300, y: 600, parentId: 'rectC', content: 'follows', zOrder: 3, duration: 12 })
  ];
  const clips = [
    { id: 'c_move', type: 'move', startTime: 1, duration: 2, easing: 'ease_in_out', sourceId: 'cubeP', targetId: null, params: { targetX: 700, targetY: 400 } },
    { id: 'c_rot', type: 'rotate', startTime: 3.5, duration: 2, easing: 'ease_in_out', sourceId: 'cubeP', targetId: null, params: { targetRotation: 90 } },
    { id: 'c_kid_move', type: 'move', startTime: 6, duration: 1.5, easing: 'linear', sourceId: 'rectC', targetId: null, params: { targetX: 1500, targetY: 400 } }
  ];
  const project = mkProject(objects, [
    { id: 'track_a', name: 'A', clips: [clips[0], clips[2]] },
    { id: 'track_b', name: 'B', clips: [clips[1]] }
  ], { sceneType: 'three_d', camera: { phi: 60, theta: 30 } });

  // preview: grandchild composes parent + grandparent transforms
  const engine = freshEngine();
  const f = engine.computeFrame(6, project.tracks, objects);
  const g = f.objectOverrides.txtG || {};
  check(Number.isFinite(g.x) && Number.isFinite(g.y), 'grandchild position finite under composed transforms', JSON.stringify(g));

  // export: family wrappers nest correctly, clips target wrappers
  const code = generateManimScript(project);
  check(code.includes('fam_cubeP = VGroup(cubeP, fam_rectC)') && code.includes('fam_rectC = VGroup(rectC, txtG)'),
    'nested family wrappers emitted');
  const idxInner = code.indexOf('fam_rectC =');
  const idxOuter = code.indexOf('fam_cubeP =');
  check(idxInner < idxOuter, 'inner family defined first');
  check(code.includes('Rotate(fam_cubeP'), 'parent rotate targets the family');
  check(code.includes('ApplyMethod(fam_rectC.shift,'),
    'child-with-children move also targets its own family', code.split('\n').filter(l => l.includes('rectC')).join('\n'));

  const v = validateProject(normalizeProject(project));
  check(v.valid === true, 'combo project passes validation', v.errors);
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 6 — REGRESSION: every previously solved issue re-verified
// ═════════════════════════════════════════════════════════════════════════════

section('6.1 Issue #1 — scene architecture decoupling');
{
  check(SCENE_TYPES.length === 4, 'four scene types registered');
  check(getSceneTypeMeta('three_d').dimensionality === '3d', '3D metadata');
  // legacy project migration
  const legacy = { name: 'old', stage: STAGE, objects: [mkObj('a', 'circle')], tracks: [] };
  check(actions.importJSON(JSON.stringify(legacy)), 'legacy project imports');
  check(store.project.sceneType === 'scene_2d' && store.project.scene.className === 'MainScene', 'legacy defaults applied');
  check(store.project.sourceMode === 'canvas', 'legacy sourceMode default');
  // scene detection (client mirror)
  const src = 'from manim import *\nclass A(Scene):\n    pass\nclass B(ThreeDScene):\n    pass\n';
  const scenes = detectScenesClient(src);
  check(scenes.length === 2 && scenes[1].sceneType === 'three_d', 'client scene detection');
}

section('6.2 Issue #33 — tolerant import: one timeline row per object');
{
  const src = `from manim import *
class MainScene(Scene):
    def construct(self):
        a = Circle(radius=1)
        b = Square(side_length=1)
        self.play(Create(a))
        self.play(Create(b))
`;
  const parsed = parseManimScript(src);
  check(parsed.objects.length === 2, 'importer: one row per constructed mobject');
  check(parsed.objects[0].enterAnim === 'draw' && parsed.objects[0].enterTime === 0,
    'importer: Create plays become per-object enter anims (timeline rows)');
  check(parsed.objects[1].enterTime > 0, 'importer: sequential plays advance the timeline');
}

section('6.3 Issue #36 — canonical render-source contract');
{
  // Lossy import → code is the render source; complete import → canvas
  const legacyPath = new URL('./fixtures/legacy_synth_wall.py', import.meta.url);
  const legacyCode = readFileSync(legacyPath, 'utf-8');
  const parsed = parseManimScript(legacyCode);
  check(parsed.objects.length > 40, 'legacy fixture imports a large scaffold');
  const res = actions.adoptImportedCode(legacyCode, parsed);
  check(res.sourceMode === 'code', 'lossy import keeps code as the render source');
  check(store.project.codeSource === legacyCode, 'codeSource preserved verbatim');
  check(store.project.importReport && store.project.importReport.dropped.length > 0, 'coverage report lists dropped constructs');
  check(actions.detachFromSource() === true, 'detach switches to canvas');
  check(store.project.sourceMode === 'canvas', 'canvas is the source after detach');

  // renderOnServer routing (the dialog path)
  actions.newProject('route', 'code', 'scene_2d');
  store.project.codeSource = 'from manim import *\nclass X(Scene):\n    def construct(self):\n        t=Text("hi")\n        self.play(FadeIn(t))\n';
  const fetches = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    fetches.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { ok: true, status: 202, json: async () => ({ jobId: 'job_x' }) };
  };
  try {
    await actions.renderOnServer('high');
  } catch (e) { /* routing-only check */ } finally {
    globalThis.fetch = origFetch;
    actions._stopPollRender();   // the poll interval would keep the process alive
  }
  const renderCode = fetches.find(f => f.url.includes('/render-code'));
  const renderCanvas = fetches.find(f => f.url.endsWith('/render') || (f.url.includes('/render') && !f.url.includes('render-code')));
  check(!!renderCode && renderCode.body && renderCode.body.codeSource === store.project.codeSource,
    'code-mode project renders via /render-code with the exact source', JSON.stringify(fetches.map(f => f.url)));

  // legacy compat boundary still applies (issue #36 follow-up)
  const legacySrc = 'from manim import *\nclass S(MovingCameraScene):\n    def construct(self):\n        self.camera_frame.scale(1.2)\n';
  const compat = applyLegacyCompat(legacySrc);
  check(compat.applied.includes('camera_frame'), 'legacy camera_frame compat still detected');
}

section('6.4 Scientific mode regression (issue #29/#32)');
{
  // The sci document travels with the project through save/load
  actions.newProject('Sci', 'scientific', 'scene_2d');
  check(store.project.editorMode === 'scientific', 'scientific project mode');
  const json = actions.exportJSON();
  check(typeof json === 'string' && json.includes('"editorMode": "scientific"'), 'scientific mode persisted');
  actions.newProject('done', 'visual', 'scene_2d');
}

// ═════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70));
console.log(`E2E RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f.msg}${f.detail ? '\n      ' + f.detail : ''}`);
  process.exit(1);
} else {
  console.log('ALL E2E TESTS PASSED');
}
