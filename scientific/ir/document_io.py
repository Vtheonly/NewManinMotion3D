"""Document (de)serialization — split from document.py (150-line rule).

Pure functions over an already-constructed SceneDocument; deterministic
field order (see SCENE-IR.md §2 for the shape).
"""

from __future__ import annotations

from typing import Any

from .expression import Expression, LiveValue
from .node import SceneNode
from .relationship import Relationship
from .schema import SCHEMA
from .timeline import Stage


def document_to_dict(doc) -> dict:
    out: dict[str, Any] = {"schema": doc.schema, "id": doc.id,
                          "title": doc.title, "sceneType": doc.scene_type}
    if doc.camera:
        out["camera"] = doc.camera
    if doc.metadata:
        out["metadata"] = doc.metadata
    out["objects"] = [n.to_dict() for n in doc.objects.values()]
    out["expressions"] = [e.to_dict() for e in doc.expressions.values()]
    out["values"] = [v.to_dict() for v in doc.values.values()]
    out["relationships"] = [r.to_dict() for r in doc.relationships.values()]
    out.update(doc.sections_to_dict())
    if doc.bindings:
        out["bindings"] = doc.bindings
    out["timeline"] = [s.to_dict() for s in doc.timeline]
    if doc.presentation:
        out["presentation"] = doc.presentation
    return out


def populate_document(doc, data: dict):
    """Fill an empty `doc` from raw `data` (inverse of document_to_dict)."""
    doc.schema = data.get("schema", SCHEMA)
    for raw in data.get("objects", []):
        doc.add_node(SceneNode.from_dict(raw))
    for raw in data.get("expressions", []):
        # paired nodes came from objects above or are created canonically
        doc.add_expression(Expression.from_dict(raw))
    for raw in data.get("values", []):
        doc.add_value(LiveValue.from_dict(raw))
    for raw in data.get("relationships", []):
        doc.add_relationship(Relationship.from_dict(raw))
    doc.load_sections(data)
    doc.bindings = dict(data.get("bindings") or {})
    for raw in data.get("timeline", []):
        doc.add_stage(Stage.from_dict(raw))
    return doc
