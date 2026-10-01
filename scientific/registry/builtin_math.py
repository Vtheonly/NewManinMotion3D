"""Extended math types: vectors, number lines, points, regions, tensors,
distributions (issue #34 object library)."""

from __future__ import annotations

from . import register_type

register_type(
    "math.vector",
    label="Vector", category="math", dimensionality="2d",
    description="Arrow vector with optional live magnitude binding.",
    properties={
        "components": {"type": "list", "required": True,
                       "description": "[x, y] (or [x, y, z]) components"},
        "color": {"type": "str", "default": "accent"},
        "text": {"type": "str", "description": "rendered vector label"},
    },
)

register_type(
    "math.number_line",
    label="Number Line", category="math", dimensionality="2d",
    description="1D axis with ticks and optional highlight interval.",
    properties={
        "min": {"type": "float", "default": -5.0},
        "max": {"type": "float", "default": 5.0},
        "step": {"type": "float", "default": 1.0},
        "includeTicks": {"type": "bool", "default": True},
        "unit": {"type": "float", "default": 0.9,
                 "description": "scene units per unit of value"},
    },
)

register_type(
    "math.point",
    label="Point on Axes", category="math", dimensionality="2d",
    description="Dot placed on an axes artifact at (x, f(x)).",
    properties={
        "axes": {"type": "str", "required": True, "description": "axes node id"},
        "x": {"type": "float", "required": True},
        "function": {"type": "str",
                     "description": "optional y = f(x) (safe expression)"},
        "y": {"type": "float", "default": 0.0},
        "color": {"type": "str", "default": "warn"},
        "text": {"type": "str", "description": "rendered point label"},
    },
)

register_type(
    "math.region",
    label="Region / Interval", category="math", dimensionality="2d",
    description="Shaded region or interval on an axes artifact.",
    properties={
        "axes": {"type": "str", "required": True},
        "xMin": {"type": "float", "required": True},
        "xMax": {"type": "float", "required": True},
        "function": {"type": "str", "default": "0",
                     "description": "upper bound y = f(x)"},
        "fill": {"type": "str", "default": "accent"},
        "opacity": {"type": "float", "default": 0.25},
    },
)

register_type(
    "math.tensor",
    label="Tensor View", category="math", dimensionality="2d",
    description="N-dimensional numeric tensor rendered as nested cells.",
    properties={
        "shape": {"type": "list", "required": True,
                  "description": "dimensions, e.g. [2, 3, 4]"},
        "data": {"type": "list",
                 "description": "flat values (row-major) or nested lists"},
        "heat": {"type": "bool", "default": True},
        "label": {"type": "str"},
    },
)

register_type(
    "math.distribution",
    label="Probability Distribution", category="math", dimensionality="2d",
    description="pdf curve of a named distribution on an axes artifact.",
    properties={
        "axes": {"type": "str", "required": True},
        "kind": {"type": "str", "required": True,
                 "enum": ["normal", "uniform", "laplace", "beta"]},
        "mu": {"type": "float", "default": 0.0},
        "sigma": {"type": "float", "default": 1.0},
        "a": {"type": "float", "default": 2.0,
              "description": "beta alpha / uniform low"},
        "b": {"type": "float", "default": 2.0,
              "description": "beta beta / uniform high"},
        "color": {"type": "str", "default": "accent2"},
    },
)
