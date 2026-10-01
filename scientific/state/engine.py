"""StateEngine — the canonical reactive state layer (issue #4).

Flow: underlying value -> observable symbol -> derived value -> consumers.

- ``bind`` declares a symbol (constant, driver or external value);
- ``derive`` declares a derived symbol as a safe expression over other
  symbols — recomputed from its *true dependencies* on every sample
  (ordering/cycles handled by state/graph.py);
- ``sample(t)`` returns the consistent snapshot of every symbol at time t;
- ``subscribe`` registers change observers (renderers, live annotations,
  diagnostics) — multiple consumers stay synchronized because they all
  read the same engine.

Pure stdlib, decoupled from rendering: 2D scenes, 3D scenes, the exporter
and the frontend all consume the same abstraction.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from ..ir.errors import IRError
from .driver import StaticDriver, driver_from
from .graph import (
    StateGraphError, check_cycles, dependencies_of, dependents_of,
    evaluate_derived,
)


class StateError(IRError):
    """Invalid state declaration."""


class StateSymbol:
    def __init__(self, name: str, kind: str, value: Any = None,
                 driver=None, format: Optional[str] = None):
        self.name = name
        self.kind = kind
        self.driver = driver
        self.value = value
        self.format = format

    def sample(self, t: float) -> Any:
        if self.driver is not None:
            return self.driver.value_at(t)
        return self.value


class StateEngine:
    def __init__(self) -> None:
        self.symbols: dict[str, StateSymbol] = {}
        self.derived: dict[str, dict] = {}
        self._subscribers: list[Callable[[str, Any], None]] = []

    # ── declaration ────────────────────────────────────────────────
    def bind(self, name: str, value: Any = None, kind: str = "scalar",
             driver=None, format: Optional[str] = None) -> StateSymbol:
        if name in self.symbols or name in self.derived:
            raise StateError(f"state symbol {name!r} already declared")
        if driver is None and value is None:
            raise StateError(f"symbol {name!r} needs a value or a driver")
        symbol = StateSymbol(name, kind, value, driver, format)
        self.symbols[name] = symbol
        return symbol

    def derive(self, name: str, expr: str,
               inputs: Optional[dict[str, str]] = None,
               kind: str = "derived",
               format: Optional[str] = None) -> str:
        if name in self.symbols or name in self.derived:
            raise StateError(f"state symbol {name!r} already declared")
        self.derived[name] = {"expr": expr, "inputs": dict(inputs or {}),
                              "kind": kind, "format": format}
        return name

    def subscribe(self, fn: Callable[[str, Any], None]) -> None:
        self._subscribers.append(fn)

    # ── queries (delegated to the graph module) ────────────────────
    def deps_of(self, name: str) -> list[str]:
        if name not in self.derived:
            return []
        return dependencies_of(self.derived[name])

    def dependents(self, name: str) -> list[str]:
        return dependents_of(name, self.derived)

    # ── evaluation ──────────────────────────────────────────────────
    def sample(self, t: float) -> dict[str, Any]:
        """Consistent snapshot of every symbol at time ``t``."""
        check_cycles(self.derived)
        context = {name: symbol.sample(t)
                   for name, symbol in self.symbols.items()}
        context.update(evaluate_derived(self.derived, context))
        return context

    # ── mutation + notification ────────────────────────────────────
    def set_value(self, name: str, value: Any, notify: bool = True) -> None:
        if name in self.derived:
            raise StateError(f"{name!r} is derived; set its inputs instead")
        if name not in self.symbols:
            raise StateError(f"unknown state symbol {name!r}")
        symbol = self.symbols[name]
        symbol.driver = None
        symbol.value = value
        if notify:
            self.notify(name, value)

    def notify(self, name: str, value: Any) -> None:
        for fn in self._subscribers:
            fn(name, value)


def engine_from_document(document) -> StateEngine:
    """Build the engine for a document's state sections (if present)."""
    engine = StateEngine()
    for symbol in document.state_symbols.values():
        driver = driver_from(symbol.driver)
        engine.bind(symbol.id, symbol.value, symbol.kind, driver,
                    symbol.format)
    for spec in document.derived.values():
        engine.derive(spec.id, spec.expr, spec.inputs, spec.kind, spec.format)
    return engine


def static(value: Any) -> StaticDriver:
    return StaticDriver(value)


__all__ = ["StateEngine", "StateError", "StateSymbol", "StateGraphError",
           "engine_from_document", "static"]
