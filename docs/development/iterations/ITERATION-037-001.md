# ITERATION-037-001 — The Comprehensive E2E Audit

> **Issue:** #37 (this iteration created and closed it)
> **Date:** 2026-10-03
> **Scope:** Full-system end-to-end testing as real usage + fixing every
> discovered root cause + regression re-verification of all prior issues.
> **Result:** 3 commits on `main`; **413 web + 65 API (incl. real-render) +
> 14 renderer + 169 scientific checks green.**

## 1. Mandate

"Do significantly more testing and fixing across all of the issues that
have already been addressed. I want a very long, comprehensive end-to-end
test script that exercises the entire system as close as possible to the
way it is actually intended to work. The tests should help determine
exactly which layer is responsible if something fails. Frontend
editability is a hard requirement. 2D and 3D must both be tested. Do not
stop when the obvious problem disappears."

## 2. What the audit found (root causes, not symptoms)

A full read of every layer (store actions, playback engine, both codegens,
every inspector panel) **before** writing a single test surfaced 13
defects. The new E2E suite then proved them and drove the fixes:

| # | Defect | Layer | Fix |
|---|---|---|---|
| F1 | `scaleX/scaleY` hard-coded `1` in every canvas config — scale clips and grow/spin entrances had **no visual effect** in the preview | StageCanvas | apply the overrides |
| F2 | Empty text objects displayed a literal `'Text'` placeholder on canvas (render shows `''`) | StageCanvas | render the real content |
| F3 | Objects rendered **outside their time window** — preview ≠ export | playback engine | `computeFrame` hides out-of-window objects |
| F4 | `obj.visible` was dead state (no UI, honored by no layer) | all | preview + codegen + panel checkbox |
| F5 | Exporters ignored `zOrder` (insertion order) — layering mismatch | codegen | stable zOrder sort |
| F6 | Rotation **mirrored** between preview (CW) and Manim (CCW) | codegen | negate at the export boundary |
| F7 | Scale clips dropped `targetScaleY` | codegen | stretch X/Y about the pivot |
| F8 | **Two duplicated codegen implementations with real drift** (frame 14 vs 14.222; the P-011 disease one layer up) | architecture | ONE shared compiler; client delegates |
| F9 | No parent/child hierarchy anywhere | model | full stack (F-parenting below) |
| F10 | No 3D objects in the visual editor | model/registry | cube/sphere/cone/cylinder end-to-end |
| F11 | Clips could not move between tracks; `sceneDuration` not editable | store/UI | `moveClip` + Track selector + duration field |
| F12 | Groups could not nest | model | cycle-guarded nesting + nested VGroups |
| F13 | Completed clips **snapped objects back** to base state in the preview (export persists) | playback engine | completed clips hold progress=1 |
| F14 | **Timeline drift** — overlapping animations serialized sequentially, every later step late (discovered BY the new E2E render test) | codegen | the wave scheduler |

## 3. The wave scheduler (F14 — found only because of the new tests)

The E2E render test pixel-asserted a real Manim video against the preview
engine's predictions and caught a one-second drift: a move clip `[1,3]`
plus an enter at `t=2` serialized to `t=3`, delaying the exit of a short
window object past its own deadline.

The fix rewrites step emission: steps are grouped into **waves**; a step
whose time falls inside a still-running wave joins that wave's single
`self.play` wrapped as `Succession(Wait(delay), anim)` — it starts at its
exact timeline time. All clip animations became constructor-style
(`ApplyMethod`, `Transform`, `Rotate`) so each carries its own `run_time`
and can be delay-started inside one play. The trailing hold now spans the
editor timeline end (windows + clips + `sceneDuration`) — the video is
exactly as long as what the preview plays.

Verified end-to-end: the rendered video shows the `[2,5)`-window square
disappearing on time, children orbiting to the exact positions
`engine/hierarchy.js` predicts, and layering by zOrder —
`services/api/tests/e2e.render.test.mjs`.

## 4. Hierarchy (F9) — the semantics, stated once

- Objects carry `parentId`; the graph is cycle-safe (actions reject, import
  repairs), deletion orphans children, duplication copies subtrees, and
  paste keeps wired pairs.
- The preview (`engine/hierarchy.js`) composes each ancestor's **own**
  delta (translation / rotation / scale about the parent pivot) onto every
  descendant, top-down — rigid per level, exactly what nested Manim
  families do.
- The exporter emits `fam_A = VGroup(A, fam_B)` (innermost first) and clips
  targeting a parent animate its family about the parent's base center.
- Each object owns its window: a parent's exit does not remove children.

## 5. Test architecture (what runs now)

| Suite | Checks | Verifies |
|---|---|---|
| `web/tests/e2e.test.mjs` | 272 | the whole product workflow: authoring every type + property from the frontend, preview contract, persistence (JSON + real HTTP), byte-identical export parity, adversarial cases, regressions (#1, #33, #36) |
| `api/tests/e2e.render.test.mjs` | 4 | REAL Manim render → ffmpeg frames → pixel assertions at preview-predicted positions (2D exact; 3D structural); skips without manim (`RENDER_E2E=0`) |
| existing suites | 62+22+34+23 / 61 / 14 / 169 | engine, scene, import, sourceMode; compiler/IR/render-source; renderer; scientific |

Run everything: `cd services/web && npm test`, `cd services/api && npm test`,
`cd services/renderer && python -m pytest tests -q`,
`python -m pytest scientific/tests -q`.

## 6. Re-verification of previously solved issues

- **#1 (scene decoupling):** scene types, migration, detection — re-tested
  in E2E Part 6.1; green.
- **#33 (per-object timeline rows):** tolerant import produces one row per
  constructed mobject — Part 6.2; green.
- **#36 (canonical render source):** sourceMode routing (mocked fetch),
  adopt/detach, coverage report, placeholder policy, legacy compat —
  Part 6.3 + the dedicated suites; green. The render-source contract now
  has ONE codegen (stronger than before).
- **#28/#29/#32 (scientific):** 169 scientific tests re-run; green.

## 7. Deferred

- Per-object approx badges (→ #15, unchanged).
- Semantic IR import of arbitrary Python (→ #29, unchanged).
- Combined move+rotate family pivots remain base-center in codegen vs
  current-center in preview (documented approximation, RENDER-SOURCE.md §4).
- 3D preview is a projected layout (camera-dependent position in `three_d`
  scenes is documented; 2D positions are exact).
