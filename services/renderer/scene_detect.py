"""
Scene Detection (Python, AST-based)

Identifies renderable Manim scene classes inside arbitrary Python source
WITHOUT executing it. Used by the render worker as the authoritative
fallback when a job's scene name is missing or does not exist in the file.

Detection rules (mirrors services/api/src/compiler/sceneDetect.js — keep the
two implementations behaviourally aligned; cross-checked by tests):

  1. Parse the source with the stdlib `ast` module (never exec).
  2. Collect top-level (and nested) `class` definitions.
  3. A class is a *renderable scene* when at least one direct base:
       a. is a known Manim scene base (KNOWN_SCENE_BASES), or
       b. follows the `*Scene` naming convention (custom subclasses).
  4. Classes inheriting from non-scene bases (VMobject, Mobject, object,
     enum, ...) are never treated as scenes.

The worker picks: requested scene name if present -> else first detected
scene (source order, matching `ast` walk order).
"""

from __future__ import annotations

import ast
from typing import List, Optional

# Manim CE scene base classes that are directly renderable.
KNOWN_SCENE_BASES = (
    "Scene",
    "MovingCameraScene",
    "ThreeDScene",
    "VectorScene",
    "ZoomedScene",
    "SampleSpaceScene",
    "LinearTransformationScene",
)


def _base_name(base: ast.expr) -> Optional[str]:
    """Extract a dotted base-class name from an AST expression."""
    if isinstance(base, ast.Name):
        return base.id
    if isinstance(base, ast.Attribute):
        parent = _base_name(base.value)
        return f"{parent}.{base.attr}" if parent else base.attr
    return None  # Subscript / Call / Starred bases are not simple names


def _looks_like_scene_base(name: str) -> bool:
    short = name.split(".")[-1]
    return short in KNOWN_SCENE_BASES or short.endswith("Scene")


def detect_scenes(source: str) -> List[dict]:
    """
    Detect renderable scene classes in Python source.

    Returns a list of dicts (source order):
        { "name": str, "bases": [str], "sceneType": str | None, "known": bool }

    Never raises on unparseable source — returns [] (the caller decides how
    to report the failure; manim itself will surface syntax errors).
    """
    if not source or not source.strip():
        return []

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    scenes: List[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue

        bases = [n for n in (_base_name(b) for b in node.bases) if n]
        for base in bases:
            short = base.split(".")[-1]
            if _looks_like_scene_base(base):
                scenes.append(
                    {
                        "name": node.name,
                        "bases": bases,
                        "sceneType": _scene_type_for_base(short),
                        "known": short in KNOWN_SCENE_BASES,
                    }
                )
                break  # list each class once even with multiple scene bases

    return scenes


def _scene_type_for_base(base_class: str) -> Optional[str]:
    """Map a Python base class name to a project scene-type key."""
    return {
        "Scene": "scene_2d",
        "MovingCameraScene": "moving_camera",
        "ThreeDScene": "three_d",
    }.get(base_class)


def pick_scene(source: str, requested_name: Optional[str] = None) -> Optional[dict]:
    """
    Pick the scene to render.

    Priority: explicit requested name (if it exists in the file) -> first
    detected scene. Returns {"name": str, "detected": bool} or None.
    """
    scenes = detect_scenes(source)
    if not scenes:
        return None

    if requested_name:
        for s in scenes:
            if s["name"] == requested_name:
                return {"name": s["name"], "detected": False}

    return {"name": scenes[0]["name"], "detected": True}
