"""Composable highlight specifications (issue #5).

A highlight is a list of *behaviors* applied to one target.  Behaviors come
from a closed, documented vocabulary and compose through a normalization
step that resolves convenience aliases (e.g. ``focus`` implies dimming the
rest) into an explicit plan the renderer executes identically in 2D and 3D.

Targets may address sub-objects through dotted paths — ``graph_1.node:a``,
``matrix_1.cell:2:3`` or a formula term name — resolved by the renderer
binding of the owning artifact (see manim_adapter/subtargets.py).
"""

from __future__ import annotations

from typing import Any, Optional

BEHAVIORS = (
    "outline", "glow", "pulse", "emphasis", "dim_others", "focus",
    "arrow", "label", "region", "temporary",
)

# Convenience aliases -> behavior sets.
_ALIASES = {
    "focus": ("focus", "dim_others"),
    "glow": ("glow", "outline"),
    "spotlight": ("focus", "dim_others", "outline"),
}


class HighlightError(ValueError):
    """Unknown or conflicting highlight behavior."""


def normalize_behaviors(behaviors: Optional[list]) -> list[str]:
    """Expand aliases and de-duplicate, preserving first-seen order."""
    out: list[str] = []
    for item in behaviors or []:
        name = str(item)
        for base in _ALIASES.get(name, (name,)):
            if base not in out:
                out.append(base)
    unknown = [b for b in out if b not in BEHAVIORS]
    if unknown:
        raise HighlightError(
            f"unknown highlight behaviors {unknown} (known: {BEHAVIORS})")
    return out


def is_behavior(name: str) -> bool:
    return name in BEHAVIORS or name in _ALIASES


def split_subtarget(target: str) -> tuple[str, Optional[str]]:
    """Split ``artifact_id[.subpath]`` into (artifact id, subpath)."""
    if "." not in target:
        return target, None
    head, _, rest = target.partition(".")
    return head, rest


def highlight_step(target: str, behaviors: Optional[list] = None,
                   color: Optional[str] = None, duration: Optional[float] = None,
                   label: Optional[str] = None) -> dict:
    """Normalized ``highlight`` step properties (IR payload)."""
    props: dict[str, Any] = {"behaviors": normalize_behaviors(behaviors)}
    if color:
        props["color"] = color
    if label:
        props["label"] = label
    if duration is not None:
        props["duration"] = float(duration)
    return props
