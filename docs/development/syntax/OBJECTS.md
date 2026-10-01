# Objects — Nodes, Transforms, Relationships and the Built-in Catalogue

## 1. Nodes

A node is any supported artifact:

```python
scene.node(
    "biology.protein",          # registered type key (dotted)
    "designed_protein",         # unique id (semantic identity)
    residues=26, seed=7,        # type properties (schema-validated)
    representation="cartoon",
    color="accent2",
    parent="pocket_group",      # optional composition parent
    space="world3d",            # scene2d (default) | world3d
    label="Designed binder",    # optional editor-facing caption
    position=(1.2, 0.0, 0.4),   # optional transform
    rotation=12.0, scale=0.85,
)
```

Reserved parameter names (they feed placement, not properties):
`position`, `rotation`, `scale`, `parent`, `space`, `label`.
`rotation` is the transform angle in degrees (float, about z) — domain
orientations like an SO(3) frame's euler triple belong in **properties**
(e.g. `attention.frame`'s `euler`).

### Transform semantics

- `position` — (x, y, z) in scene units; `move_to` at build time.
- `rotation` — degrees about z (counter-clockwise).
- `scale` — uniform.
- Parented nodes are composed into the parent's group and shifted by the
  parent's centre (relative placement). Authoring requires parents to be
  added first; the exporter preserves document order, which is z-order.

### Property schema types

`str`, `int`, `float`, `bool`, `list`, `dict`, `any` — plus optional
`required`, `default`, `enum`, `description` per property. The full
machine-readable catalogue: `GET /api/ir/schema`.

## 2. Built-in catalogue (iteration 001)

| Type | Dimensionality | Purpose |
|---|---|---|
| `core.group` | 2d | grouping container |
| `text.label` | 2d | editable text/caption |
| `ui.panel` | 2d | rounded panel with optional title |
| `ui.grid` | 2d | cell layout for walls/arrays |
| `ui.stamp` | 2d | geometric OK/FAIL validation stamp |
| `ui.badge` | 2d | colored pill (scores, tags) |
| `math.formula` | 2d | structured expression (auto-paired) |
| `math.axes` | 2d | coordinate axes |
| `math.curve` | 2d | y=f(x) on an axes node |
| `math.matrix` | 2d | numeric matrix, optional heat coloring |
| `biology.protein` | 2d* | residue-level protein (cartoon/trace/schematic) |
| `biology.sequence` | 2d | amino-acid strip with highlights |
| `nn.network` | 2d | deterministic MLP with live activations |
| `kinematics.torus` | 3d | T² manifold + flow trajectory |
| `kinematics.chain` | 3d | PoE revolute chain |
| `kinematics.jacobian` | 3d | geometric-Jacobian arrows |
| `kinematics.obstacle` | 3d | sphere obstacle (clash demos) |
| `attention.matrix` | 2d | distance-biased score heatmap |
| `attention.frame` | 3d | SO(3) triad anchor |
| `attention.link` | 3d | weighted live edge |
| `hud.fixed` | 2d | camera-independent HUD element |

*protein coordinates are 3D; the artifact renders in both scene types.

## 3. Relationships

Typed semantic edges; they attach as soon as **all sources are visible**
(so they follow the narrative):

```python
scene.relationship("chain", "obstacle", id="clash_marker",
                   kind="distance", live=True,
                   label="d = {clearance}", color="fail")
```

| Kind | Meaning | Key properties |
|---|---|---|
| `arrow` | semantic pointer A → B | `color` |
| `distance` | geometric measurement | `label` (live-value template), `color` |
| `annotation` | label attached to an artifact | `text`, `side`, `color` |
| `link` | weighted edge (attention/binding) | `weight`, `color` |
| `comparison` | brace under two artifacts | — |
| `group` | dashed outline around members | — |

`live=True` marks the relationship as driven by live state; the renderer
substitutes `{value_id}` templates from resolved live values.

## 4. Editing model (for frontend implementers, #29)

- **Selection**: ids are semantic and stable; parents give the drill-down
  `Scene → Group → Domain object → Property`.
- **Property editing**: use the registry schema per type — every declared
  property is editable generically; there is no whitelist beyond the schema
  itself.
- **Formulas** are edited through their expression entry (terms, bindings,
  highlights), never as opaque rendered images.
- **Custom steps** are surfaced as advanced code blocks (never silently
  rewritten).
