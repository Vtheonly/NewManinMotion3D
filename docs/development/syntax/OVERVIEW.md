# Syntax Overview — Authoring Scientific Scenes (sci-ir/1)

> The complete, current reference for the canonical scene syntax introduced
> by issue #32. Also available machine-readable: `GET /api/ir/schema`.

## The three ways to author

1. **Python authoring API** (hand-written or exported) —
   `scientific.ScientificScene` builder; the most expressive path.
2. **IR JSON** — the serialized document; produced/consumed by the API and
   round-trips through Python unchanged.
3. **Frontend editing** (arriving with #29) — generic editors against the
   registry metadata; the IR is the storage format, never a frontend-only
   schema.

All three are the same model: a document holds **objects** (artifacts),
**expressions** (structured math), **values** (live numbers),
**relationships** (semantic edges), **bindings** (symbols → data), a
**timeline** (stages of steps), **camera** and presentation state.

## Document checklist

```jsonc
{
  "schema": "sci-ir/1",
  "id": "synthesizability_wall",       // snake_case; drives class name
  "title": "Synthesizability Wall",
  "sceneType": "moving_camera",        // scene_2d | moving_camera | three_d | custom
  "camera": { "backgroundColor": "bg", "zoom": 0.92 },
  "objects": [ /* nodes in authoring (z-) order */ ],
  "expressions": [ /* structured math */ ],
  "values": [ /* live values */ ],
  "relationships": [ /* edges */ ],
  "bindings": { "theta": { "kind": "literal", "value": 0.6 } },
  "timeline": [ /* stages */ ]
}
```

Validation rules (identical in Python and JS — `POST /api/ir/validate`):

- `schema` must be exactly `sci-ir/1` (other majors are migration errors).
- Object ids unique within `objects`; every expression pairs with a
  `math.formula` node of the same id (auto-created when missing).
- Node types must be registered; properties must match the registered
  schema (unknown property, wrong type, bad enum, missing required).
- `parentId` must exist and parent chains must be acyclic.
- Relationship kinds are closed; sources must exist.
- Timeline ops are closed (`show | play | highlight | annotate | wait |
  camera | transform | custom`); `play` needs a known animation and a
  target; `custom` needs non-empty code; targets must exist.

## Topics

| Document | Covers |
|---|---|
| [OBJECTS.md](OBJECTS.md) | nodes, transforms, parenting, relationships, built-in catalogue |
| [MATHEMATICS.md](MATHEMATICS.md) | expression source syntax, terms, highlighting, latexification |
| [DATA-BINDINGS.md](DATA-BINDINGS.md) | literal/data/derived/symbol sources, safe evaluator, live values |
| [ANIMATION.md](ANIMATION.md) | stages, step ops, animation verbs, rate functions, custom code |
| [CAMERA.md](CAMERA.md) | per-scene-type camera configuration and animated ops |
| [EXTENSIONS.md](EXTENSIONS.md) | registering new primitives end-to-end |
| [VERSIONING.md](VERSIONING.md) | schema versioning and migration strategy |

## Minimal complete example

```python
from scientific import Derived, Literal, ScientificScene
from scientific.manim_adapter import BaseScientificScene

def build() -> ScientificScene:
    scene = ScientificScene("hello_science", title="Hello Science")
    scene.node("ui.panel", "panel", width=6.0, height=2.4, title="Result")
    scene.formula("eq", "E = m * c**2", highlights=["c**2"],
                  position=(0.0, -2.2, 0.0))
    scene.live_value("mass", Literal(2.2), format="m = {value:.1f} kg")
    with scene.stage(stage_id="intro", title="Intro") as st:
        st.play("panel", "grow").play("eq", "write")
        st.annotate("eq", "{mass}")
    return scene

class HelloScience(BaseScientificScene):
    def get_scene(self): return build()

if __name__ == "__main__":
    from scientific.run import main
    main([__file__])
```

Run it: `python -m scientific.run hello.py HelloScience --quality low`.
