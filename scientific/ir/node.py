"""Scene nodes: the universal editable artifacts of the IR.

A node is *any* supported object — text, formula, protein, matrix, torus,
camera HUD, … — identified by a semantic id, typed by a registry key, placed
by an optional transform, and composed through ``parent_id``.  There is no
type-specific wrapper: every property lives in ``properties`` and is checked
against the type's registered property schema.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .schema import SPACES


@dataclass
class Transform:
    """Placement of a node. Angles are degrees; position is [x, y, z]."""

    position: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rotation: float = 0.0
    scale: float = 1.0

    def to_dict(self) -> dict:
        return {
            "position": list(self.position),
            "rotation": self.rotation,
            "scale": self.scale,
        }

    @classmethod
    def from_dict(cls, data: Optional[dict]) -> "Transform":
        if not data:
            return cls()
        pos = data.get("position") or [0.0, 0.0, 0.0]
        return cls(
            position=(float(pos[0]), float(pos[1]), float(pos[2])),
            rotation=float(data.get("rotation", 0.0)),
            scale=float(data.get("scale", 1.0)),
        )


@dataclass
class SceneNode:
    """One semantic artifact in the scene graph."""

    id: str
    type: str
    properties: dict[str, Any] = field(default_factory=dict)
    parent_id: Optional[str] = None
    space: str = "scene2d"
    transform: Transform = field(default_factory=Transform)
    label: Optional[str] = None

    def to_dict(self) -> dict:
        out: dict[str, Any] = {
            "id": self.id,
            "type": self.type,
        }
        if self.properties:
            out["properties"] = self.properties
        if self.parent_id is not None:
            out["parentId"] = self.parent_id
        if self.space != "scene2d":
            out["space"] = self.space
        if self.label is not None:
            out["label"] = self.label
        tr = self.transform
        if (tr.position != (0.0, 0.0, 0.0) or tr.rotation or tr.scale != 1.0):
            out["transform"] = tr.to_dict()
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "SceneNode":
        return cls(
            id=str(data["id"]),
            type=str(data["type"]),
            properties=dict(data.get("properties") or {}),
            parent_id=data.get("parentId"),
            space=data.get("space", "scene2d"),
            transform=Transform.from_dict(data.get("transform")),
            label=data.get("label"),
        )


def node_parents_form_cycle(nodes: dict[str, SceneNode], start_id: str) -> bool:
    """Detect parent-chain cycles reachable from `start_id`."""
    seen = set()
    current: Optional[str] = start_id
    while current is not None:
        if current in seen:
            return True
        seen.add(current)
        node = nodes.get(current)
        current = node.parent_id if node else None
    return False


def validate_space(space: str) -> bool:
    return space in SPACES
