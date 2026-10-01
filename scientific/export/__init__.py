"""Deterministic export: IR -> runnable Python; import back to IR."""

from __future__ import annotations

from pathlib import Path
from typing import Union

from ..ir.document import SceneDocument
from .emitter import BASE_CLASSES, emit, scene_class_name

__all__ = ["emit", "scene_class_name", "BASE_CLASSES", "emit_to_file",
           "import_document"]


def emit_to_file(document: SceneDocument, path: Union[str, Path]) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(emit(document), encoding="utf-8")
    return path


def import_document(source: Union[str, Path]) -> SceneDocument:
    """Execute an emitted scene file and return its rebuilt document.

    This executes Python source — it is the documented advanced boundary for
    exported/hand-authored files (see RUNTIME-BOUNDARY.md). It is used by the
    round-trip tests and the CLI runner, never on untrusted input.
    """
    source_text = Path(source).read_text(encoding="utf-8") if _is_path(source) else source
    namespace: dict = {}
    exec(compile(source_text, "<scene>", "exec"), namespace)  # noqa: S102 (boundary)
    if "build" not in namespace:
        raise RuntimeError("scene file does not define build()")
    scene = namespace["build"]()
    return scene.document


def _is_path(value) -> bool:
    return isinstance(value, Path) or (
        isinstance(value, str) and value.endswith(".py") and "\n" not in value
        and len(value) < 300
    )
