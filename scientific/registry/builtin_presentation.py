"""Presentation & comparison object types (issues #11/#34)."""

from __future__ import annotations

from . import register_type

register_type(
    "presentation.title",
    label="Title", category="presentation", dimensionality="2d",
    description="Scene title with optional subtitle.",
    properties={
        "text": {"type": "str", "required": True},
        "subtitle": {"type": "str"},
        "fontSize": {"type": "float", "default": 40},
        "color": {"type": "str", "default": "fg"},
    },
)

register_type(
    "presentation.callout",
    label="Callout", category="presentation", dimensionality="2d",
    description="Labeled pointer that visually connects text to a target.",
    properties={
        "text": {"type": "str", "required": True},
        "target": {"type": "str", "description": "target artifact id"},
        "side": {"type": "str", "enum": ["LEFT", "RIGHT", "UP", "DOWN"],
                 "default": "RIGHT"},
        "fontSize": {"type": "float", "default": 24},
    },
)

register_type(
    "presentation.legend",
    label="Legend", category="presentation", dimensionality="2d",
    description="Color/label legend entries.",
    properties={
        "entries": {"type": "list", "required": True,
                    "description": "[{label, color}]"},
        "fontSize": {"type": "float", "default": 22},
    },
)

register_type(
    "presentation.table",
    label="Table", category="presentation", dimensionality="2d",
    description="Text table; cells support {value} live templates.",
    properties={
        "headers": {"type": "list", "default": []},
        "rows": {"type": "list", "required": True},
        "fontSize": {"type": "float", "default": 22},
    },
)

register_type(
    "presentation.metric_card",
    label="Metric Card", category="presentation", dimensionality="2d",
    description="Live metric bound to a state symbol or live value "
                "(issue #4 visual consumer).",
    properties={
        "title": {"type": "str", "required": True},
        "provider": {"type": "str", "required": True,
                     "description": "state symbol / live value id"},
        "format": {"type": "str", "default": "{value}",
                   "description": "value template"},
        "live": {"type": "bool", "default": True},
        "accent": {"type": "str", "default": "accent"},
    },
)

register_type(
    "comparison.panel",
    label="Comparison Panel", category="comparison", dimensionality="2d",
    description="Visual comparison driven by a declared comparison spec.",
    properties={
        "comparison": {"type": "str", "required": True,
                       "description": "comparison id from the comparisons "
                                      "section"},
        "fontSize": {"type": "float", "default": 22},
    },
)
