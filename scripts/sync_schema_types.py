#!/usr/bin/env python3
"""Regenerate the JS type-metadata mirror from the Python registry.

Writes services/api/src/ir/types/*.js so the frontend and API share the
registry as the single source of truth (issue #34 §6: registering a type is
the only step needed to make it discoverable).

Run after changing scientific/registry/builtin_*.py:
    python scripts/sync_schema_types.py
    cd services/api && npm test
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from scientific import describe_types  # noqa: E402

TARGET = REPO / "services" / "api" / "src" / "ir" / "types"

HEADER = """/**
 * {title} — generated from scientific/registry/builtin_{name}.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/sync_schema_types.py
 */
"""

MODULES = {
    "core": "Core types (groups, text, UI, math)",
    "math": "Mathematical types",
    "mathext": "Extended mathematical types",
    "graphs": "Graph/network types",
    "biology": "Biology types",
    "kinematics": "Kinematics types",
    "attention": "Attention types",
    "presentation": "Presentation & comparison types",
}

# registry category -> module name
CATEGORY_MODULE = {
    "core": "core", "ui": "core", "math": "math", "graph": "graphs",
    "biology": "biology", "nn": "core", "kinematics": "kinematics",
    "attention": "attention", "presentation": "presentation",
    "comparison": "presentation",
}


def py_literal(value) -> str:
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return json.dumps(value)
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, list):
        return "[" + ", ".join(py_literal(v) for v in value) + "]"
    if isinstance(value, dict):
        return "{" + ", ".join(f"{json.dumps(k)}: {py_literal(v)}"
                               for k, v in sorted(value.items())) + "}"
    raise TypeError(f"cannot mirror {value!r}")


def main() -> int:
    TARGET.mkdir(parents=True, exist_ok=True)
    types = describe_types()
    groups: dict[str, list] = {name: [] for name in MODULES}
    for entry in types:
        module = CATEGORY_MODULE.get(entry["category"], "core")
        groups[module].append(entry)

    for module, title in MODULES.items():
        entries = groups[module]
        lines = [HEADER.format(title=title, name=_source_name(module))]
        lines.append("'use strict';\n")
        names = []
        for entry in sorted(entries, key=lambda e: e["key"]):
            var = entry["key"].replace(".", "_").upper()
            names.append(var)
            lines.append(f"const {var} = {py_literal(entry)};\n")
        lines.append(f"const {module.upper()} = [\n")
        for name in names:
            lines.append(f"  {name},\n")
        lines.append("];\n")
        lines.append(f"export {{ {module.upper()} }};\n")
        lines.append(f"export default {module.upper()};\n")
        (TARGET / f"{module}.js").write_text("".join(lines),
                                             encoding="utf-8")

    _write_index(groups)
    print(f"synced {len(types)} types into {len(MODULES)} modules")
    return 0


def _source_name(module: str) -> str:
    return {"mathext": "math", "graphs": "graphs"}.get(module, module)


def _write_index(groups: dict) -> None:
    lines = ["""/**
 * IR type metadata — JS mirror of scientific/registry/builtin_*.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/gen_parity_fixtures.py && python scripts/sync_schema_types.py
 *
 * Golden-tested against services/api/tests/fixtures/ir/type-metadata.json.
 * Drives validation and the generic frontend inspector (GET /api/ir/schema).
 */

'use strict';

"""]
    imports, spreads = [], []
    for module in MODULES:
        imports.append(f"import {{ {module.upper()} }} from './types/{module}.js';")
        spreads.append(f"  ...{module.upper()}")
    lines.extend(imports)
    lines.append("\nconst TYPES = [\n" + ",\n".join(spreads) + "\n];\n")
    lines.append("""
const byKey = Object.fromEntries(TYPES.map((t) => [t.key, t]));

function typeEntry (key) {
  const entry = byKey[key];
  if (!entry) {
    const err = new Error(
      `Unknown object type '${key}'. Register it via ` +
      'scientific.registry.register_type() before use.');
    err.code = 'UNKNOWN_TYPE';
    throw err;
  }
  return entry;
}

function describeTypes () {
  return TYPES.map(({ key, label, category, dimensionality, description,
    properties }) => (
    { key, label, category, dimensionality, description, properties }
  ));
}

export { TYPES, byKey, typeEntry, describeTypes };
export default TYPES;
""")
    (TARGET.parent / "schemaTypes.js").write_text("".join(lines),
                                                  encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
