"""Document validation against the type registry.

`validate_document(doc, registry)` returns a list of error dicts and never
raises for content problems — the API surfaces the list directly.  Only
programmer mistakes (unregistered types on the *registry* side) raise.
The JS mirror lives at services/api/src/ir/validate.js; both must agree
(cross-tested in services/api/tests/ir.test.mjs and scientific/tests).
"""

from __future__ import annotations

from typing import Callable

from ..registry import UnknownTypeError, type_entry
from .document import SceneDocument
from .node import validate_space
from .relationship import validate_kind
from .schema import STEP_OPS
from .timeline import validate_step

PropertyGetter = Callable[[str], dict]


def _check_props(type_key: str, props: dict, schema: dict) -> list[dict]:
    errors: list[dict] = []
    for name, spec in schema.items():
        value = props.get(name, spec.get("default"))
        if value is None and spec.get("required"):
            errors.append({"path": f"objects/{type_key}/{name}",
                           "message": f"missing required property '{name}'"})
            continue
        if value is None:
            continue
        expected = spec.get("type", "any")
        if not _type_ok(value, expected):
            errors.append({"path": f"objects/{type_key}/{name}",
                           "message": f"property '{name}' expects {expected}, got "
                                      f"{type(value).__name__}"})
        if "enum" in spec and value not in spec["enum"]:
            errors.append({"path": f"objects/{type_key}/{name}",
                           "message": f"'{value}' not in enum {spec['enum']}"})
    for name in props:
        if name not in schema:
            errors.append({"path": f"objects/{type_key}/{name}",
                           "message": f"unknown property '{name}' for type '{type_key}'"})
    return errors


def _type_ok(value, expected: str) -> bool:
    checks = {
        "str": lambda v: isinstance(v, str),
        "float": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
        "int": lambda v: isinstance(v, int) and not isinstance(v, bool),
        "bool": lambda v: isinstance(v, bool),
        "list": lambda v: isinstance(v, list),
        "dict": lambda v: isinstance(v, dict),
        "any": lambda v: True,
    }
    return checks.get(expected, checks["any"])(value)


def _resolve_entry(type_key: str) -> dict:
    try:
        return type_entry(type_key)
    except UnknownTypeError:
        raise


def validate_document(doc: SceneDocument, registry=None) -> list[dict]:
    """Validate `doc`; return a (possibly empty) list of error dicts."""
    errors: list[dict] = []
    for node in doc.objects.values():
        try:
            entry = _resolve_entry(node.type)
        except UnknownTypeError as exc:
            errors.append({"path": f"objects/{node.id}", "message": str(exc)})
            continue
        errors.extend(_check_props(node.id, node.properties, entry.get("properties", {})))
        if not validate_space(node.space):
            errors.append({"path": f"objects/{node.id}/space",
                           "message": f"invalid space {node.space!r}"})
        if node.parent_id and node.parent_id not in doc.objects:
            errors.append({"path": f"objects/{node.id}/parentId",
                           "message": f"unknown parent '{node.parent_id}'"})
    for cyc_id in doc.has_parent_cycles():
        errors.append({"path": f"objects/{cyc_id}/parentId",
                       "message": "parent chain contains a cycle"})
    for expr in doc.expressions.values():
        for sym, spec in expr.bindings.items():
            if not isinstance(spec, dict) or "kind" not in spec:
                errors.append({"path": f"expressions/{expr.id}/bindings/{sym}",
                               "message": "binding must be a source spec with 'kind'"})
    for rel in doc.relationships.values():
        if not validate_kind(rel.kind):
            errors.append({"path": f"relationships/{rel.id}",
                           "message": f"unknown relationship kind '{rel.kind}'"})
        for src in rel.sources:
            if src not in doc.all_ids():
                errors.append({"path": f"relationships/{rel.id}/sources",
                               "message": f"unknown source '{src}'"})
    known_targets = doc.all_ids()
    for stage in doc.timeline:
        for step in stage.steps:
            if step.op not in STEP_OPS:
                continue  # already a structural error; validate_step reports it
            for problem in validate_step(step):
                errors.append({"path": f"timeline/{stage.id}", "message": problem})
            if step.target and step.target not in known_targets:
                errors.append({"path": f"timeline/{stage.id}/{step.target}",
                               "message": f"step targets unknown id '{step.target}'"})
    return errors


def validate_or_raise(doc: SceneDocument, registry=None) -> None:
    from ..registry import ValidationError
    errors = validate_document(doc, registry)
    if errors:
        raise ValidationError(errors)
