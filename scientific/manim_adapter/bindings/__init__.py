"""Renderer bindings — register manim renderers for registry types.

Importing this package registers every built-in renderer; the orchestrator
stays type-agnostic (render.py never mentions a concrete type).
"""

from __future__ import annotations

from . import (  # noqa: F401  (side-effect registration)
    attention,
    biology,
    graphs,
    kinematics,
    math as math_bindings,
    math_data,
    math_ext,
    nn,
    presentation_ext,
    ui,
)
