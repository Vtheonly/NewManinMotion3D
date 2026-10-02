# Iteration 036-001/002 — Video Render Architecture: One Canonical Scene

> **Issue:** #36 (broken video output: white screen, placeholder Text,
> timeline dead air) — two iterations delivered as one coherent redesign.
> **Date:** 2026-10-03
> **Status:** Completed — root cause fixed at the architecture level;
> residuals tracked (V-09, V-10).

## 1. Scope declared before implementation

Per the multi-iteration protocol: fix the broken video output by making the
render pipeline consume the **canonical scene**, not by patching symptoms
(no scale clamping, no hiding the white object, no trimming the dead air).

## 2. Reconstructed history (why the video was broken)

The failure chain, reproduced end-to-end before any fix:

1. The tolerant legacy importer (a #33 follow-up, PR `ad51db1`) converted
   hand-written Manim (`legacy_synth_wall.py`, 616 lines) into the visual
   project model — a **second, lossy scene representation** — and discarded
   the original source.
2. Import losses: named colour constants → default `#ffffff` fills (two
   ~30×12-unit white rectangles covered the frame); variable/f-string text
   args → literal `'Text'` placeholders; unparseable `move_to` expressions →
   objects pinned to stage centre; helper-scoped objects → `enterTime = 0`
   with no exit (visible the whole video); composites (protein, NN,
   sequence, stations, wall) silently dropped.
3. The visual compiler faithfully rendered that corrupted model:
   **56.7s of white screen, clipped/overlapping placeholder text, and dead
   air from ~00:20** — matching the user's report exactly (the broken
   pipeline was reproduced with Manim 0.21 before any code was changed).
4. The exporter also serialized same-time steps sequentially (43 t=0
   entrances → 21.5s of pile-up), inflating every canvas project's timeline.
5. The original scene itself could not render on current Manim CE
   (`self.camera_frame`, 2D point literals, `Wiggle(angle=…)`) — so the
   lossy import was the only path that "rendered" it, garbage instead of an
   error.

## 3. What shipped

| Iteration | Change | Files |
|---|---|---|
| 001 | Canonical render-source contract: `project.sourceMode` (canvas/code), preserved `codeSource`, coverage-reported imports, warned detach, client + API routing, legacy API compat boundary (4 documented rules) | `store/project.js`, `App.vue`, `Topbar.vue`, `routes/projects.js`, `compiler/legacyCompat.js`, `export/importManim.js`, `export/importShapes.js` |
| 002 | Exporter timeline fidelity: same-time steps batched into one parallel `self.play` (per-animation `run_time`), zero-duration `self.add` merges, no `'Text'` placeholder in any render | `compiler/codegen.js`, `compiler/registry/shared.js`, `export/manim.js` |

Architecture documentation: **RENDER-SOURCE.md** (the contract),
ARCHITECTURE.md §8 + module table, AGENT-WORKFLOW boundaries, PROBLEM-REGISTRY
P-011…P-013, TASK-REGISTRY V-01…V-10.

## 4. Verification

| Suite | Result |
|---|---|
| scientific (full, incl. real Manim renders) | **169/169** (144s; previously 25 skipped without manim) |
| API (compiler + IR + render-source) | **61/61** (16 new) |
| Web (engine + scene + import + sourceMode) | **141/141** (35 new), build green |
| Renderer | **14/14** |

E2E evidence:
- Before: imported scaffold → codegen → **56.7s broken video** (white screen,
  clipped text, dead air 20→56s) — archived in the iteration transcript.
- After: the same project renders **its exact source** (compat boundary
  applied, reported in the job result) → **49s, 90 animations** — verified
  visually: dark-navy/canvas split, cyan proteins, brick wall with vertical
  label, lab stations, legible metrics.
- Canvas-project export: same-time enters now one parallel play; exported
  duration == editor timeline (unit-verified); batched codegen renders green.

## 5. Regressions re-verified (issues #1, #29, #32, #33)

- **#1** (closed): registry architecture — all registry/codegen/detection
  tests green; codegen still registry-driven, now with batching in the
  orchestrator (no type knowledge added).
- **#29** (open): sci editor + `render-sci` path untouched and covered
  (sci suites green; the render routing contract extends it without change).
- **#32** (open): canonical sci-ir — full 169-test suite green **including
  real Manim execution tests** (first run with manim available in CI-env
  terms); SCENE-IR.md contract unchanged.
- **#33** (open): one-object-one-row timeline — importer tests green; the
  coverage contract makes the import's limits explicit rather than silent.

## 6. Limitations & deferred

- V-09: per-object approximation badges in the canvas/timeline UI (flags +
  import report exist; visual badges pending #15 UI iteration).
- V-10: semantic IR import for arbitrary Python (B-23/#29) — the scaffold
  import is the honest interim: it never silently becomes the render source.
- Mixed same-time groups containing `.animate` chains use play-level
  `run_time = max(duration)` (documented approximation, RENDER-SOURCE.md §4).
- `legacyCompat` covers the four rules the corpus needs; unknown legacy APIs
  fail loudly with the real traceback (by design).
