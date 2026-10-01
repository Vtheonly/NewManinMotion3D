"""Deterministic graph layouts (issue #34 — graph creation is first-class).

Pure stdlib layout algorithms used by the ``graph.network`` renderer and
reusable by the frontend (mirrored in JS).  Identical inputs always yield
identical positions — no randomness unless a seed is given.
"""

from __future__ import annotations

import math
from typing import Optional

LAYOUTS = ("circle", "layered", "grid", "line", "shell")


def is_layout(name: str) -> bool:
    return name in LAYOUTS


def node_ids(nodes: list) -> list[str]:
    return [str(n.get("id", f"n{i + 1}")) for i, n in enumerate(nodes)]


def circle_layout(nodes: list, radius: float = 2.0) -> dict[str, list]:
    ids = node_ids(nodes)
    positions = {}
    for i, nid in enumerate(ids):
        angle = 2 * math.pi * i / max(1, len(ids))
        positions[nid] = [radius * math.cos(angle),
                          radius * math.sin(angle), 0.0]
    return positions


def line_layout(nodes: list, spacing: float = 1.6) -> dict[str, list]:
    ids = node_ids(nodes)
    offset = (len(ids) - 1) / 2.0
    return {nid: [spacing * (i - offset), 0.0, 0.0]
            for i, nid in enumerate(ids)}


def grid_layout(nodes: list, spacing: float = 1.6) -> dict[str, list]:
    ids = node_ids(nodes)
    cols = max(1, math.ceil(math.sqrt(len(ids))))
    rows = math.ceil(len(ids) / cols)
    positions = {}
    for i, nid in enumerate(ids):
        r, c = divmod(i, cols)
        positions[nid] = [spacing * (c - (cols - 1) / 2.0),
                          -spacing * (r - (rows - 1) / 2.0), 0.0]
    return positions


def _depths(ids: list[str], edges: list[dict]) -> dict[str, int]:
    """Longest-path layering (acyclic); cycles fall back to order index."""
    parents: dict[str, list[str]] = {nid: [] for nid in ids}
    for edge in edges:
        src = str(edge.get("from", ""))
        dst = str(edge.get("to", ""))
        if dst in parents and src in parents:
            parents[dst].append(src)
    depths: dict[str, int] = {}

    def depth(nid: str, seen: tuple = ()) -> int:
        if nid in depths:
            return depths[nid]
        if nid in seen:  # cycle guard
            return 0
        best = 0
        for parent in parents[nid]:
            best = max(best, depth(parent, seen + (nid,)) + 1)
        depths[nid] = best
        return best

    for nid in ids:
        depth(nid)
    return depths


def layered_layout(nodes: list, edges: list,
                    spacing: float = 1.8) -> dict[str, list]:
    """Top-down layered layout (trees / DAGs / computational graphs)."""
    ids = node_ids(nodes)
    depths = _depths(ids, [{"from": e.get("from"), "to": e.get("to")}
                           for e in edges])
    layers: dict[int, list[str]] = {}
    for nid in ids:
        layers.setdefault(depths[nid], []).append(nid)
    max_depth = max(layers) if layers else 0
    positions = {}
    for depth, members in layers.items():
        row = line_layout([{"id": m} for m in members], spacing)
        for nid, pos in row.items():
            positions[nid] = [pos[0],
                              spacing * (max_depth / 2.0 - depth), 0.0]
    return positions


def shell_layout(nodes: list, shells: int = 3) -> dict[str, list]:
    ids = node_ids(nodes)
    per = [len(ids) // shells + (1 if i < len(ids) % shells else 0)
           for i in range(shells)]
    positions = {}
    index = 0
    for shell, count in enumerate(per):
        ring = [{"id": nid} for nid in ids[index:index + count]]
        for nid, pos in circle_layout(
                ring, radius=0.9 + 0.75 * shell).items():
            positions[nid] = pos
        index += count
    return positions


def layout(name: str, nodes: list, edges: Optional[list] = None,
           spacing: float = 1.6) -> dict[str, list]:
    """Dispatch a layout by name; manual positions always win upstream."""
    edges = edges or []
    if name == "layered":
        return layered_layout(nodes, edges, spacing)
    if name == "grid":
        return grid_layout(nodes, spacing)
    if name == "line":
        return line_layout(nodes, spacing)
    if name == "shell":
        return shell_layout(nodes)
    return circle_layout(nodes, spacing)


def apply_layout(nodes: list, edges: list, name: str,
                 spacing: float = 1.6) -> list:
    """Return a *copy* of nodes with layout positions merged in."""
    positions = layout(name, nodes, edges, spacing)
    out = []
    for node in nodes:
        copy = dict(node)
        copy["position"] = positions.get(str(node.get("id")), [0, 0, 0])
        out.append(copy)
    return out
