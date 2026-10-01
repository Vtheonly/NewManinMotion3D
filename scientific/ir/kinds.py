"""State kinds — the observable quantity categories of the reactive engine.

One closed vocabulary shared by the IR, the authoring API, the inspector
metadata and the renderer.  A kind is descriptive: it drives formatting
hints and editor presentation, never control flow.
"""

from __future__ import annotations

KINDS = (
    "scalar", "vector", "matrix", "tensor", "coordinate", "distance",
    "angle", "probability", "score", "percentage", "parameter", "weight",
    "bias", "activation", "gradient", "loss", "learning_rate", "counter",
    "time", "derived",
)

_FORMAT_HINTS = {
    "probability": "{value:.2f}",
    "percentage": "{value:.0%}",
    "distance": "{value:.2f}",
    "angle": "{value:.1f}°",
    "learning_rate": "{value:.2e}",
    "loss": "{value:.4f}",
    "score": "{value:.2f}",
    "counter": "{value:d}",
    "time": "{value:.2f}s",
    "coordinate": "({value:.2f})",
}


def default_format(kind: str) -> str:
    """Default display template for a kind ('{value}' when untyped)."""
    return _FORMAT_HINTS.get(kind, "{value}")


def is_kind(kind: str) -> bool:
    return kind in KINDS


def interpolatable(kind: str) -> bool:
    """Kinds whose values blend numerically along keyframe drivers."""
    return kind in ("scalar", "distance", "angle", "probability", "score",
                    "percentage", "parameter", "weight", "bias", "activation",
                    "gradient", "loss", "learning_rate", "counter", "time",
                    "derived", "coordinate")
