"""
Scene Detection Tests (renderer)

Pure-stdlib tests — no Manim installation required.
Run:  python -m unittest discover -s services/renderer/tests -v
  or: python -m unittest test_scene_detect -v   (from services/renderer/tests)

Covers the Issue #1 testing requirements for renderer-side scene detection:
  - known scene bases (Scene, MovingCameraScene, ThreeDScene, ...)
  - custom scene class names (subclasses of *Scene bases)
  - non-scene classes are ignored (VMobject, object, plain helpers)
  - commented-out / string-embedded class definitions are ignored
  - multiple scenes -> first-in-source picking / requested-name priority
  - unparseable / empty sources
"""

import os
import sys
import unittest

# Make scene_detect.py importable regardless of the working directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scene_detect import detect_scenes, pick_scene


class DetectScenesTests(unittest.TestCase):
    def test_standard_scene(self):
        src = "from manim import *\n\nclass MainScene(Scene):\n    def construct(self):\n        pass\n"
        scenes = detect_scenes(src)
        self.assertEqual(len(scenes), 1)
        self.assertEqual(scenes[0]["name"], "MainScene")
        self.assertEqual(scenes[0]["sceneType"], "scene_2d")
        self.assertTrue(scenes[0]["known"])

    def test_moving_camera_scene(self):
        src = "class Cam(MovingCameraScene):\n    pass\n"
        scenes = detect_scenes(src)
        self.assertEqual(scenes[0]["sceneType"], "moving_camera")

    def test_three_d_scene(self):
        src = "class Three(ThreeDScene):\n    pass\n"
        scenes = detect_scenes(src)
        self.assertEqual(scenes[0]["sceneType"], "three_d")

    def test_custom_scene_subclass(self):
        src = (
            "class MyBaseScene(Scene):\n    pass\n\n"
            "class Demo(MyBaseScene):\n    def construct(self):\n        pass\n"
        )
        scenes = detect_scenes(src)
        self.assertEqual([s["name"] for s in scenes], ["MyBaseScene", "Demo"])
        self.assertFalse(scenes[1]["known"])  # custom base, not in known list
        self.assertIsNone(scenes[1]["sceneType"])

    def test_dotted_base(self):
        src = "class D(manim.Scene):\n    pass\n"
        scenes = detect_scenes(src)
        self.assertEqual(scenes[0]["name"], "D")

    def test_non_scene_classes_ignored(self):
        src = (
            "class Helper:\n    pass\n\n"
            "class Shape(VMobject):\n    pass\n\n"
            "class Foo(object, metaclass=type):\n    pass\n"
        )
        self.assertEqual(detect_scenes(src), [])

    def test_commented_and_string_classes_ignored(self):
        src = (
            "# class Ghost(Scene):\n"
            "#     pass\n"
            'doc = """\n'
            "class StringScene(Scene):\n"
            "    pass\n"
            '"""\n'
            "class Real(Scene):\n    pass\n"
        )
        scenes = detect_scenes(src)
        self.assertEqual([s["name"] for s in scenes], ["Real"])

    def test_multiple_scenes_source_order(self):
        src = (
            "class A(Scene):\n    pass\n\n"
            "class B(ThreeDScene):\n    pass\n\n"
            "class C(Scene):\n    pass\n"
        )
        scenes = detect_scenes(src)
        self.assertEqual([s["name"] for s in scenes], ["A", "B", "C"])

    def test_syntax_error_returns_empty(self):
        self.assertEqual(detect_scenes("class Broken((("), [])

    def test_empty_source(self):
        self.assertEqual(detect_scenes(""), [])
        self.assertEqual(detect_scenes("   \n  "), [])


class PickSceneTests(unittest.TestCase):
    SRC = (
        "from manim import *\n\n"
        "class First(Scene):\n    pass\n\n"
        "class Second(ThreeDScene):\n    pass\n"
    )

    def test_requested_name_found(self):
        picked = pick_scene(self.SRC, "Second")
        self.assertEqual(picked["name"], "Second")
        self.assertFalse(picked["detected"])

    def test_requested_name_missing_falls_back(self):
        picked = pick_scene(self.SRC, "DoesNotExist")
        self.assertEqual(picked["name"], "First")
        self.assertTrue(picked["detected"])

    def test_no_request_picks_first(self):
        picked = pick_scene(self.SRC, None)
        self.assertEqual(picked["name"], "First")

    def test_no_scenes(self):
        self.assertIsNone(pick_scene("x = 1", None))


if __name__ == "__main__":
    unittest.main()
