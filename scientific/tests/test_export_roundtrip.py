"""Export, round-trip and execution contract tests.

Round trip: IR -> Python -> exec -> IR must be semantically identical, and
emission must be byte-deterministic.  Execution tests render emitted Python
through the real Manim pipeline (skipped when manim is unavailable).
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path

from scientific import (
    DataRef, Derived, Literal, ScientificScene, SceneDocument, from_json,
    to_json, validate_document,
)
from scientific.export import emit, emit_to_file, import_document
from scientific.export.emitter import BASE_CLASSES, scene_class_name

REPO = Path(__file__).resolve().parents[2]
SCENES = REPO / "presentation" / "scenes"
HAS_MANIM = importlib.util.find_spec("manim") is not None
HAS_VENV = Path("/home/z/venv-sci/bin/python").exists()
PYTHON = "/home/z/venv-sci/bin/python" if HAS_VENV else sys.executable


def sample_document(scene_type="scene_2d", camera=None) -> SceneDocument:
    scene = ScientificScene("sample_scene", title="Sample",
                            scene_type=scene_type, camera=camera)
    scene.node("ui.panel", "panel", width=6.0, height=3.0, title="Panel",
               position=(-2.5, 1.0, 0.0))
    scene.node("text.label", "caption", text="hello", fontSize=24,
               position=(-2.5, 2.6, 0.0))
    scene.formula("eq", "tau = J(theta).T @ F",
                  terms={"Jt": "J(theta).T"},
                  bindings={"theta": Literal(0.6)},
                  highlights=["Jt"], fontSize=40,
                  position=(2.0, -0.5, 0.0))
    scene.live_value("energy",
                     Derived("a * b + 1",
                             {"a": Literal(2), "b": Literal(3)}),
                     format="E = {value:.2f}")
    scene.live_value("hero", DataRef("synth/protein.json", "energy"),
                     format="ΔG = {value:.2f}")
    scene.bind("theta", Literal(0.6))
    scene.relationship("panel", "eq", id="link", kind="arrow",
                       live=True, color="accent")
    with scene.stage(stage_id="s1", title="Intro") as st:
        st.show("panel").play("eq", "write", duration=1.5)
        st.highlight("eq", color="warn")
        st.annotate("panel", "E = {energy}", duration=1.0)
        st.camera({"zoom": 0.85}, duration=2.0)
        st.transform("panel", {"width": 7.0}, duration=1.2)
        st.custom("print('custom code preserved')")
    return scene.document


@unittest.skipUnless(HAS_MANIM, "emitted files import the manim adapter base")
class RoundTripTests(unittest.TestCase):
    def test_sample_round_trip_semantic_equality(self):
        for scene_type, camera in (
            ("scene_2d", None),
            ("moving_camera", {"zoom": 0.9}),
            ("three_d", {"phi": 70, "theta": -40, "distance": 11.0}),
        ):
            doc = sample_document(scene_type, camera)
            self.assertEqual(validate_document(doc), [])
            rebuilt = import_document(emit(doc))
            self.assertTrue(rebuilt.semantic_equal(doc),
                            f"round trip diverged for {scene_type}")

    def test_emit_is_deterministic(self):
        doc = sample_document()
        self.assertEqual(emit(doc), emit(doc))

    def test_emit_to_file(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            path = emit_to_file(doc := sample_document(), Path(tmp) / "x.py")
            self.assertTrue(path.exists())
            self.assertEqual(import_document(path.read_text()).semantic_equal(doc), True)

    def test_class_naming(self):
        self.assertEqual(scene_class_name("synthesizability_wall"),
                         "SynthesizabilityWall")
        self.assertEqual(scene_class_name("tif_attention"), "TifAttention")

    def test_base_class_per_scene_type(self):
        self.assertEqual(BASE_CLASSES["scene_2d"], "BaseScientificScene")
        self.assertEqual(BASE_CLASSES["moving_camera"],
                         "MovingCameraScientificScene")
        self.assertEqual(BASE_CLASSES["three_d"], "ThreeDScientificScene")

    def test_custom_code_preserved_verbatim(self):
        doc = sample_document()
        code = [s.code for s in doc.timeline[0].steps
                if s.op == "custom"][0]
        self.assertIn(code, emit(doc))

    def test_emitted_source_compiles(self):
        compile(emit(sample_document()), "<emitted>", "exec")

    def test_json_save_reload_round_trip(self):
        doc = sample_document()
        reloaded = from_json(to_json(doc))
        self.assertTrue(reloaded.semantic_equal(doc))
        self.assertTrue(import_document(emit(reloaded)).semantic_equal(doc))

    def test_scalar_formatting_rules(self):
        from scientific.export.literals import format_float, py_literal
        # canonical: integral floats emit as ints (JSON erases 3.0 vs 3)
        self.assertEqual(format_float(6.0), "6")
        self.assertEqual(format_float(0.1), "0.1")
        self.assertEqual(py_literal(True), "True")
        self.assertEqual(py_literal(None), "None")
        self.assertEqual(py_literal({"b": "x", "a": [1, 2.5]}),
                         '{"a": [1, 2.5], "b": "x"}')
        with self.assertRaises(ValueError):
            format_float(float("inf"))


@unittest.skipUnless(HAS_MANIM, "manim not installed")
class ReferenceSceneTests(unittest.TestCase):
    """The three reference scenes: build, validate, and export round trip."""

    def _load(self, filename):
        path = SCENES / filename
        spec = importlib.util.spec_from_file_location(path.stem, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_all_reference_documents_valid(self):
        expected = {
            "synth_wall.py": ("SynthesizabilityWall", 55),
            "slide_01_tif_attention.py": ("TifAttention", 14),
            "slide_02_torus_poe_kinematics.py": ("TorusPoEKinematics", 6),
        }
        for filename, (cls_name, min_objects) in expected.items():
            module = self._load(filename)
            scene = getattr(module, cls_name)().get_scene()
            doc = scene.document
            self.assertEqual(validate_document(doc), [],
                             f"{filename} failed validation")
            self.assertGreaterEqual(len(doc.objects), min_objects)

    def test_reference_round_trip_via_export(self):
        for filename, cls_name in (
            ("synth_wall.py", "SynthesizabilityWall"),
            ("slide_01_tif_attention.py", "TifAttention"),
            ("slide_02_torus_poe_kinematics.py", "TorusPoEKinematics"),
        ):
            module = self._load(filename)
            doc = getattr(module, cls_name)().get_scene().document
            rebuilt = import_document(emit(doc))
            self.assertTrue(rebuilt.semantic_equal(doc),
                            f"export round trip diverged for {filename}")

    def test_reference_custom_steps_survive_export(self):
        module = self._load("slide_02_torus_poe_kinematics.py")
        doc = getattr(module, "TorusPoEKinematics")().get_scene().document
        customs = [s.code for s in doc.timeline[1].steps
                   if s.op == "custom"]
        source = emit(doc)
        for code in customs:
            self.assertIn(code, source)


@unittest.skipUnless(HAS_MANIM and HAS_VENV, "manim runtime not available")
class ExecutionTests(unittest.TestCase):
    """Exported Python must actually execute (the real Manim pipeline)."""

    def test_emitted_scene_renders(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            doc = sample_document()
            scene_file = tmp / "emitted_scene.py"
            scene_file.write_text(emit(doc), encoding="utf-8")
            result = subprocess.run(
                [PYTHON, "-m", "scientific.run", str(scene_file),
                 "SampleScene", "--quality", "low",
                 "--media_dir", str(tmp / "media")],
                capture_output=True, text=True, cwd=REPO,
                env={"PYTHONPATH": str(REPO), "PATH": "/usr/bin:/bin",
                     "HOME": "/home/z"},
                timeout=360,
            )
            self.assertEqual(result.returncode, 0,
                             f"render failed:\n{result.stdout[-2000:]}\n"
                             f"{result.stderr[-2000:]}")
            videos = list((tmp / "media").rglob("*.mp4"))
            videos = [v for v in videos if "partial_movie" not in str(v)]
            self.assertTrue(videos, "no final video produced")

    def test_runner_lists_scenes(self):
        result = subprocess.run(
            [PYTHON, "-m", "scientific.run",
             str(SCENES / "synth_wall.py"), "--list"],
            capture_output=True, text=True, cwd=REPO,
            env={"PYTHONPATH": str(REPO), "PATH": "/usr/bin:/bin",
                 "HOME": "/home/z"},
            timeout=120,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("SynthesizabilityWall", result.stdout)

    def test_runner_dry_run(self):
        result = subprocess.run(
            [PYTHON, "-m", "scientific.run",
             str(SCENES / "slide_02_torus_poe_kinematics.py"),
             "--dry_run"],
            capture_output=True, text=True, cwd=REPO,
            env={"PYTHONPATH": str(REPO), "PATH": "/usr/bin:/bin",
                 "HOME": "/home/z"},
            timeout=120,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("valid=True", result.stdout)

    def test_runner_rejects_missing_scene(self):
        result = subprocess.run(
            [PYTHON, "-m", "scientific.run", str(SCENES / "synth_wall.py"),
             "NotAScene", "--list"],
            capture_output=True, text=True, cwd=REPO,
            env={"PYTHONPATH": str(REPO), "PATH": "/usr/bin:/bin",
                 "HOME": "/home/z"},
            timeout=120,
        )
        self.assertEqual(result.returncode, 0)  # --list ignores scene name


if __name__ == "__main__":
    unittest.main()
