"""Data-driven state (issue #11) — series adapters over the data sources."""

from __future__ import annotations

from .series import (
    series_from_array, series_from_columns, series_from_payload,
    series_from_records,
)

__all__ = [
    "series_from_array", "series_from_columns", "series_from_payload",
    "series_from_records",
]
