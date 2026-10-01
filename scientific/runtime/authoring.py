"""ScientificScene — the hand-authoring API (issue #32 §4/§5/§6).

Builds a canonical SceneDocument through a small, stable surface.  The same
document serializes to JSON, exports to runnable Python and renders through
the manim adapter — one semantic object graph, every layer.
"""

from __future__ import annotations

from typing import Any, Optional

from ..ir import (
    Expression, IRError, LiveValue, Relationship, SceneNode, Transform,
)
from .narrative import NarrativeMixin

PLACEMENT_KEYS = ("position", "rotation", "scale", "parent", "space", "label")


def _transform_from(placement: dict) -> Transform:
    position = placement.get("position")
    if position is not None and (
            not isinstance(position, (tuple, list)) or len(position) != 3):
        raise IRError("position must be an (x, y, z) triple")
    rotation = placement.get("rotation", 0.0)
    scale = placement.get("scale", 1.0)
    if not isinstance(rotation, (int, float)):
        raise IRError("rotation is the transform angle (float); domain "
                      "orientation belongs in properties (e.g. euler)")
    if not isinstance(scale, (int, float)):
        raise IRError("scale must be a number")
    return Transform(
        position=tuple(float(c) for c in position or (0, 0, 0)),
        rotation=float(rotation), scale=float(scale))


class ScientificScene(NarrativeMixin):
    def __init__(self, id: str, title: str = "", scene_type: str = "scene_2d",
                 camera: Optional[dict] = None, metadata: Optional[dict] = None):
        from ..ir import SceneDocument
        self.document = SceneDocument(id=id, title=title, scene_type=scene_type,
                                      camera=camera, metadata=metadata)
        self._stage_counter = 0
        self._current_stage: Optional[Any] = None

    # ── artifacts ───────────────────────────────────────────────────
    def node(self, type_key: str, id: str, **kwargs) -> str:
        placement = {k: kwargs.pop(k) for k in PLACEMENT_KEYS if k in kwargs}
        self._check_parent(placement.get("parent"))
        self.document.add_node(SceneNode(
            id=id, type=type_key, properties=dict(kwargs),
            parent_id=placement.get("parent"),
            space=placement.get("space", "scene2d"),
            label=placement.get("label"),
            transform=_transform_from(placement),
        ))
        return id

    def formula(self, id: str, source: str,
                terms: Optional[dict[str, str]] = None,
                bindings: Optional[dict[str, Any]] = None,
                highlights: Optional[list[str]] = None,
                format: Optional[str] = None, **node_props) -> str:
        placement = {k: node_props.pop(k) for k in PLACEMENT_KEYS
                     if k in node_props}
        self._check_parent(placement.get("parent"))
        self.document.add_node(SceneNode(
            id=id, type="math.formula",
            properties={"source": source, **node_props},
            parent_id=placement.get("parent"),
            space=placement.get("space", "scene2d"),
            label=placement.get("label"),
            transform=_transform_from(placement),
        ))
        self.document.add_expression(Expression(
            id=id, source=source, terms=terms or {}, bindings=bindings or {},
            highlights=highlights or [], format=format,
        ))
        return id

    def live_value(self, id: str, source: Any, format: str = "{value}") -> str:
        self.document.add_value(LiveValue(id=id, source=source, format=format))
        return id

    def relationship(self, a: str, b: Optional[str] = None, id: str = "",
                     kind: str = "arrow", live: bool = False,
                     **properties) -> str:
        rel_id = id or f"{kind}_{len(self.document.relationships) + 1}"
        sources = [a] + ([b] if b else [])
        self.document.add_relationship(Relationship(
            id=rel_id, kind=kind, sources=sources, properties=properties,
            live=live,
        ))
        return rel_id

    def bind(self, symbol: str, source: Any) -> None:
        if symbol in self.document.bindings:
            raise IRError(f"symbol {symbol!r} already bound")
        self.document.bindings[symbol] = source

    # ── helpers ─────────────────────────────────────────────────────
    def _check_parent(self, parent: Optional[str]) -> None:
        if parent is not None and parent not in self.document.objects:
            raise IRError(f"unknown parent {parent!r} (add it first)")
