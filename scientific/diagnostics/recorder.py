"""Runtime diagnostics recorder (issue #28).

Records what actually happened during a render: configuration (versions,
scene id, schema), per-step events with wall-clock timing, state changes,
machine transitions, live-value snapshots, camera operations, data
provenance (resolved DataRefs) and warnings.  Serialized deterministically
(tools: runner ``--diagnostics``, render worker job payload).
"""

from __future__ import annotations

import time as _time
from typing import Any, Optional


class Diagnostics:
    def __init__(self, scene_id: str = "", schema: str = "",
                 data_root: str = ""):
        import sys
        self.config: dict[str, Any] = {
            "scene": scene_id, "schema": schema,
            "python": sys.version.split()[0], "manim": _manim_version(),
            "dataRoot": data_root,
        }
        self.time: float = 0.0
        self.records: list[dict[str, Any]] = []
        self.state_log: list[dict[str, Any]] = []
        self.provenance: list[str] = []
        self.warnings: list[str] = []
        self._t0 = _time.perf_counter()

    # ── recording API (used by the adapter + custom code) ───────────
    def begin(self) -> None:
        self._t0 = _time.perf_counter()

    def step(self, stage_id: str, op: str, target: Optional[str] = None,
             duration: Optional[float] = None) -> None:
        self.records.append({
            "t": round(self.time, 4), "stage": stage_id, "op": op,
            "target": target,
            "duration": float(duration) if duration is not None else None,
            "wallMs": round((_time.perf_counter() - self._t0) * 1000.0, 2),
        })
        if duration is not None:
            self.time += float(duration)
        else:
            self.time += 0.0

    def animation(self, description: str) -> None:
        self.records.append({"t": round(self.time, 4),
                             "event": description})

    def state_change(self, symbol: str, value: Any) -> None:
        self.state_log.append({"t": round(self.time, 4),
                               "symbol": symbol, "value": value})

    def machine_transition(self, machine: str, transition: str,
                           target: str) -> None:
        self.state_log.append({"t": round(self.time, 4), "machine": machine,
                               "transition": transition, "state": target})

    def camera(self, properties: dict, duration: float) -> None:
        self.records.append({"t": round(self.time, 4), "op": "camera",
                             "properties": properties,
                             "duration": duration})

    def provenance_add(self, ref: str) -> None:
        if ref not in self.provenance:
            self.provenance.append(ref)

    def warning(self, message: str) -> None:
        self.warnings.append({"t": round(self.time, 4), "message": message})

    def snapshot(self, state: dict[str, Any]) -> None:
        self.records.append({"t": round(self.time, 4),
                             "stateSnapshot": dict(state)})

    # ── output ────────────────────────────────────────────────────────
    def to_dict(self) -> dict[str, Any]:
        return {
            "config": self.config,
            "time": round(self.time, 4),
            "records": self.records,
            "stateLog": self.state_log,
            "provenance": self.provenance,
            "warnings": self.warnings,
        }


def _manim_version() -> str:
    """Manim version WITHOUT importing it (core layers stay manim-free)."""
    try:
        from importlib.metadata import PackageNotFoundError, version
        return version("manim")
    except Exception:  # pragma: no cover
        return "unavailable"


def write_json(diagnostics: Diagnostics, path) -> None:
    import json
    from pathlib import Path
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(diagnostics.to_dict(), indent=2),
                      encoding="utf-8")
