/**
 * Project State Store — v3 + Groups + Text + Server sync
 *
 * Video-editor style data model with full API integration.
 * Objects live on the timeline with enter/exit times.
 * Clips are animations between or on objects.
 * Assets hold uploaded images/SVGs.
 * Groups are logical containers with margin/padding.
 *
 * Server actions: saveToServer, loadFromServer, renderOnServer, pollRenderJob
 */

import Vue from 'vue';
import api from '../api.js';
import { store as sciStore } from '../sci/store.js';
import { toDict as sciToDict } from '../sci/document.js';

/** Object types whose Manim mobject is 3D (kept in sync with the compiler
 *  object registry OBJECT_DIMENSIONALITY — E2E audit). */
export const OBJECT_3D_TYPES = ['cube', 'sphere', 'cone', 'cylinder'];

export function is3dObjectType(type) {
  return OBJECT_3D_TYPES.includes(type);
}

/** Carry the edited sci-ir/1 document into the project (issue #29). */
function syncSciDocument() {
  if (store.project.editorMode !== 'scientific') return null;
  store.project.sciDocument = sciToDict(sciStore.document);
  return store.project.sciDocument;
}

/** Document snapshot for the render-sci endpoint. */
function sciDocumentForRender() {
  return syncSciDocument();
}

const MAX_HISTORY = 50;

// ─── Defaults ────────────────────────────────────────────────────────────────

const CODE_MODE_TEMPLATE = `from manim import *

class MainScene(Scene):
    def construct(self):
        text = Text("Hello, Manim!")
        self.play(Write(text))
        self.wait()
`;

function createDefaultProject(editorMode = 'visual', sceneType = 'scene_2d') {
  return {
    id: null,
    name: 'My Animation',
    editorMode,          // 'visual' | 'code' | 'scientific' (#29)
    codeSource: editorMode === 'code' ? CODE_MODE_TEMPLATE : '',
    // Canonical render-source contract (issue #36):
    //   'canvas'     — the visual object/track model is the source of truth
    //   'code'      — project.codeSource (verbatim Python) is the source of
    //                  truth; the visual model is a non-destructive scaffold
    //   'scientific' is carried by editorMode (sciDocument renders via /render-sci)
    sourceMode: editorMode === 'code' ? 'code' : 'canvas',
    importReport: null,  // coverage summary of the last code import (issue #36)
    sciDocument: null,   // sci-ir/1 document when editorMode === 'scientific'
    sceneType,           // 'scene_2d' | 'moving_camera' | 'three_d' | 'custom' (Issue #1)
    scene: { className: 'MainScene' },   // generated class name / custom base
    camera: {},          // per-scene-type camera config (zoom, phi, theta, ...)
    stage: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      backgroundOpacity: 1,
      backgroundImage: null,
      gridVisible: true,
      gridSize: 8,
      gridColor: '#ffffff',
      gridOpacity: 0.12,
      snapEnabled: true,
      snapToGrid: true,
      snapToCenter: true,
      snapToObjects: false
    },
    assets: [],      // { id, name, type:'image'|'svg', dataUrl, width, height, filename, serverFilename }
    objects: [],
    groups: [],       // { id, name, childIds:[], margin:10, collapsed:false }
    tracks: [
      { id: 'track_1', name: 'Track 1', clips: [] }
    ],
    sceneDuration: 10
  };
}

// ─── Scene types (Issue #1 — mirrors the compiler scene registry) ───────────
// Kept in sync with services/api/src/compiler/registry/scenes.js and
// discoverable at runtime via GET /api/capabilities.

export const SCENE_TYPES = [
  { key: 'scene_2d',      label: '2D Scene',                 baseClass: 'Scene',              dimensionality: '2d',
    cameraFields: [] },
  { key: 'moving_camera', label: '2D — Moving Camera',       baseClass: 'MovingCameraScene',  dimensionality: '2d',
    cameraFields: ['zoom', 'centerX', 'centerY', 'frameWidth', 'frameHeight'] },
  { key: 'three_d',       label: '3D Scene',                 baseClass: 'ThreeDScene',        dimensionality: '3d',
    cameraFields: ['phi', 'theta', 'distance', 'zoom', 'gamma'] },
  { key: 'custom',        label: 'Custom Scene Class',       baseClass: null,                 dimensionality: '2d',
    cameraFields: [] }
];

export function getSceneTypeMeta(key) {
  return SCENE_TYPES.find(t => t.key === key) || SCENE_TYPES[0];
}

/**
 * In-place migration of older project JSON to the v3 schema (Issue #1).
 * Adds sceneType / scene / camera defaults when missing; keeps every
 * existing field untouched. Used by importJSON and loadFromServer.
 *
 * E2E audit additions: repairs broken parent/child graphs (dangling or
 * cyclic parentId references are dropped, never crash the editor) and
 * normalizes `visible`/`z` on objects that predate those properties.
 */
function migrateProjectSchema(project) {
  if (!project.sceneType) project.sceneType = 'scene_2d';
  if (!project.scene) project.scene = { className: 'MainScene' };
  if (!project.scene.className) project.scene.className = 'MainScene';
  if (!project.camera) project.camera = {};
  // Canonical render-source defaults (issue #36): older projects never had
  // a sourceMode; code-mode projects are code-sourced by definition.
  if (!project.sourceMode) {
    project.sourceMode = project.editorMode === 'code' ? 'code' : 'canvas';
  }
  if (project.importReport === undefined) project.importReport = null;
  // Drop camera keys the current scene type does not understand (prevents
  // e.g. 3D phi values leaking into a 2D moving-camera project)
  const meta = getSceneTypeMeta(project.sceneType);
  if (meta.key !== 'custom') {
    for (const k of Object.keys(project.camera)) {
      if (!meta.cameraFields.includes(k)) delete project.camera[k];
    }
  }
  sanitizeHierarchy(project);
  return project;
}

/** Repair a parent/child graph in place: dangling parentIds are cleared and
 *  cycles are broken (the deepest edge wins). Purely defensive — the editor
 *  actions never create these states, but imported/hand-edited JSON can. */
function sanitizeHierarchy(project) {
  if (!Array.isArray(project.objects)) return;
  const byId = new Map(project.objects.map(o => [o.id, o]));
  for (const obj of project.objects) {
    if (obj.visible === undefined) obj.visible = true;
    if (obj.parentId != null && !byId.has(obj.parentId)) {
      obj.parentId = null;                 // dangling reference
    }
  }
  // Cycle break: walk up from each object with a visited set; a repeat edge
  // means a cycle — cut it there.
  for (const obj of project.objects) {
    const seen = new Set();
    let cur = obj;
    while (cur && cur.parentId != null) {
      if (seen.has(cur.parentId)) { cur.parentId = null; break; }
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
      if (!cur) break;
    }
  }
  // Groups: drop childIds that reference neither an object nor a group;
  // break group nesting cycles the same way.
  if (Array.isArray(project.groups)) {
    const groupIds = new Set(project.groups.map(g => g.id));
    const objectIds = new Set(project.objects.map(o => o.id));
    for (const g of project.groups) {
      g.childIds = (g.childIds || []).filter(cid => objectIds.has(cid) || groupIds.has(cid));
    }
    for (const g of project.groups) {
      const seen = new Set();
      const stack = [g.id];
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        const grp = project.groups.find(x => x.id === id);
        if (!grp) continue;
        for (const cid of grp.childIds || []) {
          if (groupIds.has(cid)) {
            if (seen.has(cid)) {
              grp.childIds = grp.childIds.filter(x => x !== cid); // cycle edge
            } else {
              stack.push(cid);
            }
          }
        }
      }
    }
  }
}

// ─── Reactive Store ──────────────────────────────────────────────────────────

export const store = Vue.observable({
  project: createDefaultProject(),

  selectedObjectIds: [],
  selectedClipId: null,
  activeTool: 'select',

  // Bumped when a 3D object is created — App.vue switches to the 3D
  // viewport so editing continues where the object is manipulable (issue #42)
  view3dTick: 0,

  // Playback
  playbackTime: 0,
  playbackPlaying: false,
  playbackLoop: true,

  // Frame state from playback engine
  frameState: {
    objectOverrides: {},
    morphShapes: [],
    hiddenIds: new Set()
  },

  // Export dialog
  showExportDialog: false,
  exportCode: '',

  // Render
  showRenderDialog: false,
  renderJobId: null,
  renderStatus: null,    // null | 'uploading' | 'saving' | 'queued' | 'running' | 'completed' | 'failed'
  renderError: null,
  renderQuality: 'high',
  renderVideoUrl: null,
  renderLog: '',

  // Server project browser
  showProjectBrowser: false,
  serverProjects: [],

  // API connectivity
  apiAvailable: null,    // null = unknown, true/false

  // History (undo/redo)
  history: { past: [], future: [] },

  // Clipboard (copy/paste)
  clipboard: [],

  // UI
  isDirty: false,
  error: null,
  loading: false,
  savingToServer: false,

  // Theme ('light' or 'dark')
  theme: (typeof localStorage !== 'undefined' && localStorage.getItem('manim-motion-theme')) || 'light'
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _counter = 0;
function uid(prefix = 'id') {
  _counter++;
  return `${prefix}_${Date.now().toString(36)}_${_counter}`;
}

let _objectAddCount = 0;
function nextPosition(stageW, stageH) {
  const positions = [
    { x: stageW * 0.35, y: stageH * 0.5 },
    { x: stageW * 0.65, y: stageH * 0.5 },
    { x: stageW * 0.5,  y: stageH * 0.35 },
    { x: stageW * 0.5,  y: stageH * 0.65 },
    { x: stageW * 0.5,  y: stageH * 0.5 },
  ];
  const pos = positions[_objectAddCount % positions.length];
  _objectAddCount++;
  return pos;
}

let _pollTimer = null;

// ─── Entrance / Exit animation types ─────────────────────────────────────────

export const ENTER_ANIMS = [
  { value: 'none',           label: 'None',             icon: '—',  desc: 'Appears instantly' },
  { value: 'fade_in',        label: 'Fade In',          icon: '◐',  desc: 'Fade from transparent' },
  { value: 'grow_in',        label: 'Grow In',          icon: '⊕',  desc: 'Scale up from zero' },
  { value: 'fly_in_left',    label: 'Fly In Left',      icon: '→',  desc: 'Slide in from left' },
  { value: 'fly_in_right',   label: 'Fly In Right',     icon: '←',  desc: 'Slide in from right' },
  { value: 'fly_in_top',     label: 'Fly In Top',       icon: '↓',  desc: 'Slide in from top' },
  { value: 'fly_in_bottom',  label: 'Fly In Bottom',    icon: '↑',  desc: 'Slide in from bottom' },
  { value: 'draw',           label: 'Draw / Create',    icon: '✎',  desc: 'Outline draws, then fills' },
  { value: 'write',          label: 'Write',            icon: '✍',  desc: 'Write effect (text/shapes)' },
  { value: 'spin_in',        label: 'Spin In',          icon: '↻',  desc: 'Rotate in while fading' },
  { value: 'bounce_in',      label: 'Bounce In',        icon: '⤴',  desc: 'Bounce into place' },
];

export const EXIT_ANIMS = [
  { value: 'none',            label: 'None',             icon: '—',  desc: 'Disappears instantly' },
  { value: 'fade_out',        label: 'Fade Out',         icon: '◑',  desc: 'Fade to transparent' },
  { value: 'shrink_out',      label: 'Shrink Out',       icon: '⊖',  desc: 'Scale down to zero' },
  { value: 'fly_out_left',    label: 'Fly Out Left',     icon: '←',  desc: 'Slide out to left' },
  { value: 'fly_out_right',   label: 'Fly Out Right',    icon: '→',  desc: 'Slide out to right' },
  { value: 'fly_out_top',     label: 'Fly Out Top',      icon: '↑',  desc: 'Slide out to top' },
  { value: 'fly_out_bottom',  label: 'Fly Out Bottom',   icon: '↓',  desc: 'Slide out to bottom' },
  { value: 'uncreate',        label: 'Uncreate',         icon: '✎',  desc: 'Reverse draw' },
  { value: 'spin_out',        label: 'Spin Out',         icon: '↻',  desc: 'Rotate out while fading' },
];

// ─── Shape palette ───────────────────────────────────────────────────────────

export const SHAPE_DEFAULTS = {
  rectangle:{ width: 160, height: 100, fill: '#3b82f6', stroke: '#fff',  strokeWidth: 2 },
  square:   { width: 120, height: 120, fill: '#3b82f6', stroke: '#fff',  strokeWidth: 2 },
  circle:   { width: 120, height: 120, fill: '#22c55e', stroke: '#fff',  strokeWidth: 2 },
  ellipse:  { width: 160, height: 100, fill: '#06b6d4', stroke: '#fff',  strokeWidth: 2 },
  triangle: { width: 120, height: 120, fill: '#f59e0b', stroke: '#fff',  strokeWidth: 2 },
  star:     { width: 120, height: 120, fill: '#eab308', stroke: '#fff',  strokeWidth: 2 },
  polygon:  { width: 120, height: 120, fill: '#8b5cf6', stroke: '#fff',  strokeWidth: 2 },
  line:     { width: 200, height: 4,   fill: '#94a3b8', stroke: '#94a3b8', strokeWidth: 3 },
  arrow:    { width: 200, height: 40,  fill: '#ef4444', stroke: '#fff',  strokeWidth: 2 },
  heart:    { width: 120, height: 120, fill: '#ec4899', stroke: '#fff',  strokeWidth: 2 },
  dot:      { width: 20,  height: 20,  fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  dot_grid: { width: 200, height: 200, fill: '#a855f7', stroke: 'transparent', strokeWidth: 0 },
  text:     { width: 200, height: 50,  fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  image:    { width: 200, height: 200, fill: 'transparent', stroke: 'transparent', strokeWidth: 0 },
  svg_asset:{ width: 200, height: 200, fill: 'transparent', stroke: 'transparent', strokeWidth: 0 },
  latex:    { width: 200, height: 80,  fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
  axes:     { width: 400, height: 300, fill: '#ffffff', stroke: '#ffffff', strokeWidth: 2 },
  cube:     { width: 140, height: 140, fill: '#f97316', stroke: '#ffffff', strokeWidth: 2 },
  sphere:   { width: 160, height: 160, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 },
  cone:     { width: 140, height: 180, fill: '#a78bfa', stroke: '#ffffff', strokeWidth: 2 },
  cylinder: { width: 140, height: 180, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }
};

export const SHAPE_COLORS = {
  rectangle: '#3b82f6', square: '#3b82f6', circle: '#22c55e', ellipse: '#06b6d4',
  triangle: '#f59e0b', star: '#eab308', polygon: '#8b5cf6',
  line: '#94a3b8', arrow: '#ef4444',
  heart: '#ec4899', dot: '#94a3b8', dot_grid: '#a855f7',
  text: '#f472b6', image: '#f59e0b', svg_asset: '#f59e0b',
  latex: '#a855f7', axes: '#10b981',
  cube: '#f97316', sphere: '#38bdf8', cone: '#a78bfa', cylinder: '#34d399'
};

// ─── Getters ─────────────────────────────────────────────────────────────────

export const getters = {
  selectedObjects() {
    return store.selectedObjectIds.map(id => store.project.objects.find(o => o.id === id)).filter(Boolean);
  },
  selectedObject() {
    if (store.selectedObjectIds.length !== 1) return null;
    return store.project.objects.find(o => o.id === store.selectedObjectIds[0]) || null;
  },
  selectedClip() {
    if (!store.selectedClipId) return null;
    for (const track of store.project.tracks) {
      const clip = track.clips.find(c => c.id === store.selectedClipId);
      if (clip) return clip;
    }
    return null;
  },
  objectById(id) {
    return store.project.objects.find(o => o.id === id) || null;
  },
  assetById(id) {
    return store.project.assets.find(a => a.id === id) || null;
  },
  groupById(id) {
    return (store.project.groups || []).find(g => g.id === id) || null;
  },
  objectGroup(objId) {
    return (store.project.groups || []).find(g => g.childIds && g.childIds.includes(objId)) || null;
  },
  objectChildren(objId) {
    return store.project.objects.filter(o => o.parentId === objId);
  },
  objectRoots() {
    return store.project.objects.filter(o => !o.parentId);
  },
  /** All descendants of an object (deep), in stable document order. */
  descendantsOf(objId) {
    const out = [];
    const walk = (pid) => {
      for (const o of store.project.objects) {
        if (o.parentId === pid) { out.push(o); walk(o.id); }
      }
    };
    walk(objId);
    return out;
  },
  /** Whether making child→parent would create a cycle. */
  wouldCreateCycle(childId, parentId) {
    if (childId === parentId) return true;
    const objects = store.project.objects;
    let cur = objects.find(o => o.id === parentId);
    const seen = new Set();
    while (cur && cur.parentId != null && !seen.has(cur.id)) {
      if (cur.parentId === childId) return true;
      seen.add(cur.id);
      cur = objects.find(o => o.id === cur.parentId);
    }
    return false;
  },
  computedDuration() {
    let maxEnd = 5;
    for (const obj of store.project.objects) {
      const end = (obj.enterTime || 0) + (obj.duration || 5);
      if (end > maxEnd) maxEnd = end;
    }
    for (const track of store.project.tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }
    return Math.max(store.project.sceneDuration, maxEnd + 1);
  },
  visibleTracks() {
    const all = store.project.tracks;
    const activeCount = all.filter(t => t.clips.length > 0).length;
    const showCount = Math.min(5, Math.max(1, activeCount + 1));
    return all.slice(0, showCount);
  },
  objectsAtTime(time) {
    return store.project.objects.filter(o => {
      const enter = o.enterTime || 0;
      const exit = enter + (o.duration || 999);
      return time >= enter && time < exit;
    });
  }
};

// ─── Actions ─────────────────────────────────────────────────────────────────

export const actions = {
  // ══════════════════════════════════════════════════════════════════════════
  // Objects
  // ══════════════════════════════════════════════════════════════════════════

  addObject(type, x, y, extraProps = {}) {
    const stage = store.project.stage;
    const d = SHAPE_DEFAULTS[type] || SHAPE_DEFAULTS.circle;
    const pos = (x !== undefined && y !== undefined)
      ? { x, y }
      : nextPosition(stage.width, stage.height);

    const nameMap = {
      dot_grid: 'Dot Grid', svg_asset: 'SVG', rectangle: 'Rectangle',
      ellipse: 'Ellipse', triangle: 'Triangle', star: 'Star',
      polygon: 'Polygon', line: 'Line', arrow: 'Arrow', text: 'Text',
      latex: 'LaTeX', axes: 'Axes', cube: 'Cube', sphere: 'Sphere',
      cone: 'Cone', cylinder: 'Cylinder'
    };
    const displayName = nameMap[type] || (type.charAt(0).toUpperCase() + type.slice(1));

    const obj = {
      id: uid('obj'),
      type,
      name: `${displayName} ${store.project.objects.length + 1}`,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      width: d.width,
      height: d.height,
      rotation: 0,
      fill: d.fill,
      stroke: d.stroke,
      strokeWidth: d.strokeWidth,
      opacity: 1,
      zOrder: store.project.objects.length,
      visible: true,
      parentId: null,          // canonical parent/child hierarchy (E2E audit)
      // New objects enter AT THE PLAYHEAD (video-editor convention) so the
      // canvas — which renders the scene at the playhead time — shows what
      // you just added; stagger timing by dragging the timeline row.
      enterTime: Math.round((store.playbackTime || 0) * 10) / 10,
      duration: 3,
      enterAnim: 'fade_in',
      exitAnim: 'fade_out',
      enterAnimDur: 0.5,
      exitAnimDur: 0.5,
      ...(type === 'dot_grid' ? { gridCols: 5, gridRows: 5, dotRadius: 5, dotSpacing: 40 } : {}),
      ...(type === 'text' ? { content: 'Hello World', fontSize: 48, fontFamily: 'Roboto', textAlign: 'center', fontWeight: 'normal', fontStyle: 'normal' } : {}),
      ...(type === 'polygon' ? { sides: 6 } : {}),
      ...(type === 'star' ? { starArms: 5, innerRatio: 0.4 } : {}),
      ...(type === 'latex' ? { latex: 'E = mc^2' } : {}),
      ...(type === 'axes' ? { xRange: [-5, 5, 1], yRange: [-3, 3, 1] } : {}),
      ...(is3dObjectType(type) ? {
        z: 0,
        // Full 3-axis canonical orientation (issue #42): rotationX/Y rotate
        // CCW around +x/+y in the render frame; `rotation` = editor Z.
        // Cone/cylinder primitives point +z (toward the camera) in Manim —
        // default them upright so the vertical extent equals `height`.
        rotationX: (type === 'cone' || type === 'cylinder') ? -90 : 0,
        rotationY: 0,
        ...(type === 'cube' ? { depth: d.width } : {}),
        ...(type === 'sphere' || type === 'cylinder' ? { resolution: 24 } : {})
      } : {}),
      ...extraProps
    };

    // Adding a 3D object into a 2D scene switches the scene type so the
    // render uses the orbitable ThreeDScene camera (one canonical scene;
    // the user can switch back explicitly in the panel).
    if (is3dObjectType(type)) {
      if (store.project.sceneType === 'scene_2d') {
        actions.updateSceneConfig({ sceneType: 'three_d' });
      }
      // Auto-switch to the 3D viewport (App.vue watches the tick)
      store.view3dTick = (store.view3dTick || 0) + 1;
    }

    store.project.objects.push(obj);
    store.isDirty = true;
    actions.commitState();
    return obj;
  },

  addImageObject(assetId, x, y) {
    const asset = store.project.assets.find(a => a.id === assetId);
    if (!asset) return null;

    const type = asset.type === 'svg' ? 'svg_asset' : 'image';
    const aspectRatio = (asset.width && asset.height) ? asset.width / asset.height : 1;
    const height = 200;
    const width = Math.round(height * aspectRatio);

    return actions.addObject(type, x, y, {
      name: asset.name,
      assetId: asset.id,
      width,
      height,
      naturalWidth: asset.width || width,
      naturalHeight: asset.height || height
    });
  },

  /**
   * Write properties into a canonical object.
   * opts.commit (default true) records a history entry; the 3D gizmo
   * streams live values with commit:false during a drag and commits the
   * final state when the drag ends (issue #42).
   */
  updateObject(id, updates, opts = {}) {
    const obj = store.project.objects.find(o => o.id === id);
    if (!obj) return;
    for (const key of Object.keys(updates)) {
      Vue.set(obj, key, updates[key]);
    }
    store.isDirty = true;
    if (opts.commit === false) {
      actions._debouncedCommit();
    } else {
      actions.commitState();
    }
  },

  deleteObject(id) {
    const idx = store.project.objects.findIndex(o => o.id === id);
    if (idx === -1) return;
    store.project.objects.splice(idx, 1);
    const selIdx = store.selectedObjectIds.indexOf(id);
    if (selIdx !== -1) store.selectedObjectIds.splice(selIdx, 1);
    // Children survive a deleted parent (orphaned, parentId cleared) — each
    // object owns its own timeline window; deleting a subtree is explicit.
    for (const o of store.project.objects) {
      if (o.parentId === id) o.parentId = null;
    }
    for (const track of store.project.tracks) {
      track.clips = track.clips.filter(c => c.sourceId !== id && c.targetId !== id);
    }
    // Remove from any group
    for (const group of (store.project.groups || [])) {
      const gIdx = (group.childIds || []).indexOf(id);
      if (gIdx !== -1) group.childIds.splice(gIdx, 1);
    }
    // Remove empty groups
    if (store.project.groups) {
      store.project.groups = store.project.groups.filter(g => g.childIds && g.childIds.length > 0);
    }
    store.isDirty = true;
    actions.commitState();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Parent / child hierarchy (E2E audit — frontend-editable canonical graph)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Attach `childId` to `parentId` (or detach with null). Rejects cycles and
   * self-parenting; a child reparented out of a group keeps its parentId —
   * groups and parent/child are independent organizational structures.
   * Returns true when the graph changed.
   */
  setParent(childId, parentId) {
    const child = store.project.objects.find(o => o.id === childId);
    if (!child) return false;
    if (parentId == null) {
      if (child.parentId == null) return false;
      Vue.set(child, 'parentId', null);
      store.isDirty = true;
      actions.commitState();
      return true;
    }
    if (parentId === childId) {
      actions.setError('An object cannot be its own parent');
      return false;
    }
    if (!store.project.objects.some(o => o.id === parentId)) {
      actions.setError('Parent object not found');
      return false;
    }
    if (getters.wouldCreateCycle(childId, parentId)) {
      actions.setError('That would create a parent/child cycle');
      return false;
    }
    Vue.set(child, 'parentId', parentId);
    store.isDirty = true;
    actions.commitState();
    return true;
  },

  /** Duplicate an object — with its whole subtree when it has children
   *  (parented children follow the parent; ids are remapped, clips are not
   *  copied, zOrder stacks on top). */
  duplicateObject(id) {
    const source = store.project.objects.find(o => o.id === id);
    if (!source) return null;
    const subtree = [source, ...getters.descendantsOf(id)];
    const idMap = new Map();
    for (const o of subtree) idMap.set(o.id, uid('obj'));
    const clones = subtree.map((o, i) => {
      const clone = JSON.parse(JSON.stringify(o));
      clone.id = idMap.get(o.id);
      clone.name = (i === 0 ? o.name : o.name) + ' copy';
      clone.x = (o.x || 0) + 24;
      clone.y = (o.y || 0) + 24;
      clone.zOrder = store.project.objects.length + i;
      if (o.parentId != null) clone.parentId = idMap.get(o.parentId) || null;
      return clone;
    });
    store.project.objects.push(...clones);
    store.isDirty = true;
    actions.commitState();
    return clones[0];
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Groups
  // ══════════════════════════════════════════════════════════════════════════

  groupObjects(ids) {
    if (!ids || ids.length < 2) {
      actions.setError('Select at least 2 objects to group');
      return null;
    }
    const objectIds = new Set(store.project.objects.map(o => o.id));
    const groupIds = new Set((store.project.groups || []).map(g => g.id));
    const valid = ids.filter(id => objectIds.has(id) || groupIds.has(id));
    if (valid.length < 2) {
      actions.setError('Select at least 2 objects to group');
      return null;
    }
    // Nesting guard: a group cannot contain itself transitively. Adding any
    // of `valid`'s descendant groups would close a cycle.
    const descendants = new Set();
    const collect = (gid) => {
      for (const g of (store.project.groups || [])) {
        if (g.id === gid) {
          for (const cid of g.childIds || []) {
            if (groupIds.has(cid) && !descendants.has(cid)) { descendants.add(cid); collect(cid); }
          }
        }
      }
    };
    for (const id of valid) if (groupIds.has(id)) collect(id);
    const members = valid.filter(id => !descendants.has(id) && id !== undefined);
    if (members.length < 2) {
      actions.setError('That grouping would nest a group inside itself');
      return null;
    }
    // Remove member objects from existing groups (re-grouping moves them)
    for (const group of (store.project.groups || [])) {
      group.childIds = (group.childIds || []).filter(cid => !objectIds.has(cid) || !members.includes(cid));
    }
    // Clean empty groups
    if (!store.project.groups) Vue.set(store.project, 'groups', []);
    store.project.groups = store.project.groups.filter(g => g.childIds && g.childIds.length > 0);

    const group = {
      id: uid('group'),
      name: `Group ${(store.project.groups || []).length + 1}`,
      childIds: [...members],
      margin: 10,
      collapsed: false
    };
    store.project.groups.push(group);
    store.isDirty = true;
    actions.commitState();
    return group;
  },

  ungroupObjects(groupId) {
    if (!store.project.groups) return;
    const idx = store.project.groups.findIndex(g => g.id === groupId);
    if (idx !== -1) {
      store.project.groups.splice(idx, 1);
      store.isDirty = true;
      actions.commitState();
    }
  },

  updateGroup(groupId, updates) {
    const group = (store.project.groups || []).find(g => g.id === groupId);
    if (!group) return;
    for (const key of Object.keys(updates)) {
      Vue.set(group, key, updates[key]);
    }
    store.isDirty = true;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Assets
  // ══════════════════════════════════════════════════════════════════════════

  async uploadAsset(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const asset = {
            id: uid('asset'),
            name: file.name.replace(/\.[^.]+$/, ''),
            filename: file.name,
            type: file.type.includes('svg') ? 'svg' : 'image',
            dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
            serverFilename: null
          };
          store.project.assets.push(asset);
          store.isDirty = true;
          resolve(asset);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  removeAsset(id) {
    const idx = store.project.assets.findIndex(a => a.id === id);
    if (idx !== -1) {
      store.project.assets.splice(idx, 1);
      store.isDirty = true;
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Selection
  // ══════════════════════════════════════════════════════════════════════════

  selectObject(id, addToSelection = false) {
    if (!id) { store.selectedObjectIds = []; store.selectedClipId = null; return; }
    if (addToSelection) {
      const idx = store.selectedObjectIds.indexOf(id);
      if (idx !== -1) store.selectedObjectIds.splice(idx, 1);
      else store.selectedObjectIds.push(id);
    } else {
      store.selectedObjectIds = [id];
    }
    store.selectedClipId = null;
  },

  selectClip(clipId) {
    store.selectedClipId = clipId;
    store.selectedObjectIds = [];
  },

  deselectAll() {
    store.selectedObjectIds = [];
    store.selectedClipId = null;
  },

  setActiveTool(tool) { store.activeTool = tool; },

  // ══════════════════════════════════════════════════════════════════════════
  // Clips
  // ══════════════════════════════════════════════════════════════════════════

  addClip(trackIndex, clipData) {
    while (store.project.tracks.length <= trackIndex) {
      store.project.tracks.push({
        id: `track_${store.project.tracks.length + 1}`,
        name: `Track ${store.project.tracks.length + 1}`,
        clips: []
      });
    }
    while (store.project.tracks.length < 5) {
      store.project.tracks.push({
        id: `track_${store.project.tracks.length + 1}`,
        name: `Track ${store.project.tracks.length + 1}`,
        clips: []
      });
    }
    const clip = {
      id: uid('clip'), type: 'transform', startTime: 0, duration: 1.5,
      easing: 'ease_in_out', sourceId: null, targetId: null, params: {},
      overshoot: 0, settle: 1.0, morphQuality: 'medium', ...clipData
    };
    store.project.tracks[trackIndex].clips.push(clip);
    store.isDirty = true;
    actions.commitState();
    return clip;
  },

  /**
   * Move a clip to a different track (frontend-editable track assignment —
   * blending rule: the higher track wins per-property conflicts).
   * Returns the new track index, or -1 when the clip was not found.
   */
  moveClip(clipId, trackIndex) {
    if (!Number.isInteger(trackIndex) || trackIndex < 0) return -1;
    for (let i = 0; i < store.project.tracks.length; i++) {
      const track = store.project.tracks[i];
      const idx = track.clips.findIndex(c => c.id === clipId);
      if (idx !== -1) {
        if (i === trackIndex) return i;
        const [clip] = track.clips.splice(idx, 1);
        actions.addClip(trackIndex, clip);   // addClip commits the history entry
        return trackIndex;
      }
    }
    return -1;
  },

  /** Index of the track containing a clip (-1 when absent). */
  trackIndexOfClip(clipId) {
    for (let i = 0; i < store.project.tracks.length; i++) {
      if (store.project.tracks[i].clips.some(c => c.id === clipId)) return i;
    }
    return -1;
  },

  updateClip(clipId, updates) {
    for (const track of store.project.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        for (const key of Object.keys(updates)) Vue.set(clip, key, updates[key]);
        store.isDirty = true;
        return;
      }
    }
  },

  deleteClip(clipId) {
    for (const track of store.project.tracks) {
      const idx = track.clips.findIndex(c => c.id === clipId);
      if (idx !== -1) {
        track.clips.splice(idx, 1);
        if (store.selectedClipId === clipId) store.selectedClipId = null;
        store.isDirty = true;
        actions.commitState();
        return;
      }
    }
  },

  createTransform() {
    if (store.selectedObjectIds.length !== 2) {
      actions.setError('Select exactly 2 objects to create a transform');
      return null;
    }
    const [sourceId, targetId] = store.selectedObjectIds;
    const src = getters.objectById(sourceId);
    const tgt = getters.objectById(targetId);
    if (!src || !tgt) return null;

    const startTime = (src.enterTime || 0) + (src.duration || 3) - 0.5;

    let trackIndex = 0;
    for (let i = 0; i < store.project.tracks.length; i++) {
      if (store.project.tracks[i].clips.length === 0) { trackIndex = i; break; }
      trackIndex = i + 1;
    }
    trackIndex = Math.min(trackIndex, 4);

    const clip = actions.addClip(trackIndex, {
      type: 'transform', startTime: Math.max(0, startTime), duration: 1.5,
      easing: 'ease_in_out_cubic', sourceId, targetId, morphQuality: 'medium'
    });
    store.selectedClipId = clip.id;
    store.selectedObjectIds = [];
    return clip;
  },

  createAnimation(type, params = {}) {
    if (store.selectedObjectIds.length !== 1) {
      actions.setError('Select 1 object to animate');
      return null;
    }
    const sourceId = store.selectedObjectIds[0];
    const src = getters.objectById(sourceId);
    const startTime = src ? (src.enterTime || 0) : 0;

    let trackIndex = 0;
    for (let i = 0; i < store.project.tracks.length; i++) {
      if (store.project.tracks[i].clips.length === 0) { trackIndex = i; break; }
      trackIndex = i + 1;
    }
    trackIndex = Math.min(trackIndex, 4);

    const clip = actions.addClip(trackIndex, {
      type, startTime, duration: 1.0, easing: 'ease_in_out', sourceId, params
    });
    store.selectedClipId = clip.id;
    return clip;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Alignment (3x3 grid)
  // ══════════════════════════════════════════════════════════════════════════

  alignObject(objId, anchor) {
    const obj = store.project.objects.find(o => o.id === objId);
    if (!obj) return;
    const stage = store.project.stage;
    const pad = 50;

    const positions = {
      'TOP_LEFT':     { x: pad + obj.width / 2, y: pad + obj.height / 2 },
      'TOP':          { x: stage.width / 2, y: pad + obj.height / 2 },
      'TOP_RIGHT':    { x: stage.width - pad - obj.width / 2, y: pad + obj.height / 2 },
      'LEFT':         { x: pad + obj.width / 2, y: stage.height / 2 },
      'CENTER':       { x: stage.width / 2, y: stage.height / 2 },
      'RIGHT':        { x: stage.width - pad - obj.width / 2, y: stage.height / 2 },
      'BOTTOM_LEFT':  { x: pad + obj.width / 2, y: stage.height - pad - obj.height / 2 },
      'BOTTOM':       { x: stage.width / 2, y: stage.height - pad - obj.height / 2 },
      'BOTTOM_RIGHT': { x: stage.width - pad - obj.width / 2, y: stage.height - pad - obj.height / 2 }
    };

    const pos = positions[anchor];
    if (pos) {
      actions.updateObject(objId, { x: Math.round(pos.x), y: Math.round(pos.y) });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Playback
  // ══════════════════════════════════════════════════════════════════════════

  setPlaybackTime(t) { store.playbackTime = t; },
  setPlaybackPlaying(p) { store.playbackPlaying = p; },
  setFrameState(s) { store.frameState = s; },

  // ══════════════════════════════════════════════════════════════════════════
  // Stage
  // ══════════════════════════════════════════════════════════════════════════

  updateStage(u) { for (const k of Object.keys(u)) Vue.set(store.project.stage, k, u[k]); store.isDirty = true; },

  /**
   * Update scene identity / camera config (Issue #1).
   * Changing the scene type keeps only camera keys the new type understands.
   */
  updateSceneConfig(u) {
    if (u.sceneType !== undefined) {
      Vue.set(store.project, 'sceneType', u.sceneType);
      const meta = getSceneTypeMeta(u.sceneType);
      if (meta.key !== 'custom' && store.project.camera) {
        for (const k of Object.keys(store.project.camera)) {
          if (!meta.cameraFields.includes(k)) Vue.delete(store.project.camera, k);
        }
      }
    }
    if (u.className !== undefined) Vue.set(store.project.scene, 'className', u.className);
    if (u.baseClass !== undefined) Vue.set(store.project.scene, 'baseClass', u.baseClass);
    store.isDirty = true;
  },

  /** Update a single camera property (clamped where meaningful). */
  updateCamera(k, v) {
    if (v === '' || v === null || v === undefined || Number.isNaN(Number(v))) {
      Vue.delete(store.project.camera, k);
    } else {
      Vue.set(store.project.camera, k, Number(v));
    }
    store.isDirty = true;
  },
  toggleGrid() { store.project.stage.gridVisible = !store.project.stage.gridVisible; },
  toggleSnap() { store.project.stage.snapEnabled = !store.project.stage.snapEnabled; },

  // ══════════════════════════════════════════════════════════════════════════
  // Local Project I/O  (file-based, existing behaviour)
  // ══════════════════════════════════════════════════════════════════════════

  exportJSON() {
    // Scientific mode: persist the edited document with the project (#29).
    if (store.project.editorMode === 'scientific') { syncSciDocument(); }
    return JSON.stringify(JSON.parse(JSON.stringify(store.project)), null, 2);
  },

  importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.stage || !Array.isArray(data.objects)) throw new Error('Invalid project');
      if (!data.tracks) data.tracks = [{ id: 'track_1', name: 'Track 1', clips: [] }];
      if (!data.assets) data.assets = [];
      if (!data.groups) data.groups = [];
      if (!data.editorMode) data.editorMode = 'visual';
      if (data.codeSource === undefined) data.codeSource = '';
      if (data.sciDocument === undefined) data.sciDocument = null;
      migrateProjectSchema(data);
      store.project = data;
      store.selectedObjectIds = [];
      store.selectedClipId = null;
      store.isDirty = false;
      store.error = null;
      store.history.past = [];
      store.history.future = [];
      actions.commitState();
      return true;
    } catch (err) {
      store.error = `Could not open project: ${err.message}`;
      return false;
    }
  },

  saveToFile() {
    const json = actions.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.project.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    store.isDirty = false;
  },

  loadFromFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) { resolve(false); return; }
        const reader = new FileReader();
        reader.onload = (ev) => resolve(actions.importJSON(ev.target.result));
        reader.onerror = () => { store.error = 'Failed to read file'; resolve(false); };
        reader.readAsText(file);
      };
      input.click();
    });
  },

  newProject(name = 'My Animation', editorMode = 'visual', sceneType = 'scene_2d') {
    store.project = createDefaultProject(editorMode, sceneType);
    store.project.name = name;
    store.selectedObjectIds = [];
    store.selectedClipId = null;
    store.isDirty = false;
    store.error = null;
    store.playbackTime = 0;
    store.playbackPlaying = false;
    store.frameState = { objectOverrides: {}, morphShapes: [], hiddenIds: new Set() };
    store.renderJobId = null;
    store.renderStatus = null;
    store.renderError = null;
    store.renderVideoUrl = null;
    store.renderLog = '';
    store.history.past = [];
    store.history.future = [];
    store.clipboard = [];
    _objectAddCount = 0;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Canonical render-source contract (issue #36)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Adopt a scene parsed from hand-written Manim code into the visual editor.
   *
   * The parsed model is a NON-DESTRUCTIVE scaffold: whenever the importer
   * reports that information was lost (dropped constructs or approximated
   * values), the original code becomes the canonical render source
   * (`sourceMode: 'code'`) so renders reproduce the authored scene exactly
   * instead of the approximation. The original text is always preserved in
   * `project.codeSource` — never discarded.
   *
   * @param {string} code the exact source text
   * @param {{objects: Array, tracks: Array, stage: Object, coverage?: Object}} parsed
   * @returns {{sourceMode: string, report: Object}} what the importer decided
   */
  adoptImportedCode(code, parsed) {
    const coverage = parsed.coverage || { dropped: [], approximated: 0, complete: true };
    const lossy = coverage.dropped.length > 0 || coverage.approximated > 0;

    store.project.objects = parsed.objects;
    store.project.tracks = parsed.tracks;
    if (parsed.stage && parsed.stage.backgroundColor) {
      store.project.stage.backgroundColor = parsed.stage.backgroundColor;
    }
    store.project.codeSource = code;
    store.project.sourceMode = lossy ? 'code' : 'canvas';
    store.project.importReport = {
      at: new Date().toISOString(),
      objectCount: parsed.objects.length,
      clipCount: parsed.tracks.reduce((s, t) => s + t.clips.length, 0),
      dropped: coverage.dropped,
      approximated: coverage.approximated,
      complete: !lossy
    };
    actions.deselectAll();
    actions.commitState();
    store.isDirty = true;
    return { sourceMode: store.project.sourceMode, report: store.project.importReport };
  },

  /**
   * Explicitly detach from the imported source: the visual scaffold becomes
   * the render source. Callers must warn — constructs the importer could not
   * represent are gone from the scaffold (see project.importReport).
   */
  detachFromSource() {
    if (store.project.sourceMode !== 'code') return false;
    store.project.sourceMode = 'canvas';
    store.isDirty = true;
    return true;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Server Project I/O  (Docker / API)
  // ══════════════════════════════════════════════════════════════════════════

  /** Check if the API server is reachable */
  async checkApi() {
    try {
      const ok = await api.checkHealth();
      store.apiAvailable = ok;
      return ok;
    } catch {
      store.apiAvailable = false;
      return false;
    }
  },

  /**
   * Save the current project to the server (explicit action).
   * Creates the project on the server if it has no ID.
   * Uploads any assets that haven't been synced yet.
   */
  async saveToServer() {
    store.savingToServer = true;
    store.loading = true;
    try {
      // Scientific mode: carry the edited document into the project (#29)
      if (store.project.editorMode === 'scientific') { syncSciDocument(); }

      // 1. Create on server if no project ID (pass scene type — Issue #1)
      if (!store.project.id) {
        const created = await api.projects.create(
          store.project.name, store.project.editorMode, store.project.sceneType
        );
        Vue.set(store.project, 'id', created.id);
      }

      const projectId = store.project.id;

      // 2. Upload any assets that need syncing
      for (const asset of store.project.assets) {
        if (asset.dataUrl && !asset.serverFilename) {
          try {
            const result = await api.assets.uploadBase64(projectId, {
              name: asset.filename || asset.name || 'asset',
              type: asset.type,
              data: asset.dataUrl
            });
            Vue.set(asset, 'serverFilename', result.filename);
          } catch (err) {
            console.warn('[saveToServer] Asset upload failed:', asset.name, err);
          }
        }
      }

      // 3. Prepare server-safe project JSON
      const serverProject = JSON.parse(JSON.stringify(store.project));

      // Map serverFilename → filename, remove dataUrl
      for (const a of serverProject.assets) {
        if (a.serverFilename) a.filename = a.serverFilename;
        delete a.dataUrl;
        delete a.serverFilename;
      }

      // 4. Save to server
      await api.projects.update(projectId, serverProject);
      store.isDirty = false;

      return projectId;
    } catch (err) {
      store.error = `Save to server failed: ${err.message}`;
      throw err;
    } finally {
      store.loading = false;
      store.savingToServer = false;
    }
  },

  /**
   * Load a project from the server by ID.
   */
  async loadFromServer(id) {
    store.loading = true;
    try {
      const project = await api.projects.get(id);

      // For each asset, create a displayable URL
      for (const asset of project.assets || []) {
        if (asset.filename && !asset.dataUrl) {
          asset.dataUrl = api.assets.getUrl(id, asset.filename);
          asset.serverFilename = asset.filename;
        }
      }

      // Ensure groups array exists
      if (!project.groups) project.groups = [];
      if (!project.editorMode) project.editorMode = 'visual';
      if (project.codeSource === undefined) project.codeSource = '';
      if (project.sciDocument === undefined) project.sciDocument = null;
      migrateProjectSchema(project);

      store.project = project;
      store.selectedObjectIds = [];
      store.selectedClipId = null;
      store.isDirty = false;
      store.error = null;
      store.renderJobId = null;
      store.renderStatus = null;
      store.renderError = null;
      store.renderVideoUrl = null;
      return true;
    } catch (err) {
      store.error = `Load from server failed: ${err.message}`;
      return false;
    } finally {
      store.loading = false;
    }
  },

  /**
   * Fetch list of projects on the server.
   */
  async listServerProjects() {
    try {
      const list = await api.projects.list();
      store.serverProjects = list || [];
      return list;
    } catch (err) {
      store.error = `Could not list projects: ${err.message}`;
      store.serverProjects = [];
      return [];
    }
  },

  /**
   * Delete a project from the server (project + assets + renders).
   */
  async deleteServerProject(id) {
    await api.projects.delete(id);
    store.serverProjects = store.serverProjects.filter(p => p.id !== id);
    if (store.project.id === id) {
      store.project.id = null;
    }
  },

  /**
   * Full server render pipeline:
   *  1. Save project + assets to server
   *  2. Trigger render
   *  3. Start polling for status
   */
  async renderOnServer(quality = 'high') {
    store.showRenderDialog = true;
    store.renderStatus = 'uploading';
    store.renderError = null;
    store.renderVideoUrl = null;
    store.renderLog = '';
    store.renderQuality = quality;

    try {
      // 1. Save to server
      store.renderStatus = 'saving';
      const projectId = await actions.saveToServer();

      // 2. Trigger render — routed by the CANONICAL SOURCE (issue #36):
      //    - scientific mode: emit runnable Python from the IR document
      //      (sci-ir/1 is the source of truth; same job queue)
      //    - code mode OR code-sourced import: render the exact codeSource
      //      verbatim (the visual scaffold is never compiled for these)
      //    - canvas: compile the visual model (its source of truth)
      //    The API enforces the same routing server-side (defence in depth).
      store.renderStatus = 'queued';
      let result;
      if (store.project.editorMode === 'scientific') {
        const { ir } = await import('../sci/client.js');
        result = await ir.render(projectId, sciDocumentForRender(), quality);
      } else if (store.project.editorMode === 'code'
          || (store.project.sourceMode === 'code'
              && typeof store.project.codeSource === 'string'
              && store.project.codeSource.trim().length > 0)) {
        result = await api.projects.renderCode(projectId, {
          quality,
          codeSource: store.project.codeSource
        });
      } else {
        result = await api.projects.render(projectId, quality);
      }
      store.renderJobId = result.jobId;

      // 3. Start polling
      actions._startPollRender(result.jobId, projectId);

    } catch (err) {
      store.renderStatus = 'failed';
      store.renderError = err.message;
    }
  },

  /** @private Start polling a render job */
  _startPollRender(jobId, projectId) {
    actions._stopPollRender();

    _pollTimer = setInterval(async () => {
      try {
        const job = await api.jobs.get(jobId);

        if (job.status === 'running') {
          store.renderStatus = 'running';
          if (job.stdout) store.renderLog = job.stdout;
        } else if (job.status === 'completed') {
          store.renderStatus = 'completed';
          store.renderVideoUrl = api.renders.getLatestUrl(projectId);
          store.renderLog = job.stdout || '';
          actions._stopPollRender();
        } else if (job.status === 'failed') {
          store.renderStatus = 'failed';
          store.renderError = job.error || job.stderr || 'Render failed';
          store.renderLog = (job.stdout || '') + '\n' + (job.stderr || '');
          actions._stopPollRender();
        }
      } catch (err) {
        console.warn('[poll] Error:', err);
      }
    }, 2000);
  },

  /** @private Stop polling */
  _stopPollRender() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // History (Undo / Redo)
  // ══════════════════════════════════════════════════════════════════════════

  _snapshotState() {
    return JSON.stringify({
      objects: store.project.objects,
      groups: store.project.groups,
      tracks: store.project.tracks
    });
  },

  commitState() {
    const snapshot = actions._snapshotState();
    store.history.past.push(snapshot);
    if (store.history.past.length > MAX_HISTORY) store.history.past.shift();
    store.history.future = [];
  },

  _debouncedCommit: (() => {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => actions.commitState(), 400);
    };
  })(),

  undo() {
    if (store.history.past.length <= 1) return;
    const current = store.history.past.pop();
    store.history.future.push(current);
    const prev = store.history.past[store.history.past.length - 1];
    const data = JSON.parse(prev);
    store.project.objects = data.objects;
    store.project.groups = data.groups || [];
    store.project.tracks = data.tracks;
    store.selectedObjectIds = [];
    store.selectedClipId = null;
    store.isDirty = true;
  },

  redo() {
    if (store.history.future.length === 0) return;
    const next = store.history.future.pop();
    store.history.past.push(next);
    const data = JSON.parse(next);
    store.project.objects = data.objects;
    store.project.groups = data.groups || [];
    store.project.tracks = data.tracks;
    store.selectedObjectIds = [];
    store.selectedClipId = null;
    store.isDirty = true;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Clipboard (Copy / Paste)
  // ══════════════════════════════════════════════════════════════════════════

  copySelection() {
    const selected = store.selectedObjectIds
      .map(id => store.project.objects.find(o => o.id === id))
      .filter(Boolean);
    if (selected.length === 0) return;
    store.clipboard = JSON.parse(JSON.stringify(selected));
  },

  pasteSelection() {
    if (store.clipboard.length === 0) return;
    const newIds = [];
    const idMap = new Map();   // original id -> pasted id (parentId remap)
    for (const original of store.clipboard) idMap.set(original.id, uid('obj'));
    for (const original of store.clipboard) {
      const clone = JSON.parse(JSON.stringify(original));
      clone.id = idMap.get(original.id);
      clone.x = (clone.x || 0) + 20;
      clone.y = (clone.y || 0) + 20;
      clone.name = clone.name + ' copy';
      clone.zOrder = store.project.objects.length;
      // Keep parent/child pairs pasted together; a parent left behind in the
      // scene is NOT re-referenced (the clone would jump with someone else's
      // transform) — the clone starts detached.
      clone.parentId = (original.parentId != null && idMap.has(original.parentId))
        ? idMap.get(original.parentId)
        : null;
      store.project.objects.push(clone);
      newIds.push(clone.id);
    }
    store.selectedObjectIds = newIds;
    store.selectedClipId = null;
    store.isDirty = true;
    actions.commitState();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // UI helpers
  // ══════════════════════════════════════════════════════════════════════════

  clearError() { store.error = null; },
  setError(msg) {
    store.error = msg;
    setTimeout(() => { if (store.error === msg) store.error = null; }, 4000);
  },

  setTheme(id) {
    store.theme = id;
    document.documentElement.setAttribute('data-theme', id);
    try { localStorage.setItem('manim-motion-theme', id); } catch {}
  }
};

export default { store, getters, actions, SHAPE_DEFAULTS, SHAPE_COLORS };
