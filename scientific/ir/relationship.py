"""Relationships between artifacts (arrows, distances, annotations, links).

Relationships are first-class IR citizens so the frontend can add, edit and
delete them generically, and the runtime can keep them live.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

RELATION_KINDS = (
    "arrow",        # semantic pointer A -> B
    "distance",     # geometric measurement between two artifacts
    "annotation",   # label attached to an artifact (optionally live)
    "link",         # attention/binding edge with weight
    "comparison",   # side-by-side brace between artifacts
    "group",        # visual grouping marker (dashed outline)
)


@dataclass
class Relationship:
    id: str
    kind: str
    sources: list[str] = field(default_factory=list)
    properties: dict[str, Any] = field(default_factory=dict)
    live: bool = False

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"id": self.id, "kind": self.kind}
        if self.sources:
            out["sources"] = list(self.sources)
        if self.properties:
            out["properties"] = self.properties
        if self.live:
            out["live"] = True
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "Relationship":
        return cls(
            id=str(data["id"]),
            kind=str(data.get("kind", "arrow")),
            sources=[str(s) for s in (data.get("sources") or [])],
            properties=dict(data.get("properties") or {}),
            live=bool(data.get("live", False)),
        )


def validate_kind(kind: Optional[str]) -> bool:
    return kind in RELATION_KINDS
