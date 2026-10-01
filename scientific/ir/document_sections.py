"""Suprepto document sections (state, machines, comparisons, annotations).

Mixin for SceneDocument, split from document.py to keep files small.
These sections are all optional: a document without them is a fully
valid sci-ir/1 scene (older documents load unchanged).
"""

from __future__ import annotations

from typing import Any

from .annotation import AnnotationSpec, ComparisonSpec
from .errors import IRError
from .state import DerivedSpec, StateMachineSpec, StateSymbolSpec


class SupreptoSectionsMixin:
    """Construction + (de)serialization for the Suprepto sections."""

    state_symbols: dict[str, StateSymbolSpec]
    derived: dict[str, DerivedSpec]
    machines: dict[str, StateMachineSpec]
    comparisons: dict[str, ComparisonSpec]
    annotations: dict[str, AnnotationSpec]

    def _init_sections(self) -> None:
        self.state_symbols: dict[str, StateSymbolSpec] = {}
        self.derived: dict[str, DerivedSpec] = {}
        self.machines: dict[str, StateMachineSpec] = {}
        self.comparisons: dict[str, ComparisonSpec] = {}
        self.annotations: dict[str, AnnotationSpec] = {}

    # ── construction ────────────────────────────────────────────────
    def add_state_symbol(self, spec: StateSymbolSpec) -> StateSymbolSpec:
        if spec.id in self.state_symbols or spec.id in self.derived:
            raise IRError(f"duplicate state symbol id {spec.id!r}")
        self.state_symbols[spec.id] = spec
        return spec

    def add_derived(self, spec: DerivedSpec) -> DerivedSpec:
        if spec.id in self.state_symbols or spec.id in self.derived:
            raise IRError(f"duplicate derived symbol id {spec.id!r}")
        self.derived[spec.id] = spec
        return spec

    def add_machine(self, machine: StateMachineSpec) -> StateMachineSpec:
        if machine.id in self.machines:
            raise IRError(f"duplicate machine id {machine.id!r}")
        self.machines[machine.id] = machine
        return machine

    def add_comparison(self, comparison: ComparisonSpec) -> ComparisonSpec:
        if comparison.id in self.comparisons:
            raise IRError(f"duplicate comparison id {comparison.id!r}")
        self.comparisons[comparison.id] = comparison
        return comparison

    def add_annotation(self, annotation: AnnotationSpec) -> AnnotationSpec:
        if annotation.id in self.annotations:
            raise IRError(f"duplicate annotation id {annotation.id!r}")
        self.annotations[annotation.id] = annotation
        return annotation

    # ── serialization ───────────────────────────────────────────────
    def sections_to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        if self.state_symbols or self.derived or self.machines:
            state: dict[str, Any] = {}
            if self.state_symbols:
                state["symbols"] = [s.to_dict()
                                    for s in self.state_symbols.values()]
            if self.derived:
                state["derived"] = [d.to_dict() for d in self.derived.values()]
            if self.machines:
                state["machines"] = [m.to_dict() for m in self.machines.values()]
            out["state"] = state
        if self.comparisons:
            out["comparisons"] = [c.to_dict() for c in self.comparisons.values()]
        if self.annotations:
            out["annotations"] = [a.to_dict()
                                   for a in self.annotations.values()]
        return out

    def load_sections(self, data: dict) -> None:
        state = data.get("state") or {}
        for raw in state.get("symbols", []):
            self.add_state_symbol(StateSymbolSpec.from_dict(raw))
        for raw in state.get("derived", []):
            self.add_derived(DerivedSpec.from_dict(raw))
        for raw in state.get("machines", []):
            self.add_machine(StateMachineSpec.from_dict(raw))
        for raw in data.get("comparisons", []):
            self.add_comparison(ComparisonSpec.from_dict(raw))
        for raw in data.get("annotations", []):
            self.add_annotation(AnnotationSpec.from_dict(raw))
