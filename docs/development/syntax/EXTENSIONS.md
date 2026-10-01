# Extensions — Adding New Primitives Without Forking the Model

Issue #32 §14: a newly registered primitive must automatically become
discoverable by generic systems. This is the complete checklist; the
architecture test additionally guards file size, layer boundaries and
import cycles.

## 1. Register the type (single source of truth)

```python
# scientific/registry/builtin_<domain>.py  (or a plugin module)
register_type(
    "custom.orbit",
    label="Orbit", category="custom", dimensionality="3d",
    description="Parametric orbit trajectory around a body.",
    properties={
        "radius":  {"type": "float", "required": True},
        "speed":   {"type": "float", "default": 0.3},
        "color":   {"type": "str", "default": "accent"},
    },
)
```

Registration immediately gives you: validation (unknown/invalid properties
rejected), generic-inspector metadata (`GET /api/ir/schema`), deterministic
Python export, and IR serialization. Property names must not be Python
keywords (the emitter splats them if they are, but prefer `fromId` over
`from`).

## 2. (Optional) pure numerics

If the primitive computes anything, put the math in
`scientific/domains/<domain>/` — stdlib only, no manim — with unit tests.
Renderers consume these modules; they never compute geometry inline.

## 3. Bind a renderer

```python
# scientific/manim_adapter/bindings/<domain>.py
def _orbit(node, ctx):
    from manim import Circle
    return Circle(radius=float(node.properties["radius"]),
                  color=palette_color(node.properties.get("color", "accent")))

bind_renderer("custom.orbit", _orbit)
```

Renderer signature: `(node, ctx) -> Mobject | None`. The orchestrator
applies transforms, parenting, HUD pinning and reveal order for you.
Register the binding in `bindings/__init__.py`'s import list.

## 4. Mirror the metadata for the API/frontend

```bash
python scripts/gen_parity_fixtures.py   # regenerates type-metadata.json
python scripts/sync_schema_types.py     # regenerates src/ir/types/*.js
cd services/api && npm test             # parity must pass
```

The JS type metadata, validation and emitter are mirrors — the tests make
silent divergence impossible.

## 5. Tests to ship with the primitive

- schema/behaviour: valid construction, invalid rejection (test_ir /
  test_runtime patterns);
- numerics: deterministic outputs, sanity bounds (test_domains patterns);
- render smoke: build the document, render at `-ql` in the manim suite
  (test_export_roundtrip patterns);
- parity: fixtures regenerated and green on both sides.

## 6. Documentation

Add the type to the catalogue in OBJECTS.md, one line per property in the
schema, and — for scientific primitives — a numerical note in
MATHEMATICS.md. New discoveries/constraints go to the problem registry
(problems/PROBLEM-REGISTRY.md) immediately, per issue #32 §19.

## 7. Extension points that already exist

- **Domains** (registry + numerics + renderer) — as above.
- **Relationship kinds** — extend `ir/relationship.py` (closed set),
  `relationships.py` renderer, validation and the docs together.
- **Step ops** — extend `ir/timeline.py` (op set + validation), the
  adapter's `step_ops.py`, the exporter's step emission, and both test
  suites; ops are a closed contract by design.
- **Binding source kinds** — extend `runtime/dataref.py`,
  `runtime/resolve.py`, validation and docs.
