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

## Scientific scene syntax & runtime (Issue #32)

| ID | Task | Status | Iter | Notes |
|----|------|:-----:|:----:|-------|
| B-01 | Canonical IR (sci-ir/1): schema, nodes, expressions, values, relationships, timeline, bindings | ✅ | 032-001 | `scientific/ir/`; deterministic serialization |
| B-02 | Type registry with property schemas (21 built-ins) | ✅ | 032-001 | single source of truth for editors |
| B-03 | Python authoring API (`ScientificScene` builder) | ✅ | 032-001 | `runtime/authoring.py` + narrative mixin |
| B-04 | Binding sources + safe evaluator + data sources | ✅ | 032-001 | literal/data/derived/symbol; AST whitelist |
| B-05 | Deterministic IR→Python exporter (round-trip exact) | ✅ | 032-001 | `export/`; custom code preserved verbatim |
| B-06 | Manim adapter (bases, camera, timeline, relationships, 21 renderer bindings) | ✅ | 032-001 | only manim-importing layer |
| B-07 | CLI/execution contract (`python -m scientific.run`, `python scene.py`, `manim …`) | ✅ | 032-001 | delegates to manim CLI — one pipeline |
| B-08 | Pure domain modules (torus, PoE, jacobian, obstacles, screw, protein, sequence, NN, attention, stages, palette, grids, latexify) | ✅ | 032-001 | stdlib only; numerically tested |
| B-09 | Reference scene A — Synthesizability Wall (refactored architecture) | ✅ | 032-001 | composes primitives; renders; round-trips |
| B-10 | Reference scene B — Torus/PoE/Jacobian incl. clash + DLS resolution | ✅ | 032-001 | renders; round-trips; custom boundary demo |
| B-11 | Reference scene C — TIF attention (frames, scores, links, fixed HUD, orbit) | ✅ | 032-001 | renders; round-trips |
| B-12 | API: `GET /api/ir/schema`, `POST /api/ir/validate`, `POST /api/ir/export` | ✅ | 032-001 | `routes/ir.js` |
| B-13 | JS mirrors (type metadata generated, validation, emitter) + parity fixtures | ✅ | 032-001 | byte-identical emission, corpus verdict parity |
| B-14 | Tests: IR/registry/runtime/authoring/evaluator (unit) | ✅ | 032-001 | 60 tests |
| B-15 | Tests: scientific/numerical domain correctness | ✅ | 032-001 | 58 tests (FD-Jacobian, distributions, SE(3)…) |
| B-16 | Tests: round-trip + real execution (exported Python renders via Manim) | ✅ | 032-001 | 16 tests incl. subprocess renders |
| B-17 | Tests: parity (Python vs JS) | ✅ | 032-001 | shared corpus + goldens, both sides |
| B-18 | Tests: architecture (150-line rule, manim boundary, cycles, conventions) | ✅ | 032-001 | `test_architecture.py` |
| B-19 | Docs: scene-ir / authoring-model / runtime-boundary + syntax/* + examples/* | ✅ | 032-001 | 13 documents |
| B-20 | Problem registry (P-001…P-010 discoveries) | ✅ | 032-001 | `problems/PROBLEM-REGISTRY.md` |
| B-21 | Renderer image ships the runtime (context root + .dockerignore) | ✅ | 032-001 | PYTHONPATH + SCIENTIFIC_DATA_ROOT |
| B-22 | Frontend IR authoring UI (generic inspector/editor over /api/ir/schema) | ⬜ | — | #29 / #15 (contract delivered by B-12/B-13) |
| B-23 | Import of arbitrary hand-authored Python → semantic IR (beyond canonical imports) | 🔶 | 036-001 | coverage-reported scaffold import ships (#36); semantic IR conversion still open (#29) |
| B-24 | Code-mode scene picker for multi-scene files | ⬜ | — | #15 |
| B-25 | Uploaded-asset DataRef binding in the editor | ⬜ | — | #23 DataBridge |
| B-26 | Legacy >150-line service files (worker.py, routes, web components) | ⬜ | — | #16/#15/#25; P-008 |

## Feature issues (#2–#29)

| Issue | Title | Status | Iter | Registry entries |
|-------|-------|:------:|:----:|------------------|
| #1 | Decouple architecture from 2D scenes | 🔶 | 001 | A-01…A-19 done; A-20…A-24 deferred to #6/#15/#16 |
| #2 | General-purpose 2D/3D scientific framework | 🔶 | 032-001 | canonical runtime delivered (B-01…B-08); capability depth tracked in #4–#14 |
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
| #17 | Lie-algebraic geometry & screw kinematics | 🔶 | 032-001 | pure modules: SE(3)/Rodrigues/screws/DLS (B-08); full viz layer pending |
| #18 | Geometric deep learning visualization | ⬜ | — | — |
| #19 | Flow matching / GFlowNet visualization | ⬜ | — | — |
| #20 | Structural biology & solvation | ⬜ | — | — |
| #21 | MedChem reactions & stereochemistry | ⬜ | — | — |
| #22 | Hardware / precision diagnostics visualization | ⬜ | — | — |
| #23 | DataBridge, reactive evaluation, live binding | ⬜ | — | — |
| #24 | Multi-viewport, camera direction, presentation systems | ⬜ | — | — |
| #25 | Package architecture & boundaries | ⬜ | — | — |
| #26 | SynPath-3D reference scenes | 🔶 | 032-001 | 3 reference scenes shipped via scientific runtime (B-09…B-11); real PDB/ENSF data pending #20/#23 |
| #27 | Thesis defense slide-deck state machine | ⬜ | — | — |
| #28 | E2E render verification pipeline | ⬜ | — | — |
| #29 | Universal frontend scientific editor | ⬜ | — | — |

## Change log

- **2026-10-01 — Issue #32, Iteration 001**: canonical scientific scene
  IR (sci-ir/1), Python runtime + authoring API, deterministic exporter,
  manim adapter + CLI, three reference scenes (all render + round-trip),
  API IR endpoints with JS parity mirrors, 149 new Python tests + 8 API
  tests, 13 docs, problem registry P-001…P-010. Deferred: B-22…B-26
  (tracked to #29/#15/#23/#16/#25).
- **2026-10-01 — Iteration 001** (Issue #1): registry foundation, scene types,
  scene detection, schema v3, bounded frontend integration, 65 new tests,
  architecture docs. Deferred: A-20…A-24 (tracked to #6/#15/#16).


## Video render architecture (Issue #36)

| ID | Task | Status | Iter | Notes |
|----|------|:-----:|:----:|-------|
| V-01 | Canonical render-source contract (`sourceMode` code/canvas; migration) | ✅ | 036-001 | RENDER-SOURCE.md; client + API routing |
| V-02 | Server-side enforcement: `/render` renders `codeSource` for code-sourced projects | ✅ | 036-001 | real-HTTP tested with fake RESP redis |
| V-03 | Importer coverage report (dropped / approximated / complete) + per-object approx flags | ✅ | 036-001 | no silent drops; no 'Text' placeholder content |
| V-04 | Preserve original code on import; honest summary; warned detach action | ✅ | 036-001 | adoptImportedCode / detachFromSource + UI |
| V-05 | Legacy Manim API compat boundary (4 rules, reported + idempotent) | ✅ | 036-001 | camera_frame, 2D points, move_to pad, wiggle kwarg |
| V-06 | Exporter timeline fidelity: same-time steps batch into one parallel play | ✅ | 036-002 | per-animation run_time; zero-duration adds |
| V-07 | No placeholder 'Text' in any render (server + client safeText) | ✅ | 036-002 | empty renders empty |
| V-08 | E2E render verification of the legacy scene from source | ✅ | 036-001 | 90 animations, 49s, visually verified |
| V-09 | Visual approximation badge per object in canvas/timeline UI | ⬜ | — | approx flags exist; per-object badges pending #15 |
| V-10 | Semantic IR import for arbitrary Python (fold into #29) | ⬜ | — | see B-23 |
