"""Reactive state timeline steps (issue #4).

``set``    — assign a state symbol (tracker + engine stay in sync);
``interpolate`` — animate a symbol toward a target over time; every
             consumer bound to that symbol's tracker reads the *actual
             interpolated value at the current animation time*.

Live consumers (metric cards, annotations) attach manim updaters, so a
readout of ``x`` continuously displays the true interpolated value while
``x`` animates from 0 to 10 — no scripted number sequences.
"""

from __future__ import annotations

from typing import Any

from ..runtime.resolve import format_value
from .context import RenderContext


def run_set(scene, ctx: RenderContext, step) -> None:
    """Assign a state symbol at narrative time."""
    value = (step.properties or {}).get("value")
    ctx.state_engine().set_value(step.target, value, notify=False)
    if step.target in ctx.trackers:
        ctx.trackers[step.target].set_value(float(value))
    if ctx.diagnostics is not None:
        ctx.diagnostics.state_change(step.target, value)


def run_interpolate(scene, ctx: RenderContext, step) -> None:
    """Animate a state symbol toward ``to`` (true live interpolation)."""
    props = step.properties or {}
    to = float(props.get("to", 0.0))
    tracker = ctx.tracker(step.target)
    duration = float(step.duration if step.duration is not None else 2.0)
    if "from" in props:
        tracker.set_value(float(props["from"]))
    rate = _rate(step.rate)
    engine = ctx.state_engine()
    engine.set_value(step.target, tracker.get_value(), notify=False)
    scene.play(tracker.animate.set_value(to), run_time=duration,
               rate_func=rate) if rate else scene.play(
        tracker.animate.set_value(to), run_time=duration)
    engine.set_value(step.target, to, notify=False)
    if ctx.diagnostics is not None:
        ctx.diagnostics.state_change(step.target, to)


def _rate(name):
    if not name:
        return None
    from .step_ops import rate_fn
    return rate_fn(name)


def live_text(ctx: RenderContext, symbol: str, template: str,
              font_size: int = 26, color: str = "accent"):
    """A Text mobject that re-renders from the symbol's tracker each frame."""
    from manim import Text
    from ..domains.ui.palette import color as palette_color
    tracker = ctx.tracker(symbol)

    def render(value: float) -> Any:
        return Text(format_value(template, value), font_size=font_size,
                    color=palette_color(color))

    label = render(tracker.get_value())
    label.add_updater(lambda mob: mob.become(render(tracker.get_value())))
    return label


def bind_live_consumer(mobject, ctx: RenderContext, symbol: str,
                       apply) -> None:
    """Attach an updater that applies the symbol's live value each frame."""
    tracker = ctx.tracker(symbol)
    mobject.add_updater(lambda mob: apply(mob, tracker.get_value()))
