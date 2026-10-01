"""Emission helpers for the Suprepto sections (state, machines,
comparisons, annotations) — split from emitter_parts.py (150-line rule).

Everything round-trips: the emitted authoring calls rebuild IR that is
semantically identical (pinned by round-trip tests).
"""

from __future__ import annotations

from .literals import py_literal


def emit_state_sections(w, document) -> None:
    """State symbols, derived specs, machines, comparisons, annotations."""
    for symbol in document.state_symbols.values():
        parts = [py_literal(symbol.id)]
        if symbol.driver is not None and symbol.driver.get(
                "kind") == "keyframes":
            parts.append(
                f"keyframes={py_literal(symbol.driver.get('keyframes'))}")
            easing = symbol.driver.get("easing", "smooth")
            if easing != "smooth":
                parts.append(f"easing={py_literal(easing)}")
            if symbol.value is not None:
                parts.append(f"value={py_literal(symbol.value)}")
        elif symbol.value is not None:
            parts.append(f"value={py_literal(symbol.value)}")
        if symbol.kind != "scalar":
            parts.append(f"kind={py_literal(symbol.kind)}")
        if symbol.format is not None:
            parts.append(f"format={py_literal(symbol.format)}")
        w(f"    scene.state({', '.join(parts)})")
    for spec in document.derived.values():
        parts = [py_literal(spec.id), f"expr={py_literal(spec.expr)}"]
        if spec.inputs:
            parts.append(f"inputs={py_literal(spec.inputs)}")
        if spec.kind != "derived":
            parts.append(f"kind={py_literal(spec.kind)}")
        if spec.format is not None:
            parts.append(f"format={py_literal(spec.format)}")
        w(f"    scene.derive({', '.join(parts)})")
    for machine in document.machines.values():
        _emit_machine(w, machine)
    for comparison in document.comparisons.values():
        _emit_comparison(w, comparison)
    for ann in document.annotations.values():
        parts = [py_literal(ann.target)]
        if ann.provider is not None:
            parts.append(f"provider={py_literal(ann.provider)}")
        if ann.value:
            parts.append(f"value={py_literal(ann.value)}")
        if ann.format is not None:
            parts.append(f"format={py_literal(ann.format)}")
        if ann.side != "RIGHT":
            parts.append(f"side={py_literal(ann.side)}")
        if not ann.live:
            parts.append("live=False")
        parts.append(f"id={py_literal(ann.id)}")
        w(f"    scene.annotate({', '.join(parts)})")


def _emit_machine(w, machine) -> None:
    states = [{"id": s.get("id"), **({"label": s["label"]}
                                     if s.get("label") else {})}
              for s in machine.states]
    transitions = []
    for tr in machine.transitions:
        item = {"id": tr.id, "source": tr.source, "target": tr.target}
        if tr.trigger:
            item["trigger"] = tr.trigger
        if tr.sets:
            item["sets"] = tr.sets
        if tr.animate is not None:
            item["animate"] = tr.animate
        transitions.append(item)
    w(f"    scene.machine({py_literal(machine.id)}, "
      f"states={py_literal(states)}, "
      f"transitions={py_literal(transitions)}, "
      f"initial={py_literal(machine.initial)})")


def _emit_comparison(w, comparison) -> None:
    metrics = [{"label": m.label, "a": m.a, "b": m.b, "format": m.format,
                "deltaFormat": m.delta_format} for m in comparison.metrics]
    parts = [py_literal(comparison.id), f"kind={py_literal(comparison.kind)}"]
    if comparison.a is not None:
        parts.append(f"a={py_literal(comparison.a)}")
    if comparison.b is not None:
        parts.append(f"b={py_literal(comparison.b)}")
    parts.append(f"metrics={py_literal(metrics)}")
    if comparison.title:
        parts.append(f"title={py_literal(comparison.title)}")
    w(f"    scene.compare({', '.join(parts)})")
