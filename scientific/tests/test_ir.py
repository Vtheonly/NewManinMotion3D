"""IR schema, document, validation and serialization tests."""

from __future__ import annotations

import unittest

from scientific import (
    SCHEMA, Expression, IRError, Relationship, SceneDocument, SceneNode,
    Stage, Step, ValidationError, from_json, to_json, validate_document,
)
from scientific.ir.schema import check_schema, parse_schema


class SchemaTests(unittest.TestCase):
    def test_current_schema_accepted(self):
        check_schema(SCHEMA)

    def test_parse(self):
        self.assertEqual(parse_schema("sci-ir/2"), ("sci-ir", 2))

    def test_rejects_unknown_id(self):
        with self.assertRaises(IRError):
            check_schema("other-thing/1")

    def test_rejects_future_major(self):
        with self.assertRaises(IRError):
            check_schema("sci-ir/2")

    def test_rejects_garbage(self):
        for bad in ("", "sci-ir", "sci-ir/1/2", "sci-ir/x"):
            with self.assertRaises(IRError):
                check_schema(bad)


class DocumentTests(unittest.TestCase):
    def _doc(self):
        doc = SceneDocument("demo", title="Demo")
        doc.add_node(SceneNode("panel", "ui.panel",
                               properties={"width": 4.0}))
        doc.add_node(SceneNode("child", "text.label",
                               properties={"text": "hi"},
                               parent_id="panel"))
        return doc

    def test_duplicate_ids_rejected(self):
        doc = self._doc()
        with self.assertRaises(IRError):
            doc.add_node(SceneNode("panel", "ui.panel"))

    def test_unknown_scene_type_rejected(self):
        with self.assertRaises(IRError):
            SceneDocument("x", scene_type="scene_4d")

    def test_parent_chain(self):
        doc = self._doc()
        self.assertEqual(doc.parent_chain("child"), ["panel"])
        self.assertEqual(doc.parent_chain("panel"), [])

    def test_cycle_detection(self):
        doc = SceneDocument("c")
        doc.add_node(SceneNode("a", "core.group", parent_id="b"))
        doc.add_node(SceneNode("b", "core.group", parent_id="a"))
        self.assertEqual(sorted(doc.has_parent_cycles()), ["a", "b"])

    def test_expression_pairs_get_formula_node(self):
        doc = SceneDocument("f")
        doc.add_expression(Expression("eq", "a = b"))
        self.assertIn("eq", doc.objects)
        self.assertEqual(doc.objects["eq"].type, "math.formula")

    def test_roundtrip_json(self):
        doc = self._doc()
        doc.add_stage(Stage("s1", "Title", steps=[Step(op="show", target="panel")]))
        doc2 = from_json(to_json(doc))
        self.assertTrue(doc2.semantic_equal(doc))

    def test_deterministic_serialization(self):
        doc = self._doc()
        self.assertEqual(to_json(doc), to_json(from_json(to_json(doc))))

    def test_semantic_equal_negative(self):
        doc1 = self._doc()
        doc2 = self._doc()
        doc2.add_node(SceneNode("extra", "core.group"))
        self.assertFalse(doc1.semantic_equal(doc2))


class ValidationTests(unittest.TestCase):
    def test_valid_document_passes(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("panel", "ui.panel",
                               properties={"width": 4.0, "title": "T"}))
        doc.add_expression(Expression("eq", "tau = J @ F",
                                      bindings={"a": {"kind": "literal",
                                                      "value": 1}}))
        doc.add_relationship(Relationship("r1", "arrow", ["panel", "eq"]))
        doc.add_stage(Stage("s", steps=[Step(op="show", target="panel")]))
        self.assertEqual(validate_document(doc), [])

    def test_unknown_type(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("mystery", "nope.thing"))
        errors = validate_document(doc)
        self.assertTrue(any("Unknown object type" in e["message"]
                            for e in errors))

    def test_unknown_property(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("p", "ui.panel", properties={"zzz": 1}))
        self.assertTrue(any("unknown property" in e["message"]
                            for e in validate_document(doc)))

    def test_missing_required(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("s", "ui.stamp"))
        self.assertTrue(any("missing required" in e["message"]
                            for e in validate_document(doc)))

    def test_bad_enum(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("s", "ui.stamp",
                               properties={"verdict": "maybe"}))
        self.assertTrue(any("not in enum" in e["message"]
                            for e in validate_document(doc)))

    def test_bad_property_type(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("g", "ui.grid",
                               properties={"columns": "four", "rows": 2}))
        self.assertTrue(any("expects int" in e["message"]
                            for e in validate_document(doc)))

    def test_unknown_parent(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("p", "ui.panel", parent_id="ghost"))
        self.assertTrue(any("unknown parent" in e["message"]
                            for e in validate_document(doc)))

    def test_unknown_relationship_source(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("p", "ui.panel"))
        doc.add_relationship(Relationship("r", "arrow", ["p", "ghost"]))
        self.assertTrue(any("unknown source" in e["message"]
                            for e in validate_document(doc)))

    def test_bad_relationship_kind(self):
        doc = SceneDocument("v")
        doc.add_relationship(Relationship("r", "teleport", []))
        self.assertTrue(any("unknown relationship kind" in e["message"]
                            for e in validate_document(doc)))

    def test_timeline_unknown_target(self):
        doc = SceneDocument("v")
        doc.add_stage(Stage("s", steps=[Step(op="show", target="ghost")]))
        self.assertTrue(any("unknown id" in e["message"]
                            for e in validate_document(doc)))

    def test_bad_animation_name(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("p", "ui.panel"))
        doc.add_stage(Stage("s", steps=[Step(op="play", target="p",
                                                 animation="explode")]))
        self.assertTrue(any("unknown animation" in e["message"]
                            for e in validate_document(doc)))

    def test_custom_requires_code(self):
        doc = SceneDocument("v")
        doc.add_stage(Stage("s", steps=[Step(op="custom", code="")]))
        self.assertTrue(any("non-empty code" in e["message"]
                            for e in validate_document(doc)))

    def test_bad_space(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("p", "ui.panel", space="scene4d"))
        self.assertTrue(any("invalid space" in e["message"]
                            for e in validate_document(doc)))

    def test_validate_or_raise(self):
        doc = SceneDocument("v")
        doc.add_node(SceneNode("p", "ui.panel", properties={"zzz": 1}))
        with self.assertRaises(ValidationError):
            from scientific import validate_or_raise
            validate_or_raise(doc)


if __name__ == "__main__":
    unittest.main()
