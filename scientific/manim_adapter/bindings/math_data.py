"""Renderers for data-shaped math: tensors and distributions (#34)."""

from __future__ import annotations

import math as _math

from manim import ORIGIN, RIGHT, Text, VGroup

from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer
from .math import _extract_axes


def _up():
    from manim import UP
    return UP


def _tensor(node, ctx):
    props = node.properties
    shape = [int(d) for d in (props.get("shape") or [1])]
    data = props.get("data") or []
    flat = _flatten(data) if data else [0.0] * _volume(shape)
    return _flat_grid(node, flat, shape)


def _flatten(data):
    out = []

    def walk(value):
        if isinstance(value, list):
            for item in value:
                walk(item)
        else:
            out.append(float(value))

    walk(data)
    return out


def _volume(shape) -> int:
    total = 1
    for d in shape:
        total *= d
    return total


def _flat_grid(node, flat, shape):
    from manim import RoundedRectangle
    values = flat or [0.0]
    lo, hi = min(values), max(values)
    span = (hi - lo) or 1.0
    cols = min(len(values), 8)
    grid = VGroup()
    for i, value in enumerate(values):
        t = (value - lo) / span
        tone = palette_color("fail" if t > 0.66 else
                             "warn" if t > 0.33 else "ok")
        cell = RoundedRectangle(width=0.52, height=0.52, corner_radius=0.06,
                                stroke_width=0.6, stroke_color=tone,
                                fill_color=tone, fill_opacity=0.16 + 0.5 * t)
        r, c = divmod(i, cols)
        cell.move_to(RIGHT * c * 0.6 + _up() * -r * 0.6)
        grid.add(cell)
    grid.move_to(ORIGIN)
    caption = Text(" × ".join(str(d) for d in shape), font_size=20,
                   color=palette_color("muted"))
    caption.next_to(grid, _up(), buff=0.22)
    return VGroup(grid, caption)


def _distribution(node, ctx):
    props = node.properties
    axes = _extract_axes(ctx.mobjects.get(str(props.get("axes"))))
    kind = str(props.get("kind", "normal"))
    mu = float(props.get("mu", 0.0))
    sigma = float(props.get("sigma", 1.0))
    a = float(props.get("a", 2.0))
    b = float(props.get("b", 2.0))

    def pdf(x: float) -> float:
        if kind == "uniform":
            return 1.0 / max(1e-9, b - a) if a <= x <= b else 0.0
        if kind == "laplace":
            return _math.exp(-abs(x - mu) / max(1e-9, sigma)) / (
                2 * max(1e-9, sigma))
        if kind == "beta":
            if not (0.0 < x < 1.0):
                return 0.0
            num = x ** (a - 1) * (1 - x) ** (b - 1)
            return num / max(1e-9, _beta(a, b))
        return _math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (
            sigma * _math.sqrt(2 * _math.pi))

    curve = axes.plot(pdf, x_range=[axes.x_range[0], axes.x_range[1]])
    curve.set_stroke(color=palette_color(props.get("color", "accent2")),
                     width=3.4)
    return curve


def _beta(a: float, b: float) -> float:
    return _math.exp(_lgamma(a) + _lgamma(b) - _lgamma(a + b))


def _lgamma(x: float) -> float:
    return _math.lgamma(max(1e-9, x))


bind_renderer("math.tensor", _tensor)
bind_renderer("math.distribution", _distribution)
