"""Graph/network object types (issue #34 — graphs are first-class)."""

from __future__ import annotations

from . import register_type

register_type(
    "graph.network",
    label="Graph / Network", category="graph", dimensionality="2d",
    description="Semantic graph: nodes, edges, weights, layout. Children "
                "stay individually addressable (node:/edge: sub-targets).",
    properties={
        "nodes": {"type": "list", "required": True,
                  "description": "[{id, label?, position?, color?, size?}]"},
        "edges": {"type": "list", "default": [],
                  "description": "[{from, to, directed?, weight?, label?, "
                                 "color?}]"},
        "layout": {"type": "str", "enum": ["circle", "layered", "grid",
                                           "line", "shell", "manual"],
                   "default": "circle"},
        "spacing": {"type": "float", "default": 1.6},
        "directed": {"type": "bool", "default": False},
        "showWeights": {"type": "bool", "default": True},
        "title": {"type": "str"},
    },
)

register_type(
    "graph.state_chart",
    label="State Chart", category="graph", dimensionality="2d",
    description="Visual state chart of a declared machine (states as "
                "rounded nodes, transitions as labeled arrows).",
    properties={
        "machine": {"type": "str", "required": True,
                    "description": "state machine id from the state section"},
        "layout": {"type": "str", "enum": ["circle", "layered", "line"],
                   "default": "layered"},
        "spacing": {"type": "float", "default": 2.2},
    },
)
