"""Binding source specs — how live values obtain their numbers.

A source is a plain serializable dict with a ``kind``:

    {"kind": "literal", "value": 3.25}
    {"kind": "data",    "ref": "synth/protein.json", "key": "energy"}
    {"kind": "derived", "expr": "a * b + 1", "inputs": {"a": <source>, ...}}
    {"kind": "symbol",  "name": "theta"}   # document-level binding lookup

The Python helpers below are sugar; the dicts are the canonical form shared
with JSON serialization and the JS mirror.
"""

from __future__ import annotations

from typing import Any, Optional


def Literal(value: Any) -> dict:
    return {"kind": "literal", "value": value}


def DataRef(ref: str, key: Optional[str] = None) -> dict:
    out: dict[str, Any] = {"kind": "data", "ref": ref}
    if key is not None:
        out["key"] = key
    return out


def Derived(expression: str, inputs: Optional[dict[str, Any]] = None,
            format: Optional[str] = None) -> dict:
    out: dict[str, Any] = {"kind": "derived", "expr": expression,
                           "inputs": dict(inputs or {})}
    if format is not None:
        out["format"] = format
    return out


def Symbol(name: str) -> dict:
    return {"kind": "symbol", "name": name}


def is_source(value: Any) -> bool:
    return isinstance(value, dict) and value.get("kind") in (
        "literal", "data", "derived", "symbol"
    )


def describe_source(source: dict) -> str:
    kind = source.get("kind")
    if kind == "literal":
        return f"literal {source.get('value')!r}"
    if kind == "data":
        return f"data {source.get('ref')}" + (
            f".{source['key']}" if source.get("key") else "")
    if kind == "derived":
        return f"derived({source.get('expr')!r})"
    if kind == "symbol":
        return f"symbol {source.get('name')!r}"
    return "invalid source"
