"""Graph renderers: semantic networks and state charts (issue #34).

The graph stays ONE semantic object: nodes and edges are tagged with
``suprepto_subtarget`` so highlights/annotations can address
``node:a`` / ``edge:a-b`` without flattening child identities (#33).
"""

from __future__ import annotations

from manim import (Circle, CurvedArrow, Line, RIGHT, Text, VGroup)

from ...domains.graph.layout import layout
from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer


def _positions(node):
    props = node.properties
    manual = {}
    for spec in props.get("nodes") or []:
        if spec.get("position"):
            manual[str(spec.get("id"))] = [float(c)
                                          for c in spec["position"]]
    auto = layout(str(props.get("layout", "circle")),
                  props.get("nodes") or [], props.get("edges") or [],
                  float(props.get("spacing", 1.6)))
    positions = {**auto, **manual}
    # manual positions win per-node
    for spec in props.get("nodes") or []:
        if spec.get("position"):
            positions[str(spec.get("id"))] = [float(c)
                                             for c in spec["position"]]
    return positions


def _network(node, ctx):
    props = node.properties
    nodes = props.get("nodes") or []
    edges = props.get("edges") or []
    positions = _positions(node)
    directed = bool(props.get("directed", False))
    group = VGroup()
    edge_group = VGroup()
    node_group = VGroup()

    for edge in edges:
        src = positions.get(str(edge.get("from")))
        dst = positions.get(str(edge.get("to")))
        if src is None or dst is None:
            ctx.warn(f"graph {node.id!r}: edge references unknown node")
            continue
        weight = edge.get("weight", 1.0)
        line = Line([*src[:2], 0.0], [*dst[:2], 0.0],
                    stroke_width=1.4 + 3.2 * min(1.0, float(weight or 1.0)))
        line.set_stroke(color=palette_color(edge.get("color", "muted")))
        line.suprepto_subtarget = f"edge:{edge.get('from')}-{edge.get('to')}"
        edge_group.add(line)

    for spec in nodes:
        nid = str(spec.get("id"))
        pos = positions.get(nid, [0.0, 0.0, 0.0])
        size = float(spec.get("size", 0.42))
        dot = Circle(radius=size,
                     stroke_color=palette_color(spec.get("color", "accent")),
                     stroke_width=2.4,
                     fill_color=palette_color(spec.get("color", "accent")),
                     fill_opacity=0.28)
        label_text = str(spec.get("label", nid))
        label = Text(label_text, font_size=20, color=palette_color("fg"))
        dot.move_to([pos[0], pos[1], 0.0])
        label.next_to(dot, RIGHT, buff=0.12)
        dot.suprepto_subtarget = f"node:{nid}"
        node_group.add(VGroup(dot, label))

    group.add(edge_group, node_group)
    if props.get("showWeights"):
        for edge in edges:
            if edge.get("weight") is None or not edge.get("label"):
                continue
            text = Text(f"{edge.get('label')}={edge['weight']}",
                        font_size=16, color=palette_color("muted"))
            midpoint = [(positions[str(edge["from"])][i] +
                         positions[str(edge["to"])][i]) / 2.0
                        for i in range(2)] + [0.0]
            text.move_to(midpoint)
            group.add(text)
    if props.get("title"):
        title = Text(str(props["title"]), font_size=24,
                     color=palette_color("fg"))
        title.next_to(group, __import__("manim").UP, buff=0.34)
        group = VGroup(group, title)
    return group


def _state_chart(node, ctx):
    props = node.properties
    machine = ctx.document.machines.get(str(props.get("machine")))
    if machine is None:
        ctx.warn(f"state chart {node.id!r} references unknown machine")
        return VGroup()
    nodes = [{"id": str(s.get("id")), "label": s.get("label") or s.get("id"),
              "color": "ok" if str(s.get("id")) == machine.initial
              else "accent"}
             for s in machine.states]
    edges = [{"from": tr.source, "to": tr.target,
              "weight": 1.0, "label": tr.trigger or tr.id}
             for tr in machine.transitions]
    chart = _network(type("N", (), {"properties": {
        "nodes": nodes, "edges": edges, "layout": props.get("layout",
                                                            "layered"),
        "spacing": props.get("spacing", 2.2), "directed": True,
        "showWeights": False, "title": props.get("title")}})(), ctx)
    return chart


bind_renderer("graph.network", _network)
bind_renderer("graph.state_chart", _state_chart)
