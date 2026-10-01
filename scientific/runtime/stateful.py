"""Suprepto authoring mixin — state, machines, comparisons, annotations.

Mixed into ScientificScene (authoring.py keeps the base builder small).
Every method writes plain IR sections, so everything authored here is
serializable, exportable and editable from the frontend.
"""

from __future__ import annotations

from typing import Any, Optional

from ..ir import (
    AnnotationSpec, ComparisonSpec, DerivedSpec, IRError, MetricSpec,
    StateMachineSpec, StateSymbolSpec, TransitionSpec,
)


class StatefulMixin:
    document: Any
    _auto_stage: Any

    # ── reactive state (issues #4 / #11) ─────────────────────────────
    def state(self, symbol: str, value: Any = None, kind: str = "scalar",
              keyframes=None, easing: str = "smooth", format=None) -> str:
        """Declare an observable state symbol (constant or keyframe-driven)."""
        driver = None
        if keyframes is not None:
            driver = {"kind": "keyframes",
                      "keyframes": [list(kf) for kf in keyframes],
                      "easing": easing}
        self.document.add_state_symbol(StateSymbolSpec(
            id=symbol, kind=kind, value=value, driver=driver, format=format))
        return symbol

    def drive(self, symbol: str, series: Any = None, times=None,
              value_key: str = "value", time_key: str = "") -> str:
        """Drive a declared symbol from an in-memory series (issue #11)."""
        if symbol not in self.document.state_symbols:
            raise IRError(
                f"drive() target {symbol!r} is not a declared state symbol")
        from ..data.series import (series_from_array, series_from_columns,
                                   series_from_records)
        if isinstance(series, list) and series and isinstance(series[0], dict):
            drv = series_from_records(series, value_key, time_key or None)
        elif isinstance(series, dict):
            drv = series_from_columns(series, value_key, time_key or None)
        else:
            drv = series_from_array(series, times)
        self.document.state_symbols[symbol].driver = drv.to_dict()
        return symbol

    def derive(self, symbol: str, expr: str,
               inputs: Optional[dict[str, str]] = None,
               kind: str = "derived", format=None) -> str:
        """Declare a derived state symbol (safe expression over others)."""
        self.document.add_derived(DerivedSpec(
            id=symbol, expr=expr, inputs=inputs or {}, kind=kind,
            format=format))
        return symbol

    # ── explicit state machines (issue #11) ──────────────────────────
    def machine(self, id: str, states: list, transitions: list,
                initial: str = "") -> str:
        """Declare a state machine.

        ``states``: [{id, label?, description?}] in narrative order,
        e.g. Initial -> Computation -> Intermediate -> Highlight -> Updated.
        ``transitions``: [{id?, source, target, trigger?, sets?, animate?}]
        where ``sets`` maps state symbols to their new values.
        """
        clean = []
        for tr in transitions:
            sets = tr.get("sets") or {}
            if isinstance(sets, list):  # [(symbol, value), ...]
                sets = dict(sets)
            clean.append(TransitionSpec(
                id=str(tr.get("id", f"tr_{len(clean) + 1}")),
                source=tr["source"], target=tr["target"],
                trigger=tr.get("trigger", ""), sets=sets,
                animate=tr.get("animate")))
        state_defs = [dict(s) for s in states]
        self.document.add_machine(StateMachineSpec(
            id=id, states=state_defs, transitions=clean,
            initial=initial or (state_defs[0]["id"] if state_defs else "")))
        return id

    # ── comparisons (issue #11) ───────────────────────────────────────
    def compare(self, id: str, kind: str = "before_after", a: Optional[str] = None,
                b: Optional[str] = None, metrics: Optional[list] = None,
                title: str = "") -> str:
        """Declare a comparison; metric numbers come from real bound state."""
        rows = [m if isinstance(m, MetricSpec) else MetricSpec(
            label=m.get("label", ""), a=m.get("a"), b=m.get("b"),
            format=m.get("format", "{value}"),
            delta_format=m.get("deltaFormat", "{delta:+.2f}"))
            for m in (metrics or [])]
        self.document.add_comparison(ComparisonSpec(
            id=id, kind=kind, a=a, b=b, metrics=rows, title=title))
        return id

    # ── live annotations (issue #5) ───────────────────────────────────
    def annotate(self, target: str, value: str = "", duration: float = 1.0,
                 provider: Optional[str] = None, format=None,
                 side: str = "RIGHT", live: bool = True,
                 id: str = "") -> str:
        """Annotate a target.

        With ``provider``: a persistent live annotation bound to a state
        symbol / live value / relationship.  Without: a quick one-off
        stage annotation event (the legacy narrative behaviour).
        """
        if provider is None:
            self._auto_stage().annotate(target, value, duration=duration)
            return target
        ann_id = id or f"ann_{len(self.document.annotations) + 1}"
        self.document.add_annotation(AnnotationSpec(
            id=ann_id, target=target, provider=provider, value=value,
            format=format, side=side, live=live))
        return ann_id

    def highlight(self, target: str, color: Optional[str] = None,
                  behaviors=None, duration: float = 1.0,
                  label=None) -> str:
        """Queue a (composable) highlight on the auto stage (issue #5)."""
        self._auto_stage().highlight(target, color=color, behaviors=behaviors,
                                     duration=duration, label=label)
        return target
