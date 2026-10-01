"""Runtime package — authoring API and binding resolution (no manim)."""

from __future__ import annotations

from .authoring import ScientificScene
from .dataref import DataRef, Derived, Literal, Symbol, is_source
from .datasource import data_root, resolve_data_ref, set_data_root
from .evaluate import EvaluatorError, evaluate
from .narrative import NarrativeMixin
from .resolve import BindingError, format_value, resolve, resolve_all
from .stages import StageBuilder, make_stage

__all__ = [
    "ScientificScene", "StageBuilder", "make_stage", "NarrativeMixin",
    "Literal", "DataRef", "Derived", "Symbol", "is_source",
    "resolve", "resolve_all", "resolve_data_ref", "format_value",
    "evaluate", "EvaluatorError", "BindingError",
    "data_root", "set_data_root",
]
