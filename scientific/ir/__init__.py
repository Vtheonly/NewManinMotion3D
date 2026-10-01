"""Scene IR — the canonical scientific scene model (schema sci-ir/1).

Layers (see docs/development/architecture/SCENE-IR.md):
    ir        pure data model, no manim, no numpy
    registry  type metadata + duplicate rejection
    runtime   authoring API + data bindings
    manim_adapter  rendering only
    export    deterministic IR -> Python
"""

from .document import SceneDocument
from .errors import (
    DataError, DuplicateRegistrationError, IRError, SchemaError,
    UnknownTypeError, ValidationError,
)
from .expression import Expression, LiveValue
from .node import SceneNode, Transform
from .relationship import RELATION_KINDS, Relationship
from .schema import SCENE_TYPES, SCHEMA, SCHEMA_VERSION, STEP_OPS
from .state import DerivedSpec, StateMachineSpec, StateSymbolSpec, TransitionSpec
from .annotation import (
    AnnotationSpec, COMPARISON_KINDS, ComparisonSpec, MetricSpec,
)
from .highlight import BEHAVIORS, normalize_behaviors, split_subtarget
from .timeline import Stage, Step
from .serialize import from_json, read_file, to_json, write_file
from .validate import validate_document, validate_or_raise

__all__ = [
    "SCENE_TYPES", "SCHEMA", "SCHEMA_VERSION", "STEP_OPS",
    "RELATION_KINDS", "BEHAVIORS", "COMPARISON_KINDS",
    "SceneDocument", "SceneNode", "Transform",
    "Expression", "LiveValue", "Relationship",
    "StateSymbolSpec", "DerivedSpec", "StateMachineSpec", "TransitionSpec",
    "ComparisonSpec", "MetricSpec", "AnnotationSpec",
    "normalize_behaviors", "split_subtarget",
    "Stage", "Step",
    "to_json", "from_json", "write_file", "read_file",
    "validate_document", "validate_or_raise",
    "IRError", "SchemaError", "ValidationError", "UnknownTypeError",
    "DuplicateRegistrationError", "DataError",
]
