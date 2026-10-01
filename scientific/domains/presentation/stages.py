"""Presentation stage helpers — narrative structure shared by scenes.

Stages are pure data derived from scene state (never rendered directly);
scene files use these to compose story beats from semantic content, keeping
orchestration files declarative (issue #32 §9).
"""

from __future__ import annotations

from typing import Any, Optional


def pipeline_rows(steps: list[dict]) -> list[dict]:
    """Normalize pipeline entries: {"name", "ok": bool, "detail": str}."""
    rows = []
    for i, step in enumerate(steps):
        rows.append({
            "name": str(step.get("name", f"step_{i + 1}")),
            "ok": bool(step.get("ok", True)),
            "detail": str(step.get("detail", "")),
        })
    return rows


def verdict_from_score(score: float, threshold: float = 0.5) -> str:
    """'ok' | 'fail' from a synthesizability score."""
    return "ok" if score >= threshold else "fail"


def validation_rows(candidates: list[dict]) -> list[dict]:
    """Rows for the validation stage: name, score, verdict, note."""
    rows = []
    for c in candidates:
        score = float(c.get("score", 0.0))
        rows.append({
            "name": str(c.get("name", "candidate")),
            "score": score,
            "verdict": verdict_from_score(score, float(c.get("threshold", 0.5))),
            "note": str(c.get("note", "")),
        })
    return rows


def narrative_titles(title: str, stages: list[str]) -> list[dict]:
    """Title/caption pairs for each stage id (caption shown in panels)."""
    return [
        {"stage": sid, "title": title if i == 0 else "",
         "caption": caption}
        for i, (sid, caption) in enumerate(stages)
    ]


def summarize(rows: list[dict]) -> dict:
    """Aggregate validation rows into a wall-level summary."""
    total = len(rows)
    ok = sum(1 for r in rows if r.get("verdict") == "ok")
    return {
        "total": total,
        "ok": ok,
        "fail": total - ok,
        "rate": round(ok / total, 3) if total else 0.0,
    }
