"""Schema identity for the canonical scientific scene IR.

Documents are versioned with ``"sci-ir/<major>"``.  The major number changes
only when a document written by an older runtime can no longer be loaded
without migration.  See docs/development/syntax/VERSIONING.md.
"""

from __future__ import annotations

from .errors import SchemaError

SCHEMA_ID = "sci-ir"
SCHEMA_VERSION = 1
SCHEMA = f"{SCHEMA_ID}/{SCHEMA_VERSION}"

# Scene types mirror the compiler scene registry (issue #1) so visual and
# scientific projects share one vocabulary.
SCENE_TYPES = ("scene_2d", "moving_camera", "three_d", "custom")

# Coordinate spaces.  scene2d = manim camera plane, world3d = 3D world.
SPACES = ("scene2d", "world3d")

# Timeline step operations (see ir/timeline.py).
STEP_OPS = (
    "show", "play", "highlight", "annotate", "wait",
    "camera", "transform", "custom",
    # Suprepto state/machine/comparison extensions (#4/#5/#11):
    "set", "interpolate", "transition", "compare",
)

# Animation verbs accepted by the "play" op (rendered by manim_adapter).
ANIMATION_NAMES = (
    "write", "create", "uncreate", "fade_in", "fade_out",
    "grow", "indicate", "draw", "shift_in",
)

# Rates accepted by "play"/"interpolate" steps.
RATE_NAMES = (
    "linear", "smooth", "ease_in", "ease_out", "ease_in_out",
    "there_and_back", "rush_into", "rush_from",
)


def parse_schema(value: str) -> tuple[str, int]:
    """Split a schema string into (id, major). Raises SchemaError if malformed."""
    if not isinstance(value, str) or value.count("/") != 1:
        raise SchemaError(str(value), SCHEMA)
    name, raw_major = value.split("/")
    try:
        major = int(raw_major)
    except ValueError:
        raise SchemaError(value, SCHEMA) from None
    if major < 1:
        raise SchemaError(value, SCHEMA)
    return name, major


def check_schema(value: str) -> None:
    """Raise SchemaError unless `value` is exactly this runtime's schema.

    Future majors raise with a migration pointer rather than silently loading.
    """
    name, major = parse_schema(value)
    if name != SCHEMA_ID:
        raise SchemaError(value, SCHEMA)
    if major != SCHEMA_VERSION:
        raise SchemaError(value, SCHEMA)
