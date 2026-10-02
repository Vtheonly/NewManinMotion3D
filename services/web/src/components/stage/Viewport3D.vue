<template>
  <div
    ref="container"
    class="viewport3d h-full w-full relative overflow-hidden"
    style="min-height: 0;"
    tabindex="0"
    @keydown.delete="onDelete"
    @keydown.f="focusSelected"
  >
    <!-- three.js canvas mounts here -->

    <!-- Toolbar overlay -->
    <div class="vp3d-toolbar">
      <div class="vp3d-group">
        <button
          v-for="m in modes"
          :key="m.id"
          class="vp3d-btn"
          :class="{ active: mode === m.id }"
          :title="m.title + ' (' + m.key + ')'"
          @click="setMode(m.id)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="m.icon"></svg>
        </button>
      </div>
      <div class="vp3d-group">
        <button class="vp3d-btn" :class="{ active: snap }" title="Snap (translation 0.25u / 15° / 0.1x)" @click="toggleSnap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3v14a2 2 0 002 2h14M3 5h14a2 2 0 012 2v14"/></svg>
        </button>
        <button class="vp3d-btn" :class="{ active: gridVisible }" title="Toggle grid" @click="gridVisible = !gridVisible">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>
      </div>
      <div class="vp3d-group">
        <button v-for="v in viewPresets" :key="v.label" class="vp3d-btn vp3d-label" :title="'View from ' + v.label" @click="applyViewPreset(v)">{{ v.label }}</button>
        <button class="vp3d-btn vp3d-label" title="Focus the selected object (F)" @click="focusSelected">Focus</button>
      </div>
      <div class="vp3d-group">
        <button class="vp3d-btn vp3d-label vp3d-accent" title="Copy this camera orientation into the render camera (phi/theta/distance) so the exported video frames the scene like this view" @click="cameraToRender">
          Camera → Render
        </button>
      </div>
    </div>

    <!-- Selection readout -->
    <div v-if="selectedCount === 1 && selectedObj" class="vp3d-readout">
      <span class="vp3d-name">{{ selectedObj.name }}</span>
      <span class="vp3d-props">
        x {{ fmt(selectedObj.x) }} · y {{ fmt(selectedObj.y) }}<template v-if="is3d(selectedObj)"> · z {{ fmt(selectedObj.z) }}</template>
        · {{ fmt(selectedObj.width) }}×{{ fmt(selectedObj.height) }}<template v-if="is3d(selectedObj) && selectedObj.depth != null">×{{ fmt(selectedObj.depth) }}</template> px
        <template v-if="is3d(selectedObj)"> · rot {{ fmt(selectedObj.rotationX || 0) }}°/{{ fmt(selectedObj.rotationY || 0) }}°/{{ fmt(selectedObj.rotation || 0) }}°</template>
      </span>
    </div>

    <!-- Hint -->
    <div class="vp3d-hint">
      <span v-if="mode === 'select'">Click an object to select · drag empty space to orbit · right-drag to pan · scroll to zoom</span>
      <span v-else-if="mode === 'translate'">Drag the arrows to move — writes x / y / z into the scene</span>
      <span v-else-if="mode === 'rotate'">Drag a ring to rotate — writes rotation X / Y / Z</span>
      <span v-else>Drag a handle to scale — writes width / height / depth</span>
    </div>

    <!-- Playback badge -->
    <div v-if="playing" class="vp3d-playing">● playing — the 3D view follows the timeline</div>
  </div>
</template>

<script>
/**
 * Viewport3D — the real 3D editing view (issue #42).
 *
 * Architecture: the CANONICAL scene model is the single source of truth.
 * This viewport renders it with three.js in the SAME coordinate frame the
 * video renderer uses (stage px → Manim frame units; see engine/stage3d.js)
 * and writes every gizmo manipulation back through actions.updateObject,
 * so inspector, 2D canvas, timeline, persistence and export all agree.
 *
 *   Frontend ↔ canonical store ↔ { 2D canvas | 3D viewport | codegen }
 *
 * Interaction:
 *   - OrbitControls: orbit / pan / zoom — view the scene from any angle
 *   - raycast selection (click) + hover highlight
 *   - TransformControls gizmo: translate / rotate / scale (per axis)
 *   - 2D objects are constrained to the stage plane (X/Y only)
 *   - playback: frameState overrides drive the meshes (3D preview plays)
 *   - "Camera → Render": editor camera → project.camera (phi/theta/distance)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { store, actions, getters } from '../../store/project.js';
import { applyOverrides } from '../../engine/blending.js';
import {
  stageToWorld, worldToStage, propsToEuler, eulerToProps,
  object3dSize, is3dType, FRAME_WIDTH, FRAME_HEIGHT
} from '../../engine/stage3d.js';

const MODES = [
  { id: 'select', title: 'Select / orbit', key: 'Q', icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>' },
  { id: 'translate', title: 'Move', key: 'W', icon: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>' },
  { id: 'rotate', title: 'Rotate', key: 'E', icon: '<path d="M1 4v6h6M3.51 15a9 9 0 102.13-9.36L1 10"/>' },
  { id: 'scale', title: 'Scale', key: 'R', icon: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>' }
];

const VIEW_PRESETS = [
  { label: 'Front', phi: 0.001, theta: -Math.PI / 2 },
  { label: 'Top', phi: Math.PI / 2 - 0.001, theta: -Math.PI / 2 },
  { label: 'Right', phi: 0.001, theta: 0 },
  { label: 'Iso', phi: 65 * Math.PI / 180, theta: -60 * Math.PI / 180 }
];

function hexToLinear(hexStr) {
  const h = String(hexStr || '#888888').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const num = parseInt(full, 16);
  if (!Number.isFinite(num) || Number.isNaN(num)) return new THREE.Color(0x888888);
  const r = ((num >> 16) & 255) / 255, g = ((num >> 8) & 255) / 255, b = (num & 255) / 255;
  // Manim colors are sRGB values; three renders in linear space
  const c = new THREE.Color();
  c.copySRGBToLinear(new THREE.Color(r, g, b));
  return c;
}

export default {
  name: 'Viewport3D',

  data() {
    return {
      mode: 'select',
      snap: false,
      gridVisible: true,
      modes: MODES,
      viewPresets: VIEW_PRESETS,
      hoverName: ''
    };
  },

  computed: {
    objects() { return store.project.objects; },
    stage() { return store.project.stage; },
    frameState() { return store.frameState; },
    selectedObjectIds() { return store.selectedObjectIds; },
    selectedCount() { return store.selectedObjectIds.length; },
    selectedObj() { return getters.selectedObject(); },
    playing() { return store.playbackPlaying || false; },
    cameraConf() { return store.project.camera || {}; }
  },

  watch: {
    objects: {
      handler() { this.syncFromStore(); },
      deep: true
    },
    stage: {
      handler() { this.syncStageChrome(); },
      deep: true
    },
    selectedObjectIds: {
      handler() { this.attachGizmo(); },
      deep: true
    },
    frameState: {
      handler() { this.applyPlaybackFrame(); },
      deep: true
    },
    mode(m) { this.applyMode(); },
    snap(on) {
      this.transform.setTranslationSnap(on ? 0.25 : null);
      this.transform.setRotationSnap(on ? THREE.MathUtils.degToRad(15) : null);
      this.transform.setScaleSnap(on ? 0.1 : null);
    },
    gridVisible(v) {
      if (this.grid) this.grid.visible = v;
      if (this.stageOutline) this.stageOutline.visible = v;
      if (this.axesHelper) this.axesHelper.visible = v;
    },
    cameraConf: {
      handler(c) { this.applyRenderCameraView(c); },
      deep: true
    }
  },

  mounted() {
    this._dragging = false;       // gizmo drag in progress (suppress rebuilds)
    this._meshes = new Map();     // objId -> mesh
    this._hovered = null;
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._flushScheduled = false;

    const el = this.$refs.container;
    const w = el.clientWidth || 800, h = el.clientHeight || 500;

    // Renderer — outputColorSpace sRGB matches how Manim colors read
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.prepend(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    // Scene + camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.05, 200);
    this.applyViewPreset(VIEW_PRESETS[3]);   // Iso

    // Editor chrome: stage grid + outline + axes (never exported)
    this.buildStageChrome();

    // Lighting: mostly ambient (Manim flat-fill look) + gentle key light
    this.ambient = new THREE.AmbientLight(0xffffff, 2.4);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    this.keyLight.position.set(6, 8, 10);
    this.scene.add(this.ambient, this.keyLight);

    // Orbit controls — the "view from different angles" freedom
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.minDistance = 1.5;
    this.orbit.maxDistance = 60;
    this.orbit.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };

    // Transform gizmo — move / rotate / scale in 3D
    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transformHelper = this.transform.getHelper();
    this.scene.add(this.transformHelper);
    this.transform.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value;
      if (e.value) {
        this._dragging = true;
      } else {
        this.writeBack();
        this._dragging = false;
        this.applyPlaybackFrame();   // re-blend playback state over the new base
      }
    });
    this.transform.addEventListener('objectChange', () => this.scheduleLiveWrite());

    // Pointer interactions: select + hover
    const dom = this.renderer.domElement;
    this._onPointerDown = (e) => this.onPointerDown(e);
    this._onPointerMove = (e) => this.onPointerMove(e);
    dom.addEventListener('pointerdown', this._onPointerDown);
    dom.addEventListener('pointermove', this._onPointerMove);

    // Keyboard shortcuts (QWER) scoped to the viewport
    this._onKeyDown = (e) => {
      if (this._dragging) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = e.key.toLowerCase();
      if (key === 'q') this.setMode('select');
      else if (key === 'w') this.setMode('translate');
      else if (key === 'e') this.setMode('rotate');
      else if (key === 'r') this.setMode('scale');
      else if (key === 'f') this.focusSelected();
    };
    window.addEventListener('keydown', this._onKeyDown);

    // Resize
    this._ro = new ResizeObserver(() => this.onResize());
    this._ro.observe(el);

    // First sync + render loop
    this.syncStageChrome();
    this.syncFromStore();
    this.attachGizmo();
    this.applyPlaybackFrame();

    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (this.orbit) this.orbit.update();
      if (this.renderer) this.renderer.render(this.scene, this.camera);
    };
    loop();
  },

  beforeDestroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    if (this._ro) this._ro.disconnect();
    const dom = this.renderer ? this.renderer.domElement : null;
    if (dom) {
      dom.removeEventListener('pointerdown', this._onPointerDown);
      dom.removeEventListener('pointermove', this._onPointerMove);
    }
    if (this.orbit) this.orbit.dispose();
    if (this.transform) this.transform.dispose();
    for (const mesh of this._meshes.values()) this.disposeMesh(mesh);
    this._meshes.clear();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
    }
  },

  methods: {
    is3d(obj) { return is3dType(obj.type); },
    fmt(v) { const n = Number(v); return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : '0'; },

    // ── Scene chrome (grid / outline / axes) ─────────────────────────────
    buildStageChrome() {
      // Stage-plane grid matching the canvas frame exactly
      const FW = FRAME_WIDTH, FH = FRAME_HEIGHT;
      const gridGroup = new THREE.Group();
      const nx = 16, ny = 9;
      const pts = [];
      for (let i = 0; i <= nx; i++) {
        const x = -FW / 2 + (FW * i / nx);
        pts.push(x, -FH / 2, 0, x, FH / 2, 0);
      }
      for (let j = 0; j <= ny; j++) {
        const y = -FH / 2 + (FH * j / ny);
        pts.push(-FW / 2, y, 0, FW / 2, y, 0);
      }
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const gMat = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.10, depthWrite: false
      });
      this.grid = new THREE.LineSegments(gGeo, gMat);
      gridGroup.add(this.grid);

      // Stage outline (the 2D canvas extent)
      const oPts = [-FW / 2, -FH / 2, 0, FW / 2, -FH / 2, 0, FW / 2, -FH / 2, 0, FW / 2, FH / 2, 0,
        FW / 2, FH / 2, 0, -FW / 2, FH / 2, 0, -FW / 2, FH / 2, 0, -FW / 2, -FH / 2, 0];
      const oGeo = new THREE.BufferGeometry();
      oGeo.setAttribute('position', new THREE.Float32BufferAttribute(oPts, 3));
      const oMat = new THREE.LineBasicMaterial({
        color: 0x4ceef9, transparent: true, opacity: 0.55, depthWrite: false
      });
      this.stageOutline = new THREE.LineSegments(oGeo, oMat);
      gridGroup.add(this.stageOutline);
      this.scene.add(gridGroup);

      this.axesHelper = new THREE.AxesHelper(1.1);   // x red · y green · z blue
      this.axesHelper.position.set(-FW / 2 - 0.55, -FH / 2 - 0.55, 0);
      this.scene.add(this.axesHelper);
    },

    syncStageChrome() {
      const bg = this.stage.backgroundColor || '#000000';
      this.scene.background = hexToLinear(bg);
      this.grid.visible = this.gridVisible;
      this.stageOutline.visible = this.gridVisible;
      this.axesHelper.visible = this.gridVisible;
    },

    // ── Mesh building (canonical → three) ────────────────────────────────
    syncFromStore() {
      if (this._dragging) return;   // gizmo owns the mesh during a drag
      const sw = this.stage.width || 1920, sh = this.stage.height || 1080;
      const seen = new Set();
      const frame = this.frameState || {};

      for (const raw of this.objects) {
        const obj = this.applyEffective(raw, frame);
        if (!obj) continue;
        seen.add(raw.id);
        let mesh = this._meshes.get(raw.id);
        if (mesh) {
          this.updateMesh(mesh, obj, sw, sh);
        } else {
          mesh = this.buildMesh(obj, sw, sh);
          this._meshes.set(raw.id, mesh);
          this.scene.add(mesh);
        }
        mesh.visible = obj.visible !== false && !this.isHidden(raw.id, frame);
      }
      // Remove stale meshes
      for (const [id, mesh] of [...this._meshes]) {
        if (!seen.has(id)) {
          if (this.transform.object === mesh) this.transform.detach();
          this.scene.remove(mesh);
          this.disposeMesh(mesh);
          this._meshes.delete(id);
        }
      }
      this.attachGizmo();
    },

    /** Effective object at the playhead (playback overrides applied). */
    applyEffective(raw, frame) {
      const ov = (frame.objectOverrides || {})[raw.id];
      return ov ? applyOverrides(raw, ov) : raw;
    },

    isHidden(id, frame) {
      const h = frame.hiddenIds;
      return h instanceof Set ? h.has(id) : false;
    },

    buildMesh(obj, sw, sh) {
      const kind = this.meshKind(obj);
      let geo, mesh;
      const fill = hexToLinear(obj.fill || '#4ceef9');
      const opacity = Number.isFinite(Number(obj.opacity)) ? Math.max(0, Math.min(1, Number(obj.opacity))) : 1;
      const mat = new THREE.MeshLambertMaterial({
        color: fill, transparent: opacity < 1, opacity, side: THREE.DoubleSide
      });

      if (kind === 'box') {
        geo = new THREE.BoxGeometry(1, 1, 1);
      } else if (kind === 'sphere') {
        geo = new THREE.SphereGeometry(0.5, this.resOf(obj), Math.max(8, this.resOf(obj) / 2));
      } else if (kind === 'cone') {
        geo = new THREE.ConeGeometry(0.5, 1, this.resOf(obj), 1, true);
        geo.rotateX(Math.PI / 2);   // three cone points +y → rotate to +z (Manim)
      } else if (kind === 'cylinder') {
        geo = new THREE.CylinderGeometry(0.5, 0.5, 1, this.resOf(obj), 1);
        geo.rotateX(Math.PI / 2);   // axis +y → +z
      } else if (kind === 'circle') {
        geo = new THREE.CircleGeometry(0.5, 32);
      } else if (kind === 'star') {
        geo = new THREE.ShapeGeometry(this.starShape(obj.starArms || 5, obj.innerRatio || 0.4));
      } else if (kind === 'text') {
        geo = new THREE.PlaneGeometry(1, 1);
      } else {
        geo = new THREE.PlaneGeometry(1, 1);
      }
      mesh = new THREE.Mesh(geo, mat);
      mesh.userData.objId = obj.id;
      mesh.userData.objType = obj.type;
      this.updateMesh(mesh, obj, sw, sh);
      return mesh;
    },

    meshKind(obj) {
      if (is3dType(obj.type)) {
        if (obj.type === 'cube') return 'box';
        if (obj.type === 'sphere') return 'sphere';
        if (obj.type === 'cone') return 'cone';
        return 'cylinder';
      }
      if (obj.type === 'circle' || obj.type === 'dot' || obj.type === 'ellipse') return 'circle';
      if (obj.type === 'star') return 'star';
      return 'flat';
    },

    resOf(obj) { return Math.max(8, Math.min(48, Number(obj.resolution) || 24)); },

    starShape(arms, innerRatio) {
      const shape = new THREE.Shape();
      const n = Math.max(3, arms);
      for (let i = 0; i < n * 2; i++) {
        const r = (i % 2 === 0) ? 0.5 : 0.5 * Math.max(0.1, Math.min(0.9, innerRatio));
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = r * Math.cos(a), y = r * Math.sin(a);
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      return shape;
    },

    /** Place/size/orient a mesh from the (effective) canonical object. */
    updateMesh(mesh, obj, sw, sh) {
      const pos = stageToWorld(obj.x, obj.y, obj.z, sw, sh);
      mesh.position.set(pos.x, pos.y, pos.z);
      const e = propsToEuler(obj.rotationX, obj.rotationY, obj.rotation);
      mesh.rotation.set(e.x, e.y, e.z);

      const kind = this.meshKind(obj);
      const size = object3dSize(obj, sw, sh);
      let sx = 1, sy = 1, sz = 1;
      if (kind === 'box') {
        sx = size.w; sy = size.h; sz = size.d;
      } else if (kind === 'sphere') {
        sx = size.w; sy = size.h; sz = size.d;
      } else if (kind === 'cone' || kind === 'cylinder') {
        // geometry (axis +z): base x/y = width, axis z = height
        sx = size.w; sy = size.w; sz = (obj.height || 1) / sh * FRAME_HEIGHT;
      } else if (kind === 'circle') {
        const d = Math.min(obj.width || 1, obj.height || 1);
        sx = d / sw * FRAME_WIDTH;
        sy = sx; sz = 1;
        if (obj.type === 'ellipse') { sx = (obj.width || 1) / sw * FRAME_WIDTH; sy = (obj.height || 1) / sh * FRAME_HEIGHT; }
      } else {
        // flat plane: width × height, at the stage plane
        sx = size.w; sy = size.h; sz = 1;
      }

      // playback scale overrides (blending applies scaleX/scaleY)
      const esx = Number(obj.scaleX) || 1, esy = Number(obj.scaleY) || 1;
      mesh.scale.set(sx * esx, sy * esy, sz);

      // Material props
      const mat = mesh.material;
      const fill = hexToLinear(obj.fill || '#4ceef9');
      mat.color.copy(fill);
      const op = Number.isFinite(Number(obj.opacity)) ? Math.max(0, Math.min(1, Number(obj.opacity))) : 1;
      mat.opacity = op; mat.transparent = op < 1;
      if (mesh.userData.edgeLines) {
        const edgeMat = mesh.userData.edgeLines.material;
        const stroke = hexToLinear(obj.stroke || '#ffffff');
        edgeMat.color.copy(stroke);
        edgeMat.opacity = (obj.strokeWidth ?? 2) > 0 ? Math.min(1, (obj.strokeWidth ?? 2) / 8 + 0.15) : 0;
        edgeMat.transparent = true;
        edgeMat.visible = edgeMat.opacity > 0.01;
      }

      // Stroke edges for solid 3D kinds (matches set_stroke in the render)
      if ((kind === 'box' || kind === 'cone' || kind === 'cylinder') && !mesh.userData.edgeLines) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry, 25),
          new THREE.LineBasicMaterial({ color: hexToLinear(obj.stroke || '#ffffff'), transparent: true, opacity: 0.4 })
        );
        mesh.add(edges);
        mesh.userData.edgeLines = edges;
      }
      if (kind === 'sphere' && !mesh.userData.edgeLines && (obj.strokeWidth ?? 2) > 0) {
        const wire = new THREE.LineSegments(
          new THREE.WireframeGeometry(mesh.geometry),
          new THREE.LineBasicMaterial({ color: hexToLinear(obj.stroke || '#ffffff'), transparent: true, opacity: 0.14 })
        );
        mesh.add(wire);
        mesh.userData.edgeLines = wire;
      }
    },

    disposeMesh(mesh) {
      if (mesh.userData.edgeLines) {
        mesh.userData.edgeLines.geometry.dispose();
        mesh.userData.edgeLines.material.dispose();
      }
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    },

    // ── Selection & gizmo ────────────────────────────────────────────────
    onPointerDown(e) {
      if (e.button !== 0) return;
      // A gizmo drag starts on the gizmo itself — TransformControls handles it
      if (this.transform.dragging) return;
      // ignore clicks that began as orbit drags (rotated more than a few px)
      const startXY = { x: e.clientX, y: e.clientY };
      const up = (ue) => {
        dom.removeEventListener('pointerup', up);
        const moved = Math.abs(ue.clientX - startXY.x) + Math.abs(ue.clientY - startXY.y);
        if (moved > 4) return;   // it was an orbit gesture
        const hit = this.pick(ue);
        if (hit) {
          actions.selectObject(hit, ue.shiftKey || ue.ctrlKey || ue.metaKey);
        } else if (!ue.shiftKey) {
          actions.deselectAll();
        }
      };
      const dom = this.renderer.domElement;
      dom.addEventListener('pointerup', up);
    },

    onPointerMove(e) {
      if (this.transform.dragging || this._dragging) return;
      const hit = this.pick(e);
      const id = hit ? hit : null;
      if (id !== this._hovered) {
        if (this._hovered && this._meshes.get(this._hovered)) {
          const m = this._meshes.get(this._hovered);
          m.material.emissive && m.material.emissive.setHex(0x000000);
        }
        this._hovered = id;
        if (id && this._meshes.get(id)) {
          const m = this._meshes.get(id);
          if (m.material.emissive) {
            m.material.emissive = m.material.emissive || new THREE.Color();
            m.material.emissive.setHex(0x1a3a44);
          }
        }
        this.renderer.domElement.style.cursor = id ? 'pointer' : '';
      }
    },

    pick(domEvent) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this._pointer.x = ((domEvent.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((domEvent.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const targets = [...this._meshes.values()].filter(m => m.visible);
      const intersects = this._raycaster.intersectObjects(targets, true);
      for (const it of intersects) {
        let n = it.object;
        while (n) {
          if (n.userData && n.userData.objId) return n.userData.objId;
          n = n.parent;
        }
      }
      return null;
    },

    attachGizmo() {
      if (!this.transform) return;
      // 'select' mode = pure selection/orbit — no gizmo on screen
      if (this.mode === 'select') {
        this.transform.detach();
        return;
      }
      const ids = store.selectedObjectIds;
      if (ids.length !== 1) {
        this.transform.detach();
        return;
      }
      const mesh = this._meshes.get(ids[0]);
      if (mesh && this.transform.object !== mesh) {
        this.transform.attach(mesh);
        this.applyAxisConstraints();
      } else if (!mesh) {
        this.transform.detach();
      }
    },

    /** 2D objects are constrained to the stage plane; sphere/cone/cylinder
     *  scale Z hidden (their depth canonically mirrors width). */
    applyAxisConstraints() {
      const t = this.transform;
      const obj = this.selectedObj;
      if (!obj) return;
      const three = is3dType(obj.type);
      const freeDepth = obj.type === 'cube';
      if (this.mode === 'translate') {
        t.showX = true; t.showY = true; t.showZ = three;
      } else if (this.mode === 'rotate') {
        t.showX = three; t.showY = three; t.showZ = true;
      } else if (this.mode === 'scale') {
        t.showX = true; t.showY = true; t.showZ = three && freeDepth;
      }
    },

    setMode(m) {
      this.mode = m;
      if (m === 'select') this.transform.detach();
      else this.attachGizmo();
    },

    applyMode() {
      const m = this.mode === 'select' ? 'translate' : this.mode;
      this.transform.setMode(m);
      this.applyAxisConstraints();
    },

    toggleSnap() { this.snap = !this.snap; },

    // ── Gizmo → canonical write-back ────────────────────────────────────
    scheduleLiveWrite() {
      // throttle store writes during the drag so the inspector + 2D canvas
      // track the gizmo in real time without flooding reactivity
      if (this._flushScheduled || !this._dragging) return;
      this._flushScheduled = true;
      requestAnimationFrame(() => {
        this._flushScheduled = false;
        if (this._dragging) this.writeBack(false);   // live, no commit
      });
    },

    writeBack(commit = true) {
      const id = store.selectedObjectIds[0];
      const mesh = id && this._meshes.get(id);
      const obj = id && this.objects.find(o => o.id === id);
      if (!mesh || !obj) return;
      const sw = this.stage.width || 1920, sh = this.stage.height || 1080;
      const three = is3dType(obj.type);
      const mode = this.mode === 'select' ? 'translate' : this.mode;

      if (mode === 'translate') {
        const p = worldToStage(mesh.position.x, mesh.position.y, mesh.position.z, sw, sh);
        const updates = { x: Math.round(p.x), y: Math.round(p.y) };
        if (three) updates.z = Math.round(p.z);
        this.commit(updates, id, commit);
      } else if (mode === 'rotate') {
        const r = eulerToProps(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
        const updates = three
          ? { rotationX: r.rotationX, rotationY: r.rotationY, rotation: r.rotationZ }
          : { rotation: r.rotationZ };
        this.commit(updates, id, commit);
      } else if (mode === 'scale') {
        // unit-extent geometry: mesh.scale components ARE the world dims
        const px = {
          w: mesh.scale.x / FRAME_WIDTH * sw,
          h: mesh.scale.y / FRAME_HEIGHT * sh,
          d: mesh.scale.z / FRAME_WIDTH * sw
        };
        const updates = {
          width: Math.max(4, Math.round(px.w)),
          height: Math.max(4, Math.round(px.h))
        };
        if (obj.type === 'cube') updates.depth = Math.max(4, Math.round(px.d));
        this.commit(updates, id, commit);
      }
    },

    commit(updates, id, commitNow) {
      // commitNow (drag end) writes through the store with a history commit;
      // false streams live values (the final commit lands at drag end).
      actions.updateObject(id, updates, { commit: commitNow });
    },

    // ── Playback ─────────────────────────────────────────────────────────
    applyPlaybackFrame() {
      if (this._dragging) return;   // gizmo wins during a drag
      const frame = this.frameState || {};
      if (!frame.objectOverrides && !(frame.hiddenIds instanceof Set)) return;
      this.syncFromStore();
    },

    // ── Camera views ─────────────────────────────────────────────────────
    applyViewPreset(v) {
      const d = 16;
      this.camera.position.set(
        d * Math.sin(v.phi) * Math.cos(v.theta),
        d * Math.sin(v.phi) * Math.sin(v.theta),
        d * Math.cos(v.phi)
      );
      this.camera.lookAt(0, 0, 0);
      if (this.orbit) { this.orbit.target.set(0, 0, 0); this.orbit.update(); }
    },

    applyRenderCameraView(cam) {
      if (!cam || (cam.phi == null && cam.theta == null)) return;
      const phi = THREE.MathUtils.degToRad(Number(cam.phi) || 0);
      const theta = THREE.MathUtils.degToRad(Number(cam.theta) ?? -90);
      const d = Number(cam.distance) || 16;
      this.camera.position.set(
        d * Math.sin(phi) * Math.cos(theta),
        d * Math.sin(phi) * Math.sin(theta),
        d * Math.cos(phi)
      );
      this.camera.lookAt(0, 0, 0);
      if (this.orbit) { this.orbit.target.set(0, 0, 0); this.orbit.update(); }
    },

    /** Editor camera → render camera (phi/theta/distance in degrees). */
    cameraToRender() {
      const p = this.camera.position.clone().sub(this.orbit.target);
      const distance = p.length();
      const phi = Math.acos(Math.max(-1, Math.min(1, p.z / distance)));
      let theta = Math.atan2(p.y, p.x);
      const deg = THREE.MathUtils.radToDeg;
      actions.updateCamera('phi', Math.round(deg(phi) * 10) / 10);
      actions.updateCamera('theta', Math.round(deg(theta) * 10) / 10);
      actions.updateCamera('distance', Math.round(distance * 10) / 10);
    },

    focusSelected() {
      const id = store.selectedObjectIds[0];
      const mesh = id && this._meshes.get(id);
      if (!mesh) return;
      const off = this.camera.position.clone().sub(this.orbit.target);
      this.orbit.target.copy(mesh.position);
      this.camera.position.copy(mesh.position).add(off);
      this.orbit.update();
    },

    onDelete() {
      if (store.selectedObjectIds.length > 0) {
        actions.deleteObject(store.selectedObjectIds[store.selectedObjectIds.length - 1]);
      }
    },

    onResize() {
      const el = this.$refs.container;
      if (!el || !this.renderer) return;
      const w = el.clientWidth || 800, h = el.clientHeight || 500;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }
};
</script>

<style scoped>
.viewport3d {
  background: #000;
  outline: none;
  border-radius: 12px;
  overflow: hidden;
}
.viewport3d:focus-visible { box-shadow: 0 0 0 2px rgba(76, 238, 249, 0.5); }

.vp3d-toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 6px;
  z-index: 5;
  flex-wrap: wrap;
  max-width: calc(100% - 20px);
}
.vp3d-group {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(10, 14, 18, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(6px);
}
.vp3d-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(230, 237, 243, 0.75);
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.12s;
}
.vp3d-btn:hover { background: rgba(76, 238, 249, 0.15); color: #4ceef9; }
.vp3d-btn.active { background: rgba(76, 238, 249, 0.22); color: #4ceef9; }
.vp3d-label { font-size: 10px; letter-spacing: 0.02em; }
.vp3d-accent { color: #f5b942; }
.vp3d-accent:hover { background: rgba(245, 185, 66, 0.18); color: #ffd677; }

.vp3d-readout {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 5;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(10, 14, 18, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(6px);
  font-size: 10px;
  color: rgba(230, 237, 243, 0.85);
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vp3d-name { color: #4ceef9; font-weight: 700; margin-right: 6px; }
.vp3d-props { font-family: ui-monospace, monospace; opacity: 0.8; }

.vp3d-hint {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  padding: 3px 10px;
  border-radius: 6px;
  background: rgba(10, 14, 18, 0.7);
  font-size: 9px;
  color: rgba(230, 237, 243, 0.55);
  pointer-events: none;
  white-space: nowrap;
}

.vp3d-playing {
  position: absolute;
  top: 46px;
  right: 10px;
  z-index: 5;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(220, 38, 38, 0.25);
  color: #fca5a5;
  font-size: 9px;
  font-weight: 600;
  pointer-events: none;
}
</style>
