# Iteration 032-001 — Next-Generation Scientific Scene Syntax, Universal Frontend Editing & Runnable Python Runtime

> **Issue:** #32 (foundational iteration 001 of a multi-iteration arc)
> **Date:** 2026-10-01
> **Status:** Completed — bounded scope delivered; residuals tracked (B-22…B-26)

## 1. Scope declared before implementation

Per the mandatory multi-iteration protocol (issue #1 addendum, which governs
the whole toolkit), this iteration delivered the **canonical foundation**:
the scene IR, the Python runtime, the deterministic export, the manim
adapter + CLI, three reference scenes in the new architecture, the API
contract with JS parity mirrors, extensive tests and full documentation.

Deliberately out of scope (tracked in the task registry): the frontend
authoring UI (#29/#15), arbitrary-python semantic import beyond canonical
exports (#29), uploaded-asset data binding (#23), Docker-image E2E render
verification (#16/#28), and the legacy-file size debt (#15/#16/#25).

## 2. What shipped

| Layer | Where | Highlights |
|---|---|---|
| Canonical IR (sci-ir/1) | `scientific/ir/` (9 modules) | schema versioning, node/expression/value/relationship/timeline model, validation, deterministic serialization, expression↔node pairing invariant |
| Type registry | `scientific/registry/` | 21 built-ins with property schemas; duplicate rejection; renderer slots kept separate from metadata |
| Authoring runtime | `scientific/runtime/` | `ScientificScene` builder + narrative mixin, binding sources, safe AST evaluator, data sources, live values |
| Exporter | `scientific/export/` | byte-deterministic IR→Python; custom code verbatim; round-trip exact |
| Manim adapter | `scientific/manim_adapter/` | generic construct() mixin, 3 scene bases (`*Scene` detection-compatible), camera, timeline interpreter, relationships, 21 renderer bindings |
| CLI | `scientific/run.py` | list/dry-run/quality presets; delegates rendering to the manim CLI (one pipeline) |
| Pure domains | `scientific/domains/` (14 modules) | torus/PoE/jacobian/obstacles/screw, protein/sequence, NN, attention, presentation stages, palette/grids/latexify — stdlib only |
| Reference scenes | `presentation/scenes/` (3) + `presentation/data/` fixtures | SynthesizabilityWall (55 objects), TifAttention (14), TorusPoEKinematics (6) |
| API | `services/api/src/ir/` + `routes/ir.js` | schema/validate/export endpoints; generated type mirror; validation + emitter JS mirrors with parity fixtures |
| Docker | renderer Dockerfile + compose + root .dockerignore | runtime shipped into the image (PYTHONPATH + data root) |
| Docs | 13 documents | architecture ×3, syntax ×7, examples ×2, problem registry |

## 3. Files introduced/changed

**New (77):** `scientific/**` (62 source + 6 test files), `presentation/`
(3 scenes + 5 data fixtures), `services/api/src/ir/**` (9), `routes/ir.js`,
`tests/ir.test.mjs`, fixture corpus (7), docs (13).
**Modified (5):** `services/api/src/index.js` (IR routes, still <150 lines),
`package.json` (test script + v1.3.0), renderer `Dockerfile`,
`docker-compose.yml` (build context), root `.dockerignore` (was empty).
**Untouched:** web frontend (per bounded scope; contract delivered via API).

## 4. Verification — tests (the "a lot and a lot" part)

| Suite | Command | Result |
|---|---|---|
| IR + runtime + authoring + evaluator | `python -m unittest discover -s scientific/tests -t .` | **145 tests, 0 failures** (20 auto-skip without manim; full set under the manim venv) |
| Scientific/numerical domains | included above (`test_domains.py`) | 58 tests: FD-Jacobian < 1e-4, SE(3) exponentials, softmax distributions, determinism |
| Round-trip + execution | `test_export_roundtrip.py` | 16 tests incl. **real Manim render of exported Python** (subprocess, MP4 asserted) |
| Python↔JS parity | `test_parity.py` + corpus + goldens | byte-identical emission on all fixtures; verdict parity on all corpus cases |
| Architecture | `test_architecture.py` | 150-line rule, manim boundary, import cycles, scene conventions |
| API (node) | `npm test` (api) | **40 tests** (32 legacy compiler + 8 IR/parity) |
| Renderer | `python -m unittest discover -s tests` | 14 tests (unchanged, still green) |
| Web | `npm test` + `npm run build` | 81 tests green; build succeeds |

## 5. Reference scene execution evidence

All three scenes were rendered end-to-end through the canonical runner at
480p15 during the iteration (post-refactor re-verification included):

```
python -m scientific.run presentation/scenes/synth_wall.py SynthesizabilityWall --quality low
  → Rendered SynthesizabilityWall · 14 animations · MP4 808,873 bytes
python -m scientific.run presentation/scenes/slide_01_tif_attention.py TifAttention --quality low
  → Rendered TifAttention · MP4 353,546 bytes
python -m scientific.run presentation/scenes/slide_02_torus_poe_kinematics.py TorusPoEKinematics --quality low
  → Rendered TorusPoEKinematics · 11 animations · MP4 506,165 bytes
```

Additionally, the execution suite renders an **exported** scene
(`emit(sample_document())` → temp file → runner → MP4 asserted) — the
"frontend-generated Python actually executes" requirement, verified by
test, not by claim. Each reference document also round-trips through the
exporter byte-exactly (semantic equality pinned by tests).

## 6. Bugs found & fixed during the iteration

1. **Rodrigues identity term** — `so3_exp` added `c` on the diagonal instead
   of the identity `1`; caught by the Rz(90°) hand-check, fixed and pinned
   by tests (P-004).
2. **se(3) translation used the axis point instead of the twist** —
   `v = G(θ)·q` was wrong; correct is `G(θ)·(−ω×q)`. Found by hand-computed
   rotation-about-offset-point comparison; FK(0) was silently degenerate
   before (P-004).
3. **Emitter reordering** — emitting all nodes then all expressions broke
   document order (z-order is semantic); fixed by interleaving at the
   paired node position (P-005).
4. **Keyword property collision** — `attention.link`'s `from` produced
   invalid Python; renamed `fromId`/`toId` + emitter splat guard (P-003).
5. **JSON float parity** — `3.0` vs `3` broke byte-parity between the
   emitters; solved by the integral-float canonicalization rule (P-002).
6. **Manim API details** — Sphere/Text/next_to/to_corner/DashedLine misuse
   found during first renders; all fixed with the shared `sides.py` helper
   (P-004).
7. **Formula placement kwargs** — position/rotation/scale were leaking into
   node *properties* after the pairing refactor; now routed to the
   transform with validation guards (P-006).

## 7. Known limitations / deferred

- Frontend authoring UI over the delivered contract → B-22 (#29/#15).
- Arbitrary hand-authored python imports beyond canonical exports → B-23.
- Multi-scene picker for code mode → B-24 (#15).
- Uploaded-asset DataRefs → B-25 (#23).
- Legacy >150-line files (worker.py etc.) → B-26 / P-008.
- LaTeX availability in dev environments (Text fallback) → P-001.
- Docker-image render of the runtime not executed in this environment (no
  Docker) — unit/subprocess rendering evidence instead; E2E stays with
  #16/#28.

## 8. Remaining tasks for issue #32

The canonical foundation is complete and verified. Completion of the issue
as written additionally requires the frontend authoring environment (#29)
and the deeper data/runtime integrations (#23) — per the issue's own
dependency graph and the mandatory multi-iteration rule, those belong to
their tracked issues; the contracts they need (schema discovery, validation,
export, custom-code boundary) are delivered and tested here.
