"""Structured mathematical expressions.

An expression keeps its LaTeX source *and* semantic parts:

- ``terms`` — named subexpressions that can be highlighted and edited
  individually from the frontend (e.g. ``{"Jt": "J(\\\\theta)^T"}``);
- ``bindings`` — symbol -> data source spec (see runtime/dataref.py);
- ``highlights`` — term names or raw fragments to colour;
- ``format`` — optional live-value template applied to a bound value.

A formula is therefore never an opaque image: the editor can change the
expression, a single term, a constant, or a binding and regenerate rendering.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


def _clean_terms(terms: Optional[dict[str, str]]) -> dict[str, str]:
    if not terms:
        return {}
    return {str(k): str(v) for k, v in terms.items()}


def _clean_highlights(highlights: Optional[list[str]], terms: dict[str, str]) -> list[str]:
    """Normalise highlights: term names resolve to their fragments."""
    out: list[str] = []
    for h in highlights or []:
        h = str(h)
        if h in terms:
            h = terms[h]
        if h and h not in out:
            out.append(h)
    return out


@dataclass
class Expression:
    """A semantic mathematical expression."""

    id: str
    source: str
    terms: dict[str, str] = field(default_factory=dict)
    bindings: dict[str, Any] = field(default_factory=dict)
    highlights: list[str] = field(default_factory=list)
    format: Optional[str] = None

    def __post_init__(self) -> None:
        self.terms = _clean_terms(self.terms)
        self.highlights = _clean_highlights(self.highlights, self.terms)

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"id": self.id, "source": self.source}
        if self.terms:
            out["terms"] = self.terms
        if self.bindings:
            out["bindings"] = self.bindings
        if self.highlights:
            out["highlights"] = self.highlights
        if self.format is not None:
            out["format"] = self.format
        return out

    @classmethod
    def from_dict(cls, data: dict) -> "Expression":
        return cls(
            id=str(data["id"]),
            source=str(data["source"]),
            terms=_clean_terms(data.get("terms")),
            bindings=dict(data.get("bindings") or {}),
            highlights=list(data.get("highlights") or []),
            format=data.get("format"),
        )

    def referenced_symbols(self) -> list[str]:
        """Symbols referenced by bindings (deterministic insertion order)."""
        return list(self.bindings.keys())


@dataclass
class LiveValue:
    """A formatted derived number (e.g. "ΔG = -4.21 kcal/mol")."""

    id: str
    source: Any  # binding source spec (dict) — see runtime/dataref.py
    format: str = "{value}"

    def to_dict(self) -> dict:
        return {"id": self.id, "source": self.source, "format": self.format}

    @classmethod
    def from_dict(cls, data: dict) -> "LiveValue":
        return cls(
            id=str(data["id"]),
            source=data.get("source"),
            format=str(data.get("format", "{value}")),
        )
