# Problem Registry — Discovered Constraints & Debt

> Issue #32 §19: every newly discovered architectural constraint, runtime
> dependency, API limitation or serialization problem is recorded here the
> moment it is found, so no future agent has to rediscover it.
> Additions are append-only; resolve entries by linking the fixing task.

## P-001 — MathTex requires a LaTeX toolchain (runtime dependency)

**Found:** iteration 001 of #32 (2026-10-01).
`manim.MathTex` shells out to `latex` + `dvisvgm`. Dev environments without
TeX render formulas via the **documented Text fallback**
(`bindings/math.py::_math_tex` — warns into `ctx.warnings`, colours the
formula `warn`). The Docker renderer image (`manimcommunity/manim:stable`)
ships LaTeX, so production renders formulas natively. Consequence: formula
visual fidelity differs between dev and production — acceptable and
documented; revisit only if pixel-diff fixtures (#16) need dev parity.

## P-002 — JSON erases integral-float vs int (serialization)

`JSON.parse("3.0") === 3` in JS, so cross-language byte parity of exported
Python is impossible if integral floats keep `.0`. **Rule adopted**
(VERSIONING.md §3): integral floats canonicalize to ints everywhere
(serialize `_canonical`, `format_float`, JS `pyLiteral`); `semantic_equal`
compares canonical JSON. Non-integral floats use shortest-round-trip
formatting; extreme exponents (`1e-07` vs `1e-7`) are explicitly outside
the supported corpus.

## P-003 — Python keywords cannot be property kwargs

`attention.link` originally used `from`/`to` properties — the exporter
would emit `from=...` (a `SyntaxError`). **Renamed to `fromId`/`toId`**;
the emitter additionally splats keyword-named properties as
`**{"from": ...}` as a safety net. Rule: prefer non-keyword property names.

## P-004 — Manim CE 0.21 API gotchas (renderer bindings)

- `Sphere(center=...)`, not `point=` (points are `Arrow3D(start=…, end=…)`).
- `Text(..., weight=BOLD)` at construction; there is no zero-arg
  `set_weight()`.
- `next_to`/`to_corner` need direction **constants**, not strings — use
  `manim_adapter/sides.py::side()` (shared helper; do not re-implement).
- `Line(..., dashed=True)` does not exist — use `DashedLine`.
- Rodrigues needs `R = I + sinθK + (1−cosθ)K²` (identity term!), and the
  se(3) translation uses the twist `v_s = −ω × q`, **not** the axis point
  (see `poe.py` — both were real bugs caught by the numerical tests).

## P-005 — Expression↔node pairing is load-bearing for ordering

Object order in the IR is semantic (z-order). Because `scene.formula()`
creates both the expression and its node, the exporter must emit the
`formula()` call **at the paired node's position** in the object sequence
(a two-pass nodes-then-expressions emitter reorders the rebuilt document
and breaks round-trip equality). Invariant now documented in SCENE-IR.md §2
and pinned by tests.

## P-006 — Authoring reserved-parameter hazard

`node(rotation=[...])` silently meant to pass an `attention.frame` euler
triple but collided with the transform's `rotation` float. The builder now
raises a precise error (domain orientation belongs in properties, e.g.
`euler`), and `formula()` routes placement kwargs identically.

## P-007 — Docker build context must be the repo root (runtime shipping)

The renderer image needs `scientific/` + `presentation/data/`, which live
outside `services/renderer`. `docker-compose.yml` now builds the renderer
with `context: .` + `dockerfile: services/renderer/Dockerfile`, and a root
`.dockerignore` keeps node_modules/.git out of the context.

## P-008 — Legacy >150-line files (debt, NOT introduced by #32)

The 150-line rule is enforced by test for everything under `scientific/`
and `presentation/`. Pre-existing violations elsewhere (tracked to their
own issues, not this task): `services/renderer/worker.py` (258 — #16),
`services/api/src/compiler/sceneDetect.js` (156), several API routes and
web components (100–1100 lines — #15/#25 package-architecture work).

## P-009 — Custom-step namespace contract

Custom steps run with `scene/ctx/manim/doc/values/mobs`; `ctx.mobs` is the
documented alias of `ctx.mobjects` (scene code brevity). Changing this
namespace is a breaking change to hand-written custom steps — treat it like
a schema bump (VERSIONING.md).

## P-010 — One render pipeline, by construction

`scientific.run` delegates actual rendering to `python -m manim …` rather
than driving Scene.render() programmatically — this keeps the CLI, Code-Only
editor path and the Docker worker on literally the same execution path
(and inherits manim CLI flag semantics for free).

## P-011 — A lossy import became the render source (root cause of issue #36)

**Found:** iteration 001 of #36 (2026-10-03).
The tolerant legacy importer (a #33 follow-up) converted hand-written Manim
into the visual project model and that approximation **silently became the
render source** — the second scene representation the canonical contract
forbids. Named colour constants resolved to default white fills covering the
frame; variable/f-string text args became literal 'Text' placeholders;
unparseable positions pinned objects to center; helper-scoped objects were
forced to `enterTime = 0`. **Fix (architecture, not a patch):** the
render-source contract — `project.sourceMode`, coverage-reported imports,
code preserved verbatim, server-side routing enforcement, warned detach
(RENDER-SOURCE.md). Importer approximations are now editor-visible only.

## P-012 — `.animate` builders cannot carry per-animation run_time

**Found:** iteration 002 of #36 (2026-10-03).
Manim CE accepts per-animation `run_time` on Animation constructors inside
one `self.play`, and `animate.with_duration()` does not exist (0.21) —
`.animate` chains only take play-level run_time, which overrides everything.
Codegen therefore batches same-time steps with per-animation run_time for
constructor animations, and play-level `run_time = max(duration)` for groups
containing `.animate` chains (documented approximation, RENDER-SOURCE.md §4).

## P-013 — The legacy synth_wall fixture targeted removed Manim APIs

**Found:** iteration 001 of #36 (2026-10-03).
`self.camera_frame` (removed in CE 0.15), 2D point literals passed to
Polygon/Line/Dot (CE requires 3D points), 2D points reaching `move_to`
through helper arguments, and `Wiggle(angle=…)` (renamed `rotation_angle`)
all fail on current Manim CE. Hand-written scenes therefore need the
**documented, reported compat boundary** (`compiler/legacyCompat.js`) at the
render layer rather than erroring — the source itself is never rewritten.
The fixture also carried a genuine `loop_col`/`loop_c` NameError (fixed in
the fixture; source logic bugs are NOT compat rules).

## P-014 — Timeline drift on overlapping animations (the serializer bug)

**Found:** E2E audit, iteration 037-001 (2026-10-03).
The exporter serialized step groups sequentially: a 2s move clip starting at
t=1 pushed a same-time-group at t=2 to t=3, and every later step (including
exit animations) drifted by the overlap — while the preview runs clips in
parallel. The exported video could never match the editor on any timeline
with overlapping animations. **Fix (architecture):** the wave scheduler —
steps that overlap a running wave join its single `self.play` as
`Succession(Wait(delay), anim)`; all clip animations are constructor-style
so each carries its own `run_time`. Verified by pixel-asserting a real
render at the exact positions the preview engine predicts.

## P-015 — Preview/export parity defects (six separate root causes)

**Found:** E2E audit, iteration 037-001 (2026-10-03).
Each of these made the canvas disagree with the rendered video, none were
visible from isolated unit tests: (a) objects rendered outside their
`[enterTime, enterTime+duration)` window; (b) `obj.visible` was dead state
honored by no layer; (c) exporters ignored `zOrder` (insertion order
instead); (d) rotation was mirrored (canvas CW vs Manim CCW); (e) scale
clips dropped `targetScaleY`; (f) completed clips snapped the preview back
to base state while the export persists them. **Fix:** all six closed at
their layers — `computeFrame` enforces windows + visibility, the codegen
filters invisible objects and sorts by zOrder, rotation/scale convert at
the export boundary, and completed clips hold their final value.

## P-016 — Duplicated codegen (client vs server) with real drift

**Found:** E2E audit, iteration 037-001 (2026-10-03).
The browser export maintained a parallel Manim generator that had already
drifted from the server compiler (frame width 14 vs 14.222, dot radius 7 vs
7.11) — the same second-representation disease as P-011, one layer up.
**Fix:** the client delegates to the shared registry compiler
(`api/src/compiler`), so the downloaded `.py` and the rendered `scene.py`
are byte-identical (regression-tested).

## P-017 — Missing frontend editability: hierarchy, 3D, visibility, tracks

**Found:** E2E audit, iteration 037-001 (2026-10-03).
`parentId` did not exist, there were no 3D mobjects in the visual editor,
`visible` had no UI, clips could not move between tracks, groups could not
nest, and `sceneDuration` was not editable — the backend could not inspect
or modify what the product contract said should be editable. **Fix:** the
full stack — cycle-safe `setParent` + subtree duplication + orphan-on-delete
+ migration repair; cube/sphere/cone/cylinder registered end-to-end with
`z` placement; visibility checkbox honored by preview + codegen;
`moveClip` + Track selector; nested groups; sceneDuration field.

## P-018 — 3D objects were flat drawings with no editing layer (issue #42)

**Found:** user report, iteration 038-001 (2026-10-03).
3D solids rendered as hand-drawn 2D isometric projections on Konva: no
orbitable view, no transform gizmos, no per-axis rotation, no depth, no
real-time 3D interaction — and the only 3D "camera" knob was numeric in
the inspector. A latent codegen bug compounded it: `Cone(radius=...)` is
not a valid Manim CE signature (`base_radius`) — any cone would have
failed the render. **Fix:** the interactive 3D viewport
(`Viewport3D.vue`, three.js) speaking the exact compiler coordinate frame
(`engine/stage3d.js` contract); canonical `rotationX`/`rotationY`/`depth`
+ non-uniform dimensions via `stretch_to_fit_*`; per-axis rotations
composed Z→Y→X to equal Three Euler XYZ; Camera→Render bridge; mixed
2D/3D scenes; playback-following meshes. The 3D viewport is a third view
of the ONE canonical scene — never a second model.
