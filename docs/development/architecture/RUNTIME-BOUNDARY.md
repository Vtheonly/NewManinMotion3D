# Runtime Boundary — Layers, Execution and the Custom-Code Contract

> **Status:** iteration 001 of issue #32.

## 1. Layer map

```
scientific/
  ir/            canonical model — stdlib only (no manim, no numpy)
  registry/      type metadata — stdlib only
  runtime/       authoring API, data sources, safe evaluator — stdlib only
  export/        deterministic IR → Python — stdlib only
  domains/       pure numerics (torus, PoE, protein, NN, attention) — stdlib
  manim_adapter/ the ONLY layer allowed to import manim
  run.py         CLI (imports manim lazily; delegates rendering to `manim`)
```

Dependency rules (enforced by `scientific/tests/test_architecture.py`):

- `ir`, `registry`, `runtime`, `export`, `domains` **never** import manim.
- Only `manim_adapter` (and `run.py`) may import manim.
- No circular imports anywhere in `scientific/`.
- No production file over 150 lines (this task's files; legacy debt is
  tracked in the problem registry).

This split means the entire semantic model — validation, bindings,
scientific numerics — is testable and usable without Manim installed; only
rendering needs it.

## 2. Execution contract (issue #32 §16)

One canonical way to execute a scene file, all equivalent:

```bash
# dedicated runner (list / dry-run / quality presets)
python -m scientific.run presentation/scenes/synth_wall.py SynthesizabilityWall
python -m scientific.run scene.py --list
python -m scientific.run scene.py --dry_run

# direct file execution (standard __main__ guard in every scene file)
python scene.py

# plain Manim (what the render worker does)
manim -qh scene.py SynthesizabilityWall
```

The runner delegates the actual render to `python -m manim …` so the CLI,
the Code-Only editor path and the Docker worker share one pipeline. Quality
presets mirror the worker: `low | medium | high | production | 4k`.

**Scene classes** subclass the adapter bases — `BaseScientificScene`,
`MovingCameraScientificScene`, `ThreeDScientificScene` — all of which end
with `Scene`, so the repo's scene detection (issue #1, `*Scene`
convention) discovers them automatically in Code-Only mode. Each class
implements `get_scene()` returning the `ScientificScene` (or document); a
generic `construct()` does the rest.

**Docker**: the renderer image copies `scientific/` and the reference data
and sets `PYTHONPATH` + `SCIENTIFIC_DATA_ROOT`, so any rendered file can
`import scientific` and resolve `DataRef`s against the mounted data.

## 3. Data sources

`DataRef("synth/protein.json", "energy")` resolves relative to
`SCIENTIFIC_DATA_ROOT` (default `presentation/data/`). Supported formats:
`.json`, `.csv`, `.txt`. Path traversal (`..`, absolute) is rejected.
Sources are explicit in every scene — no hidden state, no hardcoded visual
values masquerading as model outputs (issue #26 rule). Uploaded-asset
binding lands with the DataBridge (#23).

## 4. The custom-code boundary

`custom` timeline steps carry hand-written Python:

```python
st.custom(
    "stamps = [ctx.mobs[i] for i in ids if i in ctx.mobs]\n"
    "scene.play(*[manim.FadeIn(s) for s in stamps], run_time=0.8)")
```

Contract (issue #32 §11):

- The code is **preserved verbatim** by the exporter (`st.custom(...)` with
  the exact string) and by JSON serialization — round-trip tests pin this.
- At render time it executes with the documented namespace:
  `scene` (the Manim scene), `ctx` (RenderContext: `mobs`/`mobjects`,
  `values`, `formatted`, `document`), `manim`, `doc`, `values`, `mobs`.
- The frontend must render custom steps as **advanced code blocks** —
  never silently dropped, never edited semantically by generic tooling.
- Unsupported arbitrary module-level Python in hand-authored files is
  likewise preserved on import through the emitted `build()` only when the
  document was produced by the canonical API; foreign files remain
  code-only scenes (detected, rendered, but not semantically editable).

## 5. Determinism

- All domain numerics use seeded LCGs / closed-form math — identical
  outputs on every run, platform and interpreter (tested).
- The safe evaluator (`runtime/evaluate.py`) whitelists arithmetic and a
  fixed math-function set; attribute access, subscripts, lambdas and
  arbitrary calls are rejected with clear errors.
- Rendering uses the same fixed inputs; camera and timeline order are
  document order.

## 6. Known boundaries (see also the problem registry)

- **LaTeX**: `MathTex` needs a LaTeX toolchain. Where absent (this dev
  environment), the formula renderer falls back to `Text` with a recorded
  warning; the Docker image ships LaTeX, so production renders formulas
  natively.
- **3D preview fidelity**: generated code is a real `ThreeDScene`; canvas
  WYSIWYG for 3D arrives with #15.
- **Multiple scenes per file**: the runner picks the requested scene or
  the first; a code-mode scene picker is deferred to #15.
