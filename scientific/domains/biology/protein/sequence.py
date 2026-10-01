"""Sequence construction and mutation (amino-acid level)."""

from __future__ import annotations

from typing import Optional

HYDROPHOBIC = set("AVILMFYW")
POSITIVE = set("KRH")
NEGATIVE = set("DE")
POLAR = set("STNQC")


def classify(symbol: str) -> str:
    if symbol in HYDROPHOBIC:
        return "hydrophobic"
    if symbol in POSITIVE:
        return "positive"
    if symbol in NEGATIVE:
        return "negative"
    if symbol in POLAR:
        return "polar"
    if symbol == "G":
        return "glycine"
    if symbol == "P":
        return "proline"
    return "other"


def mutate(sequence: str, index: int, symbol: str) -> str:
    if not 0 <= index < len(sequence):
        raise IndexError(f"residue index {index} out of range")
    if len(symbol) != 1 or not symbol.isalpha():
        raise ValueError(f"invalid amino acid {symbol!r}")
    return sequence[:index] + symbol.upper() + sequence[index + 1:]


def mutation_labels(original: str, mutated: str) -> list[str]:
    """Annotate mutations like 'A12G' (1-indexed, deterministic order)."""
    labels = []
    for i, (a, b) in enumerate(zip(original, mutated)):
        if a != b:
            labels.append(f"{a}{i + 1}{b}")
    return labels


def hydrophobic_ratio(sequence: str) -> float:
    if not sequence:
        return 0.0
    hits = sum(1 for s in sequence if s in HYDROPHOBIC)
    return hits / len(sequence)


def block_layout(sequence: str, per_row: int = 10) -> list[str]:
    """Split a sequence into display blocks (10-mers by convention)."""
    return [sequence[i:i + per_row] for i in range(0, len(sequence), per_row)]


def highlight_ranges(sequence: str, motif: str) -> list[tuple[int, int]]:
    """[start, end) index ranges of every occurrence of `motif`."""
    if not motif:
        return []
    ranges = []
    start = sequence.find(motif)
    while start != -1:
        ranges.append((start, start + len(motif)))
        start = sequence.find(motif, start + 1)
    return ranges


def synthesizability_score(sequence: str,
                           cysteine_penalty: float = 0.6) -> float:
    """Deterministic 0..1 heuristic score (1 = easily synthesizable)."""
    if not sequence:
        return 0.0
    length_penalty = min(len(sequence) / 60.0, 1.0)
    cys = sequence.count("C") / len(sequence)
    pro = sequence.count("P") / len(sequence)
    score = 1.0 - 0.55 * length_penalty - cysteine_penalty * cys - 0.35 * pro
    return round(max(0.0, min(1.0, score)), 3)
