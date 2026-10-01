"""Render context — shared state for one render pass.

Holds built mobjects (by node id), resolved live values, the reactive state
engine, per-symbol value trackers (live per-frame updates, issue #4) and
the diagnostics recorder (issue #28).  Renderers receive (node, ctx) and
return a Mobject; the orchestrator handles placement, parenting,
relationships and the timeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from ..ir.document import SceneDocument


@dataclass
class RenderContext:
    document: SceneDocument
    mobjects: dict[str, Any] = field(default_factory=dict)
    values: dict[str, Any] = field(default_factory=dict)
    formatted: dict[str, str] = field(default_factory=dict)
    data_root: str = ""
    warnings: list[str] = field(default_factory=list)
    engine: Any = None                     # StateEngine (lazy)
    trackers: dict[str, Any] = field(default_factory=dict)
    live_mobs: dict[str, Any] = field(default_factory=dict)
    machine_states: dict[str, str] = field(default_factory=dict)
    diagnostics: Any = None                # Diagnostics recorder (lazy)

    def mob(self, node_id: str) -> Any:
        if node_id not in self.mobjects:
            raise KeyError(f"mobject for {node_id!r} has not been built")
        return self.mobjects[node_id]

    @property
    def mobs(self) -> dict[str, Any]:
        """Alias for custom-step code brevity (documented boundary API)."""
        return self.mobjects

    def warn(self, message: str) -> None:
        self.warnings.append(message)
        if self.diagnostics is not None:
            self.diagnostics.warning(message)

    # ── state engine bridge (issue #4) ─────────────────────────────
    def state_engine(self):
        if self.engine is None:
            from ..state import engine_from_document
            self.engine = engine_from_document(self.document)
        return self.engine

    def tracker(self, symbol: str):
        """Manim ValueTracker per state symbol (created on demand)."""
        if symbol not in self.trackers:
            from manim import ValueTracker
            snapshot = self.state_engine().sample(0.0)
            initial = float(snapshot.get(symbol, 0.0))
            self.trackers[symbol] = ValueTracker(initial)
        return self.trackers[symbol]

    def provider_value(self, provider: str) -> Any:
        """Current value of a provider (state symbol, live value, rel)."""
        snapshot = self.state_engine().sample(self._time_now())
        if provider in snapshot:
            return snapshot[provider]
        return self.values.get(provider)

    def provider_format(self, provider: str) -> str:
        spec = self.document.state_symbols.get(provider)
        if spec is not None and spec.format:
            return spec.format
        from ..ir.kinds import default_format
        return default_format(spec.kind if spec else "scalar")

    def _time_now(self) -> float:
        if self.diagnostics is not None:
            return self.diagnostics.time
        return 0.0

    # ── live values ─────────────────────────────────────────────────
    def resolve_values(self) -> None:
        """Resolve document bindings then live values (deterministic order)."""
        from ..runtime.resolve import resolve, resolve_all
        context = resolve_all(self.document.bindings, self.data_root or None)
        for value in self.document.values.values():
            context[value.id] = resolve(value.source, context,
                                        self.data_root or None)
        self.values = context
        from ..runtime.resolve import format_value
        self.formatted = {
            value.id: format_value(value.format, context[value.id])
            for value in self.document.values.values()
        }

    def format(self, template: str) -> str:
        """Substitute {value_id} placeholders with formatted live values."""
        try:
            return template.format_map(_SafeMap(self.formatted))
        except (ValueError, KeyError):
            return template


class _SafeMap(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"
