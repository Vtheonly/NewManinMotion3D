# Mathematics — Structured Expressions, Terms and Highlighting

## 1. Expression entries

```python
scene.formula(
    "jacobian_projection",               # id (pairs with a math.formula node)
    "tau = J(theta).T @ F",              # source: readable pseudo-math
    terms={"Jt": "J(theta).T", "F": "F"},   # named subexpressions
    bindings={"theta": Literal(0.6)},    # symbol → source (DATA-BINDINGS)
    highlights=["Jt"],                   # term names or fragments to colour
    format="tau = {value:.2f}",          # optional live display template
    fontSize=40, position=(0.0, -2.0, 0.0),
)
```

A formula is **never an opaque image**. The source stays editable; terms
address subexpressions individually; bindings connect symbols to data;
highlights stay attached through renders and round trips.

## 2. Source syntax (readable pseudo-math)

The source is plain, greppable text — no LaTeX required to author:

| Authoring form | Meaning |
|---|---|
| `tau`, `theta`, `gamma`, `Delta` … | Greek symbols (word names) |
| `A.T` / `A.T @ B` | transpose / matrix product |
| `a * b` | multiplication (rendered as `·`) |
| `x**2`, `sqrt(d)`, `q.k` | powers, functions, dot products |
| `_` and `^{}` | sub/superscripts pass through unchanged |

## 3. Latexification (rendering)

The renderer converts sources to LaTeX with a fixed, deterministic mapping
(`scientific/domains/math/latexify.py`):

- `@` → `\,` (thin space)
- `.T` → `^{T}`
- `*` → `\cdot`
- Greek word names (word-boundary) → `\theta` etc.

`MathTex` then renders the converted source; every highlight fragment is
converted the same way and coloured (warn tone) via `set_color_by_tex`.
Where no LaTeX toolchain exists, a documented `Text` fallback renders the
raw source so scenes still execute (see RUNTIME-BOUNDARY.md §6).

## 4. Terms and deep editing

Terms name the semantic parts of an expression so the frontend can edit
them individually (issue #32 §2: "a formula cannot be treated as an opaque
rendered image"):

- change a term's fragment → both the paired node's rendering and the
  expression regenerate;
- highlight/annotate a term by name (`highlights=["Jt"]` resolves to the
  fragment automatically);
- bind a symbol inside the source (`theta` above) to a live source; the
  safe evaluator computes derived numbers from it.

## 5. Numeric matrices and curves

- `math.matrix` — `rows: [[...], ...]` with optional `heat: true` cell
  coloring by value range; used by the attention scene for score tables.
- `math.curve` — `function` is a **safe-evaluator expression of `x`**
  (same whitelist as derived bindings), plotted on the referenced `axes`
  node id. Example: `"sin(x) * exp(-x**2 / 4)"`.

## 6. Scientific numerics backing visuals

The math that *generates* visual values lives in pure, tested domain
modules — never inside renderers:

| Module | Provides |
|---|---|
| `domains/kinematics/torus.py` | T² embedding, analytic flow, midpoint integration |
| `domains/kinematics/poe.py` | so(3)/se(3) exponentials (Rodrigues) |
| `domains/kinematics/jacobian.py` | geometric Jacobian, DLS solver |
| `domains/nn/network.py` | seeded MLP forward pass |
| `domains/attention/model.py` | distance-biased softmax scores |
| `domains/biology/protein/*` | deterministic folds, pseudo-energy |

Every one of these is covered by numerical tests (finite-difference
Jacobian checks, distribution sums, round-trip geometry) in
`scientific/tests/test_domains.py`.
