"""Reproducibility verification (issue #28).

``verify_document_render`` renders a scene file twice through the real
Manim pipeline and compares the SHA-256 of every produced frame (PNG
sequence — MP4 containers embed encoder timestamps, so frame content is
the deterministic quantity).  Suprepto numerics are seeded/closed-form,
so identical inputs must yield identical frames.
"""

from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

QUALITY_FLAGS = {
    "low": "-ql", "medium": "-qm", "high": "-qh",
    "production": "-qp", "4k": "-qk",
}


def _render(path: Path, scene_name: str, media_dir: Path,
            quality: str) -> list[Path]:
    cmd = [sys.executable, "-m", "manim", "--disable_caching",
           "--format=png", QUALITY_FLAGS.get(quality, "-ql"),
           "--media_dir", str(media_dir), str(path), scene_name]
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(
        p for p in (str(_repo_root(path)), env.get("PYTHONPATH")) if p)
    completed = subprocess.run(cmd, env=env, cwd=str(path.parent),
                              capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(f"render failed: {completed.stderr[-800:]}")
    frames = sorted(media_dir.rglob("*.png"))
    if not frames:
        raise RuntimeError("render produced no frames")
    return frames


def _frames_digest(frames: list[Path]) -> str:
    digest = hashlib.sha256()
    for frame in frames:
        digest.update(frame.name.encode("utf-8"))
        with frame.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 16), b""):
                digest.update(chunk)
    return digest.hexdigest()


def verify_document_render(path, scene_name: str, quality: str = "low",
                           media_dir: Optional[str] = None) -> dict:
    """Render twice; report frame hashes, reproducibility and validation."""
    from .ir import validate_document

    scene_path = Path(path)
    validation_errors: list = []
    document = _try_document(scene_path)
    if document is not None:
        validation_errors = validate_document(document)

    out_dir = Path(media_dir) if media_dir else Path(tempfile.mkdtemp(
        prefix="suprepto-verify-"))
    first = _frames_digest(_render(scene_path, scene_name, out_dir, quality))
    second = _frames_digest(_render(scene_path, scene_name, out_dir, quality))
    total_bytes = sum(f.stat().st_size for f in out_dir.rglob("*.png"))

    return {
        "scene": scene_name,
        "file": str(scene_path),
        "hash": first,
        "hash2": second,
        "bytes": total_bytes,
        "reproducible": first == second,
        "validationErrors": validation_errors,
        "mediaDir": str(out_dir),
    }


def _try_document(scene_path: Path):
    """Best-effort document extraction for validation (never fatal)."""
    try:
        from .export import import_document
        return import_document(scene_path)
    except Exception:
        return None


def _repo_root(scene_path: Path) -> Path:
    """Walk up from a scene file until the scientific package is visible."""
    for candidate in (scene_path.parent, *scene_path.parents):
        if (candidate / "scientific" / "__init__.py").is_file():
            return candidate
    return scene_path.parent
