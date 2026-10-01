"""Attention renderers: score matrix, orientation frames, weighted links."""

from __future__ import annotations

import math

from manim import Arrow3D, Line, RoundedRectangle, Text, VGroup, ORIGIN, RIGHT, DOWN

from ...domains.attention.model import CrossAttention
from ...domains.kinematics.poe import so3_exp
from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer


def _matrix(node, ctx):
    props = node.properties
    queries = [str(q) for q in (props.get("queries") or ["Q"])]
    keys = [str(k) for k in (props.get("keys") or ["K"])]
    att = CrossAttention(queries, keys,
                         temperature=float(props.get("temperature", 1.0)),
                         distance_bias=float(props.get("distanceBias", 0.25)))
    scores = att.scores()

    group = VGroup()
    for j, key in enumerate(keys):
        head = Text(key, font_size=18, color=palette_color("muted"))
        head.move_to(ORIGIN + RIGHT * (j + 0.5) * 0.9 + DOWN * -0.45)
        group.add(head)
    for i, query in enumerate(queries):
        head = Text(query, font_size=18, color=palette_color("muted"))
        head.move_to(ORIGIN + RIGHT * -0.55 + DOWN * i * 0.7)
        group.add(head)
        for j in range(len(keys)):
            weight = scores[i][j]
            tone = "fail" if weight > 0.5 else "warn" if weight > 0.3 else "panel2"
            cell = RoundedRectangle(width=0.8, height=0.55, corner_radius=0.07,
                                    stroke_color=palette_color("border"),
                                    stroke_width=1.0,
                                    fill_color=palette_color(tone),
                                    fill_opacity=min(0.9, 0.15 + weight))
            value = Text(f"{weight:.2f}", font_size=17,
                         color=palette_color("fg"))
            cell.move_to(ORIGIN + RIGHT * (j + 0.5) * 0.9 + DOWN * i * 0.7)
            value.move_to(cell)
            group.add(cell, value)
    group.move_to(ORIGIN)
    return group


def _frame(node, ctx):
    props = node.properties
    rot = [float(r) for r in (props.get("euler") or [0, 0, 0])]
    size = float(props.get("size", 0.5))
    import numpy  # manim ships numpy

    def axis_matrix(deg: float, axis):
        R = so3_exp(axis, math.radians(deg))
        return numpy.array(R)

    R = axis_matrix(rot[2], (0.0, 0.0, 1.0)) @ axis_matrix(rot[1], (0.0, 1.0, 0.0)) \
        @ axis_matrix(rot[0], (1.0, 0.0, 0.0))
    origin = [float(p) for p in (props.get("origin") or [0.0, 0.0, 0.0])]
    group = VGroup()
    for axis, tone in (((1, 0, 0), "fail"), ((0, 1, 0), "ok"), ((0, 0, 1), "accent")):
        d = R @ numpy.array(axis, dtype=float)
        end = [origin[k] + d[k] * size for k in range(3)]
        group.add(Arrow3D(start=origin, end=end,
                          color=palette_color(tone),
                          thickness=0.01, height=0.08))
    return group


def _link(node, ctx):
    props = node.properties
    a = ctx.mobjects.get(str(props.get("fromId")))
    b = ctx.mobjects.get(str(props.get("toId")))
    weight = float(props.get("weight", 1.0))
    if a is None or b is None:
        return VGroup()
    ca, cb = a.get_center(), b.get_center()
    line = Line([ca[0], ca[1], ca[2]], [cb[0], cb[1], cb[2]],
                stroke_color=palette_color("accent2"),
                stroke_width=1.5 + 4.5 * min(1.0, weight))
    line.set_opacity(max(0.15, min(1.0, weight)))
    return line


bind_renderer("attention.matrix", _matrix)
bind_renderer("attention.frame", _frame)
bind_renderer("attention.link", _link)
