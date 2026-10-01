"""Canonical CLI/execution contract (issue #32 §16).

    python -m scientific.run presentation/scenes/synth_wall.py SynthesizabilityWall
    python -m scientific.run scene.py --list
    python scene.py                 # via the __main__ guard in emitted files

Delegates the actual render to the Manim CLI (`python -m manim …`) so the
runner and the Code-Only renderer share one execution path.  Quality presets
mirror the renderer worker: low/medium/high/production/4k.
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import subprocess
import sys
from pathlib import Path

QUALITY_FLAGS = {
    "low": "-ql", "medium": "-qm", "high": "-qh",
    "production": "-qp", "4k": "-qk",
}


def _load_module(path: Path):
    spec = importlib.util.spec_from_file_location(f"scene_{path.stem}", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot import scene file {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _scene_classes(module):
    from .manim_adapter.bases import ScientificRenderMixin
    found = []
    for name in dir(module):
        obj = getattr(module, name)
        if (isinstance(obj, type) and issubclass(obj, ScientificRenderMixin)
                and obj is not ScientificRenderMixin and getattr(obj, "__module__", "") == module.__name__):
            found.append((name, obj))
    return found


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m scientific.run",
        description="Render a scientific scene file through Manim CE.")
    parser.add_argument("file", help="path to a .py scene file")
    parser.add_argument("scene", nargs="?", default=None,
                        help="scene class name (default: first found)")
    parser.add_argument("--list", action="store_true",
                        help="list scene classes and exit")
    parser.add_argument("--quality", choices=sorted(QUALITY_FLAGS),
                        default="low")
    parser.add_argument("--media_dir", default=None,
                        help="override manim media output directory")
    parser.add_argument("--dry_run", action="store_true",
                        help="build the scene document only (no render)")
    args = parser.parse_args(argv)

    path = Path(args.file).resolve()
    if not path.is_file():
        print(f"error: scene file not found: {path}", file=sys.stderr)
        return 2
    module = _load_module(path)

    if args.list:
        names = [name for name, _ in _scene_classes(module)]
        print("\n".join(names) if names else "(no scientific scenes found)")
        return 0

    scenes = _scene_classes(module)
    if not scenes:
        print(f"error: no scientific scene classes in {path}", file=sys.stderr)
        return 3
    if args.scene:
        match = [cls for name, cls in scenes if name == args.scene]
        if not match:
            available = ", ".join(n for n, _ in scenes)
            print(f"error: scene {args.scene!r} not found "
                  f"(available: {available})", file=sys.stderr)
            return 4
    else:
        match = [scenes[0][1]]

    scene_cls = match[0]
    if args.dry_run:
        document = _document_of(scene_cls)
        print(f"document {document.id!r}: {len(document.objects)} objects, "
              f"{len(document.timeline)} stages, valid="
              f"{not _validate(document)}")
        return 0

    cmd = [sys.executable, "-m", "manim", QUALITY_FLAGS[args.quality]]
    if args.media_dir:
        cmd += ["--media_dir", args.media_dir]
    cmd += [str(path), scene_cls.__name__]
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(
        p for p in (str(path.parents[1] if path.parent.name == "scenes"
                        else path.parent.parent), env.get("PYTHONPATH")) if p)
    print(f"[scientific.run] {' '.join(cmd)}")
    completed = subprocess.run(cmd, env=env, cwd=str(path.parent))
    return completed.returncode


def _document_of(scene_cls):
    from .ir.document import SceneDocument
    from .runtime.authoring import ScientificScene
    scene = scene_cls().get_scene()
    if isinstance(scene, SceneDocument):
        return scene
    if isinstance(scene, ScientificScene):
        return scene.document
    raise TypeError("get_scene() must return a ScientificScene or document")


def _validate(document) -> list:
    from .ir import validate_document
    return validate_document(document)


if __name__ == "__main__":
    raise SystemExit(main())
