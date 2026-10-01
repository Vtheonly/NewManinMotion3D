"""Screw-axis state for visualization (axis, moment, pitch).

Revolute screws have zero pitch; the twist (angular, linear) pair is what the
renderer draws (screw axis arrow + linear velocity arrow at the EE).
"""

from __future__ import annotations

import math
from typing import Optional

from .poe import Vec3


class Screw:
    """Zero-pitch screw: unit axis through a point."""

    def __init__(self, axis: Vec3, point: Vec3):
        n = math.sqrt(sum(c * c for c in axis))
        if n < 1e-9:
            raise ValueError("screw axis must be non-zero")
        self.axis = tuple(c / n for c in axis)
        self.point = tuple(float(c) for c in point)

    def moment(self) -> Vec3:
        """m = r x omega (distance-from-origin encoding)."""
        r = self.point
        w = self.axis
        return (r[1] * w[2] - r[2] * w[1],
                r[2] * w[0] - r[0] * w[2],
                r[0] * w[1] - r[1] * w[0])

    def velocity_at(self, p: Vec3) -> Vec3:
        """v = omega x (p - q) for the pure-rotation screw."""
        d = tuple(p[k] - self.point[k] for k in range(3))
        w = self.axis
        return (w[1] * d[2] - w[2] * d[1],
                w[2] * d[0] - w[0] * d[2],
                w[0] * d[1] - w[1] * d[0])

    def pitch(self) -> float:
        return 0.0

    def describe(self) -> str:
        return (f"screw(axis={tuple(round(c, 3) for c in self.axis)}, "
                f"pitch=0)")


def screw_from_joint(axis: Vec3, origin: Vec3) -> Screw:
    return Screw(axis, origin)


def twist_norm(screw: Screw, p: Vec3) -> float:
    v = screw.velocity_at(p)
    return math.sqrt(sum(c * c for c in v))


def axis_segment(screw: Screw, length: float = 2.4) -> tuple[Vec3, Vec3]:
    """A symmetric segment along the screw axis for rendering."""
    a, w = screw.point, screw.axis
    start = tuple(a[k] - w[k] * length / 2 for k in range(3))
    end = tuple(a[k] + w[k] * length / 2 for k in range(3))
    return start, end
