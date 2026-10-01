"""Easing functions for state drivers (pure, deterministic).

Names mirror the authoring vocabulary used by timeline rates so one mental
model covers both; ``linear`` is the identity.
"""

from __future__ import annotations

import math

EASINGS = ("linear", "smooth", "ease_in", "ease_out", "ease_in_out",
           "bounce", "elastic")


def is_easing(name: str) -> bool:
    return name in EASINGS


def ease(name: str, t: float) -> float:
    """Map normalized progress ``t`` in [0, 1] through ``name``."""
    t = min(1.0, max(0.0, float(t)))
    if name in ("", "linear"):
        return t
    if name == "smooth":
        return t * t * (3.0 - 2.0 * t)
    if name == "ease_in":
        return t * t
    if name == "ease_out":
        return 1.0 - (1.0 - t) * (1.0 - t)
    if name == "ease_in_out":
        return 0.5 - 0.5 * math.cos(math.pi * t)
    if name == "bounce":
        # standard bounce-out (piecewise parabolic)
        if t < 1 / 2.75:
            return 7.5625 * t * t
        if t < 2 / 2.75:
            t -= 1.5 / 2.75
            return 7.5625 * t * t + 0.75
        if t < 2.5 / 2.75:
            t -= 2.25 / 2.75
            return 7.5625 * t * t + 0.9375
        t -= 2.625 / 2.75
        return 7.5625 * t * t + 0.984375
    if name == "elastic":
        if t in (0.0, 1.0):
            return t
        return (2.0 ** (-10.0 * t)) * math.sin((t * 10.0 - 0.75)
                                               * (2.0 * math.pi / 3.0)) + 1.0
    raise ValueError(f"unknown easing {name!r} (known: {EASINGS})")
