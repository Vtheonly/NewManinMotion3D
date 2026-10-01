"""UI chrome renderers: groups, labels, panels, grids, stamps, badges, HUD."""

from __future__ import annotations

from manim import (
    VGroup, RoundedRectangle, Text, Line, RIGHT, UP, DOWN, ORIGIN,
)

from ...domains.ui.grids import cell_centers
from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer


def _group(node, ctx):
    return VGroup()


def _label(node, ctx):
    props = node.properties
    kwargs = {
        "font_size": props.get("fontSize", 28),
        "color": palette_color(props.get("color", "fg")),
    }
    if props.get("weight") == "bold":
        from manim import BOLD
        kwargs["weight"] = BOLD
    return Text(str(props.get("text", "")), **kwargs)


def _panel(node, ctx):
    props = node.properties
    panel = RoundedRectangle(
        width=float(props.get("width", 6.0)),
        height=float(props.get("height", 3.0)),
        corner_radius=float(props.get("radius", 0.18)),
        fill_color=palette_color(props.get("fill", "panel")),
        fill_opacity=1.0,
        stroke_color=palette_color(props.get("stroke", "border")),
        stroke_width=1.6,
    )
    if props.get("title"):
        title = Text(str(props["title"]), font_size=24,
                     color=palette_color("accent"))
        title.move_to(panel.get_top() + DOWN * 0.28)
        return VGroup(panel, title)
    return panel


def _grid(node, ctx):
    props = node.properties
    cols = int(props.get("columns", 1))
    rows = int(props.get("rows", 1))
    cw = float(props.get("cellWidth", 1.5))
    chh = float(props.get("cellHeight", 1.5))
    cells = VGroup()
    for (x, y) in cell_centers(cols, rows, cw, chh,
                               float(props.get("gap", 0.2))):
        cell = RoundedRectangle(width=cw, height=chh, corner_radius=0.08,
                                stroke_color=palette_color("border"),
                                stroke_width=1.0, fill_opacity=0.0)
        cell.move_to([x, y, 0.0])
        cells.add(cell)
    return cells


def _mark(kind: str, size: float):
    """Geometric check/cross primitives (no font dependency)."""
    s = size
    if kind == "ok":
        a = Line(ORIGIN, RIGHT * s * 0.32).rotate(-0.6)
        b = Line(RIGHT * s * 0.32, RIGHT * s * 0.32 + RIGHT * s * 0.62) \
            .rotate(0.65, about_point=RIGHT * s * 0.32)
        g = VGroup(a, b)
    else:
        g = VGroup(Line(ORIGIN, RIGHT * s).rotate(0.785),
                   Line(ORIGIN, RIGHT * s).rotate(-0.785))
    g.set_stroke(width=4.5)
    return g


def _stamp(node, ctx):
    props = node.properties
    verdict = props.get("verdict", "ok")
    tone = "ok" if verdict == "ok" else "fail"
    mark = _mark(verdict, 0.55)
    mark.set_stroke(color=palette_color(tone))
    ring = RoundedRectangle(width=0.95, height=0.95, corner_radius=0.45,
                           stroke_color=palette_color(tone),
                           stroke_width=3.0)
    mark.move_to(ring)
    stamp = VGroup(ring, mark)
    if props.get("label"):
        caption = Text(str(props["label"]), font_size=20,
                       color=palette_color("muted"))
        caption.next_to(stamp, UP, buff=0.15)
        stamp = VGroup(stamp, caption)
    return stamp


def _badge(node, ctx):
    props = node.properties
    tone = props.get("tone", "info")
    text = Text(str(props.get("text", "")), font_size=22,
                color=palette_color("fg"))
    pill = RoundedRectangle(width=text.width + 0.5, height=0.5,
                            corner_radius=0.25,
                            fill_color=palette_color(tone), fill_opacity=0.28,
                            stroke_color=palette_color(tone), stroke_width=1.4)
    text.move_to(pill)
    return VGroup(pill, text)


def _hud(node, ctx):
    from ..sides import side
    props = node.properties
    hud = Text(str(props.get("text", "")),
               font_size=int(props.get("fontSize", 22)),
               color=palette_color("accent"))
    hud.to_corner(side(props.get("corner", "UL")), buff=0.4)
    return hud


bind_renderer("core.group", _group)
bind_renderer("text.label", _label)
bind_renderer("ui.panel", _panel)
bind_renderer("ui.grid", _grid)
bind_renderer("ui.stamp", _stamp)
bind_renderer("ui.badge", _badge)
bind_renderer("hud.fixed", _hud)
