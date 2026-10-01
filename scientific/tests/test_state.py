"""Reactive state engine tests (issue #4).

Covers: symbol binding, keyframe/series/static drivers, derived values
computed from true dependencies, multi-consumer synchronization, cycle
rejection, IR serialization round trips and the document -> engine bridge.
"""

from __future__ import annotations

import unittest

from scientific import SceneDocument, to_json, from_json
from scientific.ir import (
    AnnotationSpec, ComparisonSpec, DerivedSpec, MetricSpec,
    StateMachineSpec, StateSymbolSpec, TransitionSpec,
)
from scientific.ir.highlight import normalize_behaviors, split_subtarget
from scientific.state import (
    DriverError, KeyframeDriver, SeriesDriver, StateEngine, StaticDriver,
    driver_from, ease, engine_from_document,
)


class DriverTests(unittest.TestCase):
    def test_keyframe_interpolation_is_continuous(self):
        d = KeyframeDriver([(0, 0), (2, 10)], easing="linear")
        self.assertEqual(d.value_at(0), 0.0)
        self.assertEqual(d.value_at(1), 5.0)
        self.assertEqual(d.value_at(2), 10.0)
        self.assertEqual(d.value_at(5), 10.0)   # clamped
        self.assertEqual(d.value_at(-3), 0.0)   # clamped

    def test_keyframe_ordering_is_normalized(self):
        d = KeyframeDriver([(2, 10), (0, 0)], easing="smooth")
        self.assertEqual(d.value_at(0), 0.0)
        self.assertEqual(d.value_at(2), 10.0)

    def test_smooth_easing_hits_midpoint(self):
        self.assertAlmostEqual(ease("smooth", 0.5), 0.5)

    def test_easing_catalog(self):
        for name in ("linear", "smooth", "ease_in", "ease_out",
                     "ease_in_out", "bounce", "elastic"):
            self.assertEqual(ease(name, 0.0), 0.0)
            self.assertAlmostEqual(ease(name, 1.0), 1.0)
        with self.assertRaises(ValueError):
            ease("warp", 0.5)

    def test_series_driver(self):
        d = SeriesDriver([0, 1, 4], [0, 10, 20])
        self.assertEqual(d.value_at(0.5), 5.0)
        self.assertAlmostEqual(d.value_at(2), 10 + 10 * (1 / 3))  # 13.33
        self.assertEqual(d.value_at(9), 20.0)

    def test_driver_from_dict_round_trip(self):
        for d in (StaticDriver(3), KeyframeDriver([(0, 1), (2, 5)]),
                  SeriesDriver([0, 1], [1, 2])):
            self.assertEqual(driver_from(d.to_dict()).value_at(1.0),
                             d.value_at(1.0))

    def test_bad_driver_spec_rejected(self):
        with self.assertRaises(DriverError):
            KeyframeDriver([])
        with self.assertRaises(DriverError):
            driver_from({"kind": "warp_drive"})


class EngineTests(unittest.TestCase):
    def test_derived_updates_from_true_dependencies(self):
        eng = StateEngine()
        eng.bind("x", 0.0, driver=KeyframeDriver([(0, 0), (2, 10)]))
        eng.derive("dbl", "x * 2", {"x": "x"})
        self.assertEqual(eng.sample(1.0), {"x": 5.0, "dbl": 10.0})
        self.assertEqual(eng.sample(2.0), {"x": 10.0, "dbl": 20.0})

    def test_chained_derived_order_follows_dependencies(self):
        eng = StateEngine()
        eng.bind("t", 3.0)
        eng.derive("b", "t + 1", {"t": "t"})       # declared *before* a
        eng.derive("a", "b * 2", {"b": "b"})
        self.assertEqual(eng.sample(0)["a"], 8.0)

    def test_cycles_rejected(self):
        eng = StateEngine()
        eng.bind("a", 1)
        eng.derive("d1", "a + d2", {"a": "a", "d2": "d2"})
        eng.derive("d2", "d1 + 1", {"d1": "d1"})
        with self.assertRaises(Exception):
            eng.sample(0)

    def test_unresolvable_inputs_rejected(self):
        eng = StateEngine()
        eng.derive("d", "missing + 1", {"missing": "missing"})
        with self.assertRaises(Exception):
            eng.sample(0)

    def test_multiple_consumers_synchronized(self):
        eng = StateEngine()
        eng.bind("x", 0.0, driver=KeyframeDriver([(0, 0), (1, 10)]))
        seen = []
        eng.subscribe(lambda name, value: seen.append((name, value)))
        eng.set_value("x", 42.0)
        self.assertEqual(seen, [("x", 42.0)])
        self.assertEqual(eng.sample(9.0)["x"], 42.0)  # driver replaced

    def test_duplicate_declarations_rejected(self):
        eng = StateEngine()
        eng.bind("x", 1)
        with self.assertRaises(Exception):
            eng.bind("x", 2)
        with self.assertRaises(Exception):
            eng.derive("x", "1", {})

    def test_set_value_on_derived_rejected(self):
        eng = StateEngine()
        eng.bind("x", 1)
        eng.derive("y", "x + 1", {"x": "x"})
        with self.assertRaises(Exception):
            eng.set_value("y", 5)

    def test_dependency_queries(self):
        eng = StateEngine()
        eng.bind("x", 1)
        eng.derive("y", "x * 2", {"x": "x"})
        eng.derive("z", "y + x", {"y": "y", "x": "x"})
        self.assertEqual(eng.deps_of("z"), ["y", "x"])
        self.assertEqual(sorted(eng.dependents("x")), ["y", "z"])


class DocumentStateTests(unittest.TestCase):
    def _doc(self) -> SceneDocument:
        doc = SceneDocument("state_scene")
        doc.add_state_symbol(StateSymbolSpec(
            id="x", kind="scalar", value=0.0,
            driver={"kind": "keyframes", "keyframes": [[0, 0], [2, 10]],
                    "easing": "linear"}))
        doc.add_derived(DerivedSpec(id="dbl", expr="x * 2",
                                    inputs={"x": "x"}))
        doc.add_machine(StateMachineSpec(
            id="gd", states=[{"id": "initial", "label": "Initial"},
                             {"id": "updated", "label": "Updated"}],
            transitions=[TransitionSpec(id="t1", source="initial",
                                        target="updated", trigger="step",
                                        sets={"x": 4.0})],
            initial="initial"))
        doc.add_comparison(ComparisonSpec(
            id="cmp", kind="before_after", a=None, b=None,
            metrics=[MetricSpec(label="score", a=1.0, b=2.5)]))
        doc.add_annotation(AnnotationSpec(id="ann", target="x",
                                          provider="dbl"))
        return doc

    def test_state_section_round_trip(self):
        doc = self._doc()
        revived = from_json(to_json(doc))
        self.assertTrue(revived.semantic_equal(doc))
        eng = engine_from_document(revived)
        self.assertEqual(eng.sample(1.0)["dbl"], 10.0)

    def test_machine_semantics(self):
        doc = self._doc()
        machine = doc.machines["gd"]
        self.assertEqual(machine.initial, "initial")
        self.assertEqual(machine.transitions[0].sets, {"x": 4.0})

    def test_bad_state_kind_rejected(self):
        with self.assertRaises(Exception):
            StateSymbolSpec(id="bad", kind="vibes", value=1)

    def test_highlight_behavior_normalization(self):
        self.assertEqual(normalize_behaviors(["focus"]),
                         ["focus", "dim_others"])
        self.assertEqual(normalize_behaviors(["glow", "glow"]),
                         ["glow", "outline"])
        with self.assertRaises(Exception):
            normalize_behaviors(["teleport"])
        self.assertEqual(split_subtarget("graph_1.node:a"),
                         ("graph_1", "node:a"))


if __name__ == "__main__":
    unittest.main()
