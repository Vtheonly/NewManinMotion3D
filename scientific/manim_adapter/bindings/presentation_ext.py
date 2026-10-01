"""Presentation renderers: title, callout, legend, table, metric card,
comparison panel (issues #4/#11/#34)."""

from __future__ import annotations

from manim import Line, Rectangle, Text, VGroup

from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer
from ..sides import side


def _title(node, ctx):
    props = node.properties
    text = Text(str(props.get("text", "")),
                font_size=int(props.get("fontSize", 40)),
                color=palette_color(props.get("color", "fg")))
    if props.get("subtitle"):
        sub = Text(str(props["subtitle"]), font_size=24,
                   color=palette_color("muted"))
        sub.next_to(text, __import__("manim").DOWN, buff=0.22)
        return VGroup(text, sub)
    return text


def _callout(node, ctx):
    props = node.properties
    label = Text(str(props.get("text", "")),
                 font_size=int(props.get("fontSize", 24)),
                 color=palette_color("accent"))
    target = ctx.mobjects.get(str(props.get("target", "")))
    if target is not None:
        where = side(str(props.get("side", "RIGHT")))
        label.next_to(target, where, buff=0.7)
        arrow = Line(label.get_center(),
                     target.get_center() * 0.35 + label.get_center() * 0.65,
                     color=palette_color("accent"), stroke_width=2)
        return VGroup(label, arrow)
    return label


def _legend(node, ctx):
    props = node.properties
    entries = VGroup()
    for entry in props.get("entries") or []:
        swatch = Rectangle(width=0.3, height=0.18,
                           fill_color=palette_color(entry.get("color",
                                                              "accent")),
                           fill_opacity=0.9,
                           stroke_width=0)
        label = Text(str(entry.get("label", "")),
                     font_size=int(props.get("fontSize", 22)),
                     color=palette_color("fg"))
        row = VGroup(swatch, label).arrange(__import__("manim").RIGHT,
                                            buff=0.16)
        entries.add(row)
    entries.arrange(__import__("manim").DOWN, buff=0.16,
                    aligned_edge=__import__("manim").LEFT)
    return entries


def _table(node, ctx):
    props = node.properties
    headers = props.get("headers") or []
    rows = props.get("rows") or []
    grid = VGroup()
    if headers:
        header = VGroup(*[Text(ctx.format(str(h)),
                               font_size=int(props.get("fontSize", 22)),
                               color=palette_color("muted"))
                          for h in headers])
        header.arrange(__import__("manim").RIGHT, buff=0.6)
        grid.add(header)
    for row in rows:
        line = VGroup(*[Text(ctx.format(str(cell)),
                             font_size=int(props.get("fontSize", 22)),
                             color=palette_color("fg")) for cell in row])
        line.arrange(__import__("manim").RIGHT, buff=0.6,
                     aligned_edge=__import__("manim").LEFT)
        grid.add(line)
    grid.arrange(__import__("manim").DOWN, buff=0.18,
                 aligned_edge=__import__("manim").LEFT)
    return grid


def _metric_card(node, ctx):
    """The issue #4 visual consumer: a live-updating metric display."""
    from ..state_ops import live_text
    props = node.properties
    label = Text(str(props.get("title", "")), font_size=22,
                 color=palette_color("muted"))
    provider = str(props.get("provider", ""))
    template = props.get("format") or ctx.provider_format(provider)
    value = live_text(ctx, provider, template, font_size=34,
                      color=props.get("accent", "accent")) \
        if provider else Text("—", font_size=34)
    card_body = VGroup(label, value).arrange(__import__("manim").DOWN,
                                             buff=0.14)
    card = RoundedRectangle(card_body)
    ctx.mobjects[f"__card_{node.id}"] = card_body
    return card


def RoundedRectangle(body):
    from manim import RoundedRectangle as _RR
    box = _RR(corner_radius=0.14, width=body.width + 0.6,
              height=body.height + 0.42,
              fill_color=palette_color("panel"), fill_opacity=0.9,
              stroke_color=palette_color("border"), stroke_width=1.2)
    box.move_to(body.get_center())
    return VGroup(box, body)


def _comparison_panel(node, ctx):
    from ..compare_ops import build_comparison
    props = node.properties
    comparison = ctx.document.comparisons.get(str(props.get("comparison")))
    if comparison is None:
        ctx.warn(f"comparison panel {node.id!r} references unknown "
                 f"comparison {props.get('comparison')!r}")
        return Text("comparison?", font_size=22)
    return build_comparison(ctx, comparison)


bind_renderer("presentation.title", _title)
bind_renderer("presentation.callout", _callout)
bind_renderer("presentation.legend", _legend)
bind_renderer("presentation.table", _table)
bind_renderer("presentation.metric_card", _metric_card)
bind_renderer("comparison.panel", _comparison_panel)
