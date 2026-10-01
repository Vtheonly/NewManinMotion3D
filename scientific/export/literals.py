"""Python literal formatting shared by the exporter (and mirrored in JS).

Cross-language canonical rules (AUTHORING-MODEL.md):
  - None/True/False map to Python spellings;
  - strings use JSON escaping (valid in both languages);
  - numbers that are integral are emitted as ints (JSON erases the 3.0/3
    distinction, so the canonical form is the int);
  - non-integral floats use the shortest round-trip form;
  - dict keys are sorted (matching ir/serialize.py canonical JSON);
  - lists recurse in order.
"""

from __future__ import annotations

import json
from typing import Any


def format_float(value: float) -> str:
    if value != value or value in (float("inf"), float("-inf")):
        raise ValueError(f"non-finite float {value!r} is not exportable")
    if float(value).is_integer():
        return str(int(value))
    return repr(float(value))


def py_literal(value: Any, _indent: int = 0) -> str:
    """Render a JSON-compatible value as a canonical Python literal."""
    if value is None:
        return "None"
    if value is True:
        return "True"
    if value is False:
        return "False"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return format_float(value)
    if isinstance(value, list):
        return "[" + ", ".join(py_literal(v) for v in value) + "]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        parts = [
            f"{json.dumps(str(k), ensure_ascii=False)}: {py_literal(v)}"
            for k, v in sorted(value.items())
        ]
        return "{" + ", ".join(parts) + "}"
    raise ValueError(
        f"cannot export value of type {type(value).__name__}: {value!r}")
