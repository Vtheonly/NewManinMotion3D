"""Data-source resolution for DataRef bindings.

Loads JSON (and simple CSV) fixtures relative to a data root.  Sources are
explicit in every scene (issue #26: "production examples must make the data
source explicit"); nothing is hardcoded behind the author's back.
"""

from __future__ import annotations

import csv
import io
import json
import os
from pathlib import Path
from typing import Any

from ..ir.errors import DataError

DEFAULT_DATA_ROOT = os.environ.get(
    "SCIENTIFIC_DATA_ROOT",
    str(Path(__file__).resolve().parents[2] / "presentation" / "data"),
)

_cache: dict[str, Any] = {}


def data_root() -> Path:
    return Path(DEFAULT_DATA_ROOT)


def set_data_root(path: str | Path) -> None:
    global DEFAULT_DATA_ROOT
    DEFAULT_DATA_ROOT = str(Path(path))
    _cache.clear()


def resolve_ref(ref: str, root: str | Path | None = None) -> Any:
    """Load `ref` (relative path) from the data root; raise DataError if absent."""
    root = Path(root) if root else data_root()
    if not ref or ".." in Path(ref).parts or ref.startswith("/"):
        raise DataError(f"invalid data ref {ref!r} (must be a relative path)")
    path = root / ref
    if not path.is_file():
        raise DataError(f"data source not found: {ref} (root={root})")
    key = str(path.resolve())
    if key not in _cache:
        _cache[key] = _load(path)
    return _cache[key]


def _load(path: Path) -> Any:
    try:
        if path.suffix == ".json":
            return json.loads(path.read_text(encoding="utf-8"))
        if path.suffix == ".csv":
            with path.open(encoding="utf-8", newline="") as fh:
                return [dict(row) for row in csv.DictReader(fh)]
        if path.suffix in (".txt", ".md"):
            return path.read_text(encoding="utf-8")
    except (json.JSONDecodeError, OSError) as exc:
        raise DataError(f"could not load data source {path.name}: {exc}") from None
    raise DataError(
        f"unsupported data format {path.suffix!r} for {path.name} "
        "(supported: .json, .csv, .txt)"
    )


def lookup(payload: Any, key: str | None) -> Any:
    """Apply an optional dotted key path ('energy.total') to loaded data."""
    if key is None:
        return payload
    current = payload
    for part in key.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            raise DataError(f"key {key!r} not found in data source")
    return current


def resolve_data_ref(ref: str, key: str | None = None,
                     root: str | Path | None = None) -> Any:
    return lookup(resolve_ref(ref, root), key)


def parse_csv(text: str) -> list[dict]:
    """Parse CSV text (test helper)."""
    return list(csv.DictReader(io.StringIO(text)))
