"""Neural-network renderer: layers, edges and live activations."""

from __future__ import annotations

from manim import Circle, Line, Text, VGroup, ORIGIN

from ...domains.nn.network import MLP, edges as edge_list, layout
from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer


def _network(node, ctx):
    props = node.properties
    layers = [int(n) for n in (props.get("layers") or [3, 4, 1])]
    seed = int(props.get("seed", 11))
    inputs = [float(v) for v in (props.get("input") or [])]

    net = MLP(layers, seed=seed)
    activations = None
    if props.get("showActivations", True):
        try:
            activations = net.forward(inputs or None)
        except ValueError:
            activations = None

    positions = layout(layers, width=4.0, height=3.0)
    group = VGroup()

    for li, a, lj, b in edge_list(layers):
        edge = Line([positions[li][a][0], positions[li][a][1], 0.0],
                    [positions[lj][b][0], positions[lj][b][1], 0.0],
                    stroke_color=palette_color("border"), stroke_width=1.2)
        group.add(edge)

    for li, layer_positions in enumerate(positions):
        for ni, (x, y) in enumerate(layer_positions):
            tone = "panel2"
            if activations is not None and li > 0:
                value = activations[li][ni]
                tone = "ok" if value >= 0 else "fail"
            neuron = Circle(radius=0.16, stroke_color=palette_color("accent"),
                            stroke_width=2.2,
                            fill_color=palette_color(tone),
                            fill_opacity=0.9 if li else 0.25)
            neuron.move_to([x, y, 0.0])
            group.add(neuron)
            if activations is not None and li > 0:
                value = activations[li][ni]
                label = Text(f"{value:+.2f}", font_size=15,
                             color=palette_color("fg"))
                label.next_to(neuron, ORIGIN, buff=0.28)
                group.add(label)
    group.move_to(ORIGIN)
    return group


bind_renderer("nn.network", _network)
