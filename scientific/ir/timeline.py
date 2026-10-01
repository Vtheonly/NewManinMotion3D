"""Timeline: narrative stages built from declarative steps.

A step is a small operation object.  The set of ops is closed and validated;
``custom`` is the explicit advanced boundary — it carries verbatim Python
that survives every round trip (documented in
docs/development/architecture/RUNTIME-BOUNDARY.md) and is never silently
dropped by the exporter or the frontend.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .schema import ANIMATION_NAMES, STEP_OPS

KNOWN_ANIMATIONS = frozenset(ANIMATION_NAMES)


@dataclass
class Step:
    op: str
    target: Optional[str] = None
    animation: Optional[str] = None
    duration: Optional[float] = None
    rate: Optional[str] = None
    properties: Optional[dict] = None
    code: Optional[str] = None        # only for op == "custom"
    payload: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"op": self.op}
        for key in ("target", "animation", "duration", "rate", "properties", "code"):
            value = getattr(self, key)
            if value is not None:
                out[key] = value
        if self.payload:
            out.update(self.payload)
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "Step":
        known = {"op", "target", "animation", "duration", "rate", "properties", "code"}
        return cls(
            op=str(data["op"]),
            target=data.get("target"),
            animation=data.get("animation"),
            duration=data.get("duration"),
            rate=data.get("rate"),
            properties=data.get("properties"),
            code=data.get("code"),
            payload={k: v for k, v in data.items() if k not in known},
        )


@dataclass
class Stage:
    id: str
    title: str = ""
    steps: list[Step] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "steps": [s.to_dict() for s in self.steps],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Stage":
        return cls(
            id=str(data["id"]),
            title=str(data.get("title", "")),
            steps=[Step.from_dict(s) for s in (data.get("steps") or [])],
        )


def validate_step(step: Step) -> list[str]:
    """Return human-readable problems for a single step."""
    problems: list[str] = []
    if step.op not in STEP_OPS:
        problems.append(f"unknown op {step.op!r}")
    if step.op == "custom" and not (step.code or "").strip():
        problems.append("custom step requires non-empty code")
    if step.op == "play":
        if step.animation not in KNOWN_ANIMATIONS:
            problems.append(
                f"unknown animation {step.animation!r} (known: {sorted(KNOWN_ANIMATIONS)})"
            )
        if not step.target:
            problems.append("play step requires a target")
    if step.op in ("show", "highlight", "annotate", "transform") and not step.target:
        problems.append(f"{step.op} step requires a target")
    if step.op == "set" and not step.target:
        problems.append("set step requires a target symbol")
    if step.op == "interpolate" and not step.target:
        problems.append("interpolate step requires a target symbol")
    if step.op == "transition":
        if not step.target:
            problems.append("transition step requires a machine id")
        props = step.properties or {}
        if not props.get("to") and not props.get("event"):
            problems.append("transition step requires 'to' or 'event'")
    if step.op == "compare" and not step.target:
        problems.append("compare step requires a comparison id")
    if step.duration is not None and float(step.duration) < 0:
        problems.append("duration must be >= 0")
    return problems
