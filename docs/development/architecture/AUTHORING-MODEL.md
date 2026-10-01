# Authoring Model — Python API, JS Mirror and the Parity Contract

> **Status:** iteration 001 of issue #32. Python: `scientific/runtime/`,
> `scientific/export/`. JS mirror: `services/api/src/ir/`.

## 1. The Python authoring API (canonical)

Hand-authored and exported scenes use the same small surface:

```python
from scientific import ScientificScene, Literal, DataRef, Derived

scene = ScientificScene("synthesizability_wall", scene_type="moving_camera",
                        camera={"backgroundColor": "bg", "zoom": 0.92})

scene.node("ui.grid", "wall", columns=6, rows=4, cellWidth=1.5, gap=0.24)
scene.formula("jac", "tau = J(theta).T @ F",
              terms={"Jt": "J(theta).T"},
              bindings={"theta": Literal(0.6)},
              highlights=["Jt"], fontSize=40, position=(2.0, -1.0, 0.0))
scene.live_value("energy", DataRef("synth/protein.json", "energy"),
                 format="ΔG = {value:.2f} kcal/mol")
scene.bind("theta", Literal(0.6))
scene.relationship("panel", "jac", id="link", kind="arrow", live=True)

with scene.stage(stage_id="intro", title="Intro") as st:
    st.show("panel").play("jac", "write", duration=1.4)
    st.highlight("jac", color="warn")
    st.custom("# advanced boundary — kept verbatim by the exporter")
```

Reserved keyword parameters on `node()`/`formula()`: `position`, `rotation`,
`scale`, `parent`, `space`, `label`. They feed the node transform/placement;
everything else is a type property validated against the registry. Passing a
list to `rotation` raises a clear error — domain orientation belongs in
properties (e.g. `euler` for `attention.frame`).

## 2. Deterministic Python export

`scientific.export.emit(document)` produces a standalone scene file that
rebuilds the identical IR (`build() -> ScientificScene`) and defines the
Manim class (`class SynthesizabilityWall(MovingCameraScientificScene)`).
Properties:

- **Byte-stable** — identical documents produce identical source; there are
  no timestamps and no unordered maps (all dict keys are sorted).
- **Round-trip exact** — `import_document(emit(doc)).semantic_equal(doc)`
  is a tested invariant, including custom steps and camera state.
- **Runnable** — `python scene.py` and
  `python -m scientific.run scene.py SceneName` both work; the file ends
  with the standard `__main__` guard.

## 3. The JS mirror and the parity contract

The Node API implements the same two pure functions — validation and
emission — so the editor can validate/export without shelling out to
Python:

| Concept | Python (canonical) | JS mirror |
|---|---|---|
| Type metadata | `scientific/registry/builtin_*.py` | `src/ir/types/*.js` (generated) |
| Validation | `scientific/ir/validate.py` | `src/ir/validate.js` |
| Emission | `scientific/export/emitter*.py` | `src/ir/emitPython.js` |
| Literals | `scientific/export/literals.py` | `src/ir/literals.js` |

**Parity is tested, not assumed** (mirrors the issue #1 precedent of
`sceneDetect.js` / `scene_detect.py`):

- `services/api/tests/ir.test.mjs` asserts the JS emitter output is
  **byte-identical** to the Python goldens for every fixture document.
- Both suites run the shared validation corpus and must agree on every
  verdict.
- The type-metadata golden is generated from the Python registry; the JS
  mirror is regenerated from it.

### Canonicalization rules (the fine print)

These rules make byte-parity possible across languages — follow them when
extending either emitter:

1. **Integral floats are ints.** JSON erases the `3.0`/`3` distinction
   (`JSON.parse("3.0") === 3`), so the canonical numeric form of any
   integral number is the integer (`6.0` → `6`). Both emitters and the IR
   serializer apply this; `semantic_equal` compares canonical JSON.
2. **Non-integral floats** use the shortest round-trip form
   (`repr` in Python, `String(x)` in JS — identical for the normal range;
   extreme exponents like `1e-07` vs `1e-7` are outside the corpus and
   intentionally unsupported).
3. **Map keys are sorted** everywhere (matching the canonical JSON form).
   Arrays keep their order — object order is semantic (z-order).
4. **Python keywords** in property names (`from`, `class`, …) are emitted
   as `**{"from": …}` dict splats. Prefer non-keyword property names
   (we renamed `attention.link`'s `from`/`to` to `fromId`/`toId`).
5. **Python `repr` strings** in docstrings use single quotes on both sides
   (`pyRepr` in the JS mirror).

### Regeneration workflow

```bash
# after changing the Python registry or emitter:
python scripts/gen_parity_fixtures.py   # regenerates fixtures + goldens
python scripts/sync_schema_types.py     # regenerates the JS type mirror
cd services/api && npm test             # parity must pass
python -m unittest discover -s scientific/tests -t .
```

## 4. Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/ir/schema` | type metadata for the generic frontend inspector |
| `POST /api/ir/validate` | `{document}` → `{valid, errors[]}` |
| `POST /api/ir/export` | validated `{document}` → `{python}` (422 when invalid) |

The frontend must **not** invent semantics the runtime cannot express; the
inspector metadata is the contract for generic editors (see #29 for the
editor UI itself).
