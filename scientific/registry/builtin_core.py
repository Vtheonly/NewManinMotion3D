"""Built-in core types: layout, UI chrome, text and mathematics.

Property schemas are the contract shared by Python runtime, validation and
the JS mirror (services/api/src/ir/schemaTypes.js — keep in sync; parity is
cross-tested).
"""

from __future__ import annotations

from . import register_type

register_type(
    "core.group",
    label="Group", category="core", dimensionality="2d",
    description="Logical/visual grouping container for child artifacts.",
    properties={"title": {"type": "str", "description": "optional group caption"}},
)

register_type(
    "text.label",
    label="Text Label", category="core", dimensionality="2d",
    description="Editable text or caption.",
    properties={
        "text": {"type": "str", "required": True, "description": "label content"},
        "fontSize": {"type": "float", "default": 28, "description": "manim font size"},
        "color": {"type": "str", "default": "fg", "description": "palette token or hex"},
        "weight": {"type": "str", "enum": ["normal", "bold"], "default": "normal"},
    },
)

register_type(
    "ui.panel",
    label="Panel", category="ui", dimensionality="2d",
    description="Rounded background panel/banner with optional title.",
    properties={
        "width": {"type": "float", "default": 6.0},
        "height": {"type": "float", "default": 3.0},
        "fill": {"type": "str", "default": "panel"},
        "stroke": {"type": "str", "default": "border"},
        "radius": {"type": "float", "default": 0.18},
        "title": {"type": "str"},
    },
)

register_type(
    "ui.grid",
    label="Grid", category="ui", dimensionality="2d",
    description="Cell layout grid used by walls/arrays of artifacts.",
    properties={
        "columns": {"type": "int", "required": True, "min": 1},
        "rows": {"type": "int", "required": True, "min": 1},
        "cellWidth": {"type": "float", "default": 1.5},
        "cellHeight": {"type": "float", "default": 1.5},
        "gap": {"type": "float", "default": 0.2},
    },
)

register_type(
    "ui.stamp",
    label="Validation Stamp", category="ui", dimensionality="2d",
    description="OK/FAIL validation stamp for candidate artifacts.",
    properties={
        "verdict": {"type": "str", "enum": ["ok", "fail"], "required": True},
        "label": {"type": "str"},
    },
)

register_type(
    "ui.badge",
    label="Badge", category="ui", dimensionality="2d",
    description="Small colored pill with short text (scores, tags).",
    properties={
        "text": {"type": "str", "required": True},
        "tone": {"type": "str", "enum": ["ok", "warn", "fail", "info"], "default": "info"},
    },
)

register_type(
    "math.formula",
    label="Formula", category="math", dimensionality="2d",
    description="Structured LaTeX expression with terms/bindings/highlights.",
    properties={
        "source": {"type": "str", "required": True},
        "fontSize": {"type": "float", "default": 44},
    },
)

register_type(
    "math.axes",
    label="Axes", category="math", dimensionality="2d",
    description="Coordinate axes with ranges for curves/plots.",
    properties={
        "xMin": {"type": "float", "default": -3.0},
        "xMax": {"type": "float", "default": 3.0},
        "yMin": {"type": "float", "default": -2.0},
        "yMax": {"type": "float", "default": 2.0},
        "xLabel": {"type": "str"}, "yLabel": {"type": "str"},
    },
)

register_type(
    "math.curve",
    label="Curve", category="math", dimensionality="2d",
    description="Function curve y=f(x) on an axes artifact.",
    properties={
        "axes": {"type": "str", "required": True, "description": "axes node id"},
        "function": {"type": "str", "required": True,
                     "description": "safe-evaluator expression of x"},
        "color": {"type": "str", "default": "accent"},
    },
)

register_type(
    "math.matrix",
    label="Matrix", category="math", dimensionality="2d",
    description="Numeric matrix with optional cell heat-coloring.",
    properties={
        "rows": {"type": "list", "required": True},
        "heat": {"type": "bool", "default": False, "description": "color cells by value"},
        "label": {"type": "str"},
    },
)
