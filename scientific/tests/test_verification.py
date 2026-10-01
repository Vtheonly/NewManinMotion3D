"""End-to-end render verification tests (issue #28).

Renders representative scenes through the real pipeline (subprocess manim):
a 2D scene, a 3D scene, a HUD scene and the Suprepto fixture; asserts the
MP4 exists, diagnostics content is correct and double-renders are
frame-identical (deterministic reproducibility within the documented
renderer tolerance — our scenes are seeded/closed-form, so byte-exact).
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCENES = REPO / "presentation" / "scenes"
FIXTURES = REPO / "services" / "api" / "tests" / "fixtures" / "ir"

HAS_MANIM = __import__("importlib.util", fromlist=["x"]).find_spec(
    "manim") is not None


def _run(args, cwd=REPO, timeout=360):
    env = {"PYTHONPATH": str(REPO), "PATH": "/usr/bin:/bin",
           "HOME": "/home/z"}
    return subprocess.run([sys.executable, "-m", "scientific.run", *args],
                          capture_output=True, text=True, cwd=cwd, env=env,
                          timeout=timeout)


@unittest.skipUnless(HAS_MANIM, "manim not installed")
class RenderVerificationTests(unittest.TestCase):
    def test_reference_2d_scene_renders(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = _run([str(SCENES / "synth_wall.py"),
                           "SynthesizabilityWall", "--quality", "low",
                           "--media_dir", str(Path(tmp) / "m")])
            self.assertEqual(result.returncode, 0,
                             result.stdout[-800:] + result.stderr[-800:])
            videos = [p for p in (Path(tmp) / "m").rglob("*.mp4")
                      if "partial_movie" not in str(p)]
            self.assertTrue(videos, "no final MP4 produced")

    def test_reference_3d_scene_renders(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = _run([str(SCENES / "slide_02_torus_poe_kinematics.py"),
                           "TorusPoEKinematics", "--quality", "low",
                           "--media_dir", str(Path(tmp) / "m")])
            self.assertEqual(result.returncode, 0,
                             result.stdout[-800:] + result.stderr[-800:])
            videos = [p for p in (Path(tmp) / "m").rglob("*.mp4")
                      if "partial_movie" not in str(p)]
            self.assertTrue(videos, "3D scene produced no MP4")

    def test_suprepto_fixture_renders_with_diagnostics(self):
        """Frontend-export path: the parity fixture (emitted Python)."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            scene_file = tmp / "suprepto.py"
            scene_file.write_text(
                (FIXTURES / "suprepto_demo.py").read_text(), encoding="utf-8")
            result = _run([str(scene_file), "SupreptoDemo", "--quality",
                           "low", "--diagnostics",
                           "--media_dir", str(tmp / "m")])
            self.assertEqual(result.returncode, 0,
                             result.stdout[-800:] + result.stderr[-800:])
            diag = json.loads((tmp / "m" / "diagnostics.json").read_text())
            self.assertEqual(diag["config"]["scene"], "suprepto_demo")
            self.assertTrue(diag["records"], "diagnostics has no records")
            self.assertTrue(any("x" == c.get("symbol")
                                for c in diag["stateLog"]),
                            "state changes not recorded")
            self.assertTrue(any(r.get("op") == "interpolate"
                                for r in diag["records"]),
                            "interpolate step not recorded")

    def test_deterministic_rerun_same_frame_hash(self):
        """Issue #28 acceptance: rerun produces stable output."""
        from scientific.verify import verify_document_render
        report = verify_document_render(
            FIXTURES / "suprepto_demo.py", "SupreptoDemo", quality="low")
        self.assertEqual(report["validationErrors"], [])
        self.assertTrue(report["reproducible"],
                        "double render produced different frames")

    def test_dry_run_validates_document(self):
        result = _run([str(SCENES / "slide_02_torus_poe_kinematics.py"),
                       "--dry_run"])
        self.assertEqual(result.returncode, 0)
        self.assertIn("valid=True", result.stdout)


if __name__ == "__main__":
    unittest.main()
