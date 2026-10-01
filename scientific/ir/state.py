"""IR model for the reactive state section (issues #4 and #11).

``document.state`` groups three declarative collections:

- ``symbols`` — observable quantities (id, kind, initial value or driver);
- ``derived`` — safe expressions over other symbols (true dependencies);
- ``machines`` — explicit state machines (states + transitions) for
  data-driven narrative such as
  Initial -> Computation -> Intermediate -> Highlight -> Updated.

Everything is plain data with deterministic serialization, mirroring the
runtime engine in scientific/state/engine.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .errors import IRError
from .kinds import is_kind

MACHINE_KINDS = ("linear", "loop", "final")


@dataclass
class StateSymbolSpec:
    id: str
    kind: str = "scalar"
    value: Any = None
    driver: Optional[dict] = None
    format: Optional[str] = None

    def __post_init__(self) -> None:
        if not is_kind(self.kind):
            raise IRError(f"unknown state kind {self.kind!r}")
        if self.value is None and self.driver is None:
            raise IRError(f"state symbol {self.id!r} needs a value or driver")

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"id": self.id, "kind": self.kind}
        if self.value is not None:
            out["value"] = self.value
        if self.driver is not None:
            out["driver"] = self.driver
        if self.format is not None:
            out["format"] = self.format
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "StateSymbolSpec":
        return cls(id=str(data["id"]), kind=str(data.get("kind", "scalar")),
                   value=data.get("value"), driver=data.get("driver"),
                   format=data.get("format"))


@dataclass
class DerivedSpec:
    id: str
    expr: str
    inputs: dict[str, str] = field(default_factory=dict)
    kind: str = "derived"
    format: Optional[str] = None

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"id": self.id, "expr": self.expr}
        if self.inputs:
            out["inputs"] = self.inputs
        if self.kind != "derived":
            out["kind"] = self.kind
        if self.format is not None:
            out["format"] = self.format
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "DerivedSpec":
        return cls(id=str(data["id"]), expr=str(data["expr"]),
                   inputs=dict(data.get("inputs") or {}),
                   kind=str(data.get("kind", "derived")),
                   format=data.get("format"))


@dataclass
class TransitionSpec:
    id: str
    source: str
    target: str
    trigger: str = ""
    sets: dict[str, Any] = field(default_factory=dict)
    animate: Optional[dict] = None

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"id": self.id, "source": self.source,
                                "target": self.target}
        if self.trigger:
            out["trigger"] = self.trigger
        if self.sets:
            out["sets"] = self.sets
        if self.animate is not None:
            out["animate"] = self.animate
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "TransitionSpec":
        return cls(id=str(data["id"]), source=str(data["source"]),
                   target=str(data["target"]),
                   trigger=str(data.get("trigger", "")),
                   sets=dict(data.get("sets") or {}),
                   animate=data.get("animate"))


@dataclass
class StateMachineSpec:
    id: str
    states: list[dict] = field(default_factory=list)
    transitions: list[TransitionSpec] = field(default_factory=list)
    initial: str = ""

    def state_ids(self) -> list[str]:
        return [str(s.get("id", "")) for s in self.states]

    def to_dict(self) -> dict:
        return {"id": self.id, "states": self.states,
                "transitions": [t.to_dict() for t in self.transitions],
                "initial": self.initial}

    @classmethod
    def from_dict(cls, data: dict) -> "StateMachineSpec":
        return cls(id=str(data["id"]),
                   states=list(data.get("states") or []),
                   transitions=[TransitionSpec.from_dict(t)
                                for t in data.get("transitions") or []],
                   initial=str(data.get("initial", "")))
