"""Spatial cross-attention with distance bias (deterministic).

Queries/keys carry 3D anchors; scores are

    s_ij = (q_i . k_j) / sqrt(d) - bias * ||a_i - a_j||

followed by a softmax row-wise.  Everything is explicit and testable: token
vectors, anchor positions, and the resulting link weights all come from this
model, never from hardcoded visuals.
"""

from __future__ import annotations

import math
from typing import Optional

Point3 = tuple[float, float, float]


def _dot(a, b) -> float:
    return sum(x * y for x, y in zip(a, b))


def _dist(a: Point3, b: Point3) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _lcg(seed: int):
    state = (seed * 2654435761 + 1) & 0xFFFFFFFF
    while True:
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        yield state / 0x7FFFFFFF


class CrossAttention:
    def __init__(self, queries: list[str], keys: list[str],
                 anchors_q: Optional[list[Point3]] = None,
                 anchors_k: Optional[list[Point3]] = None,
                 dim: int = 8, seed: int = 5,
                 temperature: float = 1.0, distance_bias: float = 0.25):
        if not queries or not keys:
            raise ValueError("queries and keys must be non-empty")
        self.queries = list(queries)
        self.keys = list(keys)
        rng = _lcg(seed)
        self.q_vectors = [[(next(rng) * 2 - 1) for _ in range(dim)]
                          for _ in queries]
        self.k_vectors = [[(next(rng) * 2 - 1) for _ in range(dim)]
                          for _ in keys]
        self.anchors_q = list(anchors_q or
                              [(math.cos(2 * math.pi * i / len(queries)) * 1.6,
                                1.2, math.sin(2 * math.pi * i / len(queries)) * 1.6)
                               for i in range(len(queries))])
        self.anchors_k = list(anchors_k or
                              [(math.cos(2 * math.pi * j / len(keys)) * 2.6,
                                -0.8, math.sin(2 * math.pi * j / len(keys)) * 2.6)
                               for j in range(len(keys))])
        self.dim = dim
        self.temperature = max(temperature, 1e-6)
        self.distance_bias = distance_bias

    def logits(self) -> list[list[float]]:
        """Raw scores before softmax (bias included)."""
        scale = math.sqrt(self.dim)
        out = []
        for i, q in enumerate(self.q_vectors):
            row = []
            for j, k in enumerate(self.k_vectors):
                raw = _dot(q, k) / scale
                bias = self.distance_bias * _dist(self.anchors_q[i],
                                                  self.anchors_k[j])
                row.append(raw - bias)
            out.append(row)
        return out

    def scores(self) -> list[list[float]]:
        """Row-wise softmax of the logits."""
        table = self.logits()
        out = []
        for row in table:
            m = max(row)
            exps = [math.exp(v - m) for v in row]
            total = sum(exps) or 1.0
            out.append([round(e / total, 4) for e in exps])
        return out

    def top_links(self, top_k: int = 3) -> list[tuple[int, int, float]]:
        """Deterministic (i, j, weight) list, sorted by weight desc."""
        pairs = []
        for i, row in enumerate(self.scores()):
            for j, w in enumerate(row):
                pairs.append((i, j, w))
        pairs.sort(key=lambda p: (-p[2], p[0], p[1]))
        return [(i, j, w) for i, j, w in pairs[: max(1, top_k)]]

    def row_entropy(self, row: list[float]) -> float:
        """Shannon entropy of one attention distribution (nats)."""
        h = -sum((w * math.log(w) if w > 1e-12 else 0.0) for w in row)
        return round(h, 4)
