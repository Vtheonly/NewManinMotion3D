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
