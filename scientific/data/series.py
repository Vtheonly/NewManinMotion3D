"""Time-series extraction for data-driven state (issue #11).

Adapters turn loaded data (JSON records, CSV rows, plain arrays, training
logs, experiment results) into ``SeriesDriver`` inputs — (times, values)
pairs that drive state symbols through real external data.
"""

from __future__ import annotations

from typing import Any, Iterable, Optional

from ..ir.errors import DataError
from ..state.driver import SeriesDriver

TIME_KEYS = ("t", "time", "step", "epoch", "frame", "iteration")


def _coerce(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        raise DataError(f"non-numeric series value {value!r}") from None


def series_from_records(records: Iterable[dict],
                        value_key: str,
                        time_key: Optional[str] = None) -> SeriesDriver:
    """Records (list of dicts) -> series; auto-detects the time column."""
    rows = list(records)
    if not rows:
        raise DataError("series needs at least one record")
    if time_key is None:
        time_key = next((k for k in TIME_KEYS if k in rows[0]), None)
    if time_key is None:
        # implicit time: 0, 1, 2, ... (document order)
        return SeriesDriver(range(len(rows)),
                            [_coerce(r.get(value_key)) for r in rows])
    return SeriesDriver([_coerce(r[time_key]) for r in rows],
                        [_coerce(r.get(value_key)) for r in rows])


def series_from_columns(columns: dict[str, Iterable[float]],
                        value_key: str,
                        time_key: Optional[str] = None) -> SeriesDriver:
    """Column-oriented data ({'loss': [...], 'step': [...]}) -> series."""
    if value_key not in columns:
        raise DataError(f"column {value_key!r} not in data")
    values = [_coerce(v) for v in columns[value_key]]
    if time_key is None:
        time_key = next((k for k in TIME_KEYS if k in columns), None)
    if time_key is None:
        return SeriesDriver(range(len(values)), values)
    return SeriesDriver([_coerce(t) for t in columns[time_key]], values)


def series_from_array(values: Iterable[float],
                      times: Optional[Iterable[float]] = None) -> SeriesDriver:
    """Plain array (plus optional times) -> series."""
    vals = [_coerce(v) for v in values]
    if not vals:
        raise DataError("series needs at least one value")
    return SeriesDriver(times if times is not None else range(len(vals)), vals)


def series_from_payload(payload: Any, value_key: str,
                        time_key: Optional[str] = None) -> SeriesDriver:
    """Dispatch on payload shape (records / columns / plain array)."""
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        return series_from_records(payload, value_key, time_key)
    if isinstance(payload, dict):
        return series_from_columns(payload, value_key, time_key)
    if isinstance(payload, list):
        return series_from_array(payload, times=None)
    raise DataError(
        f"cannot build a series from {type(payload).__name__}; expected "
        "records (list of dicts), columns (dict of lists) or a plain array")
