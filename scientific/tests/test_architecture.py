"""Architecture tests (issue #32 §15: file length, boundaries, cycles).

Rules enforced:
  1. No production source file > 150 lines (tests and docs exempt).
  2. scientific/ir, registry, runtime, export, domains never import manim.
  3. No circular imports inside the scientific package.
  4. Only scientific.manim_adapter (and run.py) may import manim.
"""

from __future__ import annotations

import ast
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCIENTIFIC = REPO / "scientific"
MANIM_FREE = ("ir", "registry", "runtime", "export", "domains")

# The 150-line rule applies to files introduced/modified by THIS task
# (issue #32).  Pre-existing service files are tracked as legacy debt in
# docs/development/problems/PROBLEM-REGISTRY.md and belong to their issues.
PRODUCTION_ROOTS = [
    SCIENTIFIC,
    REPO / "presentation" / "scenes",
]


def production_files():
    for root in PRODUCTION_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if "node_modules" in path.parts or "tests" in path.parts:
                continue
            if path.suffix not in (".py", ".js", ".mjs", ".vue"):
                continue
            if path.name in ("media",):
                continue
            yield path


class FileLengthTests(unittest.TestCase):
    def test_no_production_file_exceeds_150_lines(self):
        offenders = []
        for path in production_files():
            count = len(path.read_text(encoding="utf-8").splitlines())
            if count > 150:
                offenders.append(f"{path.relative_to(REPO)}: {count} lines")
        self.assertEqual(
            offenders, [],
            "production files exceed the 150-line architectural limit: "
            + "; ".join(offenders))


class ManimBoundaryTests(unittest.TestCase):
    def test_core_layers_never_import_manim(self):
        offenders = []
        for layer in MANIM_FREE:
            for path in (SCIENTIFIC / layer).rglob("*.py"):
                if "tests" in path.parts:
                    continue
                tree = ast.parse(path.read_text(encoding="utf-8"))
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        names = [a.name for a in node.names]
                    elif isinstance(node, ast.ImportFrom) and node.module:
                        names = [node.module]
                    else:
                        continue
                    for name in names:
                        if name == "manim" or name.startswith("manim."):
                            offenders.append(str(path.relative_to(REPO)))
        self.assertEqual(offenders, [],
                          "manim imported outside manim_adapter: "
                          + ", ".join(sorted(set(offenders))))

    def test_only_adapter_imports_manim(self):
        allowed = {"manim_adapter"}
        offenders = []
        for path in SCIENTIFIC.rglob("*.py"):
            if "tests" in path.parts or path.name == "run.py":
                continue
            rel = path.relative_to(SCIENTIFIC)
            layer = rel.parts[0] if len(rel.parts) > 1 else path.stem
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    names = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom) and node.module:
                    names = [node.module]
                else:
                    continue
                if any(n == "manim" or n.startswith("manim.") for n in names):
                    if layer not in allowed:
                        offenders.append(str(rel))
        self.assertEqual(offenders, [])


HAS_MANIM = __import__("importlib.util", fromlist=["x"]).find_spec("manim") is not None


@unittest.skipUnless(HAS_MANIM, "manim not installed")
class ImportCycleTests(unittest.TestCase):
    def test_no_circular_imports(self):
        import importlib
        import pkgutil
        import scientific

        loaded = {}
        for module_info in pkgutil.walk_packages(
                scientific.__path__, prefix="scientific."):
            if ".tests" in module_info.name:
                continue
            try:
                loaded[module_info.name] = importlib.import_module(
                    module_info.name)
            except Exception as exc:  # pragma: no cover
                self.fail(f"cannot import {module_info.name}: {exc}")

        graph = {}
        for name, module in loaded.items():
            deps = set()
            for attr in vars(module).values():
                dep = getattr(attr, "__module__", None)
                if isinstance(dep, str) and dep.startswith("scientific.") \
                        and dep != name and ".tests" not in dep:
                    deps.add(dep)
            graph[name] = deps

        for start in graph:
            stack, seen = [start], set()
            while stack:
                current = stack.pop()
                for dep in graph.get(current, ()):
                    if dep == start:
                        self.fail(f"circular import: {start} -> {dep}")
                    if dep not in seen:
                        seen.add(dep)
                        stack.append(dep)


@unittest.skipUnless(HAS_MANIM, "manim not installed")
class RepoConventionTests(unittest.TestCase):
    def test_scene_files_use_canonical_bases(self):
        for path in sorted((REPO / "presentation" / "scenes").glob("*.py")):
            source = path.read_text(encoding="utf-8")
            self.assertIn(
                "get_scene", source,
                f"{path.name} must define get_scene() (scientific runtime)")
            self.assertIn(
                "scientific.run", source,
                f"{path.name} must be runnable via python -m scientific.run")

    def test_scene_classes_end_with_scene_suffix_for_detection(self):
        """Bases must satisfy the repo *Scene detection convention (#1)."""
        from scientific.manim_adapter import bases
        for name in ("BaseScientificScene",
                     "MovingCameraScientificScene",
                     "ThreeDScientificScene"):
            cls = getattr(bases, name)
            self.assertTrue(name.endswith("Scene"))
            self.assertTrue(hasattr(cls, "get_scene"))


if __name__ == "__main__":
    unittest.main()
