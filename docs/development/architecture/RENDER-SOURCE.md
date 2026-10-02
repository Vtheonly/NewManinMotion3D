# Render-Source Contract — One Canonical Scene (issue #36)

> **Status:** Iterations 001–003 complete (E2E audit). This document defines
> the architecture the render pipeline must maintain: every exported video is
> a rendering of the **same canonical scene** the editor holds. It extends
> `SCENE-IR.md` (the scientific scene model) to the visual and code editors.

## 1. The contract

Every project has exactly **one canonical scene**, and both renderers — the
editor preview and the video exporter — consume it. The exporter must never
reconstruct, approximate, or invent a second version of the scene.

```
                        ┌─> Editor preview (Konva / schematic canvas)
Canonical scene ────────┤
                        └─> Video exporter (Manim via the render queue)
```

The canonical scene is selected by `project.sourceMode` (visual projects) or
`project.editorMode`:

| Mode | Canonical scene | Preview | Video export |
|---|---|---|---|
| `canvas` (visual, default) | the object/track model (project JSON) | StageCanvas (WYSIWYG) | compiler codegen → `POST /api/projects/:id/render` |
| `code` (code-only **or** imported-from-code) | `project.codeSource` (verbatim Python) | code editor (WYSIWYG by execution) | `POST /api/projects/:id/render-code` with the exact source |
| `scientific` (IR) | `project.sciDocument` (sci-ir/1) | SciCanvas (documented schematic) | `POST /api/projects/:id/render-sci` → deterministic Python export |

Routing is enforced in **both** the frontend (`renderOnServer`) and the API
(`/render` refuses to compile the scaffold of a code-sourced project and
renders its `codeSource` instead). One concept, one route — defence in depth.

## 2. The import bridge (tolerant legacy import)

Hand-written Manim Python can be pulled into the visual editor ("Apply code
to canvas") for editing. The parse is a **projection, not a conversion**:

1. **The original code is always preserved** in `project.codeSource` — never
   discarded.
2. The importer returns a **coverage report** (`coverage`):
   - `dropped` — constructs referenced by the scene flow that the visual
     model cannot represent (helper-built composites, camera rigs, custom
     animations). Recorded live at the point of reference.
   - `approximated` — objects whose colour/position/text/size fell back to a
     default because the source expression was not a literal; each carries
     per-object `approx` flags.
   - `complete` — true only when nothing was lost.
3. Whenever anything was dropped or approximated, the project becomes
   **code-sourced** (`sourceMode: 'code'`): renders reproduce the authored
   scene exactly, and the scaffold is a non-destructive editing aid. The UI
   reports the losses; the Code tab keeps showing the canonical source.
4. Switching the canvas model to the render source is an **explicit, warned,
   one-way action** (`File > Detach from Source Code`): the user takes
   ownership of the approximation, knowing what was dropped.
5. A fully representable round-trip (canvas → code → canvas) stays
   `canvas`-sourced — the historical workflow is unchanged.

What the importer must never do: fabricate placeholder objects, invent
colours or positions, silently discard the source, or let its approximation
become a render source by default.

## 3. Legacy Manim API compatibility boundary

Code-sourced renders execute the author's Python verbatim on the current
Manim CE. Scenes written against removed APIs fail loudly — which is correct
— but a small, **documented** set of pure renames is auto-applied to the
rendered `scene.py` copy so old scenes keep rendering (`compiler/legacyCompat.js`):

| Rule | Shim | Note |
|---|---|---|
| `camera_frame` | read/write alias property onto `self.camera.frame` | removed in Manim CE 0.15 |
| `point_2d_literals` | 2-element point literals in point-taking ctors padded to `[x, y, 0]` | CE requires 3D points |
| `move_to_2d` | runtime 2D→3D pad in `Mobject.move_to` | pre-CE auto-padding |
| `wiggle_angle` | `Wiggle(angle=…)` → `rotation_angle=…` | kwarg rename |

Rules of the boundary: idempotent (marker comment), **reported** (job result
`legacyCompat`, API log), applied only to the render copy — the project's
`codeSource` is never modified. Extending the rule set requires a matching
test + this table entry. Logic bugs in the source are NOT compat rules: the
renderer must surface them with the real traceback.

## 4. Exporter timeline semantics (canvas projects)

The editor timeline is the truth; the exported video must match it:

- **Wave scheduler (exact overlap timing, E2E audit):** steps are grouped
  into non-overlapping waves. A step whose time falls inside a still-running
  wave joins that wave's single `self.play` wrapped as
  `Succession(Wait(delay), anim)`, so it starts at its **exact timeline
  time** — overlapping animations never serialize (the drift bug, P-014).
- Animations that start at the same time play **in parallel** (one batched
  `self.play`), each with its own duration — never sequentially.
- All clip animations are constructor-style (`ApplyMethod`, `Transform`,
  `Rotate`) so every animation carries its own `run_time` / `rate_func`.
- Instant (`enterAnim: 'none'`) steps merge into one zero-duration
  `self.add`; a delayed instant appearance is a 0.01s linear FadeIn at its
  delay (time-exact, visually instant).
- Objects appear at their `enterTime`, stay for their `duration`, and exit
  at `enterTime + duration` (adjusted by clip ends). `visible: false`
  objects (and clips referencing them) are never emitted.
- **The video spans the editor timeline end**: `max(last window end, last
  clip end, last step end) + 1`, and at least `sceneDuration` (editable in
  the canvas panel). No truncation, no dead-air inflation.
- Objects are emitted in `zOrder` order (Manim creation order = layering).
- Rotation is negated at the export boundary (editor degrees are
  clockwise-positive on a y-down canvas; Manim is CCW on y-up).
- Text placeholders: empty content renders empty — the literal string
  `"Text"` can only appear if the user typed it.
- **ONE codegen**: the browser export (`export/manim.js`) delegates to the
  shared registry compiler (`api/src/compiler`) — the downloaded `.py` is
  byte-identical to the `scene.py` the API renders (tested).

### Parent/child hierarchy (canonical, frontend-editable)

Objects carry `parentId` (cycle-safe, deep). The preview
(`engine/hierarchy.js`) propagates each ancestor's delta (translation /
rotation / scale about the parent pivot) to all descendants, composing with
each object's own animation state. The exporter emits nested **family
VGroups** (`fam_A = VGroup(A, fam_B)`, innermost first) and clips targeting
a parent animate its family about the parent's base center — the same
rigid composition the preview computes. Deleting a parent orphans children
(each object owns its window); duplicating a parent duplicates the subtree.

### 3D objects

`cube`, `sphere`, `cone`, `cylinder` are registered mobjects with a
stage-relative `z` (editable in the properties panel). Adding one to a 2D
scene switches the scene type to `three_d` (the orbitable camera). The
canvas draws a projected layout preview (position/size/rotation/scale/
colors canonical); the render applies the real 3D mobject + camera —
documented: the projected preview position is exact for 2D scenes, and
camera-dependent for `three_d` scenes.

Documented approximation: a family clip that both moves AND rotates in the
same instant pivots rotations about the parent's base center (codegen-time
constant), where the preview uses the parent's current center. Single-clip
families are exact.

## 5. Renderer / editor responsibilities

| Component | Responsibility | Must not do |
|---|---|---|
| Editor (visual) | own the object/track model; render WYSIWYG preview | invent semantics the compiler doesn't register |
| Editor (code) | own the source; edit + render it verbatim | rewrite user code |
| Editor (scientific) | own the sci-ir document; schematic preview is documented non-WYSIWYG | fork the document model |
| Compiler (codegen) | compile the **canvas** canonical model | render scaffolds of code-sourced projects |
| Legacy importer | project a code scene onto the visual model + coverage report | become a render source; fabricate objects |
| `legacyCompat` | pure, reported API renames on the render copy | fix logic bugs; touch `codeSource` |
| Renderer worker | execute scene.py via the manim CLI (one pipeline, P-010) | execute code for detection |

## 6. Verification hooks

- `services/web/tests/sourceMode.test.mjs` — the contract itself (routing,
  adopt/detach, migration).
- `services/web/tests/import.test.mjs` — coverage report + honesty rules.
- `services/api/tests/renderSource.test.mjs` — compat boundary + real-HTTP
  routing enforcement.
- `services/api/tests/compiler.test.mjs` — timeline batching + wave fidelity.
- **`services/web/tests/e2e.test.mjs`** — the comprehensive end-to-end
  suite: frontend authoring of every object type (incl. 3D) and editable
  property, the preview contract (windows, visibility, completed-clip
  holds, multi-track blending, parent propagation), persistence round-trips
  (JSON + real HTTP), byte-identical client/server export parity, and
  adversarial cases (unknown types, hostile values, broken hierarchies,
  deep/wide trees, the 3D-parent combo).
- **`services/api/tests/e2e.render.test.mjs`** — REAL Manim render +
  ffmpeg frame extraction + pixel assertions at the positions the preview
  engine predicts (2D exact WYSIWYG; 3D structural ink). Set
  `RENDER_E2E=0` to skip where manim is unavailable.
- Iteration reports in `iterations/` carry the E2E render evidence.
