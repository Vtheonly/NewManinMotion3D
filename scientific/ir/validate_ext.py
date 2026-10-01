"""Validation for the Suprepto sections (state, machines, comparisons,
annotations) — split from validate.py to keep files small.

Pure structural checks; the numeric/derived layer is validated by
StateEngine (scientific/state/engine.py) at evaluation time.
"""

from __future__ import annotations

from .document import SceneDocument
from .annotation import COMPARISON_KINDS
from .highlight import HighlightError, normalize_behaviors


def validate_state_sections(doc: SceneDocument) -> list[dict]:
    errors: list[dict] = []
    symbols = set(doc.state_symbols) | set(doc.derived)

    for spec in doc.state_symbols.values():
        if spec.driver:
            kind = spec.driver.get("kind")
            if kind not in ("static", "keyframes", "series"):
                errors.append({"path": f"state/{spec.id}/driver",
                               "message": f"unknown driver kind {kind!r}"})
    for spec in doc.derived.values():
        for alias, src in spec.inputs.items():
            if src not in symbols:
                errors.append({
                    "path": f"state/derived/{spec.id}/inputs/{alias}",
                    "message": f"input '{src}' is not a declared state symbol"})
        if not str(spec.expr).strip():
            errors.append({"path": f"state/derived/{spec.id}",
                           "message": "derived symbol needs an expression"})

    for machine in doc.machines.values():
        state_ids = machine.state_ids()
        if not machine.initial or machine.initial not in state_ids:
            errors.append({"path": f"machines/{machine.id}/initial",
                           "message": "machine needs an 'initial' state that "
                                      "matches one of its states"})
        for tr in machine.transitions:
            if tr.source not in state_ids:
                errors.append({"path": f"machines/{machine.id}/{tr.id}/source",
                               "message": f"unknown source state {tr.source!r}"})
            if tr.target not in state_ids:
                errors.append({"path": f"machines/{machine.id}/{tr.id}/target",
                               "message": f"unknown target state {tr.target!r}"})
            for sym in tr.sets:
                if sym not in symbols:
                    errors.append({
                        "path": f"machines/{machine.id}/{tr.id}/sets/{sym}",
                        "message": f"transition sets unknown symbol {sym!r}"})

    for comp in doc.comparisons.values():
        if comp.kind not in COMPARISON_KINDS:
            errors.append({"path": f"comparisons/{comp.id}",
                           "message": f"unknown comparison kind {comp.kind!r}"})
        for side in ("a", "b"):
            target = getattr(comp, side)
            if target is not None and target not in doc.objects:
                errors.append({"path": f"comparisons/{comp.id}/{side}",
                               "message": f"comparison side is not an "
                                          f"artifact: {target!r}"})
        if not comp.metrics:
            errors.append({"path": f"comparisons/{comp.id}/metrics",
                           "message": "comparison needs at least one metric"})

    for ann in doc.annotations.values():
        if ann.target not in doc.all_ids():
            errors.append({"path": f"annotations/{ann.id}/target",
                           "message": f"annotation targets unknown id "
                                      f"{ann.target!r}"})
        providers = symbols | set(doc.values) | set(doc.relationships)
        if ann.provider is not None and ann.provider not in providers:
            errors.append({"path": f"annotations/{ann.id}/provider",
                           "message": f"annotation provider is not a state "
                                      f"symbol, value or relationship: "
                                      f"{ann.provider!r}"})

    for stage in doc.timeline:
        for step in stage.steps:
            if step.op == "highlight":
                behaviors = (step.properties or {}).get("behaviors")
                if behaviors is not None:
                    try:
                        normalize_behaviors(behaviors)
                    except HighlightError as exc:
                        errors.append({"path": f"timeline/{stage.id}",
                                       "message": str(exc)})
            elif step.op in ("set", "interpolate"):
                if step.target not in doc.state_symbols:
                    errors.append({
                        "path": f"timeline/{stage.id}/{step.target}",
                        "message": f"{step.op} targets unknown state symbol "
                                   f"{step.target!r}"})
            elif step.op == "transition":
                if step.target not in doc.machines:
                    errors.append({
                        "path": f"timeline/{stage.id}/{step.target}",
                        "message": f"transition targets unknown machine "
                                   f"{step.target!r}"})
            elif step.op == "compare":
                if step.target not in doc.comparisons:
                    errors.append({
                        "path": f"timeline/{stage.id}/{step.target}",
                        "message": f"compare targets unknown comparison "
                                   f"{step.target!r}"})
    return errors
