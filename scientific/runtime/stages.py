"""Timeline authoring helpers (stage builders).

Each stage builder collects declarative steps; ``custom`` is the explicit
advanced-code boundary preserved verbatim through export/import.
"""

from __future__ import annotations

from typing import Any, Optional

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
                  duration: float = 1.0) -> "StageBuilder":
        props = {"color": color} if color else None
        return self._add(Step(op="highlight", target=target,
                              duration=duration, properties=props))

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

    def note(self, text: str) -> "StageBuilder":
        """Attach a stage note (documentation only, never rendered)."""
        return self._add(Step(op="custom", code=f"# note: {text}"))


def make_stage(stage_id: str, title: str = "") -> tuple[Stage, StageBuilder]:
    stage = Stage(id=stage_id, title=title)
    return stage, StageBuilder(stage)
