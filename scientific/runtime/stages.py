"""Timeline authoring helpers (stage builders).

Each stage builder collects declarative steps; ``custom`` is the explicit
advanced-code boundary preserved verbatim through export/import.  The
Suprepto ops (set / interpolate / transition / compare) drive reactive
state, state machines and comparisons from the narrative order.
"""

from __future__ import annotations

from typing import Any, Optional

from ..ir.highlight import normalize_behaviors
from ..ir.timeline import Stage, Step


class StageBuilder:
    """Fluent builder for one narrative stage."""

    def __init__(self, stage: Stage):
        self._stage = stage

    @property
    def stage(self) -> Stage:
        return self._stage

    def _add(self, step: Step) -> "StageBuilder":
        self._stage.steps.append(step)
        return self

    def show(self, target: str) -> "StageBuilder":
        return self._add(Step(op="show", target=target))

    def play(self, target: str, animation: str = "fade_in",
             duration: Optional[float] = None,
             rate: Optional[str] = None) -> "StageBuilder":
        return self._add(Step(op="play", target=target, animation=animation,
                              duration=duration, rate=rate))

    def highlight(self, target: str, color: Optional[str] = None,
                  behaviors: Optional[list] = None,
                  duration: float = 1.0,
                  label: Optional[str] = None) -> "StageBuilder":
        props: dict[str, Any] = {}
        if behaviors:
            props["behaviors"] = normalize_behaviors(behaviors)
        if color:
            props["color"] = color
        if label:
            props["label"] = label
        return self._add(Step(op="highlight", target=target,
                              duration=duration,
                              properties=props or None))

    def annotate(self, target: str, value: str,
                 duration: float = 1.0) -> "StageBuilder":
        return self._add(Step(op="annotate", target=target, duration=duration,
                              properties={"value": value}))

    def wait(self, duration: float = 0.5) -> "StageBuilder":
        return self._add(Step(op="wait", duration=duration))

    def camera(self, properties: dict[str, Any],
               duration: float = 2.0) -> "StageBuilder":
        return self._add(Step(op="camera", duration=duration,
                              properties=dict(properties)))

    def transform(self, target: str, properties: dict[str, Any],
                  duration: float = 1.5) -> "StageBuilder":
        return self._add(Step(op="transform", target=target,
                              duration=duration, properties=dict(properties)))

    def custom(self, code: str) -> "StageBuilder":
        """Insert hand-written runtime code (advanced boundary, kept verbatim)."""
        return self._add(Step(op="custom", code=code))

    # ── Suprepto steps (#4 / #11) ─────────────────────────────────
    def set(self, symbol: str, value: Any) -> "StageBuilder":
        """Assign a state symbol at narrative time."""
        return self._add(Step(op="set", target=symbol,
                              properties={"value": value}))

    def interpolate(self, symbol: str, to: float, duration: float = 2.0,
                    rate: Optional[str] = None,
                    from_: Optional[float] = None) -> "StageBuilder":
        """Animate a state symbol toward ``to`` over ``duration`` seconds."""
        props: dict[str, Any] = {"to": float(to)}
        if from_ is not None:
            props["from"] = float(from_)
        return self._add(Step(op="interpolate", target=symbol,
                              duration=duration, rate=rate,
                              properties=props))

    def transition(self, machine: str, to: Optional[str] = None,
                   event: Optional[str] = None,
                   duration: float = 1.0) -> "StageBuilder":
        """Trigger a state-machine transition (by target state or event)."""
        props: dict[str, Any] = {}
        if to:
            props["to"] = to
        if event:
            props["event"] = event
        return self._add(Step(op="transition", target=machine,
                              duration=duration, properties=props))

    def compare(self, comparison: str, duration: float = 2.0) -> "StageBuilder":
        """Reveal a comparison panel with its computed metrics."""
        return self._add(Step(op="compare", target=comparison,
                              duration=duration))

    def note(self, text: str) -> "StageBuilder":
        """Attach a stage note (documentation only, never rendered)."""
        return self._add(Step(op="custom", code=f"# note: {text}"))


def make_stage(stage_id: str, title: str = "") -> tuple[Stage, StageBuilder]:
    stage = Stage(id=stage_id, title=title)
    return stage, StageBuilder(stage)
