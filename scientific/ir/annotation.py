"""IR model for comparisons and semantic annotations (issues #5 and #11).

Comparisons are declarative: two sides (artifact ids or binding specs),
a kind from the closed vocabulary, and metric rows whose numbers are
computed from real bound state at render time — never hardcoded visuals.

Annotations bind a target artifact to a live provider (state symbol, live
value or relationship) with a display template; the renderer keeps the
displayed number bound to the actual underlying state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .errors import IRError

COMPARISON_KINDS = (
    "before_after", "input_output", "prediction_truth", "model_a_b",
    "iteration", "parameter",
)


@dataclass
class MetricSpec:
    label: str
    a: Any = None                    # binding source spec or plain value
    b: Any = None
    format: str = "{value}"
    delta_format: str = "{delta:+.2f}"

    def to_dict(self) -> dict:
        return {"label": self.label, "a": self.a, "b": self.b,
                "format": self.format, "deltaFormat": self.delta_format}

    @classmethod
    def from_dict(cls, data: dict) -> "MetricSpec":
        return cls(label=str(data.get("label", "")), a=data.get("a"),
                   b=data.get("b"), format=str(data.get("format", "{value}")),
                   delta_format=str(data.get("deltaFormat", "{delta:+.2f}")))


@dataclass
class ComparisonSpec:
    id: str
    kind: str
    a: Optional[str] = None          # artifact ids for the two sides
    b: Optional[str] = None
    metrics: list[MetricSpec] = field(default_factory=list)
    title: str = ""

    def __post_init__(self) -> None:
        if self.kind not in COMPARISON_KINDS:
            raise IRError(
                f"unknown comparison kind {self.kind!r} "
                f"(known: {COMPARISON_KINDS})")

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"id": self.id, "kind": self.kind}
        if self.a is not None:
            out["a"] = self.a
        if self.b is not None:
            out["b"] = self.b
        if self.metrics:
            out["metrics"] = [m.to_dict() for m in self.metrics]
        if self.title:
            out["title"] = self.title
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "ComparisonSpec":
        return cls(id=str(data["id"]), kind=str(data.get("kind", "before_after")),
                   a=data.get("a"), b=data.get("b"),
                   metrics=[MetricSpec.from_dict(m)
                            for m in data.get("metrics") or []],
                   title=str(data.get("title", "")))


@dataclass
class AnnotationSpec:
    """A persistent live annotation attached to a target artifact."""

    id: str
    target: str
    provider: Optional[str] = None  # state symbol / live value / rel id
    value: str = ""                  # literal template when no provider
    format: Optional[str] = None
    side: str = "RIGHT"
    live: bool = True
    follow: bool = True             # keep tracking target under camera moves

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"id": self.id, "target": self.target}
        if self.provider is not None:
            out["provider"] = self.provider
        if self.value:
            out["value"] = self.value
        if self.format is not None:
            out["format"] = self.format
        if self.side != "RIGHT":
            out["side"] = self.side
        if not self.live:
            out["live"] = False
        if not self.follow:
            out["follow"] = False
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "AnnotationSpec":
        return cls(id=str(data["id"]), target=str(data.get("target", "")),
                   provider=data.get("provider"),
                   value=str(data.get("value", "")),
                   format=data.get("format"),
                   side=str(data.get("side", "RIGHT")),
                   live=bool(data.get("live", True)),
                   follow=bool(data.get("follow", True)))
