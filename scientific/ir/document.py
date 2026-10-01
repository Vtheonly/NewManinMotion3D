"""SceneDocument — the canonical, serializable scientific scene.

Holds objects, expressions, live values, relationships, bindings, timeline,
camera and presentation state.  Serialization is deterministic (stable field
order, no timestamps) so identical scenes produce identical JSON and
identical exported Python.
"""

from __future__ import annotations

from typing import Any, Optional

from .errors import IRError
from .expression import Expression, LiveValue
from .node import SceneNode, Transform, node_parents_form_cycle
from .relationship import Relationship
from .schema import SCENE_TYPES, SCHEMA
from .timeline import Stage, Step

class SceneDocument:
    def __init__(self, id: str, title: str = "", scene_type: str = "scene_2d",
                 camera: Optional[dict] = None, metadata: Optional[dict] = None,
                 presentation: Optional[dict] = None):
        if scene_type not in SCENE_TYPES:
            raise IRError(f"unknown scene type {scene_type!r} (known: {SCENE_TYPES})")
        self.schema = SCHEMA
        self.id = str(id)
        self.title = str(title or id)
        self.scene_type = scene_type
        self.camera: dict[str, Any] = dict(camera or {})
        self.metadata: dict[str, Any] = dict(metadata or {})
        self.presentation: dict[str, Any] = dict(presentation or {})
        self.objects: dict[str, SceneNode] = {}
        self.expressions: dict[str, Expression] = {}
        self.values: dict[str, LiveValue] = {}
        self.relationships: dict[str, Relationship] = {}
        self.bindings: dict[str, Any] = {}
        self.timeline: list[Stage] = []

    # ── construction ────────────────────────────────────────────────
    def add_node(self, node: SceneNode) -> SceneNode:
        if node.id in self.objects:
            raise IRError(f"duplicate object id {node.id!r}")
        self.objects[node.id] = node
        return node

    def add_expression(self, expr: Expression,
                        node_props: dict | None = None) -> Expression:
        if expr.id in self.expressions:
            raise IRError(f"duplicate expression id {expr.id!r}")
        self.expressions[expr.id] = expr
        # Canonical invariant: every expression has a paired math.formula
        # artifact (see docs/development/architecture/SCENE-IR.md).
        if expr.id not in self.objects:
            self.add_node(SceneNode(
                id=expr.id, type="math.formula",
                properties=node_props or {"source": expr.source},
            ))
        return expr

    def add_value(self, value: LiveValue) -> LiveValue:
        if value.id in self.values:
            raise IRError(f"duplicate value id {value.id!r}")
        self.values[value.id] = value
        return value

    def add_relationship(self, rel: Relationship) -> Relationship:
        if rel.id in self.relationships:
            raise IRError(f"duplicate relationship id {rel.id!r}")
        self.relationships[rel.id] = rel
        return rel

    def add_stage(self, stage: Stage) -> Stage:
        self.timeline.append(stage)
        return stage

    # ── queries ─────────────────────────────────────────────────────
    def all_ids(self) -> set[str]:
        ids = set(self.objects) | set(self.expressions)
        return ids | set(self.values) | set(self.relationships) | set(self.bindings)

    def objects_by_type(self, type_key: str) -> list[SceneNode]:
        return [n for n in self.objects.values() if n.type == type_key]

    def parent_chain(self, node_id: str) -> list[str]:
        chain: list[str] = []
        current = self.objects.get(node_id)
        while current is not None and current.parent_id:
            chain.append(current.parent_id)
            current = self.objects.get(current.parent_id)
        return chain

    # ── serialization ───────────────────────────────────────────────
    def to_dict(self) -> dict:
        out: dict[str, Any] = {
            "schema": self.schema,
            "id": self.id,
            "title": self.title,
            "sceneType": self.scene_type,
        }
        if self.camera:
            out["camera"] = self.camera
        if self.metadata:
            out["metadata"] = self.metadata
        out["objects"] = [n.to_dict() for n in self.objects.values()]
        out["expressions"] = [e.to_dict() for e in self.expressions.values()]
        out["values"] = [v.to_dict() for v in self.values.values()]
        out["relationships"] = [r.to_dict() for r in self.relationships.values()]
        if self.bindings:
            out["bindings"] = self.bindings
        out["timeline"] = [s.to_dict() for s in self.timeline]
        if self.presentation:
            out["presentation"] = self.presentation
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "SceneDocument":
        doc = cls(
            id=data["id"],
            title=data.get("title", ""),
            scene_type=data.get("sceneType", "scene_2d"),
            camera=data.get("camera"),
            metadata=data.get("metadata"),
            presentation=data.get("presentation"),
        )
        doc.schema = data.get("schema", SCHEMA)
        for raw in data.get("objects", []):
            doc.add_node(SceneNode.from_dict(raw))
        for raw in data.get("expressions", []):
            # paired nodes either came from the objects list above or are
            # created here with the canonical source property
            doc.add_expression(Expression.from_dict(raw))
        for raw in data.get("values", []):
            doc.add_value(LiveValue.from_dict(raw))
        for raw in data.get("relationships", []):
            doc.add_relationship(Relationship.from_dict(raw))
        doc.bindings = dict(data.get("bindings") or {})
        for raw in data.get("timeline", []):
            doc.add_stage(Stage.from_dict(raw))
        return doc

    def semantic_equal(self, other: "SceneDocument") -> bool:
        """Equality by canonical content (number forms and key order
        normalized) — used by round-trip tests."""
        from .serialize import to_json
        return to_json(self) == to_json(other)

    def has_parent_cycles(self) -> list[str]:
        """Return ids whose parent chain contains a cycle."""
        return [nid for nid in self.objects if node_parents_form_cycle(self.objects, nid)]
