"""Render context — shared state for one render pass.

Holds built mobjects (by node id), resolved live values and the document.
Renderers receive (node, ctx) and return a Mobject; the orchestrator handles
placement, parenting, relationships and the timeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..ir.document import SceneDocument


@dataclass
class RenderContext:
    document: SceneDocument
    mobjects: dict[str, Any] = field(default_factory=dict)
    values: dict[str, Any] = field(default_factory=dict)
    formatted: dict[str, str] = field(default_factory=dict)
    data_root: str = ""
    warnings: list[str] = field(default_factory=list)

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

    def resolve_values(self) -> None:
        """Resolve document bindings then live values (deterministic order)."""
        from ..runtime.resolve import resolve, resolve_all
        context = resolve_all(self.document.bindings, self.data_root or None)
        for value in self.document.values.values():
            context[value.id] = resolve(value.source, context,
                                        self.data_root or None)
        self.values = context
        # Formatted text for display (templates applied once, reused).
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
