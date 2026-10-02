# Architecture — Scene Decoupling (Issue #1)

> Status: Iteration 001 complete. This document describes the registry-based
> compiler architecture that decouples the project from the single 2D Manim
> scene model. Future iterations extend this document rather than replace it.

## 1. Overview

Before Issue #1, the pipeline was hardwired to one scene shape:

```
project JSON ──> validator (fixed schema) ──> normalizer ──> codegen
                                                        └─ class MainScene(Scene):   ← hardcoded
                                                                          switch (obj.type)      ← hardcoded
                                                                          switch (enterAnim)     ← hardcoded
renderer: manim -qh scene.py MainScene                ← hardcoded scene name
```

After Iteration 001:

```
project JSON ──> validator ──> normalizer ──> codegen (orchestrator only)
                 ▲                              ▲          ▲
                 │                              │          │
          registry/scenes.js            registry/objects.js │
          (scene types + camera)        registry/animations.js
                                                        │
                     sceneDetect.js / scene_detect.py ──┘
                     (finds scene classes in Python source)

renderer: manim -qh scene.py <detected-or-requested-scene-name>
```

The compiler's orchestration code contains **no knowledge** of specific object
types, animations, or scene types. All capability knowledge is registered in
data-driven registries.

## 2. Module responsibilities

### 2.1 Compiler core (`services/api/src/compiler/`)

| Module | Responsibility | Must not do |
|---|---|---|
| `index.js` | Pipeline orchestration (validate → normalize → resolve scene → codegen); public API | Contain type-specific logic |
| `validator.js` | Zod schema v3 (`sceneType`, `scene`, `camera`) + registry-driven type/animation checks | Hardcode capability lists |
| `normalizer.js` | Defaults, clamps, scene/camera normalization, `_resolvedScene` metadata | Mutate semantic content |
| `codegen.js` | Scene assembly: header → prologue → objects → groups → animation steps (same-time steps batched into one parallel play — issue #36) | Know any concrete object/animation/scene type |
| `legacyCompat.js` | Documented, idempotent, reported shims for removed Manim APIs, applied to the rendered scene.py copy only (issue #36) | Modify the project's codeSource; fix source logic bugs |
| `sceneDetect.js` | Regex-based scene class detection in Python source (no execution) | Execute or import Python |
| `registry/index.js` | Generic registry factory + shared `registries` hub + capability snapshot | Accept duplicate registrations |
| `registry/objects.js` | Built-in object type registrations (17 types) | Touch scene assembly |
| `registry/animations.js` | Enter/exit/clip animation registrations | Touch scene assembly |
| `registry/scenes.js` | Scene type registrations: base class, dimensionality, `emitPrologue`, `knownBases` | Touch object codegen |
| `registry/shared.js` | Shared codegen helpers (colors, coords, easing map, sanitizers) | Registry logic |

### 2.2 Scene types (built-in)

| Key | Python base | Dimensionality | Camera knobs (`supportsCamera`) |
|---|---|---|---|
| `scene_2d` | `Scene` | 2d | backgroundColor |
| `moving_camera` | `MovingCameraScene` | 2d | zoom, centerX, centerY, frameWidth, frameHeight |
| `three_d` | `ThreeDScene` | 3d | phi, theta, distance, zoom, gamma |
| `custom` | user-declared (`scene.baseClass`) | — | backgroundColor |

`scene.className` names the generated class (default `MainScene`, validated as
a Python identifier; `codegen.safeClassName` is the defence-in-depth sanitizer).

### 2.3 Renderer (`services/renderer/`)

| Module | Responsibility |
|---|---|
| `worker.py` | Queue consumer; before rendering, reads the scene file and calls `pick_scene()` |
| `scene_detect.py` | AST-based scene class detection (stdlib `ast`, never executes source) |

Renderer boundary rule: the worker trusts the job payload's `sceneName` **only
if that class exists in the file**; otherwise it renders the first detected
scene and reports the substitution via the job result's `sceneName` field.
A file with no renderable scene fails the job with an actionable error.

### 2.4 Frontend (`services/web/src/`)

| Module | Responsibility |
|---|---|
| `store/project.js` | Project schema v3 (`sceneType`, `scene`, `camera`), `SCENE_TYPES` metadata, `migrateProjectSchema()`, `updateSceneConfig()` / `updateCamera()` actions |
| `export/manim.js` | Client-side codegen parity: same class base + camera prologue as the server; `detectScenesClient()` mirror of server detection |
| `components/topbar/Topbar.vue` | New Project dialog: scene type picker (2D / moving camera / 3D / custom) |
| `components/inspector/PropertiesPanel.vue` | No-selection state: Scene section (type, class name, custom base) + Camera section (fields per scene type) |
| `api.js` | `create()` passes `sceneType`; `renderCode()` omits `sceneName` (server auto-detects); `capabilities.get()` / `capabilities.detectScenes()` |

Frontend/core boundary rule: the frontend never invents scene semantics. The
`SCENE_TYPES` table mirrors the server registry (single source of truth is the
server; `GET /api/capabilities` exposes it for future dynamic UI).

## 3. Scene detection rules

Two implementations must stay behaviourally aligned:

- `services/api/src/compiler/sceneDetect.js` (regex over comment/string-stripped source)
- `services/renderer/scene_detect.py` (Python `ast`)

Shared rules:
1. Strip comments and string literals (best-effort in JS; exact in Python).
2. Collect `class <Name>(<bases>)` definitions.
3. A class is **renderable** when a direct base is a known Manim scene base
   (`Scene`, `MovingCameraScene`, `ThreeDScene`, `VectorScene`, `ZoomedScene`,
   `SampleSpaceScene`, `LinearTransformationScene`) **or** matches the
   `*Scene` naming convention (custom subclasses).
4. Non-scene classes (`VMobject`, `object`, helpers) are never scenes.
5. Picking: requested name (if present in file) → else first scene in source
   order.

Cross-checked by tests on both sides. When you change one, change both.

## 4. Extension points (how to add capabilities)

### Add an object type
```js
// services/api/src/compiler/registry/objects.js (or a plugin module that imports it)
registerObjectType('torus_knot', {
  label: 'Torus Knot',
  codegen(obj, ctx) {
    const n = ctx.vn(obj.id);
    return [`${n} = Torus(radius=1, tube_radius=0.3)`];
  }
});
```
Add the matching client-side preview in the frontend separately (see
PropertiesPanel/AssetSidebar). The validator immediately accepts the type;
`GET /api/capabilities` lists it.

### Add an animation
```js
registerAnimation('enter', 'flash_in', {
  label: 'Flash In',
  codegen: ({ varName, duration, helpers }) =>
    `self.play(Flash(${varName})${helpers.rtOpt(duration)})`
});
```

### Add a scene type
```js
registerSceneType('vector', {
  label: 'Vector Scene',
  baseClass: 'VectorScene',
  dimensionality: '2d',
  knownBases: ['VectorScene'],
  supportsCamera: ['backgroundColor'],
  emitPrologue({ project, hex }) { return [...]; }
});
```
The frontend `SCENE_TYPES` table must gain the matching entry.

### Plugin rules
- One concept, one registration. Duplicate keys throw.
- Register at module load (import side effect) — the compiler has no init step.
- Never branch on registered keys inside core orchestration code.

## 5. Data model (v3 additions)

```jsonc
{
  "sceneType": "scene_2d",              // registered scene-type key
  "scene": {
    "className": "MainScene",           // generated Python class name
    "baseClass": "MyProjectScene"       // only for sceneType: "custom"
  },
  "camera": {                            // only keys the scene type supports
    "zoom": 0.8, "centerX": 2,           // moving_camera
    "phi": 75, "theta": 30               // three_d (degrees)
  }
}
```

Migration: projects saved before v3 get `sceneType: "scene_2d"`,
`scene: { className: "MainScene" }`, `camera: {}` on load (client-side
`migrateProjectSchema`; server-side Zod defaults). Camera keys not supported
by the current scene type are dropped on migration and on scene-type change.

## 6. API additions

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/capabilities` | Registered object types, animations, scene types |
| `POST` | `/api/detect-scenes` | Detect scene classes in Python source |
| `POST` | `/api/projects/:id/render` | Now renders the project's actual scene class (verified via detection) |
| `POST` | `/api/projects/:id/render-code` | `sceneName` optional; auto-detection; 400 with guidance when no scene exists |

## 7. What is intentionally deferred

Per the issue's multi-iteration mandate, these are **out of scope for
Iteration 001** and tracked in the task registry:

- 3D object placement / depth editing in the visual canvas (needs #15 editor
  integration + #6 camera architecture)
- Camera **animation** (zoom/orbit keyframes) — only initial camera setup is
  supported; animation belongs to #6
- Per-scene-type frontend gizmos (3D orbit controls) — #15
- `MovingCameraScene` frame animation clips (`self.camera.frame.animate...`) — #6
- Additional scene bases (VectorScene, ZoomedScene) as first-class frontend
  choices — the registry accepts them; the UI exposes the four core types

## 8. Canonical render-source contract (issue #36)

Every project has ONE canonical scene; the editor preview and the video
exporter both consume it. The tolerant legacy import projects hand-written
code onto the visual model as a **non-destructive scaffold** — the original
source stays the render source whenever the import lost anything. Routing is
enforced client- and server-side; a documented compat boundary keeps legacy
Manim APIs renderable. Full contract, importer rules and timeline semantics:
**[RENDER-SOURCE.md](RENDER-SOURCE.md)**.
