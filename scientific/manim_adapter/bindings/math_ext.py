"""Renderers for extended math types: vector, number line, point, region,
tensor, distribution (issue #34)."""

from __future__ import annotations

import math as _math

from manim import (Arrow, Dot, NumberLine, ORIGIN, RIGHT, Text, VGroup)

from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer
from ...runtime.evaluate import evaluate
from .math import _extract_axes


def _vector(node, ctx):
    props = node.properties
    parts = [float(c) for c in (props.get("components") or [1, 0])]
    arrow = Arrow(ORIGIN, RIGHT * parts[0] + _up() * parts[1],
                  buff=0, stroke_width=5, max_tip_length_to_length_ratio=0.28,
                  color=palette_color(props.get("color", "accent")))
    if props.get("text"):
        label = Text(str(props["text"]), font_size=24,
                     color=palette_color("fg"))
        label.next_to(arrow, _up(), buff=0.12)
        return VGroup(arrow, label)
    return arrow


def _up():
    from manim import UP
    return UP


def _number_line(node, ctx):
    props = node.properties
    line = NumberLine(
        x_range=[float(props.get("min", -5)), float(props.get("max", 5)),
                 float(props.get("step", 1))],
        unit_size=float(props.get("unit", 0.9)),
        include_ticks=bool(props.get("includeTicks", True)),
        stroke_color=palette_color("muted"),
    )
    return line


def _point(node, ctx):
    props = node.properties
    axes = _extract_axes(ctx.mobjects.get(str(props.get("axes"))))
    x = float(props.get("x", 0))
    y = float(props.get("y", 0))
    expression = props.get("function")
    if expression:
        try:
            y = evaluate(str(expression), {"x": x})
        except Exception:
            ctx.warn(f"point {node.id!r}: bad function {expression!r}")
    try:
        point = axes.c2p(x, y)
    except Exception:
        point = ORIGIN
    dot = Dot(point, radius=0.09,
              color=palette_color(props.get("color", "warn")))
    if props.get("text"):
        label = Text(str(props["text"]), font_size=22,
                     color=palette_color("fg"))
        label.next_to(dot, _up(), buff=0.14)
        return VGroup(dot, label)
    return dot


def _region(node, ctx):
    props = node.properties
    axes = _extract_axes(ctx.mobjects.get(str(props.get("axes"))))
    x_min = float(props.get("xMin", 0))
    x_max = float(props.get("xMax", 1))
    expression = str(props.get("function", "0"))

    def fn(x: float) -> float:
        try:
            return evaluate(expression, {"x": x})
        except Exception:
            return 0.0

    try:
        region = axes.get_area(graph=axes.plot(fn, x_range=[x_min, x_max]),
                               x_range=[x_min, x_max],
                               color=palette_color(props.get("fill",
                                                             "accent")),
                               opacity=float(props.get("opacity", 0.25)))
    except Exception:
        ctx.warn(f"region {node.id!r} could not be built on its axes")
        return VGroup()
    return region


bind_renderer("math.vector", _vector)
bind_renderer("math.number_line", _number_line)
bind_renderer("math.point", _point)
bind_renderer("math.region", _region)
