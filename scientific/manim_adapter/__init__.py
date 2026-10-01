"""Manim adapter — renders a canonical scene document via Manim CE.

This is the only layer allowed to import manim.  Bindings register per-type
renderers into the shared registry; the orchestrator is type-agnostic.
"""

from __future__ import annotations

from .bases import (
    BaseScientificScene,
    MovingCameraScientificScene,
    ScientificRenderMixin,
    ThreeDScientificScene,
)
from .context import RenderContext
from .render import render_document

__all__ = [
    "BaseScientificScene", "MovingCameraScientificScene",
    "ThreeDScientificScene", "ScientificRenderMixin",
    "RenderContext", "render_document",
]
