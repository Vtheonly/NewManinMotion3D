"""Direction-name mapping for authoring-friendly side strings.

IR accepts readable side names ('RIGHT', 'UP', 'UL', …); renderers map them
to manim direction constants here so no binding does its own conversion.
"""

from __future__ import annotations

import manim

SIDES = {
    "RIGHT": manim.RIGHT, "LEFT": manim.LEFT,
    "UP": manim.UP, "DOWN": manim.DOWN,
    "UR": manim.UR, "UL": manim.UL,
    "DR": manim.DR, "DL": manim.DL,
    "ORIGIN": manim.ORIGIN,
}


def side(name: str):
    """Resolve a side name (case-insensitive) to a manim direction."""
    if not isinstance(name, str):
        return manim.RIGHT
    return SIDES.get(name.strip().upper(), manim.RIGHT)
