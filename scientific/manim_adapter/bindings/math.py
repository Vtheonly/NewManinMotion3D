"""Math renderers: formulas (with highlights), axes, curves, matrices."""

from __future__ import annotations

from manim import Axes, MathTex, Text, VGroup, RIGHT, UP, ORIGIN

from ...domains.math.latexify import latexify
from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer
from ...runtime.evaluate import evaluate


def _formula(node, ctx):
    props = node.properties
    expr = ctx.document.expressions.get(node.id)
    source = expr.source if expr else str(props.get("source", ""))
    tex = _math_tex(latexify(source), int(props.get("fontSize", 44)))
    if tex is None:
        # No LaTeX toolchain in this environment (documented runtime
        # boundary — see RUNTIME-BOUNDARY.md): deterministic text fallback.
        ctx.warn(f"LaTeX unavailable; formula {node.id!r} rendered as text")
        tex = Text(source, font_size=int(props.get("fontSize", 44)))
        tex.set_color(palette_color("warn"))
        return tex
    tex.set_color(palette_color("fg"))
    if expr is not None:
        for fragment in expr.highlights:
            tex.set_color_by_tex(latexify(fragment), palette_color("warn"))
    return tex


def _math_tex(source: str, font_size: int):
    try:
        return MathTex(source, font_size=font_size)
    except Exception:  # missing latex / dvisvgm or invalid latex
        return None


def _axes(node, ctx):
    props = node.properties
    axes = Axes(
        x_range=[float(props.get("xMin", -3)), float(props.get("xMax", 3)),
                 1.0],
        y_range=[float(props.get("yMin", -2)), float(props.get("yMax", 2)),
                 1.0],
        x_length=6.0, y_length=4.0,
        axis_config={"include_ticks": True,
                     "stroke_color": palette_color("muted")},
    )
    labels = VGroup()
    if props.get("xLabel"):
        lab = Text(str(props["xLabel"]), font_size=22,
                   color=palette_color("muted"))
        lab.next_to(axes.x_axis.get_end(), RIGHT, buff=0.15)
        labels.add(lab)
    if props.get("yLabel"):
        lab = Text(str(props["yLabel"]), font_size=22,
                   color=palette_color("muted"))
        lab.next_to(axes.y_axis.get_end(), UP, buff=0.15)
        labels.add(lab)
    return VGroup(axes, labels) if len(labels) else axes


def _curve(node, ctx):
    props = node.properties
    axes = _extract_axes(ctx.mobjects.get(str(props.get("axes"))))
    expression = str(props.get("function", "0"))

    def fn(x: float) -> float:
        try:
            return evaluate(expression, {"x": x})
        except Exception:
            return 0.0

    curve = axes.plot(fn, x_range=[axes.x_range[0], axes.x_range[1]])
    curve.set_stroke(color=palette_color(props.get("color", "accent")),
                     width=3.4)
    return curve


def _extract_axes(mob):
    if mob is None:
        return Axes()
    if hasattr(mob, "x_axis"):
        return mob
    for sub in getattr(mob, "submobjects", []):
        if hasattr(sub, "x_axis"):
            return sub
    return mob


def _matrix(node, ctx):
    props = node.properties
    rows = props.get("rows") or []
    heat = bool(props.get("heat", False))
    values = [float(v) for row in rows for v in row]
    lo, hi = (min(values), max(values)) if values else (0.0, 1.0)
    span = (hi - lo) or 1.0
    grid = VGroup()
    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            tone = palette_color("accent2")
            if heat:
                t = (float(value) - lo) / span
                tone = palette_color("fail" if t > 0.66 else
                                     "warn" if t > 0.33 else "ok")
            cell = _cell(str(value), tone)
            cell.move_to(ORIGIN + RIGHT * c * 1.0 + UP * -r * 0.7)
            grid.add(cell)
    grid.move_to(ORIGIN)
    if props.get("label"):
        caption = Text(str(props["label"]), font_size=22,
                       color=palette_color("muted"))
        caption.next_to(grid, UP, buff=0.3)
        grid = VGroup(grid, caption)
    return grid


def _cell(text: str, tone: str):
    from manim import RoundedRectangle
    box = RoundedRectangle(width=0.9, height=0.55, corner_radius=0.08,
                          stroke_color=tone, stroke_width=1.4,
                          fill_color=tone, fill_opacity=0.18)
    label = Text(text, font_size=20, color=palette_color("fg"))
    label.move_to(box)
    return VGroup(box, label)


bind_renderer("math.formula", _formula)
bind_renderer("math.axes", _axes)
bind_renderer("math.curve", _curve)
bind_renderer("math.matrix", _matrix)
