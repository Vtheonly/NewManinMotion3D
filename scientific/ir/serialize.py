"""Deterministic JSON (de)serialization for scene documents."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Union

from .document import SceneDocument
from .errors import SchemaError
from .schema import check_schema


def to_json(doc: SceneDocument, indent: int = 2) -> str:
    """Serialize deterministically (stable field order, sorted dict props)."""
    data = doc.to_dict()
    return json.dumps(_canonical(data), indent=indent, ensure_ascii=False)


def from_json(raw: Union[str, bytes]) -> SceneDocument:
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise SchemaError(type(data).__name__, "sci-ir/1")
    check_schema(data.get("schema", "sci-ir/1"))
    return SceneDocument.from_dict(data)


def write_file(doc: SceneDocument, path: Union[str, Path]) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(to_json(doc) + "\n", encoding="utf-8")
    return path


def read_file(path: Union[str, Path]) -> SceneDocument:
    return from_json(Path(path).read_text(encoding="utf-8"))


def _canonical(value):
    """Sort dict keys and normalize integral floats to ints so the JSON form
    is byte-stable across authoring order, serializers and languages."""
    if isinstance(value, dict):
        return {k: _canonical(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [_canonical(v) for v in value]
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value
