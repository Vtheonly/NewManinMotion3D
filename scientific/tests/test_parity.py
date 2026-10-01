"""Python-side parity tests for the shared JS fixtures (issue #32).

Guards the same corpus and goldens consumed by services/api/tests/ir.test.mjs
so the two implementations cannot silently diverge.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from scientific.export import emit
from scientific.export.literals import format_float, py_literal
from scientific.ir import from_json
from scientific.ir.errors import IRError
from scientific.ir.validate import validate_document
from scientific.registry import describe_types

FIXTURES = (Path(__file__).resolve().parents[2] /
            "services" / "api" / "tests" / "fixtures" / "ir")


class GoldenEmitterParityTests(unittest.TestCase):
    def test_python_emitter_matches_goldens(self):
        goldens = sorted(FIXTURES.glob("*.py"))
        self.assertGreaterEqual(len(goldens), 3)
        for golden in goldens:
            doc = from_json((FIXTURES / f"{golden.stem}.json").read_text())
            self.assertEqual(emit(doc), golden.read_text(),
                             f"Python emitter diverged for {golden.stem}")

    def test_goldens_round_trip_through_import(self):
        import importlib.util
        if importlib.util.find_spec("manim") is None:
            self.skipTest("manim not installed")
        from scientific.export import import_document
        for golden in sorted(FIXTURES.glob("*.py")):
            doc = from_json((FIXTURES / f"{golden.stem}.json").read_text())
            rebuilt = import_document(golden.read_text())
            self.assertTrue(rebuilt.semantic_equal(doc),
                            f"golden {golden.stem} does not round-trip")


class CorpusParityTests(unittest.TestCase):
    def _corpus(self):
        return json.loads((FIXTURES / "corpus.json").read_text())

    def test_verdicts_match_corpus(self):
        for entry in self._corpus():
            with self.subTest(case=entry["name"]):
                valid, errors = self._validate(entry["document"])
                self.assertEqual(
                    valid, entry["expectValid"],
                    f"case {entry['name']}: errors={errors}")

    def _validate(self, document: dict):
        """Python verdict for a raw JSON document (parse + validate)."""
        try:
            doc = from_json(json.dumps(document))
        except IRError as exc:
            return False, [str(exc)]
        errors = validate_document(doc)
        return (not errors), errors


class MetadataParityTests(unittest.TestCase):
    def test_type_metadata_matches_golden(self):
        golden = json.loads((FIXTURES / "type-metadata.json").read_text())
        ours = describe_types()
        self.assertEqual(json.loads(json.dumps(ours)), golden)


class LiteralRuleTests(unittest.TestCase):
    def test_canonical_rules(self):
        self.assertEqual(format_float(6.0), "6")
        self.assertEqual(format_float(0.1), "0.1")
        self.assertEqual(py_literal({"b": 1, "a": 2}), '{"a": 2, "b": 1}')
        self.assertEqual(py_literal([1, 2.5]), "[1, 2.5]")


if __name__ == "__main__":
    unittest.main()
