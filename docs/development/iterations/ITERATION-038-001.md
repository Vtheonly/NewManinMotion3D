# ITERATION-038-001 — Interactive 3D Editing

> **Issue:** #42 (this iteration created and closed it)
> **Date:** 2026-10-03
> **Scope:** Real 3D viewport (orbit camera, transform gizmos, full 3D
> property editing), canonical 3D property model, codegen 3D parity,
> mixed-scene support, persistence + render verification.
> **Result:** commits on `main`; **422 web + 68 API + 14 renderer +
> 169 scientific checks green; real-Manim render of a gizmo-edited scene
> pixel-verified.**

## 1. Mandate

"I can successfully create a 3D object, but I can't properly edit it in
3D, transform it, view it from different angles, or add whatever
properties we want to it. I want every object fully editable and
manipulable from the 3D view, with proper tools to transform, modify,
inspect, and interact with it in real time — like Three.js + Konva, a
proper 3D editing/manipulation system."

## 2. Investigation first

Verified in dev AND production builds (agent-browser over the real UI):
creation, selection, inspector editing, canvas drag and transformer resize
all functioned. The reported gap was the missing 3D editing layer itself:
3D objects were hand-drawn 2D isometric projections on Konva — no orbit,
no view angles, no 3D transforms, no gizmos, no per-axis rotation, no depth.

## 3. What was built (root architecture, not a patch)

| Piece | What it does |
|---|---|
| `engine/stage3d.js` | The stage↔world coordinate CONTRACT (mirrors `registry/shared.js` + `solid3dSize`): stage px → Manim frame units, y-flip, +z toward camera, Euler↔props mapping, per-type dimension semantics |
| `components/stage/Viewport3D.vue` | Three.js viewport: OrbitControls (orbit/pan/zoom), raycast selection + hover, TransformControls gizmos (move/rotate/scale, per-axis), QWER shortcuts, snap, view presets, focus, grid/axes chrome, playback-following meshes, Camera→Render bridge, 2D-plane constraints for flat objects |
| Canonical 3D props | `rotationX`/`rotationY` (deg, CCW around +x/+y), `rotation` = editor Z, `depth` (cube), non-uniform `width/height/depth` |
| Codegen | Unit ctor + `stretch_to_fit_width/height/depth` to exact canonical extents; per-axis rotations emitted Z→Y→X (composes to `Rx·Ry·Rz` = Three Euler 'XYZ' — verified); z placement unchanged |
| Inspector | 3D Position (XYZ), 3D Size (W/H/D + resolution), 3D Rotation (X/Y/Z + Reset/Upright helpers) — all live-synced with the viewport |
| App | Canvas \| **3D** \| Code switcher; auto-switch to 3D on 3D object creation (`view3dTick`) |

Also fixed a **latent codegen bug**: `Cone(radius=...)` was never a valid
Manim CE signature (it is `base_radius`) — a cone in any project would have
failed the render with a TypeError.

## 4. Verification

- `tests/stage3d.test.mjs` (9 checks): coordinate round-trips, corner
  mapping, Euler↔props inversion, Manim/Three composition identity,
  per-type size semantics (caught a real double-scaling bug in the depth
  fallback — fixed in both copies).
- API compiler tests (3 new): stretch dimensions, rotation order
  Z→Y→X, zero-rotation suppression.
- Browser E2E (real UI, real HTTP): create cube → viewport auto-activates →
  raycast select → gizmo Y-drag → store y 540 → −578 (correct direction) →
  inspector writes 3D state → mesh reflects it exactly → save → reload →
  load → mesh rebuild byte-identical → compiled code matches the mesh
  position/euler/scale exactly → **real Manim render → ffmpeg pixel check
  finds the rotated sphere (831 hits)**.
- Mixed scenes: sphere + text both render in the viewport at the playhead.
- Full regression: web 422, api 68 (incl. real-render E2E), renderer 14,
  scientific 169+12, vite build green.

## 5. Documented boundaries

- The 2D Konva canvas remains a *layout preview* for 3D solids (projected
  drawing); the 3D viewport is the WYSIWYG view. The render matches the 3D
  viewport.
- Camera: orbiting the editor camera does not change the render camera
  until "Camera → Render" is pressed (explicit intent).
- Sphere/cone/cylinder gizmo scale hides the Z axis (their depth canonically
  mirrors width); cube scales full XYZ.
- Multi-selection shows highlights but the gizmo operates on single
  selection (multi-edit via the inspector).
