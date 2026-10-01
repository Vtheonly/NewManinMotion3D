"""Type registry — the single source of truth for object types.

Every scientific primitive registers here with:
  - a dotted type key (``biology.protein``);
  - a property schema (name -> type/required/default/enum/description);
  - metadata (label, category, dimensionality, description).

The same metadata drives: validation, the generic frontend inspector
(GET /api/ir/schema), the exporter and the manim renderer binding.  Registering
a type is therefore the *only* step needed to make a primitive editable —
there is no separate frontend whitelist (issue #32 §1/§14).

Renderer callables are attached separately (manim_adapter) so this module
stays free of manim imports.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from ..ir.errors import (
    DuplicateRegistrationError, UnknownTypeError, ValidationError,
    IRError,
)

Renderer = Callable[..., Any]


class TypeRegistry:
    def __init__(self) -> None:
        self._entries: dict[str, dict] = {}
        self._renderers: dict[str, Renderer] = {}

    def register(self, key: str, entry: dict) -> dict:
        if key in self._entries:
            raise DuplicateRegistrationError(f"type {key!r} already registered")
        if "." not in key:
            raise IRError(f"type key {key!r} must be dotted (domain.name)")
        full = {
            "key": key,
            "label": entry.get("label", key),
            "category": entry.get("category", key.split(".")[0]),
            "dimensionality": entry.get("dimensionality", "2d"),
            "description": entry.get("description", ""),
            "properties": entry.get("properties", {}),
        }
        self._entries[key] = full
        return full

    def get(self, key: str) -> dict:
        if key not in self._entries:
            raise UnknownTypeError(key)
        return self._entries[key]

    def has(self, key: str) -> bool:
        return key in self._entries

    def list(self) -> list[dict]:
        return [dict(e) for e in self._entries.values()]

    # ── renderer binding (manim layer attaches these) ───────────────
    def bind_renderer(self, key: str, fn: Renderer) -> None:
        if not self.has(key):
            raise UnknownTypeError(key)
        self._renderers[key] = fn

    def renderer_for(self, key: str) -> Optional[Renderer]:
        return self._renderers.get(key)


default_registry = TypeRegistry()


# ── module-level convenience API ────────────────────────────────────────
def register_type(key: str, **entry) -> dict:
    return default_registry.register(key, entry)


def type_entry(key: str) -> dict:
    return default_registry.get(key)


def list_types() -> list[dict]:
    return default_registry.list()


def has_type(key: str) -> bool:
    return default_registry.has(key)


def bind_renderer(key: str, fn: Renderer) -> None:
    default_registry.bind_renderer(key, fn)


def renderer_for(key: str) -> Optional[Renderer]:
    return default_registry.renderer_for(key)


def describe_types() -> list[dict]:
    """Metadata for the frontend generic inspector (no renderers)."""
    return [
        {
            "key": e["key"], "label": e["label"], "category": e["category"],
            "dimensionality": e["dimensionality"],
            "description": e["description"], "properties": e["properties"],
        }
        for e in default_registry.list()
    ]


__all__ = [
    "TypeRegistry", "default_registry",
    "register_type", "type_entry", "list_types", "has_type",
    "bind_renderer", "renderer_for", "describe_types",
    "UnknownTypeError", "DuplicateRegistrationError", "ValidationError",
]


# Populate built-ins (must come after the API above is defined).
from . import builtin_core, builtin_domains  # noqa: E402,F401  (side effects)
