# Iteration 001 — Decouple the Architecture from 2D Manim Scenes

> **Issue:** #1 (foundational)
> **Date:** 2026-10-01
> **Branch / PR:** `issue-1/iteration-001-decouple-architecture`
> **Status:** Completed — bounded scope delivered; residual tasks deferred (see below)

## 1. Goals (declared before implementation)

1. Remove the hardcoded `class MainScene(Scene)` coupling from code generation.
2. Introduce a data-driven **registry architecture** (objects / animations /
   scene types) so new capabilities never require core compiler changes.
3. Support 2D, moving-camera, 3D, and custom scene classes end to end.
4. Implement **scene detection** (JS + Python) so the renderer no longer
   assumes a fixed scene name.
5. Extend the project schema with `sceneType` / `scene` / `camera` (+
   migration), with bounded frontend integration.
6. Ship tests for all of the above, plus the mandated documentation structure.

Out of scope (deliberately): the entire roadmap (#2–#29), camera animation
clips, 3D canvas gizmos, per-domain visualizations.

## 2. Task list & completion

| # | Task | Status |
|---|------|:------:|
| 1 | Generic registry core (`createRegistry`, duplicate rejection) | ✅ |
| 2 | Object registry — all 17 legacy types as codegen entries | ✅ |
| 3 | Animation registry — 11 enter / 9 exit / 5 clip | ✅ |
| 4 | Scene registry — `scene_2d`, `moving_camera`, `three_d`, `custom` with `emitPrologue` camera hooks | ✅ |
| 5 | `codegen.js` v5 — pure orchestrator, registry-driven | ✅ |
| 6 | Validator v3 — schema + registry-driven checks | ✅ |
| 7 | Normalizer v3 — scene/camera normalization | ✅ |
| 8 | `sceneDetect.js` (JS) + `scene_detect.py` (AST) | ✅ |
| 9 | Render routes use detected/actual scene names | ✅ |
| 10 | Worker scene-detection fallback + `sceneName` in job results | ✅ |
| 11 | `GET /api/capabilities`, `POST /api/detect-scenes` | ✅ |
| 12 | Frontend schema v3 + migration + `SCENE_TYPES` | ✅ |
| 13 | New Project dialog scene-type picker | ✅ |
| 14 | PropertiesPanel Scene + Camera editors | ✅ |
| 15 | Client codegen parity + `detectScenesClient` | ✅ |
| 16 | Test suites (API 32, renderer 14, frontend 19) | ✅ |
| 17 | Documentation (`docs/development/**`) | ✅ |

## 3. Files changed

**New (17):**
- `services/api/src/compiler/registry/{index,objects,animations,scenes,shared}.js`
- `services/api/src/compiler/sceneDetect.js`
- `services/api/tests/{compiler.test.mjs,smoke.mjs}`
- `services/renderer/scene_detect.py`, `services/renderer/tests/test_scene_detect.py`
- `services/web/tests/scene.test.mjs`
- `docs/development/` (architecture, roadmap, task registry, iterations, agents, issues)

**Modified (15):**
- `services/api/src/compiler/{codegen,validator,normalizer,index}.js`
- `services/api/src/index.js` (capabilities + detect-scenes endpoints)
- `services/api/src/routes/projects.js` (render routes use detection)
- `services/api/package.json` (test script)
- `services/renderer/worker.py`, `services/renderer/Dockerfile`
- `services/web/src/{store/project.js,api.js,export/manim.js}`
- `services/web/src/components/topbar/Topbar.vue`, `services/web/src/components/inspector/PropertiesPanel.vue`
- `services/web/package.json` (test script)

**Housekeeping:** normalized CRLF→LF across 8 source files (separate commit,
no content changes).

## 4. Architecture changes

See `../architecture/ARCHITECTURE.md` (full document). Summary:

- The compiler orchestration (`codegen.js` v5) contains zero knowledge of
  concrete object/animation/scene types; everything resolves through the
  registries at runtime.
- `compileProject()` now returns `sceneName` + `sceneType`; the render routes
  verify the class exists in the generated code before enqueueing.
- The renderer reads the scene file and picks the requested scene if present,
  else the first detected scene; the used name is written back to the Redis
  job record.
- New capability contract: register → validate → codegen, all data-driven,
  duplicates rejected, surfaced via `GET /api/capabilities`.

## 5. Frontend changes

- Project schema v3 (`sceneType`, `scene.className`, `scene.baseClass`,
  `camera`) with backward-compatible migration in `importJSON` /
  `loadFromServer`.
- New Project dialog: scene type selector (Visual mode) with hints.
- Properties panel (no selection): **Scene** section (type / class name /
  custom base) and **Camera** section (fields vary by scene type; invalid
  camera keys dropped on type change).
- Code editor rendering no longer sends a hardcoded scene name — the server
  auto-detects scene classes in user code (any `Scene`, `MovingCameraScene`,
  `ThreeDScene`, or custom `*Scene` subclass now renders from Code-Only mode).
- Client-side export (`export/manim.js`) generates the same class base +
  camera prologue as the server (parity), and exposes `detectScenesClient`.

## 6. Core/backend changes

Covered in §4–5 above; renderer changes: `scene_detect.py` (stdlib `ast`,
never executes user code) + worker integration + Dockerfile copy.

## 7. Tests added

| Suite | Location | Count | Runner |
|-------|----------|:-----:|--------|
| Compiler architecture | `services/api/tests/compiler.test.mjs` | 32 | `npm test` (node:test) |
| Scene detection (Python) | `services/renderer/tests/test_scene_detect.py` | 14 | `python -m unittest` |
| Frontend scene metadata + detection | `services/web/tests/scene.test.mjs` | 19 | `npm test` |

**Coverage of the issue's required test list:**
- scene detection ✅ (JS 7 tests + Python 14 tests, cross-implementation)
- compiler/plugin registration ✅ (6 tests)
- 2D scene generation ✅ (3 tests incl. legacy-schema regression)
- moving-camera scene generation ✅ (2 tests)
- 3D scene generation ✅ (2 tests)
- custom scene names ✅ (3 tests)
- unsupported/invalid scene handling ✅ (5 tests)
- renderer integration ✅ (3 tests via pickScene contract)
- regression for 2D-only assumptions ✅ (v2 project JSON without sceneType
  compiles as 2D; legacy generated-code assertions)

## 8. Tests executed & results

```
services/api    npm test                      32 pass, 0 fail
services/web    npm test   (engine + scene)   62 + 19 pass, 0 fail
services/render python -m unittest            14 pass, 0 fail
services/web    npm run build                 success (pre-existing chunk-size warning only)
API boot        node src/index.js + curl      /api/capabilities + /api/detect-scenes OK
```

## 9. Bugs found & fixed during the iteration

1. **Unknown-animation fallback semantics** — the first codegen draft made
   `exit: 'none'` render `FadeOut` because a null emission was
   indistinguishable from an unregistered animation. Fixed by separating
   "registered but emits nothing" from "unregistered → v4 fallback".
2. **Client codegen camera mirror drift** — the client initially emitted
   `self.camera.frame.move_to(...)` without guarding missing fields; aligned
   exactly with the server's conditional emission (regression-tested).
3. **CRLF line endings** blocked surgical edits in 8 files; normalized in a
   separate no-content commit to keep diffs clean.

## 10. Known limitations

- The visual canvas still previews in 2D for 3D projects (objects render in
  the XY plane; no depth editing yet) — the **generated code** is a real
  `ThreeDScene`, but WYSIWYG fidelity for 3D comes with #15/#6.
- Camera support covers **initial** configuration only (zoom / center / frame
  size for moving camera; phi / theta / distance / gamma for 3D). Camera
  *animation* is #6.
- Scene detection trusts direct bases only (`class A(B)` where B is a known
  base or `*Scene`); deeply indirect inheritance (A → B → Scene where B is
  defined in another file) resolves via the `*Scene` naming convention only.
- `render-code` with multiple scenes renders the first unless a `sceneName`
  is requested; the frontend does not yet offer a scene picker for code mode
  (deferred to #15).
- Docker render of a 3D scene has not been executed in CI (no Docker in the
  dev environment for this iteration); unit + boot verification only (A-24).

## 11. Deferred work

Tracked in `../roadmap/TASK-REGISTRY.md` as A-20…A-24, mapped to issues
#6 / #15 / #16.

## 12. Remaining tasks for Issue #1

The acceptance criteria are met at the architectural level. The registry
boundaries, scene-type support, scene detection, separation of concerns,
frontend integration for scene selection/camera, documentation, and tests are
in place. Remaining work (3D canvas editing, camera animation, gizmos,
Docker E2E verification) belongs to the dependent issues by design and is
recorded in the task registry — per the issue's own rule that dependent
capability belongs to #4–#16 rather than to #1.
