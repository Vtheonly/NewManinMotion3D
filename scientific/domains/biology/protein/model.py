"""Deterministic residue-level protein model.

No external dependencies: a residue chain is generated from (seed, residues)
with alternating helix/strand segments so every scene, test and render
produces the identical structure.  Real PDB data can be injected instead via
``from_data`` (issue #26: data sources must be explicit).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Optional

ALPHABET = "ACDEFGHIKLMNPQRSTVWY"


@dataclass
class Residue:
    symbol: str
    position: tuple[float, float, float]

    def to_dict(self) -> dict:
        return {"symbol": self.symbol,
                "position": list(self.position)}


def _lcg(seed: int) -> float:
    """Tiny deterministic generator — same sequence everywhere (no numpy)."""
    state = (seed * 2654435761 + 1) & 0xFFFFFFFF
    while True:
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        yield state / 0x7FFFFFFF


class ProteinModel:
    """Residue chain with deterministic fold and pseudo-energy."""

    def __init__(self, residues: int = 24, seed: int = 7,
                 representation: str = "cartoon"):
        self.representation = representation
        rng = _lcg(seed)
        self.residues: list[Residue] = []
        pos = [0.0, 0.0, 0.0]
        direction = 0.0
        for i in range(residues):
            symbol = ALPHABET[int(next(rng) * len(ALPHABET))]
            if i % 7 == 0:
                direction += (next(rng) - 0.5) * 1.2
            kind = "helix" if (i // 7) % 2 == 0 else "strand"
            if kind == "helix":
                angle = 1.75  # ~100°/residue helix rise
                pos = [pos[0] + 0.32 * math.cos(angle * i + direction),
                       pos[1] + 0.21,
                       pos[2] + 0.32 * math.sin(angle * i + direction)]
            else:
                pos = [pos[0] + 0.42 * math.cos(direction),
                       pos[1] + 0.18,
                       pos[2] + 0.42 * math.sin(direction)]
            self.residues.append(Residue(symbol, (pos[0], pos[1], pos[2])))

    # ── measurements ───────────────────────────────────────────────
    def ca_positions(self) -> list[tuple[float, float, float]]:
        return [r.position for r in self.residues]

    def radius_of_gyration(self) -> float:
        pts = self.ca_positions()
        n = len(pts)
        cx = sum(p[0] for p in pts) / n
        cy = sum(p[1] for p in pts) / n
        cz = sum(p[2] for p in pts) / n
        return math.sqrt(sum((p[0] - cx) ** 2 + (p[1] - cy) ** 2
                             + (p[2] - cz) ** 2 for p in pts) / n)

    def contacts(self, cutoff: float = 1.15) -> int:
        pts = self.ca_positions()
        count = 0
        for i in range(len(pts)):
            for j in range(i + 2, len(pts)):
                if _dist(pts[i], pts[j]) < cutoff:
                    count += 1
        return count

    def energy(self) -> float:
        """Deterministic pseudo-energetic score (kcal/mol-like, negative=better)."""
        compact = self.radius_of_gyration()
        return round(-0.8 * self.contacts() + 1.7 * compact - 0.05 * len(self.residues), 3)

    def sequence(self) -> str:
        return "".join(r.symbol for r in self.residues)

    # ── data injection ─────────────────────────────────────────────
    @classmethod
    def from_data(cls, payload: dict) -> "ProteinModel":
        model = cls(residues=0, seed=1)
        model.residues = [
            Residue(str(r["symbol"]),
                    (float(r["position"][0]), float(r["position"][1]),
                     float(r["position"][2])))
            for r in payload.get("residues", [])
        ]
        model.representation = payload.get("representation", "cartoon")
        return model

    def to_dict(self) -> dict:
        return {
            "representation": self.representation,
            "residues": [r.to_dict() for r in self.residues],
        }


def _dist(a, b) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def load_protein(source: Optional[str], properties: dict,
                 loader=None) -> ProteinModel:
    """Resolve a protein from an explicit DataRef or deterministic params."""
    if source:
        loader = loader or _default_loader
        payload = loader(source)
        return ProteinModel.from_data(payload)
    return ProteinModel(
        residues=int(properties.get("residues", 24)),
        seed=int(properties.get("seed", 7)),
        representation=properties.get("representation", "cartoon"),
    )


def _default_loader(ref: str) -> dict:
    from ....runtime.datasource import resolve_data_ref
    return resolve_data_ref(ref)
