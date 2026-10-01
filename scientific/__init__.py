"""scientific — canonical scientific scene runtime (issue #32).

Public surface (stable, documented in docs/development/syntax/):

    from scientific import ScientificScene, Literal, DataRef, Derived

Layers:
    ir               canonical scene model (sci-ir/1) — no manim, no numpy
    registry         type metadata; single source of truth for editors
    runtime          authoring API + data bindings + safe evaluation
    manim_adapter    IR -> Manim rendering (import manim lazily)
    export           deterministic IR -> runnable Python
    domains          pure numerical/domain modules (no manim)
"""

from __future__ import annotations

__version__ = "0.1.0"

from .ir import (  # noqa: F401
    SCENE_TYPES, SCHEMA, SCHEMA_VERSION,
    Expression, IRError, LiveValue, Relationship, SceneDocument, SceneNode,
    Stage, Step, Transform, ValidationError,
    from_json, read_file, to_json, validate_document, validate_or_raise,
    write_file,
)
from .registry import (  # noqa: F401
    describe_types, list_types, register_type, type_entry, UnknownTypeError,
    DuplicateRegistrationError, bind_renderer, renderer_for,
)
from .runtime import (  # noqa: F401
    BindingError, DataRef, Derived, EvaluatorError, Literal, ScientificScene,
    StageBuilder, Symbol, evaluate, format_value, resolve, resolve_all,
)

__all__ = [
    "__version__",
    "ScientificScene", "SceneDocument", "SceneNode", "Expression",
    "LiveValue", "Relationship", "Stage", "Step", "Transform",
    "Literal", "DataRef", "Derived", "Symbol",
    "resolve", "resolve_all", "evaluate", "format_value",
    "to_json", "from_json", "write_file", "read_file", "validate_or_raise",
    "validate_document", "register_type", "type_entry", "list_types",
    "describe_types", "bind_renderer", "renderer_for",
    "IRError", "ValidationError", "UnknownTypeError",
    "DuplicateRegistrationError", "BindingError", "EvaluatorError",
    "StageBuilder", "SCENE_TYPES", "SCHEMA", "SCHEMA_VERSION",
]
