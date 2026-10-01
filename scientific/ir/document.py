"""SceneDocument — the canonical, serializable scientific scene.

Objects, expressions, live values, relationships, bindings, timeline,
camera, presentation state and the Suprepto sections (state / machines /
comparisons / annotations).  Serialization is deterministic (stable field
order, no timestamps) so identical scenes produce identical JSON and
identical exported Python.
"""

from __future__ import annotations

from typing import Any, Optional

from .annotation import AnnotationSpec, ComparisonSpec  # noqa: F401 (re-export)
from .document_sections import SupreptoSectionsMixin
from .errors import IRError
from .expression import Expression, LiveValue
from .node import SceneNode, Transform, node_parents_form_cycle
from .relationship import Relationship
from .schema import SCENE_TYPES, SCHEMA
from .state import (  # noqa: F401 (re-export)
    DerivedSpec, StateMachineSpec, StateSymbolSpec, TransitionSpec,
)
from .timeline import Stage, Step


class SceneDocument(SupreptoSectionsMixin):
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
        self._init_sections()  # Suprepto: state/machines/comparisons

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
        # canonical invariant: every expression has a paired math.formula
        # node (SCENE-IR.md) — created here when absent
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
        from .document_io import document_to_dict
        return document_to_dict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "SceneDocument":
        from .document_io import populate_document
        doc = cls(id=data["id"], title=data.get("title", ""),
                  scene_type=data.get("sceneType", "scene_2d"),
                  camera=data.get("camera"),
                  metadata=data.get("metadata"),
                  presentation=data.get("presentation"))
        return populate_document(doc, data)

    def semantic_equal(self, other: "SceneDocument") -> bool:
        """Equality by canonical JSON — used by round-trip tests."""
        from .serialize import to_json
        return to_json(self) == to_json(other)

    def has_parent_cycles(self) -> list[str]:
        """Ids whose parent chain contains a cycle."""
        return [nid for nid in self.objects
                if node_parents_form_cycle(self.objects, nid)]
