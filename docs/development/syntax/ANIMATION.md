# Animation — Stages, Step Operations and the Custom Boundary

## 1. Stages

The timeline is a list of stages (narrative beats); each stage is an
ordered list of steps:

```python
with scene.stage(stage_id="validation", title="Validation") as st:
    st.show("wall")
    st.play("scorer", "grow", duration=1.6)
    st.highlight("score_formula", color="warn")
    st.annotate("score_formula", "{hero_energy}", duration=1.2)
    st.camera({"zoom": 1.15}, duration=2.4)
    st.wait(0.4)
```

Stage ids are stable identifiers (`stage_01`… by default); titles are
display-only. Quick actions outside a stage (`scene.highlight(...)`,
`scene.annotate(...)`, `scene.custom(...)`) append to the current/last
stage so scripting stays terse without hiding structure from the IR.

## 2. Step operations (closed set)

| Op | Fields | Behaviour |
|---|---|---|
| `show` | `target` | add the artifact (no animation) |
| `play` | `target`, `animation`, `duration`, `rate` | run a named animation verb |
| `highlight` | `target`, `color`, `duration` | animate colour change |
| `annotate` | `target`, `value`, `side`, `duration` | live-value label next to the artifact |
| `wait` | `duration` | pause |
| `camera` | `properties`, `duration` | animated camera (see CAMERA.md) |
| `transform` | `target`, `properties`, `duration` | animate placement/visual props |
| `custom` | `code` | **advanced boundary** — verbatim runtime code |

`transform` supports `position` (move), `scale`, and `color`; domain
reconfiguration beyond that (e.g. a chain's joint angles) is intentionally
a `custom` step rather than a pseudo-generic property.

### Animation verbs (`play`)

`write` (Write), `create` (Create), `uncreate` (Uncreate), `fade_in`
(FadeIn), `fade_out` (FadeOut), `grow` (GrowFromCenter), `indicate`
(Indicate), `draw` (DrawBorderThenFill), `shift_in` (FadeIn with downward
shift). Unknown verbs are validation errors.

### Rate functions

`linear`, `smooth`, `ease_in` (rush_into), `ease_out` (rush_from),
`there_and_back`, `rush_into`, `rush_from` — mapped to Manim rate functions
at render time.

## 3. Reveal semantics

- Steps that reveal an artifact (`show`, `play`) mark it visible;
  **relationships attach automatically** once all their sources are
  visible, in document order.
- Artifacts never referenced by any step (or relationship) are added
  automatically at the start — background chrome like grids and panels
  does not need a step per artifact.
- HUD nodes in 3D scenes are registered as fixed-in-frame at build time.

## 4. The custom boundary

```python
st.custom(
    "ids = [f'stamp_cand_{i:02d}' for i in range(1, 7)]\n"
    "stamps = [ctx.mobs[i] for i in ids if i in ctx.mobs]\n"
    "scene.play(*[manim.FadeIn(s) for s in stamps], run_time=0.8)")
```

Rules (issue #32 §11 — preserve, never silently destroy):

1. The code string is stored verbatim in the IR and re-emitted verbatim by
   the exporter (pinned by round-trip tests on all three reference scenes).
2. At render time it executes with: `scene` (Manim scene), `ctx`
   (RenderContext — `mobs`/`mobjects`, `values`, `formatted`, `document`),
   `manim`, `doc`, `values`, `mobs`.
3. Frontends must present custom steps as advanced code blocks — editable
   as *code*, never rewritten by generic property tooling.
4. Validation requires non-empty code for `custom` steps (an empty custom
   step is a structural error, not a silent no-op).

## 5. Composition pattern for reference scenes

Scene files stay declarative: they compose primitives and narrate order;
numerics live in domain modules; advanced beats (the DLS reconfiguration in
the torus scene, row-wise stamp reveals in the wall scene) use small,
documented `custom` steps. A scene file that grows past composition is a
sign a domain module is missing — extract it (150-line rule applies to
scene files too).
