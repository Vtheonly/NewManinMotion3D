"""Registry and runtime (authoring API, evaluator, bindings) tests."""

from __future__ import annotations

import unittest

from scientific import (
    DataRef, Derived, DuplicateRegistrationError, EvaluatorError, IRError,
    Literal, ScientificScene, Symbol, UnknownTypeError, evaluate,
    list_types, register_type, resolve, resolve_all, type_entry,
)
from scientific.registry import describe_types

MANIM_GUARD = unittest.skipIf(
    __import__("importlib.util", fromlist=["x"]).find_spec("manim") is None,
    "manim not installed")


class RegistryTests(unittest.TestCase):
    def test_builtins_registered(self):
        keys = [entry["key"] for entry in list_types()]
        for expected in ("ui.panel", "math.formula", "biology.protein",
                         "nn.network", "kinematics.torus", "attention.matrix",
                         "hud.fixed", "text.label", "math.matrix"):
            self.assertIn(expected, keys)

    def test_duplicate_rejected(self):
        with self.assertRaises(DuplicateRegistrationError):
            register_type("ui.panel", label="Again")

    def test_dotted_key_required(self):
        with self.assertRaises(IRError):
            register_type("plain", label="Nope")

    def test_property_schema_metadata(self):
        entry = type_entry("ui.stamp")
        self.assertIn("verdict", entry["properties"])
        self.assertEqual(entry["properties"]["verdict"]["type"], "str")

    def test_extension_registration(self):
        register_type("custom.orbit", label="Orbit",
                      dimensionality="3d",
                      properties={"radius": {"type": "float",
                                             "required": True}})
        self.assertIn("custom.orbit",
                      [e["key"] for e in describe_types()])

    def test_unknown_type_raises(self):
        with self.assertRaises(UnknownTypeError):
            type_entry("ghost.thing")

    def test_describe_types_has_inspector_metadata(self):
        for entry in describe_types():
            self.assertIn("label", entry)
            self.assertIn("properties", entry)
            self.assertIn("dimensionality", entry)


class AuthoringTests(unittest.TestCase):
    def _scene(self):
        scene = ScientificScene("auth", title="Auth", scene_type="scene_2d")
        return scene

    def test_node_and_properties(self):
        scene = self._scene()
        nid = scene.node("ui.panel", "panel", width=5.0, title="P")
        self.assertEqual(nid, "panel")
        self.assertEqual(scene.document.objects["panel"].properties["width"], 5.0)

    def test_unknown_parent_rejected(self):
        scene = self._scene()
        with self.assertRaises(IRError):
            scene.node("text.label", "lab", parent="ghost", text="x")

    def test_reserved_rotation_guard(self):
        scene = self._scene()
        with self.assertRaises(IRError):
            scene.node("attention.frame", "f", rotation=[1, 2, 3])

    def test_position_must_be_triple(self):
        scene = self._scene()
        with self.assertRaises(IRError):
            scene.node("ui.panel", "p", position=(1, 2))

    def test_formula_creates_expression_and_node(self):
        scene = self._scene()
        scene.formula("eq", "tau = J @ F", terms={"J": "J"},
                      highlights=["J"], fontSize=40)
        self.assertIn("eq", scene.document.expressions)
        self.assertIn("eq", scene.document.objects)
        self.assertEqual(scene.document.objects["eq"].type, "math.formula")

    def test_live_value_and_bindings(self):
        scene = self._scene()
        scene.live_value("v", Literal(2.5), format="{value:.1f}")
        scene.bind("theta", Literal(0.4))
        self.assertEqual(scene.document.bindings["theta"]["value"], 0.4)
        with self.assertRaises(IRError):
            scene.bind("theta", Literal(1.0))

    def test_relationship_builder(self):
        scene = self._scene()
        a = scene.node("ui.panel", "a")
        b = scene.node("ui.panel", "b")
        rid = scene.relationship(a, b, kind="distance", live=True)
        rel = scene.document.relationships[rid]
        self.assertEqual(rel.kind, "distance")
        self.assertEqual(rel.sources, ["a", "b"])
        self.assertTrue(rel.live)

    def test_stage_builder_steps(self):
        scene = self._scene()
        scene.node("ui.panel", "panel")
        with scene.stage(stage_id="s1", title="Intro") as st:
            st.show("panel").play("panel", "write", duration=2.0)
            st.highlight("panel", color="fail")
            st.annotate("panel", "note", duration=1.1)
            st.camera({"zoom": 1.2}, duration=2.0)
            st.transform("panel", {"width": 7.0})
            st.custom("print('x')")
            st.wait(0.3)
        steps = scene.document.timeline[0].steps
        ops = [s.op for s in steps]
        self.assertEqual(ops, ["show", "play", "highlight", "annotate",
                               "camera", "transform", "custom", "wait"])
        self.assertEqual(steps[1].duration, 2.0)
        self.assertEqual(steps[-2].code, "print('x')")

    def test_scene_validates_clean(self):
        scene = self._scene()
        scene.node("ui.grid", "grid", columns=2, rows=2)
        self.assertEqual(scene.validate(), [])

    def test_document_exportable(self):
        scene = self._scene()
        scene.node("ui.panel", "panel")
        text = scene.to_json()
        self.assertIn('"schema": "sci-ir/1"', text)


class EvaluatorTests(unittest.TestCase):
    def test_arithmetic(self):
        self.assertEqual(evaluate("1 + 2 * 3", {}), 7.0)
        self.assertAlmostEqual(evaluate("2 ** 10", {}), 1024.0)
        self.assertAlmostEqual(evaluate("7 / 2", {}), 3.5)

    def test_functions_and_constants(self):
        self.assertAlmostEqual(evaluate("sqrt(pi ** 2)", {}), 3.14159265, 5)
        self.assertAlmostEqual(evaluate("min(3, 1, 2)", {}), 1.0)
        self.assertAlmostEqual(evaluate("tanh(e)", {}), 0.9913287, 6)

    def test_variables(self):
        self.assertEqual(evaluate("a * b + 1", {"a": 2, "b": 5}), 11.0)

    def test_unknown_symbol(self):
        with self.assertRaises(EvaluatorError):
            evaluate("nope + 1", {})

    def test_unsafe_syntax_rejected(self):
        for evil in ("__import__('os')", "x.__class__", "[1,2][0]",
                     "lambda: 1", "(lambda: 1)()", "open('/etc/passwd')",
                     "True + 1", "'a' + 'b'"):
            with self.assertRaises(EvaluatorError):
                evaluate(evil, {})

    def test_division_by_zero(self):
        with self.assertRaises(EvaluatorError):
            evaluate("1 / 0", {})

    def test_bad_expression(self):
        with self.assertRaises(EvaluatorError):
            evaluate("", {})
        with self.assertRaises(EvaluatorError):
            evaluate("1 +", {})


class ResolveTests(unittest.TestCase):
    def test_literal_and_symbol(self):
        self.assertEqual(resolve(Literal(3)), 3)
        self.assertEqual(resolve(Symbol("a"), {"a": 9}), 9)

    def test_derived_chain(self):
        source = Derived("a * 2 + b", {"a": Literal(3),
                                       "b": Derived("c + 1",
                                                    {"c": Literal(4)})})
        self.assertEqual(resolve(source), 11.0)

    def test_cyclic_derived_rejected(self):
        a = {"kind": "derived", "expr": "b + 1",
             "inputs": {"b": {"kind": "derived", "expr": "a",
                              "inputs": {"a": {"kind": "symbol",
                                               "name": "a"}}}}}
        from scientific.runtime.resolve import BindingError
        with self.assertRaises(BindingError):
            resolve(a, {})

    def test_missing_data_ref(self):
        from scientific.runtime.resolve import BindingError
        with self.assertRaises(BindingError):
            resolve(DataRef("does/not/exist.json"))

    def test_path_traversal_rejected(self):
        from scientific.runtime.resolve import BindingError
        with self.assertRaises(BindingError):
            resolve(DataRef("../secrets.json"))

    def test_data_ref_fixture(self):
        value = resolve(DataRef("synth/protein.json", "energy"))
        self.assertIsInstance(value, (int, float))
        self.assertLess(value, 0)

    def test_resolve_all_order(self):
        bindings = {"x": Literal(1), "y": Derived("x + 1", {})}
        self.assertEqual(resolve_all(bindings), {"x": 1, "y": 2.0})

    def test_plain_values_pass_through(self):
        self.assertEqual(resolve(5), 5)
        self.assertEqual(resolve("text"), "text")

    def test_format_value(self):
        from scientific import format_value
        self.assertEqual(format_value("ΔG = {value:.2f}", -4.213),
                         "ΔG = -4.21")
        self.assertEqual(format_value("{value:.0%}", 0.4166), "42%")


if __name__ == "__main__":
    unittest.main()
