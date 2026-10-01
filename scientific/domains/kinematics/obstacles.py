"""Obstacles, steric clash detection and DLS-based resolution.

The clash state drives the reference scene's narrative: the chain enters an
obstacle, the clash is detected, and a damped-least-squares step pushes the
end effector out while visualising the Jacobian.
"""

from __future__ import annotations

import math
from typing import Optional

from .chain import PoEChain
from .jacobian import dls_step, jacobian
from .poe import Vec3

Point3 = tuple[float, float, float]


def distance_to_segment(p: Point3, a: Point3, b: Point3) -> float:
    """Point-to-segment distance in R^3."""
    ab = tuple(b[k] - a[k] for k in range(3))
    ap = tuple(p[k] - a[k] for k in range(3))
    denom = sum(c * c for c in ab)
    if denom < 1e-12:
        return math.sqrt(sum(c * c for c in ap))
    t = max(0.0, min(1.0, sum(ab[k] * ap[k] for k in range(3)) / denom))
    closest = tuple(a[k] + t * ab[k] for k in range(3))
    return math.sqrt(sum((p[k] - closest[k]) ** 2 for k in range(3)))


def obstacle_clearance(positions: list[Point3], center: Point3,
                       radius: float) -> float:
    """Signed clearance: min over links of (distance - radius); <0 = clash."""
    if not positions:
        return float("inf")
    worst = float("inf")
    points = [(0.0, 0.0, 0.0)] + list(positions)
    for a, b in zip(points, points[1:]):
        worst = min(worst, distance_to_segment(center, a, b) - radius)
    return worst


def is_clash(positions: list[Point3], center: Point3, radius: float,
             margin: float = 0.0) -> bool:
    return obstacle_clearance(positions, center, radius) < margin


def escape_direction(center: Point3, positions: list[Point3]) -> Vec3:
    """Unit vector from the deepest link point away from the obstacle."""
    best_point, best_d = None, -1.0
    points = [(0.0, 0.0, 0.0)] + list(positions)
    for a, b in zip(points, points[1:]):
        for p in (a, b):
            d = math.sqrt(sum((p[k] - center[k]) ** 2 for k in range(3)))
            if d > best_d:
                best_point, best_d = p, d
    v = tuple(best_point[k] - center[k] for k in range(3))
    n = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / n for c in v)


def resolve_clash(chain: PoEChain, center: Point3, radius: float,
                  iterations: int = 24, push: float = 0.35,
                  damping: float = 0.15) -> dict:
    """Iteratively apply DLS steps away from the obstacle.

    Returns {"thetas": [...], "clearance": float, "iters": int,
             "clashRemaining": bool} — deterministic for fixed inputs.
    """
    thetas = list(chain.thetas)
    current = PoEChain(thetas, chain.L)
    iters = 0
    for iters in range(1, iterations + 1):
        positions = current.joint_positions()
        clearance = obstacle_clearance(positions, center, radius)
        if clearance >= 0.05:
            break
        direction = escape_direction(center, positions)
        error = tuple(push * c for c in direction)
        step = dls_step(jacobian(current), error, damping)
        thetas = [t + s for t, s in zip(thetas, step)]
        # keep angles bounded (revolute wrap) for stable rendering
        thetas = [max(-2.6, min(2.6, t)) for t in thetas]
        current = PoEChain(thetas, chain.L)
    clearance = obstacle_clearance(current.joint_positions(), center, radius)
    return {
        "thetas": [round(t, 4) for t in thetas],
        "clearance": round(clearance, 4),
        "iters": iters,
        "clashRemaining": clearance < 0.0,
    }
