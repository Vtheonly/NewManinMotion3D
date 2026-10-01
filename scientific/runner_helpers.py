"""Runner helpers (split from run.py — 150-line rule)."""

from __future__ import annotations

from pathlib import Path

def _repo_root(scene_path: Path) -> Path:
    """Walk up from a scene file until the scientific package is visible."""
    for candidate in (scene_path.parent, *scene_path.parents):
        if (candidate / "scientific" / "__init__.py").is_file():
            return candidate
    return scene_path.parent


def _document_of(scene_cls):
    from .ir.document import SceneDocument
    from .runtime.authoring import ScientificScene
    scene = scene_cls().get_scene()
    if isinstance(scene, (SceneDocument, ScientificScene)):
        return getattr(scene, "document", scene)
    raise TypeError("get_scene() must return a ScientificScene or document")


def _validate(document) -> list:
    from .ir import validate_document
    return validate_document(document)
