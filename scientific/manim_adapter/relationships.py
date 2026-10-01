"""Relationship rendering (arrows, distances, annotations, links)."""

from __future__ import annotations

from typing import Any

from manim import Arrow, Brace, DashedLine, Line, Text, UP

from ..domains.ui.palette import color as palette_color
from ..ir.relationship import Relationship
from .context import RenderContext


def attach_relationship(scene: Any, ctx: RenderContext, rel: Relationship) -> None:
    """Build and add a relationship once all its sources are visible."""
    handler = {
        "arrow": _arrow,
        "distance": _distance,
        "annotation": _annotation,
        "link": _link,
        "comparison": _comparison,
        "group": _group,
    }.get(rel.kind, _arrow)
    mobject = handler(scene, ctx, rel)
    if mobject is not None:
        ctx.mobjects[rel.id] = mobject
        scene.add(mobject)


def _endpoints(ctx: RenderContext, rel: Relationship):
    sources = [ctx.mob(s) for s in rel.sources if s in ctx.mobjects]
    if len(sources) < 2:
        return None, None
    return sources[0], sources[1]


def _arrow(scene, ctx, rel) -> Any:
    a, b = _endpoints(ctx, rel)
    if a is None:
        ctx.warn(f"relationship {rel.id!r} needs two visible sources")
        return None
    stroke = palette_color(rel.properties.get("color", "accent"))
    arrow = Arrow(a.get_right(), b.get_left(), buff=0.18,
                  stroke_width=3.2, color=stroke)
    return arrow


def _distance(scene, ctx, rel) -> Any:
    from manim import DashedLine
    a, b = _endpoints(ctx, rel)
    if a is None:
        return None
    line = DashedLine(a.get_center(), b.get_center(),
                      color=palette_color(rel.properties.get("color", "muted")),
                      stroke_width=2, dash_length=0.12)
    value = ctx.format(rel.properties.get("label", "{value}"))
    label = Text(value, font_size=22, color=palette_color("fg"))
    label.next_to(line, UP, buff=0.08)
    from manim import VGroup
    return VGroup(line, label)


def _annotation(scene, ctx, rel) -> Any:
    source = ctx.mob(rel.sources[0]) if rel.sources else None
    if source is None:
        return None
    text = ctx.format(str(rel.properties.get("text", "")))
    label = Text(text, font_size=24,
                 color=palette_color(rel.properties.get("color", "info")))
    from .sides import side
    label.next_to(source, side(rel.properties.get("side", "UP")), buff=0.2)
    return label


def _link(scene, ctx, rel) -> Any:
    a, b = _endpoints(ctx, rel)
    if a is None:
        return None
    weight = float(rel.properties.get("weight", 1.0))
    opacity = max(0.12, min(1.0, weight))
    line = Line(a.get_center(), b.get_center(),
                color=palette_color(rel.properties.get("color", "accent2")),
                stroke_width=1.5 + 4.0 * min(1.0, weight))
    line.set_opacity(opacity)
    return line


def _comparison(scene, ctx, rel) -> Any:
    a, b = _endpoints(ctx, rel)
    if a is None:
        return None
    brace = Brace(a, DOWN, color=palette_color("muted"))
    return brace


def _group(scene, ctx, rel) -> Any:
    from manim import SurroundingRectangle
    members = [ctx.mob(s) for s in rel.sources if s in ctx.mobjects]
    if not members:
        return None
    rect = SurroundingRectangle(
        members[0] if len(members) == 1 else _bounding(members),
        color=palette_color("border"), buff=0.2, dashed=True)
    return rect


def _bounding(mobjects):
    from manim import VGroup
    return VGroup(*mobjects)
