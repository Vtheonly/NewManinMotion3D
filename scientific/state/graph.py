"""Derived-state graph resolution — topological order + evaluation.

Split from engine.py so each module stays small: this file owns the pure
dependency-graph algorithms (ordering, cycle detection, batch evaluation);
the engine owns symbol storage and change notification.
"""

from __future__ import annotations

from typing import Any

from ..ir.errors import IRError
from ..runtime.evaluate import evaluate


class StateGraphError(IRError):
    """Cyclic or unresolvable derived state."""


def dependencies_of(spec: dict) -> list[str]:
    """Symbols a derived spec reads (deterministic order)."""
    deps: list[str] = []
    for dep in spec["inputs"].values():
        if dep not in deps:
            deps.append(dep)
    return deps


def dependents_of(name: str, derived: dict[str, dict]) -> list[str]:
    return [d for d, spec in derived.items()
            if name in dependencies_of(spec)]


def check_cycles(derived: dict[str, dict]) -> None:
    """Reject derived definitions whose inputs cycle (DFS colouring)."""
    colour: dict[str, int] = {}  # 1 = on stack, 2 = done

    def visit(node: str) -> None:
        if colour.get(node) == 1:
            raise StateGraphError(f"cyclic derived state via {node!r}")
        if colour.get(node) == 2:
            return
        colour[node] = 1
        for dep in dependencies_of(derived.get(node, {"inputs": {}})):
            if dep in derived:
                visit(dep)
        colour[node] = 2

    for start in derived:
        visit(start)


def evaluate_derived(derived: dict[str, dict],
                     context: dict[str, Any]) -> dict[str, Any]:
    """Evaluate every derived symbol against already-bound values.

    Iterative worklist resolution: a derived symbol is evaluated as soon
    as all of its inputs are available, so evaluation order always follows
    true dependencies (issue #4 acceptance).
    """
    out: dict[str, Any] = {}
    pending = list(derived)
    while pending:
        progressed = False
        remaining = []
        for name in pending:
            spec = derived[name]
            if all(dep in context or dep in out
                   for dep in dependencies_of(spec)):
                out[name] = _evaluate_one(spec, context, out)
                progressed = True
            else:
                remaining.append(name)
        pending = remaining
        if not progressed and pending:
            raise StateGraphError(
                f"unresolvable derived symbols: {sorted(pending)}")
    return out


def _evaluate_one(spec: dict, context: dict, out: dict) -> float:
    local = {}
    for alias, src in spec["inputs"].items():
        local[alias] = out[src] if src in out else context[src]
    return evaluate(spec["expr"], local)
