/**
 * Stage ↔ 3D-world mapping — the single coordinate contract shared by the
 * Three.js editor viewport (Viewport3D.vue), the canonical store, and the
 * api compiler's codegen (issue #42).
 *
 * The 3D viewport speaks EXACTLY the Manim frame coordinate system that the
 * video renderer uses (services/api/src/compiler/registry/shared.js):
 *   world.x = ((x / sw) - 0.5) * FRAME_WIDTH      (right = +x)
 *   world.y = -((y / sh) - 0.5) * FRAME_HEIGHT    (up = +y, stage y is down)
 *   world.z = (z / sh) * FRAME_HEIGHT             (toward camera = +z / OUT)
 * so an object dragged in the 3D view lands at the same place in the
 * rendered video (WYSIWYG by construction, not by approximation).
 *
 * Rotation contract (verified against Three.js Euler 'XYZ' = Rx·Ry·Rz):
 *   - `rotationX` / `rotationY` are degrees CCW around +x (RIGHT) / +y (UP),
 *     identical to Manim `rotate(rad, axis=RIGHT/UP)` and Three rotation.x/y.
 *   - `rotation` (editor Z) is canvas-clockwise degrees; Manim receives
 *     -rotation rad (editorRotationToManim) which equals Three rotation.z.
 *   - Emission order in codegen: Z, then Y, then X (compose to Rx·Ry·Rz).
 *
 * Pure math only — no three.js import, unit-testable in Node.
 */

export const FRAME_WIDTH = 14 + 2 / 9;   // 14.222… (Manim true frame)
export const FRAME_HEIGHT = 8;
export const FRAME_X_RADIUS = FRAME_WIDTH / 2;
export const FRAME_Y_RADIUS = FRAME_HEIGHT / 2;

export const OBJECT_3D_TYPES = ['cube', 'sphere', 'cone', 'cylinder'];

export function is3dType(type) {
  return OBJECT_3D_TYPES.includes(type);
}

/** Stage pixel position (x, y, z) → Manim/world coordinates. */
export function stageToWorld(x, y, z, sw, sh) {
  return {
    x: ((Number(x) || 0) / sw - 0.5) * FRAME_WIDTH,
    y: -((Number(y) || 0) / sh - 0.5) * FRAME_HEIGHT,
    z: ((Number(z) || 0) / sh) * FRAME_HEIGHT
  };
}

/** World/Manim coordinates → stage pixels (inverse of stageToWorld). */
export function worldToStage(wx, wy, wz, sw, sh) {
  return {
    x: ((wx / FRAME_WIDTH) + 0.5) * sw,
    y: (-(wy / FRAME_HEIGHT) + 0.5) * sh,
    z: (wz / FRAME_HEIGHT) * sh
  };
}

/**
 * Canonical 3D rotations → Three Euler (radians, order 'XYZ').
 * rotationX/Y are direct; editor Z is negated (canvas y-down).
 */
export function propsToEuler(rotationX, rotationY, rotationZ) {
  const d = Math.PI / 180;
  return {
    x: (Number(rotationX) || 0) * d,
    y: (Number(rotationY) || 0) * d,
    z: -(Number(rotationZ) || 0) * d
  };
}

/** Three Euler (radians) → canonical 3D rotations (degrees). */
export function eulerToProps(ex, ey, ez) {
  const r = 180 / Math.PI;
  return {
    rotationX: Math.round(ex * r * 10) / 10,
    rotationY: Math.round(ey * r * 10) / 10,
    rotationZ: Math.round(-ez * r * 10) / 10   // editor Z (clockwise canvas)
  };
}

/**
 * Effective 3D dimensions of a canonical object in world units.
 * Semantics = world bounding-box extents of the UNROTATED primitive
 * (cone/cylinder axis = +z): must MATCH the api compiler's solid3dSize —
 *   cube:     x=width, y=height, z=depth (defaults to width)
 *   sphere:   x=width, y=height, z=width (circular xz footprint)
 *   cone/cyl: x=width, y=width (base), z=height (the axis)
 */
export function object3dSize(obj, sw, sh) {
  const w = ((Number(obj.width) || 1) / sw) * FRAME_WIDTH;
  const h = ((Number(obj.height) || 1) / sh) * FRAME_HEIGHT;
  if (obj.type === 'cube') {
    // depth is stage px (like width) — never rescale the fallback
    const dPx = obj.depth != null ? (Number(obj.depth) || 1) : obj.width;
    return { w, h, d: (dPx / sw) * FRAME_WIDTH };
  }
  if (obj.type === 'cone' || obj.type === 'cylinder') {
    return { w, h: w, d: h };
  }
  return { w, h, d: w };   // sphere
}

/** Mesh geometry kind for the viewport, by canonical type. */
export function meshKind(type) {
  if (type === 'cube') return 'box';
  if (type === 'sphere') return 'sphere';
  if (type === 'cone') return 'cone';
  if (type === 'cylinder') return 'cylinder';
  return 'flat';    // 2D types → flat plane at z = 0
}

/** Clamp helper for gizmo write-back. */
export function round1(v) { return Math.round(v * 10) / 10; }
