"""Grid geometry for walls/arrays of artifacts (pure math)."""

from __future__ import annotations


def cell_center(col: int, row: int, columns: int, rows: int,
                cell_w: float = 1.5, cell_h: float = 1.5,
                gap: float = 0.2) -> tuple[float, float]:
    """Center of cell (col, row) in a grid centered at the origin."""
    step_x = cell_w + gap
    step_y = cell_h + gap
    x = (col - (columns - 1) / 2.0) * step_x
    y = ((rows - 1) / 2.0 - row) * step_y
    return x, y


def cell_centers(columns: int, rows: int, cell_w: float = 1.5,
                 cell_h: float = 1.5,
                 gap: float = 0.2) -> list[tuple[float, float]]:
    """All cell centers, row-major from the top-left."""
    return [
        cell_center(c, r, columns, rows, cell_w, cell_h, gap)
        for r in range(rows)
        for c in range(columns)
    ]


def grid_size(columns: int, rows: int, cell_w: float = 1.5,
              cell_h: float = 1.5, gap: float = 0.2) -> tuple[float, float]:
    """Total (width, height) of a grid layout."""
    return (columns * cell_w + (columns - 1) * gap,
            rows * cell_h + (rows - 1) * gap)


def stack_positions(count: int, spacing: float = 0.6,
                    vertical: bool = True) -> list[tuple[float, float]]:
    """Evenly spaced positions centered at the origin (rows or columns)."""
    offset = (count - 1) / 2.0
    positions = []
    for i in range(count):
        d = (i - offset) * spacing
        positions.append((0.0, -d) if vertical else (d, 0.0))
    return positions
