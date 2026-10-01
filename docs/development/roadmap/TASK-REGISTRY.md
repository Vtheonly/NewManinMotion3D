# Master Task Registry

> Single source of truth for every capability tracked across the project.
> Updated at the end of every iteration. See `roadmap/ROADMAP.md` for sequencing
> and `iterations/` for what actually shipped.

## Legend

- **Status**: ✅ done · 🔶 partial · ⬜ not started · 🚫 deliberately dropped
- **Iter**: iteration that last touched the task

## Registry / architecture foundation (Issue #1)

| ID | Task | Status | Iter | Notes |
|----|------|:-----:|:----:|-------|
| A-01 | Generic compiler registries (objects / animations / scenes) | ✅ | 001 | `registry/index.js`; duplicate keys rejected |
| A-02 | Object type registry with all 17 legacy types | ✅ | 001 | output byte-compatible with v4 generator |
| A-03 | Animation registry (11 enter / 9 exit / 5 clip) | ✅ | 001 | registry-driven validation |
| A-04 | Scene type registry (2D / moving-camera / 3D / custom) | ✅ | 001 | `emitPrologue` camera hooks |
| A-05 | Scene detection (JS, no execution) | ✅ | 001 | `compiler/sceneDetect.js` |
| A-06 | Scene detection (Python AST) | ✅ | 001 | `renderer/scene_detect.py` |
| A-07 | Renderer renders any detected scene class | ✅ | 001 | `worker.py` + `sceneName` in job result |
| A-08 | Project schema v3 (sceneType / scene / camera) | ✅ | 001 | validator + normalizer + Zod defaults |
| A-09 | Migration of legacy projects on load | ✅ | 001 | client `migrateProjectSchema`, server defaults |
| A-10 | Capability discovery endpoint | ✅ | 001 | `GET /api/capabilities` |
| A-11 | Scene detection endpoint | ✅ | 001 | `POST /api/detect-scenes` |
| A-12 | Frontend: scene type picker in New Project dialog | ✅ | 001 | Topbar |
| A-13 | Frontend: Scene + Camera property editors | ✅ | 001 | PropertiesPanel (no selection) |
| A-14 | Frontend: client codegen parity for scene types | ✅ | 001 | `export/manim.js` |
| A-15 | Frontend: client scene detection mirror | ✅ | 001 | `detectScenesClient` |
| A-16 | Tests: registry / codegen / detection (API) | ✅ | 001 | 32 tests, `npm test` in `services/api` |
| A-17 | Tests: scene detection (renderer) | ✅ | 001 | 14 tests, unittest |
| A-18 | Tests: frontend scene metadata + detection | ✅ | 001 | 19 tests in `tests/scene.test.mjs` |
| A-19 | Architecture documentation | ✅ | 001 | `architecture/ARCHITECTURE.md` |
| A-20 | 3D object placement / depth editing in visual canvas | ⬜ | — | needs #15 + #6 |
| A-21 | Camera animation clips (zoom / orbit keyframes) | ⬜ | — | #6 |
| A-22 | Frontend gizmos per scene type (3D orbit controls) | ⬜ | — | #15 |
| A-23 | Additional scene bases as first-class UI choices (VectorScene, ZoomedScene) | ⬜ | — | registry accepts them already |
| A-24 | Docker-level end-to-end render verification of 3D scenes | ⬜ | — | #16 |

## Feature issues (#2–#29)

| Issue | Title | Status | Iter | Registry entries |
|-------|-------|:------:|:----:|------------------|
| #1 | Decouple architecture from 2D scenes | 🔶 | 001 | A-01…A-19 done; A-20…A-24 deferred to #6/#15/#16 |
| #2 | General-purpose 2D/3D scientific framework | ⬜ | — | — |
| #3 | Project governance / task registry / agent system | 🔶 | 001 | this file + iterations/ + agents/ started |
| #4 | Reactive state engine | ⬜ | — | — |
| #5 | Highlighting & semantic annotation | ⬜ | — | — |
| #6 | Unified 2D/3D camera architecture | ⬜ | — | will consume A-21 |
| #7 | Math graphs, dynamic functions, layout | ⬜ | — | — |
| #8 | Matrix & tensor visualization | ⬜ | — | — |
| #9 | Neural network visualization | ⬜ | — | — |
| #10 | Attention / transformer visualization | ⬜ | — | — |
| #11 | Data-driven animation & comparison | ⬜ | — | — |
| #12 | Graph/network primitives | ⬜ | — | — |
| #13 | Molecular & scientific visualization | ⬜ | — | — |
| #14 | Animation primitive library & high-level API | ⬜ | — | — |
| #15 | Frontend editor integration (all capabilities) | ⬜ | — | will consume A-20/A-22 |
| #16 | Unified testing / Docker reproducibility | ⬜ | — | will consume A-24 |
| #17 | Lie-algebraic geometry & screw kinematics | ⬜ | — | — |
| #18 | Geometric deep learning visualization | ⬜ | — | — |
| #19 | Flow matching / GFlowNet visualization | ⬜ | — | — |
| #20 | Structural biology & solvation | ⬜ | — | — |
| #21 | MedChem reactions & stereochemistry | ⬜ | — | — |
| #22 | Hardware / precision diagnostics visualization | ⬜ | — | — |
| #23 | DataBridge, reactive evaluation, live binding | ⬜ | — | — |
| #24 | Multi-viewport, camera direction, presentation systems | ⬜ | — | — |
| #25 | Package architecture & boundaries | ⬜ | — | — |
| #26 | SynPath-3D reference scenes | ⬜ | — | — |
| #27 | Thesis defense slide-deck state machine | ⬜ | — | — |
| #28 | E2E render verification pipeline | ⬜ | — | — |
| #29 | Universal frontend scientific editor | ⬜ | — | — |

## Change log

- **2026-10-01 — Iteration 001** (Issue #1): registry foundation, scene types,
  scene detection, schema v3, bounded frontend integration, 65 new tests,
  architecture docs. Deferred: A-20…A-24 (tracked to #6/#15/#16).
