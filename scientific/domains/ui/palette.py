"""Theme tokens — one palette shared by every domain renderer.

Tokens (not raw hex) are the canonical color values inside the IR; the
frontend can re-map tokens per theme without touching scene semantics.
Unknown tokens fall back to ``fg`` so rendering never crashes on a typo
(validation still reports it).
"""

from __future__ import annotations

THEME = {
    "bg": "#101014",
    "fg": "#E8E8F0",
    "muted": "#8A8A99",
    "panel": "#1B1B24",
    "panel2": "#22222E",
    "border": "#34344A",
    "accent": "#4FA3FF",
    "accent2": "#7C6CF0",
    "ok": "#39C88E",
    "warn": "#F2B84B",
    "fail": "#F26D6D",
    "info": "#5BD1E0",
}

_FALLBACK = "fg"


def color(token: str) -> str:
    """Resolve a token (or pass through a #hex literal)."""
    if isinstance(token, str) and token.startswith("#"):
        return token
    return THEME.get(token, THEME[_FALLBACK])


def all_tokens() -> dict[str, str]:
    return dict(THEME)
