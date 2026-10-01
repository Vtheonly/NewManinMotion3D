"""Biology renderers: protein structures and sequence strips."""

from __future__ import annotations

from manim import Line, Text, VGroup, RIGHT, ORIGIN

from ...domains.biology.protein.model import ProteinModel, load_protein
from ...domains.biology.protein.sequence import block_layout
from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer


def _protein(node, ctx):
    props = node.properties
    model = load_protein(props.get("source"), props)
    positions = model.ca_positions()
    if len(positions) < 2:
        return Text("protein", font_size=20)

    kind = model.representation
    tone = palette_color(props.get("color", "accent2"))
    body = VGroup()
    if kind == "cartoon":
        body = _cartoon(positions, tone)
    elif kind == "trace":
        body = _trace(positions, tone)
    else:  # schematic
        body = _schematic(positions, tone)
    body.move_to(ORIGIN)
    return body


def _cartoon(positions, tone):
    """Rounded thick polyline through the CA trace (ribbon-like)."""
    body = _trace(positions, tone)
    body.set_stroke(width=10.0)
    for i, seg in enumerate(body):
        seg.set_stroke(width=10.0 if i % 3 else 7.0)
    return body


def _trace(positions, tone):
    group = VGroup()
    for a, b in zip(positions, positions[1:]):
        seg = Line([a[0], a[1], a[2]], [b[0], b[1], b[2]],
                   stroke_color=tone, stroke_width=4.0)
        group.add(seg)
    return group


def _schematic(positions, tone):
    """Zig-zag strand schematic (arrows alternate above/below the trace)."""
    group = VGroup()
    for i, (a, b) in enumerate(zip(positions, positions[1:])):
        mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (0.18 if i % 2 else -0.18),
               (a[2] + b[2]) / 2]
        seg1 = Line([a[0], a[1], a[2]], mid, stroke_color=tone, stroke_width=3.0)
        seg2 = Line(mid, [b[0], b[1], b[2]], stroke_color=tone, stroke_width=3.0)
        group.add(seg1, seg2)
    return group


def _sequence(node, ctx):
    props = node.properties
    sequence = str(props.get("sequence", ""))
    highlight = set(props.get("highlight") or [])
    block = float(props.get("blockSize", 0.42))
    blocks = block_layout(sequence)
    group = VGroup()
    offset = 0
    for b_idx, b in enumerate(blocks):
        for i, symbol in enumerate(b):
            tone = "warn" if (offset + i) in highlight else "fg"
            glyph = Text(symbol, font_size=int(block * 62),
                         color=palette_color(tone))
            glyph.move_to(RIGHT * (offset + i) * block * 1.15)
            group.add(glyph)
        offset += len(b)
    group.move_to(ORIGIN)
    return group


bind_renderer("biology.protein", _protein)
bind_renderer("biology.sequence", _sequence)
