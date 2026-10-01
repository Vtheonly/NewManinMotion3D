# Data Bindings — Sources, Live Values and the Safe Evaluator

## 1. Source specs

A binding source is a small serializable dict (`kind` discriminates). The
Python helpers are sugar; the dicts are the canonical form:

```python
Literal(3.25)                 # {"kind": "literal", "value": 3.25}
DataRef("synth/protein.json", "energy")
                              # {"kind": "data", "ref": "...", "key": "energy"}
Derived("a * b + 1", {"a": Literal(2), "b": Literal(3)}, format="{value:.2f}")
                              # {"kind": "derived", "expr": ..., "inputs": {...}}
Symbol("theta")               # {"kind": "symbol", "name": "theta"}
```

| Kind | Resolves to | Errors |
|---|---|---|
| `literal` | the stored value | — |
| `data` | loaded file value at an optional dotted key | missing file, unsupported format, path traversal, missing key |
| `derived` | safe-evaluated expression over resolved inputs | unsafe syntax, unknown symbol, math error, cycles |
| `symbol` | a document-level binding (`scene.bind`) | unbound symbol |

## 2. Document bindings and live values

```python
scene.bind("theta", Literal(0.6))            # symbol table
scene.live_value("hero_energy",
                 DataRef("synth/protein.json", "energy"),
                 format="ΔG = {value:.2f} kcal/mol")
```

Resolution order is document order (deterministic): bindings first, then
each live value (which may reference earlier symbols). Values can chain
(`Derived` over `Symbol`s and other `Derived`s); cycles are detected and
reported as clear authoring errors.

**Display templates** use Python format syntax over `{value}`; step
annotations substitute resolved live values by id (`"{hero_energy}"` → the
formatted string, so labels read `ΔG = -42.69 kcal/mol`, never raw floats).

## 3. Data sources on disk

- Root: `SCIENTIFIC_DATA_ROOT` (default `presentation/data/`; the Docker
  image points it at the mounted fixtures).
- Formats: `.json` (any structure, dotted-key lookup), `.csv` (rows as
  dicts), `.txt` (raw string).
- Refs are relative; `..` and absolute paths are rejected.
- Files are cached per render; fixtures are deterministic and versioned in
  the repo with an explicit `manifest.json` (issue #26: data sources must
  be explicit; mock fixtures are allowed for tests but production scenes
  declare their data).

## 4. The safe evaluator (derived expressions)

Whitelisted grammar (AST-checked, never `eval`):

- numeric literals, names (inputs/constants);
- `+ - * / ** % //`, unary `-`;
- constants `pi`, `e`, `tau`;
- functions: `abs min max round sqrt exp log sin cos tan atan atan2 tanh`.

Everything else — attribute access, subscripts, calls to anything else,
lambdas, strings, booleans — raises `EvaluatorError` with the offending
construct. Division by zero and domain errors (e.g. `log(0)`) surface as
binding errors with the expression included.

## 5. Design rules

1. **No hidden state** — a value's number always traces to a literal, a
   file, or a derived chain over those.
2. **Deterministic** — same inputs, same numbers, every run (seeded domain
   models included).
3. **Serializable** — sources are plain JSON dicts; round-trip tests pin
   that emitted Python rebuilds identical binding specs.
