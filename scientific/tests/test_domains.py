"""Scientific-correctness tests for the pure domain modules (no manim)."""

from __future__ import annotations

import math
import unittest

from scientific.domains.attention.model import CrossAttention
from scientific.domains.biology.protein import sequence as seq
from scientific.domains.biology.protein.model import ProteinModel, load_protein
from scientific.domains.kinematics.chain import PoEChain
from scientific.domains.kinematics.jacobian import (
    dls_step, jacobian, numerical_jacobian_check, residual,
)
from scientific.domains.kinematics.obstacles import (
    distance_to_segment, escape_direction, is_clash, obstacle_clearance,
    resolve_clash,
)
from scientific.domains.kinematics.poe import (
    apply, identity, mat_mul, se3_exp, so3_exp, translation,
)
from scientific.domains.kinematics.screw import Screw, axis_segment
from scientific.domains.kinematics.torus import (
    integrate, residuum, torus_point, trajectory_3d, wrap_angle,
)
from scientific.domains.nn.network import MLP, edges, layout
from scientific.domains.presentation import stages
from scientific.domains.ui import grids, palette


class TorusTests(unittest.TestCase):
    def test_point_on_major_circle(self):
        # phi=0 -> tube radius offset outward: R + r at theta=0
        p = torus_point(0.0, 0.0, major=2.0, minor=0.5)
        self.assertAlmostEqual(p[0], 2.5, places=9)
        self.assertAlmostEqual(p[1], 0.0, places=9)
        self.assertAlmostEqual(p[2], 0.0, places=9)

    def test_point_on_minor_circle(self):
        p = torus_point(0.0, math.pi / 2, major=2.0, minor=0.5)
        self.assertAlmostEqual(p[0], 2.0, places=9)
        self.assertAlmostEqual(p[2], 0.5, places=9)

    def test_wrap_angle(self):
        self.assertAlmostEqual(wrap_angle(3 * math.pi), -math.pi, places=9)
        self.assertAlmostEqual(wrap_angle(0.3), 0.3, places=9)

    def test_integration_deterministic(self):
        a = integrate(steps=40)
        b = integrate(steps=40)
        self.assertEqual(a, b)

    def test_midpoint_more_accurate_than_euler(self):
        fine = integrate(steps=400, dt=0.01)
        reference = fine[::5]  # same timestamps as the coarse runs
        mid = integrate(steps=80, dt=0.05)
        eul = integrate(steps=80, dt=0.05, method="euler")
        self.assertEqual(len(reference), len(mid))
        self.assertLess(residuum(mid, reference),
                        residuum(eul, reference))

    def test_trajectory_embeds_in_3d(self):
        pts = trajectory_3d(steps=10)
        self.assertEqual(len(pts), 11)
        for p in pts:
            self.assertEqual(len(p), 3)

    def test_bad_method_rejected(self):
        with self.assertRaises(ValueError):
            integrate(method="rk9000")


class PoETests(unittest.TestCase):
    def test_identity_rotation(self):
        R = so3_exp((0, 0, 1), 0.0)
        self.assertEqual(R, [[1, 0, 0], [0, 1, 0], [0, 0, 1]])

    def test_rodrigues_known_rotation(self):
        R = so3_exp((0, 0, 1), math.pi / 2)
        v = apply(_to4(R), (1.0, 0.0, 0.0))
        self.assertAlmostEqual(v[0], 0.0, places=9)
        self.assertAlmostEqual(v[1], 1.0, places=9)

    def test_rodrigues_orthonormal(self):
        R = so3_exp((1, 2, 3), 0.7)
        for i in range(3):
            norm = math.sqrt(sum(R[i][j] ** 2 for j in range(3)))
            self.assertAlmostEqual(norm, 1.0, places=9)
            for j in range(i):
                dot = sum(R[i][k] * R[j][k] for k in range(3))
                self.assertAlmostEqual(dot, 0.0, places=9)

    def test_se3_rotation_about_origin(self):
        T = se3_exp((0, 0, 1), (0, 0, 0), math.pi)
        v = apply(T, (1.0, 0.0, 0.0))
        self.assertAlmostEqual(v[0], -1.0, places=9)
        self.assertAlmostEqual(v[1], 0.0, places=9)

    def test_se3_pure_rotation_about_offset_point(self):
        # rotating a point on the axis leaves it fixed
        T = se3_exp((0, 1, 0), (0.9, 0, 0), 0.6)
        v = apply(T, (0.9, 0.0, 0.0))
        self.assertAlmostEqual(v[0], 0.9, places=9)
        self.assertAlmostEqual(v[1], 0.0, places=9)
        self.assertAlmostEqual(v[2], 0.0, places=9)

    def test_translation_matrix(self):
        T = translation((1, 2, 3))
        v = apply(T, (0, 0, 0))
        self.assertEqual(v, (1.0, 2.0, 3.0))

    def test_chain_zero_config_is_straight_line(self):
        chain = PoEChain([0.0] * 4, 0.9)
        positions = chain.joint_positions()
        expected = [(i * 0.9, 0.0, 0.0) for i in range(5)]
        for got, want in zip(positions, expected):
            for g, w in zip(got, want):
                self.assertAlmostEqual(g, w, places=9)

    def test_chain_single_joint_rotation(self):
        chain = PoEChain([math.pi / 2], 1.0)
        ee = chain.end_effector()
        self.assertAlmostEqual(ee[0], 0.0, places=9)
        self.assertAlmostEqual(ee[1], 1.0, places=9)

    def test_chain_config_length_validated(self):
        chain = PoEChain([0.1, 0.2], 0.9)
        with self.assertRaises(ValueError):
            chain.end_effector([0.1])

    def test_mat_mul_identity(self):
        T = translation((3, 1, 2))
        self.assertEqual(mat_mul(identity(), T), T)


def _to4(R):
    T = identity()
    for i in range(3):
        for j in range(3):
            T[i][j] = R[i][j]
    return T


class JacobianTests(unittest.TestCase):
    def test_analytic_matches_finite_differences(self):
        for thetas in ([0.3, -0.5, 0.4], [1.0, -0.3, 0.2, 0.5], [0.0]):
            chain = PoEChain(thetas, 0.9)
            self.assertLess(numerical_jacobian_check(chain), 1e-4)

    def test_zero_configuration_jacobian_columns(self):
        # joint 1 at origin about z: column = z x (ee - 0) = (-y, x, 0)*?
        chain = PoEChain([0.0, 0.0], 1.0)
        cols = jacobian(chain)
        ee = chain.end_effector()
        self.assertAlmostEqual(cols[0][0], -ee[1], places=9)
        self.assertAlmostEqual(cols[0][1], ee[0], places=9)
        self.assertAlmostEqual(cols[0][2], 0.0, places=9)

    def test_dls_step_pulls_toward_target(self):
        chain = PoEChain([0.2, -0.1, 0.3], 0.9)
        target = (2.4, 0.9, 0.2)
        before = residual(chain, target)
        step = dls_step(jacobian(chain),
                        tuple(target[k] - chain.end_effector()[k]
                              for k in range(3)))
        moved = PoEChain([t + s for t, s in zip(chain.thetas, step)], 0.9)
        self.assertLess(residual(moved, target), before)

    def test_residual_zero_at_target(self):
        chain = PoEChain([0.1], 1.0)
        self.assertAlmostEqual(residual(chain, chain.end_effector()), 0.0)


class ObstacleTests(unittest.TestCase):
    def test_distance_to_segment(self):
        self.assertAlmostEqual(
            distance_to_segment((0.5, 1.0, 0.0), (0, 0, 0), (1, 0, 0)), 1.0)
        self.assertAlmostEqual(
            distance_to_segment((2.0, 0.0, 0.0), (0, 0, 0), (1, 0, 0)), 1.0)
        self.assertAlmostEqual(
            distance_to_segment((0.5, 0.0, 0.0), (0, 0, 0), (1, 0, 0)), 0.0)

    def test_clearance_and_clash(self):
        positions = [(0, 0, 0), (1, 0, 0), (2, 0, 0)]
        clearance = obstacle_clearance(positions, (1.0, 0.0, 0.0), 0.4)
        self.assertAlmostEqual(clearance, -0.4, places=9)
        self.assertTrue(is_clash(positions, (1.0, 0.0, 0.0), 0.4))
        self.assertFalse(is_clash(positions, (1.0, 3.0, 0.0), 0.4))

    def test_escape_direction_points_away(self):
        positions = [(0, 0, 0), (1, 0, 0)]
        direction = escape_direction((0.5, 0.0, 0.0), positions)
        self.assertGreater(abs(direction[0]) + abs(direction[1]), 0.9)

    def test_resolve_clash_improves_clearance(self):
        # build a guaranteed clash: obstacle centred on the second link
        chain = PoEChain([0.9, -0.4, 0.3, 0.1], 0.9)
        positions = chain.joint_positions()
        center = tuple((positions[2][k] + positions[3][k]) / 2
                       for k in range(3))
        radius = 0.7
        self.assertTrue(is_clash(chain.joint_positions(), center, radius))
        result = resolve_clash(chain, center, radius)
        self.assertGreater(result["clearance"], -radius)
        self.assertFalse(result["clashRemaining"])


class ScrewTests(unittest.TestCase):
    def test_moment_of_axis_through_origin(self):
        screw = Screw((0, 0, 1), (0, 0, 0))
        self.assertEqual(screw.moment(), (0.0, 0.0, 0.0))

    def test_velocity_perpendicular(self):
        screw = Screw((0, 1, 0), (0.5, 0, 0))
        v = screw.velocity_at((1.5, 0.0, 0.0))
        self.assertAlmostEqual(v[1], 0.0, places=9)
        self.assertAlmostEqual(v[2], -1.0, places=9)

    def test_axis_segment_symmetric(self):
        screw = Screw((0, 0, 1), (1, 2, 3))
        start, end = axis_segment(screw, length=2.0)
        self.assertAlmostEqual(start[0] + end[0], 2.0, places=9)

    def test_zero_axis_rejected(self):
        with self.assertRaises(ValueError):
            Screw((0, 0, 0), (0, 0, 0))


class ProteinTests(unittest.TestCase):
    def test_deterministic_fold(self):
        a = ProteinModel(residues=20, seed=5)
        b = ProteinModel(residues=20, seed=5)
        self.assertEqual(a.ca_positions(), b.ca_positions())

    def test_different_seeds_differ(self):
        a = ProteinModel(residues=20, seed=1).ca_positions()
        b = ProteinModel(residues=20, seed=2).ca_positions()
        self.assertNotEqual(a, b)

    def test_geometry(self):
        model = ProteinModel(residues=24, seed=7)
        self.assertGreater(model.radius_of_gyration(), 0.1)
        self.assertGreater(model.contacts(), 0)
        self.assertLess(model.energy(), 0)  # compact folds score negative

    def test_from_data_roundtrip(self):
        model = ProteinModel(residues=12, seed=3)
        clone = ProteinModel.from_data(model.to_dict())
        self.assertEqual(model.ca_positions(), clone.ca_positions())

    def test_load_from_fixture(self):
        protein = load_protein("synth/protein.json", {})
        self.assertEqual(len(protein.residues), 26)
        self.assertEqual(protein.representation, "cartoon")

    def test_sequence_matches_residues(self):
        model = ProteinModel(residues=15, seed=2)
        self.assertEqual(len(model.sequence()), 15)


class SequenceTests(unittest.TestCase):
    def test_classify(self):
        self.assertEqual(seq.classify("A"), "hydrophobic")
        self.assertEqual(seq.classify("K"), "positive")
        self.assertEqual(seq.classify("D"), "negative")
        self.assertEqual(seq.classify("S"), "polar")
        self.assertEqual(seq.classify("P"), "proline")

    def test_mutate(self):
        self.assertEqual(seq.mutate("AAA", 1, "C"), "ACA")
        with self.assertRaises(ValueError):
            seq.mutate("AAA", 1, "XX")

    def test_mutation_labels(self):
        self.assertEqual(seq.mutation_labels("ACA", "AAA"), ["C2A"])

    def test_block_layout(self):
        self.assertEqual(seq.block_layout("A" * 23, per_row=10),
                         ["A" * 10, "A" * 10, "A" * 3])

    def test_highlight_ranges(self):
        self.assertEqual(seq.highlight_ranges("ABAB", "AB"),
                         [(0, 2), (2, 4)])

    def test_score_bounds_and_monotone_length(self):
        self.assertEqual(seq.synthesizability_score(""), 0.0)
        short = seq.synthesizability_score("AAAA")
        long = seq.synthesizability_score("A" * 60)
        self.assertGreater(short, long)
        for s in ("AAAA", "C" * 30, "P" * 30, "ACDE"):
            self.assertTrue(0.0 <= seq.synthesizability_score(s) <= 1.0)


class NNTests(unittest.TestCase):
    def test_deterministic(self):
        a = MLP([3, 4, 1], seed=9).forward([0.1, 0.2, 0.3])
        b = MLP([3, 4, 1], seed=9).forward([0.1, 0.2, 0.3])
        self.assertEqual(a, b)

    def test_forward_shapes_and_bounds(self):
        acts = MLP([4, 6, 2], seed=1).forward([1, -1, 0.5, 0])
        self.assertEqual([len(a) for a in acts], [4, 6, 2])
        for layer in acts[:-1]:
            for v in layer:
                self.assertLessEqual(abs(v), 1.0)

    def test_input_length_validated(self):
        with self.assertRaises(ValueError):
            MLP([4, 2], seed=1).forward([1, 2])

    def test_score_in_unit_interval(self):
        net = MLP([4, 6, 1], seed=11)
        for inputs in ([0.5, -0.3, 0.8, 0.1], [-1, -1, -1, -1], [1, 1, 1, 1]):
            self.assertTrue(0.0 <= net.score(inputs) <= 1.0)

    def test_layout_and_edges(self):
        pos = layout([2, 3, 1])
        self.assertEqual([len(p) for p in pos], [2, 3, 1])
        self.assertEqual(len(edges([2, 3, 1])), 2 * 3 + 3 * 1)


class AttentionTests(unittest.TestCase):
    def test_rows_are_distributions(self):
        att = CrossAttention(["a", "b"], ["x", "y", "z"])
        for row in att.scores():
            self.assertAlmostEqual(sum(row), 1.0, places=3)
            self.assertTrue(all(0 <= w <= 1 for w in row))

    def test_deterministic(self):
        a = CrossAttention(["q"], ["k"]).scores()
        b = CrossAttention(["q"], ["k"]).scores()
        self.assertEqual(a, b)

    def test_distance_bias_pushes_down_far_pairs(self):
        anchors_q = [(0.0, 0.0, 0.0)]
        anchors_k = [(0.2, 0, 0), (3.0, 0, 0), (6.0, 0, 0)]
        unbiased = CrossAttention(["q"], ["near", "mid", "far"],
                                  anchors_q=anchors_q, anchors_k=anchors_k,
                                  distance_bias=0.0)
        biased = CrossAttention(["q"], ["near", "mid", "far"],
                                anchors_q=anchors_q, anchors_k=anchors_k,
                                distance_bias=1.5)
        # heavier distance bias must raise the nearest key's weight
        self.assertGreater(biased.scores()[0][0], unbiased.scores()[0][0])
        self.assertGreater(biased.row_entropy(biased.scores()[0]), 0.0)

    def test_top_links_sorted_and_limited(self):
        att = CrossAttention(["q1", "q2"], ["k1", "k2", "k3"])
        links = att.top_links(2)
        self.assertEqual(len(links), 2)
        self.assertGreaterEqual(links[0][2], links[1][2])

    def test_empty_rejected(self):
        with self.assertRaises(ValueError):
            CrossAttention([], ["k"])


class PresentationUiTests(unittest.TestCase):
    def test_palette_tokens_resolve(self):
        self.assertTrue(palette.color("ok").startswith("#"))
        self.assertEqual(palette.color("#FF00FF"), "#FF00FF")
        self.assertEqual(palette.color("nonexistent"), palette.color("fg"))

    def test_grid_geometry(self):
        centers = grids.cell_centers(2, 2, 1.0, 1.0, 0.0)
        self.assertEqual(len(centers), 4)
        # symmetric around origin
        xs = sorted(c[0] for c in centers)
        self.assertAlmostEqual(xs[0] + xs[-1], 0.0)

    def test_grid_size(self):
        w, h = grids.grid_size(3, 2, 1.0, 1.0, 0.5)
        self.assertAlmostEqual(w, 4.0)
        self.assertAlmostEqual(h, 2.5)

    def test_stack_positions_centered(self):
        self.assertAlmostEqual(grids.stack_positions(3)[1][1], 0.0)

    def test_pipeline_and_validation_rows(self):
        rows = stages.pipeline_rows([{"name": "fold", "ok": True},
                                     {"name": "clash", "ok": False}])
        self.assertEqual([r["ok"] for r in rows], [True, False])
        vrows = stages.validation_rows(
            [{"name": "a", "score": 0.9}, {"name": "b", "score": 0.2}])
        self.assertEqual([r["verdict"] for r in vrows], ["ok", "fail"])

    def test_summarize(self):
        summary = stages.summarize(
            stages.validation_rows([{"score": 0.9}, {"score": 0.1}]))
        self.assertEqual((summary["total"], summary["ok"], summary["fail"]),
                         (2, 1, 1))

    def test_verdict_threshold(self):
        self.assertEqual(stages.verdict_from_score(0.5), "ok")
        self.assertEqual(stages.verdict_from_score(0.49), "fail")


if __name__ == "__main__":
    unittest.main()
