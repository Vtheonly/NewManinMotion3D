"""Deterministic MLP — layout, weights and forward pass.

Used by the synthesizability wall (a scoring network) and reusable anywhere a
small network must render with live activations.  Weights come from a seeded
LCG so every render/test produces identical numbers (issue #26: "No hardcoded
visual values masquerading as model outputs" — these ARE the model outputs).
"""

from __future__ import annotations

import math
from typing import Optional


def _lcg(seed: int):
    state = (seed * 2654435761 + 1) & 0xFFFFFFFF
    while True:
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        yield (state / 0x7FFFFFFF) * 2.0 - 1.0  # uniform in [-1, 1)


def _tanh(x: float) -> float:
    return math.tanh(x)


class MLP:
    def __init__(self, layers: list[int], seed: int = 11):
        if len(layers) < 2 or any(n < 1 for n in layers):
            raise ValueError(f"invalid layer sizes {layers}")
        self.layers = list(layers)
        rng = _lcg(seed)
        self.weights: list[list[list[float]]] = []
        self.biases: list[list[float]] = []
        for i in range(len(layers) - 1):
            self.weights.append(
                [[next(rng) * 0.8 for _ in range(layers[i])]
                 for _ in range(layers[i + 1])]
            )
            self.biases.append([next(rng) * 0.2 for _ in range(layers[i + 1])])

    def forward(self, inputs: Optional[list[float]] = None) -> list[list[float]]:
        """Return activations per layer (including the input layer)."""
        values = list(inputs or [0.0] * self.layers[0])
        if len(values) != self.layers[0]:
            raise ValueError(
                f"expected {self.layers[0]} inputs, got {len(values)}")
        activations = [[_tanh(v) for v in values]]
        for idx, (w, b) in enumerate(zip(self.weights, self.biases)):
            prev = activations[-1]
            out = []
            for row, bias in zip(w, b):
                z = sum(wi * a for wi, a in zip(row, prev)) + bias
                out.append(_tanh(z) if idx < len(self.weights) - 1 else z)
            activations.append(out)
        return activations

    def output(self, inputs: Optional[list[float]] = None) -> float:
        acts = self.forward(inputs)
        return acts[-1][0] if len(acts[-1]) == 1 else float(sum(acts[-1]))

    def score(self, inputs: Optional[list[float]] = None) -> float:
        """Squashed output in [0, 1] — 'synthesizability score'."""
        return round((math.tanh(self.output(inputs)) + 1.0) / 2.0, 3)


def layout(layers: list[int], width: float = 4.0, height: float = 3.0
           ) -> list[list[tuple[float, float]]]:
    """Neuron positions per layer, centered at the origin."""
    count = len(layers)
    if count == 0:
        return []
    positions = []
    for i, n in enumerate(layers):
        x = (i / (count - 1) - 0.5) * width if count > 1 else 0.0
        ys = [(0.5 - (j + 0.5) / n) * height for j in range(n)]
        positions.append([(x, y) for y in ys])
    return positions


def edges(layers: list[int]) -> list[tuple[int, int, int, int]]:
    """(layer_i, neuron_i, layer_j, neuron_j) connectivity."""
    out = []
    for i in range(len(layers) - 1):
        for a in range(layers[i]):
            for b in range(layers[i + 1]):
                out.append((i, a, i + 1, b))
    return out
