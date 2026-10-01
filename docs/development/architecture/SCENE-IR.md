# Scene IR — the Canonical Scientific Scene Model (sci-ir/1)

> **Status:** Implemented in iteration 001 of issue #32 (PR reference in the
> iteration report). Runtime package: `scientific/` (Python),
> `services/api/src/ir/` (JS mirror).

## 1. Purpose

The Scene IR is the **single semantic representation** shared by the
frontend, the compiler, the Python runtime and the renderer. Every supported
artifact — text, formula, protein, matrix, torus, camera HUD, attention
link — is a node in one document. There is no per-domain side channel and no
frontend-only state: if a primitive is registered, it is editable,
serializable, exportable and renderable through the same generic mechanisms.

```
Frontend editor ─┐                         ┌─ Manim renderer (worker)
                 ├─ Scene IR (sci-ir/1) ───┤
Python authoring ┘    canonical JSON       └─ Deterministic Python export
```

## 2. Document structure

A document is a JSON object with stable, versioned fields (camelCase in
serialized form):

| Field | Type | Meaning |
|---|---|---|
| `schema` | `"sci-ir/1"` | schema identity; loaders reject other majors |
| `id` | string | scene id; snake_case; drives the exported class name |
| `title` | string | human title |
| `sceneType` | enum | `scene_2d` \| `moving_camera` \| `three_d` \| `custom` (mirrors issue #1's scene registry) |
| `camera` | object | initial camera (see syntax/CAMERA.md) |
| `metadata` | object | free-form provenance (never rendered) |
| `objects` | array | scene nodes in **authoring order** (order = z-order) |
| `expressions` | array | structured math (see below) |
| `values` | array | live values (formatted derived numbers) |
| `relationships` | array | semantic edges between artifacts |
| `bindings` | object | symbol → binding source map |
| `timeline` | array | stages of declarative steps |
| `presentation` | object | presentation state (HUD toggles etc.) |

### Canonical invariants

1. **Expression pairing** — every expression has a paired `math.formula`
   node with the same id (created automatically by the authoring API and
   re-created on load if absent). This keeps formulas placeable, editable
   and renderable like any artifact.
2. **Unique ids** — object/expression/value/relationship ids must not
   collide within their section (an expression id may pair with its node).
3. **Parent-before-child authoring** — the builder enforces it; loaders
   normalize order; cycles are validation errors.
4. **Determinism** — serialization sorts all map keys and canonicalizes
   integral floats to ints, so equal content yields byte-identical JSON and
   byte-identical exported Python on every platform.

## 3. Nodes

```json
{
  "id": "designed_protein",
  "type": "biology.protein",
  "properties": { "representation": "cartoon", "residues": 26 },
  "parentId": "pocket_group",
  "space": "world3d",
  "label": " Designed binder",
  "transform": {
    "position": [1.2, 0.0, 0.4],
    "rotation": 12.0,
    "scale": 0.85
  }
}
```

- `type` keys are dotted (`domain.name`) and must be registered
  (`scientific.registry.register_type` / mirrored in the JS metadata).
- `properties` are validated against the type's registered **property
  schema** — unknown properties, wrong types, bad enums and missing
  required fields are validation errors, not silent drops.
- `space` selects `scene2d` (camera plane) or `world3d`.
- `transform` is placement (position triple, rotation degrees about z,
  uniform scale). Domain orientation (e.g. an SO(3) frame's euler angles)
  belongs in `properties`, never in `transform.rotation`.

## 4. Expressions, values, relationships, timeline

- **Expressions** carry `source` (readable pseudo-math), `terms` (named
  subexpressions), `bindings` (symbol → source spec), `highlights` (term
  names or fragments to colour) and an optional `format`. A formula is
  never an opaque image — terms, constants and bindings stay editable
  (syntax/MATHEMATICS.md).
- **Live values** bind a symbol to a data source and a display template
  (`"ΔG = {value:.2f} kcal/mol"`); the renderer resolves them once per
  render, deterministically (syntax/DATA-BINDINGS.md).
- **Relationships** are typed edges (`arrow`, `distance`, `annotation`,
  `link`, `comparison`, `group`) with optional live state; they attach as
  soon as all their sources are visible (syntax/OBJECTS.md).
- **Timeline** = ordered stages of closed-set steps (`show`, `play`,
  `highlight`, `annotate`, `wait`, `camera`, `transform`, `custom`).
  `custom` is the explicit advanced boundary: hand-written runtime code,
  preserved verbatim through every export/import round trip
  (RUNTIME-BOUNDARY.md).

## 5. Validation

`validate_document` (Python) and `validateDocument` (JS) return a list of
`{path, message}` errors and never throw for content problems. Verdict
parity between the two implementations is enforced by the shared corpus
(`services/api/tests/fixtures/ir/corpus.json`), which both test suites
consume. The API exposes it as `POST /api/ir/validate`.

## 6. Extension

Registering a type is the *only* step required to make a primitive
universally available:

```python
register_type("custom.orbit", label="Orbit", dimensionality="3d",
              properties={"radius": {"type": "float", "required": True}})
```

Registration provides: validation, generic inspector metadata
(`GET /api/ir/schema`), deterministic export, and (when a renderer binding
is attached in `manim_adapter/bindings/`) rendering. New domains must not
fork the model — extend it (syntax/EXTENSIONS.md).
