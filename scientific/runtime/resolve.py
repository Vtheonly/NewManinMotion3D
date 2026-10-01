"""Binding resolution — turn source specs into numbers, deterministically.

resolve(source, context, data_root) evaluates any source spec against a
context of already-bound symbols.  Derived inputs may reference other
symbols, which are resolved depth-first; cycles are detected and reported.
"""

from __future__ import annotations

from typing import Any

from ..ir.errors import IRError
from .dataref import is_source
from .datasource import resolve_data_ref
from .evaluate import EvaluatorError, evaluate


class BindingError(IRError):
    """A binding could not be resolved."""


def resolve(source: Any, context: dict[str, Any] | None = None,
            data_root: str | None = None, _stack: tuple[str, ...] = ()) -> Any:
    """Resolve one source spec to a value (recursive for Derived)."""
    context = context or {}
    if not is_source(source):
        if isinstance(source, (int, float, str, bool, list, dict, type(None))):
            return source  # already a plain value (author convenience)
        raise BindingError(f"not a binding source: {source!r}")

    kind = source["kind"]
    if kind == "literal":
        return source.get("value")
    if kind == "symbol":
        name = source.get("name", "")
        if name not in context:
            raise BindingError(f"unbound symbol {name!r}")
        return context[name]
    if kind == "data":
        try:
            return resolve_data_ref(source.get("ref", ""), source.get("key"),
                                    data_root)
        except IRError as exc:
            raise BindingError(str(exc)) from None
    if kind == "derived":
        return _resolve_derived(source, context, data_root, _stack)
    raise BindingError(f"unknown source kind {kind!r}")


def _resolve_derived(source: dict, context: dict, data_root, _stack) -> float:
    expr = source.get("expr", "")
    inputs = source.get("inputs") or {}
    local = dict(context)
    for name, spec in inputs.items():
        if name in _stack:
            raise BindingError(f"cyclic derived binding via {name!r}")
        local[name] = resolve(spec, local, data_root, _stack + (name,))
    try:
        return evaluate(expr, local)
    except EvaluatorError as exc:
        raise BindingError(f"derived expression failed: {exc}") from None


def resolve_all(bindings: dict[str, Any], data_root: str | None = None) -> dict:
    """Resolve a symbol -> source map into symbol -> value (document order)."""
    context: dict[str, Any] = {}
    for name, source in bindings.items():
        context[name] = resolve(source, context, data_root)
    return context


def format_value(template: str, value: Any) -> str:
    """Apply a live-value template ('ΔG = {value:.2f} kcal/mol')."""
    try:
        return template.format(value=value)
    except (ValueError, TypeError):
        return str(value)
