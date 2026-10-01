# Versioning — Schema Identity, Compatibility and Migration

## 1. Schema identity

Documents declare `"schema": "sci-ir/<major>"`. Current major: **1**.
Loaders (Python `from_json`, JS `validateDocument`) reject any other value
with an explicit migration error pointing here — an unknown or future
schema is never loaded partially.

## 2. Compatibility rules

- **Minor/additive changes** (new optional properties, new registered
  types, new enum values, new relationship kinds or step ops) do **not**
  bump the major: older documents remain valid and the new features are
  simply absent from them.
- **Breaking changes** (removing/renaming fields, changing a property's
  type meaning, changing serialization semantics, renumbering the op set)
  bump the major and require a migration (below).
- The Python and JS implementations must agree on the supported major at
  all times (parity tests).

## 3. Canonicalization (already in effect for v1)

These rules are part of the schema contract and must not drift:

1. Map keys are sorted in serialized form; arrays preserve order (object
   order is semantic z-order).
2. Integral floats canonicalize to ints (`6.0` → `6`) — JSON erases the
   distinction, and both emitters rely on it for byte parity.
3. Every expression is paired with a `math.formula` node of the same id;
   loaders create the pair when absent.
4. Emission is deterministic: identical documents → identical exported
   Python, on both language implementations.

## 4. Migration strategy (when major N+1 lands)

1. Add `scientific/ir/migrations/<N>_to_<N+1>.py` exposing
   `migrate(document) -> document` plus a JS mirror in
   `services/api/src/ir/migrations/`.
2. Loaders attempt automatic migration when they see major N; failures
   return a precise error (never a partial load).
3. `POST /api/ir/validate` reports the target schema in its response so
   editors can offer migration explicitly.
4. Fixtures and goldens are regenerated per supported major; parity suites
   run against both during the transition window.
5. The task registry tracks the migration as its own task with tests.

## 5. Versioning of the pieces

| Piece | Version carrier | Where it's visible |
|---|---|---|
| IR schema | `schema` field | every document |
| Python runtime | `scientific.__version__` | `import scientific` |
| Type metadata | content-hashed via goldens | `GET /api/ir/schema` |
| Exported files | header comment states `sci-ir/1` | first docstring line |

Exported Python files record the schema they were generated under; the
runtime refuses to round-trip files declaring a newer major.
