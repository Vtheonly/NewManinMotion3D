# Suprepto — The Complete Scene Syntax Guide

> The developer guide for the unified scientific scene system shipped for
> issues #4, #5, #11, #28, #29, #32, #33 and #34. It documents **what is
> actually implemented** — every section below names the module that owns
> the behavior, so nothing here is aspirational.
>
> Companion references: the base syntax family (`OVERVIEW.md`, `OBJECTS.md`,
> `MATHEMATICS.md`, `DATA-BINDINGS.md`, `ANIMATION.md`, `CAMERA.md`,
> `EXTENSIONS.md`, `VERSIONING.md`) still apply in full; Suprepto extends
> them without replacing them. Schema id stays `sci-ir/1` because every
> addition is an optional document section.

## Table of contents

1. [What Suprepto is](#1-what-suprepto-is)
2. [Design principles](#2-design-principles)
3. [The document model](#3-the-document-model)
4. [The object catalogue](#4-the-object-catalogue)
5. [Reactive state](#5-reactive-state-issue-4)
6. [Derived values and the dependency graph](#6-derived-values-and-the-dependency-graph)
7. [Data-driven scenes](#7-data-driven-scenes-issue-11)
8. [The timeline: stages and step operations](#8-the-timeline-stages-and-step-operations)
9. [State machines](#9-state-machines-issue-11)
10. [Comparisons](#10-comparisons-issue-11)
11. [Highlights and live annotations](#11-highlights-and-live-annotations-issue-5)
12. [The web editor](#12-the-web-editor-issues-29-33-34)
13. [Python execution and export](#13-python-execution-and-export)
14. [Verification and reproducibility](#14-verification-and-reproducibility-issue-28)
15. [Extending Suprepto](#15-extending-suprepto)
16. [A complete worked example](#16-a-complete-worked-example)
17. [Command cheatsheet](#17-command-cheatsheet)

---

## 1. What Suprepto is

Suprepto is one scene system across three authoring surfaces and one
execution pipeline:

```
             Python authoring API          IR JSON (sci-ir/1)
        (scientific.ScientificScene)   (POST /api/ir/validate|export)
                     \                        /
                      \   one document model  /
                       `------.       .------'
                              `--.   .-'
   Web editor "Scientific (IR)"  | |
   mode (registry-driven) -------' |
                                  |
                    deterministic Python export (scene.py)
                                  |
                    python -m manim scene.py SceneClass
                                  |
                     MP4 + diagnostics.json + verification
```

Everything you can author is **plain data** (`scientific/ir/`), validated by
closed vocabularies, executed by one renderer (`scientific/manim_adapter/`),
and reproduced by one verification pipeline (`scientific/verify.py`). There
is no second runtime and no frontend-only schema: the web editor edits the
same document the Python runtime executes.

Layers, and who owns what:

| Layer | Module | Responsibility |
|---|---|---|
| IR | `scientific/ir/` | document, nodes, timeline, state/machine/comparison/annotation specs, validation (mirrored in JS by `services/api/src/ir/`) |
| Registry | `scientific/registry/` | 35 object types with property schemas — single source of truth for editors and validation |
| Runtime | `scientific/runtime/` | `ScientificScene` builder, binding sources, safe evaluator, stage builders |
| State | `scientific/state/` | `StateEngine`, drivers, dependency graph — pure stdlib, no manim |
| Data | `scientific/data/` | series adapters (records / columns / arrays) |
| Domains | `scientific/domains/` | pure numerical models (protein, NN, graphs, kinematics, attention) |
| Adapter | `scientific/manim_adapter/` | IR → Manim CE rendering; manim is imported lazily and only here |
| Export | `scientific/export/` | deterministic IR → runnable Python (byte-parity with the JS mirror) |
| Diagnostics | `scientific/diagnostics/` | records what a render actually did |
| Verify | `scientific/verify.py` | render-twice frame-hash reproducibility |

## 2. Design principles

1. **Declarative data, not scripts.** A scene is a document: objects,
   state, timeline. `custom` steps are the single, explicit escape hatch
   for hand-written code and survive every round trip verbatim (see
   `docs/development/architecture/RUNTIME-BOUNDARY.md`).
2. **Closed vocabularies.** Step ops, animation names, rates, state kinds,
   machine kinds, comparison kinds, highlight behaviors and node types are
   all closed sets — validated identically in Python and JavaScript.
   Anything outside the set is an error at authoring time, never a silent
   no-op at render time.
3. **Reactive, not scripted.** Numbers on screen come from a `StateEngine`
   whose symbols can be constants, keyframe curves or external data series.
   Live consumers (metric cards, annotations) read the *actual interpolated
   value at animation time* through manim value trackers — there are no
   hardcoded number sequences.
4. **Deterministic by default.** Every domain model is seeded or
   closed-form; identical documents produce identical frames (verified by
   `verify.py` double-render hashing).
5. **One identity per object.** Object ids drive the timeline (one row per
   object — issue #33), sub-target addressing (`graph_1.node:a`) and export
   round-trips. Ids are stable through save/load/export.
6. **Byte parity, two runtimes.** The Python exporter and the JS emitter
   (`services/api/src/ir/emit*.js`) produce byte-identical Python for the
   same IR — cross-tested by `scripts/gen_parity_fixtures.py` fixtures.
7. **No parallel systems.** Scientific projects render through the same
   Redis job queue as code projects; the web editor reuses the same export
   dialog, render dialog and project persistence as the visual editor.

## 3. The document model

Owned by `scientific/ir/document.py` + `document_sections.py` (JS mirror:
`services/web/src/sci/document.js`). A complete document with every
Suprepto section:

```jsonc
{
  "schema": "sci-ir/1",
  "id": "suprepto_demo",              // snake_case; drives the class name
  "title": "Suprepto Demo",
  "sceneType": "scene_2d",            // scene_2d | moving_camera | three_d | custom
  "camera": { "backgroundColor": "bg", "zoom": 0.92 },

  "objects": [                        // authoring (z-) order; see §4
    { "id": "graph", "type": "graph.network",
      "properties": { "nodes": [{"id": "a", "label": "A"}], "edges": [] },
      "parentId": null, "space": "scene2d", "label": "my graph",
      "transform": { "position": [0, -1.8, 0], "rotation": 0, "scale": 1 } }
  ],
  "expressions": [                    // structured math (OBJECTS/MATHEMATICS.md)
    { "id": "eq", "source": "E = m * c**2", "terms": {}, "bindings": {},
      "highlights": ["c**2"], "format": null }
  ],
  "values": [                         // live values ({value} templates)
    { "id": "mass", "source": {"kind": "literal", "value": 2.2},
      "format": "m = {value:.1f} kg" }
  ],
  "relationships": [                  // semantic edges
    { "id": "arrow_1", "kind": "arrow", "sources": ["a", "b"],
      "properties": {}, "live": false }
  ],

  "state": {                          // §5, §6, §9 (issues #4, #11)
    "symbols": [
      { "id": "x", "kind": "scalar", "value": 0,
        "driver": { "kind": "keyframes", "keyframes": [[0, 0], [2, 10]],
                    "easing": "linear" },
        "format": null }
    ],
    "derived": [
      { "id": "speed", "expr": "x / 2", "inputs": {"x": "x"},
        "kind": "derived", "format": null }
    ],
    "machines": [
      { "id": "gd", "initial": "initial",
        "states": [{"id": "initial", "label": "Initial"}],
        "transitions": [{"id": "t1", "source": "initial", "target": "updated",
                          "trigger": "step", "sets": {"x": 4}}] }
    ]
  },
  "comparisons": [                    // §10 (issue #11)
    { "id": "cmp", "kind": "before_after", "a": null, "b": null,
      "metrics": [{"label": "score", "a": 1, "b": 2.5,
                    "format": "{value}", "deltaFormat": "{delta:+.2f}"}],
      "title": "Score change" }
  ],
  "annotations": [                    // §11 (issue #5)
    { "id": "live_speed", "target": "stage_panel", "provider": "speed",
      "value": "", "format": "v = {value:.2f}", "side": "RIGHT",
      "live": true, "follow": true }
  ],

  "bindings": { "theta": {"kind": "literal", "value": 0.6} },
  "timeline": [                       // §8
    { "id": "run", "title": "Run", "steps": [
      { "op": "show", "target": "stage_panel" },
      { "op": "interpolate", "target": "x", "duration": 2,
        "properties": {"to": 10} },
      { "op": "transition", "target": "gd", "properties": {"to": "updated"} },
      { "op": "compare", "target": "cmp", "duration": 2 },
      { "op": "highlight", "target": "graph", "duration": 1,
        "properties": {"behaviors": ["focus", "dim_others"], "color": "warn"} }
    ] }
  ]
}
```

Validation (`scientific/ir/validate.py` + `validate_ext.py`, mirrored by
`POST /api/ir/validate`) enforces: exact schema id; unique object ids;
registered node types with schema-conformant properties (unknown property,
wrong type, bad enum, missing required all fail); existing, acyclic
`parentId`; closed relationship kinds with existing sources; closed step
ops with per-op requirements (`play` needs a known animation and target,
`custom` needs non-empty code, `transition` needs `to` or `event`, …);
state symbols need a value or a driver; derived inputs must reference
declared symbols and must not form cycles; machine transitions must
reference declared states.

## 4. The object catalogue

The registry (`scientific/registry/builtin_*.py`) is the single source of
truth; the web library and the generic inspector are generated from it.
35 built-in types in 10 categories:

| Type | Category | Dim | Key properties |
|---|---|---|---|
| `core.group` | basic | 2d | `title` |
| `text.label` | basic | 2d | `text`*, `fontSize`, `color`, `weight` |
| `ui.panel` | ui | 2d | `width`, `height`, `fill`, `stroke`, `radius`, `title` |
| `ui.grid` | ui | 2d | `columns`*, `rows`*, `cellWidth`, `cellHeight`, `gap` |
| `ui.badge` | ui | 2d | `text`*, `tone` (ok/warn/fail/info) |
| `ui.stamp` | ui | 2d | `verdict`* (ok/fail), `label` |
| `math.formula` | math | 2d | `source`*, `fontSize` |
| `math.axes` | math | 2d | `xMin`…`yMax`, `xLabel`, `yLabel` |
| `math.curve` | math | 2d | `axes`*, `function`* (safe expr of `x`), `color` |
| `math.matrix` | math | 2d | `rows`*, `heat`, `label` |
| `math.vector` | math | 2d | `components`*, `color`, `text` |
| `math.number_line` | math | 2d | `min`, `max`, `step`, `includeTicks`, `unit` |
| `math.point` | math | 2d | `axes`*, `x`*, `function`?, `y`, `color`, `text` |
| `math.region` | math | 2d | `axes`*, `xMin`*, `xMax`*, `function`, `fill`, `opacity` |
| `math.tensor` | math | 2d | `shape`*, `data`, `heat`, `label` |
| `math.distribution` | math | 2d | `axes`*, `kind`* (normal/uniform/laplace/beta), `mu`, `sigma`, `a`, `b` |
| `graph.network` | graph | 2d | `nodes`*, `edges`, `layout` (circle/layered/grid/line/shell/manual), `spacing`, `directed`, `showWeights`, `title` |
| `graph.state_chart` | graph | 2d | `machine`* (state machine id), `layout`, `spacing` |
| `nn.network` | nn | 2d | `layers`* (e.g. `[4, 6, 1]`), `seed`, `input`, `showActivations` |
| `attention.matrix` | attention | 2d | `queries`*, `keys`*, `temperature`, `distanceBias`, `topK` |
| `attention.frame` | attention | 3d | `euler`, `origin`, `size` |
| `attention.link` | attention | 3d | `fromId`*, `toId`*, `weight` |
| `biology.protein` | biology | 2d | `source` (DataRef), `representation`, `seed`, `residues`, `color` |
| `biology.sequence` | biology | 2d | `sequence`*, `blockSize`, `highlight` (indices) |
| `kinematics.torus` | kinematics | 3d | `majorRadius`, `minorRadius`, `flowStrength`, `steps`, `dt` |
| `kinematics.chain` | kinematics | 3d | `thetas`*, `linkLength` |
| `kinematics.jacobian` | kinematics | 3d | `scale` |
| `kinematics.obstacle` | kinematics | 3d | `center`*, `radius` |
| `presentation.title` | presentation | 2d | `text`*, `subtitle`, `fontSize`, `color` |
| `presentation.callout` | presentation | 2d | `text`*, `target`, `side`, `fontSize` |
| `presentation.legend` | presentation | 2d | `entries`* ([{label, color}]), `fontSize` |
| `presentation.table` | presentation | 2d | `headers`, `rows`*, `fontSize` |
| `presentation.metric_card` | presentation | 2d | `title`*, `provider`* (state symbol / live value), `format`, `live`, `accent` |
| `comparison.panel` | comparison | 2d | `comparison`* (comparison id), `fontSize` |
| `hud.fixed` | presentation | 2d | `text`*, `corner` (UL/UR/LL/LR), `fontSize` |

`*` = required. Colors accept palette tokens (`fg`, `bg`, `accent`,
`accent2`, `ok`, `warn`, `fail`, `border`, `panel`, `muted`) or hex.

Graph nodes keep **individual identities**: `graph.network` children are
addressable as sub-targets (`graph_1.node:a`, `graph_1.edge:a-b`) for
highlights and annotations (`manim_adapter/subtargets.py`). Layouts are
deterministic (`domains/graph/layout.py`: circle, layered via longest-path
with cycle guard, grid, line, shell; `manual` honors per-node `position`).

## 5. Reactive state (issue #4)

Owned by `scientific/state/engine.py` + `driver.py` + `graph.py`. Flow:
**underlying value → observable symbol → derived value → consumers**.

Declare with the authoring API:

```python
scene.state("x", value=0)                          # constant symbol
scene.state("t", keyframes=[[0, 0], [2, 10]],      # keyframe-driven
            easing="smooth", kind="time")
scene.drive("loss", series=records, value_key="loss", time_key="epoch")
scene.derive("speed", expr="x / 2", inputs={"x": "x"})
```

- **Drivers** (`state/driver.py`) are the only time-dependent part:
  `static` (one value), `keyframes` (sorted `(time, value)` pairs,
  piecewise-interpolated with an easing curve), `series` (explicitly
  supplied `(times, values)` samples, linear between samples).
- **Easing curves** (`state/easing.py`): `linear`, `smooth`, `ease_in`,
  `ease_out`, `ease_in_out`, `there_and_back`, `rush_into`, `rush_from`.
- **Kinds** (`scalar`, `vector`, `matrix`, `tensor`, `coordinate`,
  `distance`, `angle`, `probability`, `score`, `percentage`, `parameter`,
  `weight`, `bias`, `activation`, `gradient`, `loss`, `learning_rate`,
  `counter`, `time`) are semantic labels for editors and formats.
- `engine.sample(t)` returns the consistent snapshot of every symbol at
  time `t`; `engine.set_value(name, v)` mutates and notifies subscribers.
- **Live consumers** bind to manim value trackers
  (`manim_adapter/state_ops.py`): a metric card reading `x` displays the
  true interpolated value while `x` animates from 0 to 10 — no scripted
  sequences anywhere.

Timeline ops drive state (see §8): `set` assigns, `interpolate` animates
toward a target.

## 6. Derived values and the dependency graph

`state/graph.py` builds the true dependency graph from each derived
symbol's `inputs` (alias → symbol id). On every `sample(t)`:

1. all plain symbols evaluate their drivers at `t`;
2. derived symbols evaluate **in topological order** through the safe
   evaluator (no calls, no attribute access, closed operator set —
   `runtime/evaluate.py`);
3. cycles raise `StateGraphError` before any rendering happens.

`engine.deps_of("speed")` and `engine.dependents_of("x")` expose the graph
for editors (the state panel shows them; diagnostics logs re-computations).

## 7. Data-driven scenes (issue #11)

Two layers, both explicit — nothing is loaded behind your back:

**Binding sources** (`runtime/dataref.py`) for live values and formula
bindings:

```python
from scientific import Literal, DataRef, Derived, Symbol

scene.live_value("energy", DataRef("synth/protein.json", "energy"),
                 format="E = {value:.1f}")
scene.live_value("score", Derived("a * b + 1", inputs={"a": s1, "b": s2}))
scene.bind("theta", Literal(0.6))
scene.live_value("live_theta", Symbol("theta"), format="{value:.3f}")
```

Serialized forms (canonical — the helpers are sugar):
`{"kind": "literal", "value": v}` · `{"kind": "data", "ref": path, "key": dot.path}` ·
`{"kind": "derived", "expr": str, "inputs": {alias: source}}` ·
`{"kind": "symbol", "name": binding}`.

**Data files** (`runtime/datasource.py`): `DataRef` paths resolve against a
data root (default `presentation/data/`, override with `SCIENTIFIC_DATA_ROOT`
or `set_data_root()`). Supported formats: `.json`, `.csv` (rows as records),
`.txt`/`.md` (raw text), `.npy`/`.npz` (needs numpy). Refs must be relative
paths — `..` and absolute paths are rejected. Dotted keys
(`energy.total`) walk into the loaded payload; resolution is recorded in
diagnostics provenance.

**Time series** (`data/series.py`) turn loaded data into `SeriesDriver`s:

```python
scene.drive("loss", series=records)        # list of dicts
scene.drive("loss", series=columns,        # {"loss": [...], "step": [...]}
            value_key="loss", time_key="step")
scene.drive("temp", series=[15, 17, 21])   # plain array → implicit time 0..n
```

Time keys are auto-detected from `t, time, step, epoch, frame, iteration`
when not given.

## 8. The timeline: stages and step operations

A timeline is an ordered list of **stages**; each stage holds **steps**
(`ir/timeline.py`). The op set is closed (12 ops) — the base eight from
issue #32 plus the four Suprepto extensions:

| Op | Purpose | Required fields | Rendered by |
|---|---|---|---|
| `show` | add target to the scene | `target` | `step_ops.py` |
| `play` | run an entrance animation | `target`, `animation` | `step_ops.py` |
| `highlight` | composable highlight (§11) | `target` | `highlight_ops.py` |
| `annotate` | quick one-off label event | `target` | `relationships.py` |
| `wait` | pause | `duration` | — |
| `camera` | animated camera property change | `properties` | `camera.py` |
| `transform` | animate object properties | `target`, `properties` | `step_ops.py` |
| `custom` | verbatim Python (advanced boundary) | `code` | runtime boundary |
| `set` | assign a state symbol | `target` (symbol) | `state_ops.py` |
| `interpolate` | animate a symbol toward a value | `target`, `properties.to` | `state_ops.py` |
| `transition` | fire a state-machine transition | `target` (machine), `properties.to`/`event` | `machine_ops.py` |
| `compare` | reveal a comparison panel | `target` (comparison) | `compare_ops.py` |

**Animation verbs** for `play`: `write`, `create`, `uncreate`, `fade_in`,
`fade_out`, `grow`, `indicate`, `draw`, `shift_in`.
**Rates** for `play`/`interpolate`: `linear`, `smooth`, `ease_in`,
`ease_out`, `ease_in_out`, `there_and_back`, `rush_into`, `rush_from`.

Authoring (builder methods in `runtime/stages.py`):

```python
with scene.stage(stage_id="run", title="Run") as st:
    st.show("panel").play("eq", "write", duration=1.5)
    st.set("x", 3)
    st.interpolate("x", to=10, duration=2, rate="smooth")
    st.transition("gd", to="updated")
    st.compare("cmp", duration=2)
    st.highlight("graph", behaviors=["focus"], color="warn", duration=1)
    st.camera({"zoom": 1.2}, duration=2)
    st.custom("print('advanced boundary')")
```

`scene.stage()` is a context manager; quick actions outside a stage
(`scene.highlight(...)`, `scene.annotate(target, "text")`) go to the current
or auto-created stage. `st.note("...")` attaches a documentation-only note.

## 9. State machines (issue #11)

Machines make data-driven narrative explicit — states and transitions are
data (`ir/state.py`), and a `transition` step fires them:

```python
scene.machine(
    "pipeline",
    states=[{"id": "initial", "label": "Initial"},
            {"id": "computation", "label": "Computation"},
            {"id": "updated", "label": "Updated"}],
    transitions=[
        {"id": "t1", "source": "initial", "target": "computation",
         "trigger": "step"},
        {"id": "t2", "source": "computation", "target": "updated",
         "trigger": "done", "sets": {"x": 4.0},
         "animate": {"duration": 1.0}}
    ],
    initial="initial")
```

Semantics (rendered by `manim_adapter/machine_ops.py`):

- `st.transition("pipeline", to="updated")` picks the transition whose
  source is the machine's current state and whose target matches;
  `st.transition("pipeline", event="done")` picks by trigger.
- Firing applies `sets` to the reactive engine **and** to the value
  trackers, so live consumers update instantly.
- The current state renders as a state chip (tone by state id:
  `initial`→info, `computation`→accent, `highlight`→warn, `updated`/`converged`/`final`→ok).
- `graph.state_chart` renders any declared machine as a node/arrow chart —
  declare it once, reference it by `machine` id.

Machine kinds (`linear`, `loop`, `final`) are advisory metadata for
editors; the runtime honors transitions as authored.

## 10. Comparisons (issue #11)

Comparisons are declarative two-side constructs whose numbers are **real
bound state**, never hardcoded visuals (`ir/annotation.py`):

```python
scene.compare(
    "cmp", kind="before_after",
    metrics=[
        {"label": "score", "a": 1.0, "b": 2.5,
         "format": "{value}", "deltaFormat": "{delta:+.2f}"},
        {"label": "energy", "a": {"kind": "symbol", "name": "e_before"},
                     "b": {"kind": "symbol", "name": "e_after"}}
    ],
    title="Score change")
```

- Kinds: `before_after`, `input_output`, `prediction_truth`, `model_a_b`,
  `iteration`, `parameter`.
- `a`/`b` are artifact ids for the two sides; each metric's `a`/`b` accept
  plain values or any binding source (§7) — deltas are computed at render
  time from the resolved values.
- `st.compare("cmp")` reveals a comparison panel; a persistent visual is
  the `comparison.panel` object referencing the comparison by id.

## 11. Highlights and live annotations (issue #5)

**Highlights** are lists of composable behaviors (`ir/highlight.py`):

```python
st.highlight("matrix_1.cell:2:3", behaviors=["glow", "pulse"],
             color="warn", duration=1.5, label="attention")
scene.highlight("graph_1.node:a", behaviors=["spotlight"])
```

- Behaviors (closed set): `outline`, `glow`, `pulse`, `emphasis`,
  `dim_others`, `focus`, `arrow`, `label`, `region`, `temporary`.
- Aliases expand: `focus` → focus + dim_others; `glow` → glow + outline;
  `spotlight` → focus + dim_others + outline.
- **Sub-targets** address children through dotted paths: `graph_1.node:a`,
  `matrix_1.cell:2:3`, a formula term name — resolved by the owning
  artifact's renderer binding (`manim_adapter/subtargets.py`).

**Live annotations** bind a target to a provider (state symbol, live value
or relationship id) with a display template (`ir/annotation.py`):

```python
scene.annotate("panel", provider="speed", format="v = {value:.2f}",
               side="RIGHT", id="live_speed")
scene.annotate("eq", "{mass}", duration=1.0)   # quick one-off (no provider)
```

Live annotations track their target under camera moves (`follow: true`,
camera-tracking via `next_to` + `always_redraw`); the displayed number
re-renders from the provider each frame. `side`: `LEFT`, `RIGHT`, `UP`,
`DOWN`.

## 12. The web editor (issues #29, #33, #34)

The web app (`services/web`) has three project modes: **Visual**,
**Code Only**, and **Scientific (IR)** — selected in the new-project
dialog. Scientific mode is the Suprepto editor:

- **Persistence**: the document lives in `project.sciDocument` inside the
  normal project JSON (server and file). Entering the mode boots the
  editor store from it (`sci/bridge.js`); every save/export/render syncs
  it back first.
- **Library** (`LibraryPanel` + `sci/library.js`): searchable,
  categorized object palette generated from the registry (server metadata
  via `GET /api/ir/schema` wins; the static mirror is the offline
  fallback), with context-aware suggestions and creation presets.
- **Schematic canvas** (`SciCanvas`): drag positioning, selection,
  per-object transforms.
- **Generic inspector** (`InspectorPanel`): schema-driven property editors
  for any registered type — custom server registrations appear
  automatically. Includes the formula editor (terms / bindings /
  highlights), graph builder (nodes, edges, weights, layouts), state /
  machine / comparison panel and annotations.
- **Timeline** (`SciTimeline`): stages as columns, **one row per object
  identity** (issue #33) — plus rows for state symbols, machines and
  comparisons; every step lands on its target's row. Step editing via the
  step editor.
- **Export**: `POST /api/ir/export` → byte-parity runnable Python through
  the shared export dialog. **Render**: `POST /api/projects/:id/render-sci`
  → the same Redis job queue as code mode.
- **Undo/redo**: full-document history (`past` holds the state after each
  change, starting from the initial document; `undo` restores the previous
  entry, `redo` replays).

The **visual editor's timeline** also got the identity rule (issue #33):
`Timeline.vue` renders one row per object (label column + lifetime bar +
that object's clips on its own lane), with a playhead and click-to-seek on
the ruler. Importing hand-written Manim code ("Apply to Canvas") parses
tolerantly (`export/importManim.js`): arbitrary kwargs, chained calls,
multi-line `self.play(...)`, `self.add(...)`, per-`def` variable scoping —
one constructed mobject becomes one timeline row; unknown constructs
(helper factories, `VGroup` literals) are tracked so the timing of
everything else stays correct.

## 13. Python execution and export

**Export** (`scientific/export/`, JS mirror `services/api/src/ir/`):
deterministic IR → runnable `scene.py` using the authoring API. Identical
documents produce identical bytes; exported files round-trip through
`scientific.export.import_document()` exactly. Endpoints:
`POST /api/ir/validate`, `POST /api/ir/export`, `GET /api/ir/schema`,
`POST /api/projects/:id/render-sci`.

**Execution** (`scientific/run.py`):

```bash
python -m scientific.run scene.py MyScene --quality high   # render
python -m scientific.run scene.py --list                   # list scenes
python -m scientific.run scene.py MyScene --dry_run         # build + validate only
python -m scientific.run scene.py MyScene --diagnostics     # + diagnostics.json
python -m scientific.run scene.py MyScene --verify         # render twice + compare
```

Quality presets (shared with the render worker): `low`, `medium`, `high`,
`production`, `4k`. Emitted files carry a `__main__` guard, so
`python scene.py` also renders. The runner delegates to the Manim CLI —
one execution path for local and server rendering.

## 14. Verification and reproducibility (issue #28)

- **`verify.py`**: `verify_document_render(path, scene, quality)` renders
  the scene twice with caching disabled, and compares the **SHA-256 of
  every produced frame** (PNG sequences — MP4 containers embed encoder
  timestamps, frame content is the deterministic quantity). Reports
  `reproducible`, both hashes, byte totals and validation errors. The
  runner's `--verify` flag exits non-zero when non-deterministic or
  invalid.
- **Diagnostics** (`diagnostics/recorder.py`): opt-in recording of what
  actually happened — config (python/manim versions, scene id, schema),
  per-step events with wall-clock timing, state changes, machine
  transitions, live-value snapshots, camera operations, resolved DataRefs
  (provenance) and warnings. Serialized deterministically as
  `diagnostics.json` (`--diagnostics` flag, or `SUPREPTO_DIAGNOSTICS=<path>`
  env for the API-driven render path).
- **End-to-end tests** (`scientific/tests/test_verification.py`): 2D and 3D
  reference renders, a Suprepto fixture render with diagnostics content
  assertions, deterministic double-render frame-hash equality, and dry-run
  validation — all running against real Manim.

Determinism practices: seeded domain models, closed-form math, no wall
clock in scene content, and caching disabled during verification.

## 15. Extending Suprepto

Register a new primitive end-to-end (see `EXTENSIONS.md` for the full
walkthrough):

1. **Python registry** — `register_type("my.widget", label="Widget",
   category="core", dimensionality="2d", properties={...})` with a
   declarative property schema (`type`, `default`, `required`, `enum`,
   `min`).
2. **Renderer binding** — `bind_renderer("my.widget", render_fn)`; manim
   code lives only in the adapter.
3. **JS mirror** — add the schema entry in
   `services/api/src/ir/schemaTypes.js` (parity is cross-tested by
   `scripts/sync_schema_types.py` + `scripts/gen_parity_fixtures.py`).
4. Registering a type automatically gives you: validation, the web library
   entry, the generic inspector fields and Python export — no frontend
   code required.

The registry is also the contract for property schemas: unknown property,
wrong type, bad enum and missing required are authoring errors, not render
surprises.

## 16. A complete worked example

The parity fixture `services/api/tests/fixtures/ir/suprepto_demo.py`
(exercised by both test suites) uses every Suprepto section:

```python
from scientific import DataRef, Derived, Literal, ScientificScene, Symbol
from scientific.manim_adapter import BaseScientificScene


def build() -> ScientificScene:
    scene = ScientificScene("suprepto_demo", title="Suprepto Demo",
                            scene_type="scene_2d", camera=None)

    # Objects (§4): panel, live metric card, semantic graph
    scene.node("ui.panel", "stage_panel", height=2.5, width=5)
    scene.node("presentation.metric_card", "readout", format="{value:.1f}",
               provider="x", title="x", position=[2.2, 1.2, 0])
    scene.node("graph.network", "graph",
               nodes=[{"id": "a", "label": "A"},
                      {"color": "accent2", "id": "b", "label": "B"},
                      {"id": "c", "label": "C"}],
               edges=[{"from": "a", "to": "b", "weight": 0.7},
                      {"directed": True, "from": "b", "to": "c", "weight": 1}],
               layout="circle", position=[0, -1.8, 0])

    # Reactive state (§5): keyframe-driven symbol + derived speed (§6)
    scene.state("x", keyframes=[[0, 0], [2, 10]], easing="linear", value=0)
    scene.derive("speed", expr="x / 2", inputs={"x": "x"})

    # Machine (§9) and comparison (§10)
    scene.machine("gd",
                  states=[{"id": "initial", "label": "Initial"},
                          {"id": "updated", "label": "Updated"}],
                  transitions=[{"id": "t1", "source": "initial",
                                "target": "updated", "trigger": "step",
                                "sets": {"x": 4}}],
                  initial="initial")
    scene.compare("cmp", kind="before_after",
                  metrics=[{"label": "score", "a": 1, "b": 2.5,
                            "deltaFormat": "{delta:+.2f}",
                            "format": "{value}"}],
                  title="Score change")

    # Live annotation (§11)
    scene.annotate("stage_panel", provider="speed",
                   format="v = {value:.2f}", id="live_speed")

    # Timeline (§8) — every Suprepto op except camera/wait
    with scene.stage(stage_id="run", title="Run") as st:
        st.show("stage_panel")
        st.interpolate("x", to=10, duration=2)
        st.set("x", 3)
        st.transition("gd", to="updated", duration=1)
        st.compare("cmp", duration=2)
        st.highlight("graph", behaviors=["focus", "dim_others"],
                     color="warn", duration=1)
        st.custom("print('suprepto boundary')")
    return scene


class SupreptoDemo(BaseScientificScene):
    """Rendered from sci-ir/1 scene 'suprepto_demo'."""

    def get_scene(self) -> ScientificScene:
        return build()


if __name__ == "__main__":
    from scientific.run import main
    main([__file__])
```

Run it:

```bash
python -m scientific.run suprepto_demo.py SupreptoDemo --quality low
python -m scientific.run suprepto_demo.py SupreptoDemo --verify
```

The reference legacy scene `presentation/scenes/synth_wall.py` (documented
in `docs/development/examples/SYNTH-WALL.md`) is the large-scale example:
a 6×4 candidate wall driven by deterministic protein models and an MLP
scorer, with stamps, badges, live values, a formula with highlights and
camera moves — all composed from the registry primitives, no bespoke
drawing.

## 17. Command cheatsheet

```bash
# Render (local)
python -m scientific.run scene.py MyScene --quality medium

# Validate only
python -m scientific.run scene.py MyScene --dry_run

# Reproducibility (render twice, compare frame hashes)
python -m scientific.run scene.py MyScene --verify

# Diagnostics dump
python -m scientific.run scene.py MyScene --diagnostics

# Full test suites
cd scientific && python -m pytest tests/          # 169 tests
cd services/api && npm test                        # 40 tests
cd services/web && npm test                        # 105 tests

# Python/JS export parity fixtures (regenerate + cross-check both sides)
python scripts/gen_parity_fixtures.py
python scripts/sync_schema_types.py
```

API surface quick map: `POST /api/ir/validate` · `POST /api/ir/export` ·
`GET /api/ir/schema` · `POST /api/projects/:id/render-sci` ·
`GET /api/jobs/:id`.
