"""Comparison rendering (issue #11).

Builds a side-by-side panel whose metric numbers are computed from the
*real bound values* at render time (state symbols, live values or plain
literals) — differences are never hardcoded visuals.
"""

from __future__ import annotations

from typing import Any

from manim import DOWN, LEFT, RIGHT

from ..domains.ui.palette import color as palette_color
from ..ir.annotation import ComparisonSpec
from ..runtime.resolve import format_value, resolve
from .context import RenderContext

TITLES = {
    "before_after": ("Before", "After"),
    "input_output": ("Input", "Output"),
    "prediction_truth": ("Prediction", "Ground Truth"),
    "model_a_b": ("Model A", "Model B"),
    "iteration": ("Previous", "Current"),
    "parameter": ("Old", "New"),
}


def run_compare(scene, ctx: RenderContext, step) -> None:
    comparison = ctx.document.comparisons.get(step.target)
    if comparison is None:
        ctx.warn(f"compare targets unknown comparison {step.target!r}")
        return
    duration = float(step.duration if step.duration is not None else 2.0)
    panel = build_comparison(ctx, comparison)
    if panel is None:
        return
    from manim import FadeIn
    scene.play(FadeIn(panel), run_time=min(2.0, duration))
    scene.add(panel)
    ctx.mobjects[f"__compare_{comparison.id}"] = panel
    if ctx.diagnostics is not None:
        ctx.diagnostics.animation(f"compare:{comparison.id}")


def _metric_value(ctx: RenderContext, side: Any) -> float:
    """Resolve one metric side: state symbol, live value, or literal."""
    if isinstance(side, str):
        snapshot = ctx.state_engine().sample(ctx.diagnostics.time
                                            if ctx.diagnostics else 0.0)
        if side in snapshot:
            return float(snapshot[side])
        if side in ctx.values:
            return float(ctx.values[side])
        try:
            return float(side)
        except ValueError:
            return 0.0
    return float(side if side is not None else 0.0)


def build_comparison(ctx: RenderContext, comparison: ComparisonSpec) -> Any:
    from manim import Line, Rectangle, Text, VGroup

    left_title, right_title = TITLES.get(
        comparison.kind, ("A", "B"))
    rows: list[Any] = []
    for metric in comparison.metrics:
        a = _metric_value(ctx, metric.a)
        b = _metric_value(ctx, metric.b)
        delta = b - a
        label = Text(metric.label, font_size=22,
                     color=palette_color("fg"))
        a_text = Text(format_value(metric.format, a), font_size=22,
                      color=palette_color("muted"))
        b_text = Text(format_value(metric.format, b), font_size=22,
                      color=palette_color("accent"))
        d_text = Text(format_value(metric.delta_format, delta),
                      font_size=20,
                      color=palette_color("ok" if delta >= 0 else "fail"))
        row = VGroup(label, a_text, b_text, d_text).arrange(RIGHT,
                                                           buff=0.42)
        rows.append(row)
    if not rows:
        ctx.warn(f"comparison {comparison.id!r} has no metrics")
        return None

    header = VGroup(Text(left_title, font_size=24, weight="BOLD",
                         color=palette_color("fg")),
                    Text(right_title, font_size=24, weight="BOLD",
                         color=palette_color("fg"))).arrange(
                         RIGHT, buff=0.42)
    title = Text(comparison.title or comparison.kind.replace("_", " "),
                 font_size=26, color=palette_color("accent"))
    body = VGroup(title, header, *rows).arrange(DOWN, buff=0.22,
                                                aligned_edge=LEFT)
    back = Rectangle(width=body.width + 0.7, height=body.height + 0.5,
                    fill_color=palette_color("panel"), fill_opacity=0.9,
                    stroke_color=palette_color("border"), stroke_width=1.2)
    back.move_to(body.get_center())
    return VGroup(back, body)
