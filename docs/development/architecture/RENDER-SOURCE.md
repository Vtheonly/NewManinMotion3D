# Render-Source Contract — One Canonical Scene (issue #36)

> **Status:** Iterations 001–002 complete. This document defines the
> architecture the render pipeline must maintain: every exported video is a
> rendering of the **same canonical scene** the editor holds. It extends
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

- Animations that start at the same time play **in parallel** (one batched
  `self.play`), each with its own duration — never sequentially.
- Instant (`enterAnim: 'none'`) steps merge into one zero-duration
  `self.add`.
- Objects appear at their `enterTime`, stay for their `duration`, and exit
  at `enterTime + duration` (adjusted by clip ends).
- Text placeholders: empty content renders empty — the literal string
  `"Text"` can only appear if the user typed it.
- Client (`export/manim.js`) and server (`compiler/codegen.js`) emit the
  same structure — keep both in sync (parity contract, ARCHITECTURE.md §2.4).

Documented approximation: a same-time group that mixes `.animate` chains
(which cannot carry per-animation `run_time`) uses one play-level
`run_time = max(duration)`. Everything else is exact.

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
- `services/api/tests/compiler.test.mjs` — timeline batching fidelity.
- Iteration reports in `iterations/` carry the E2E render evidence.
