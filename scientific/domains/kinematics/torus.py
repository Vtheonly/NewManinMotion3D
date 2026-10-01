"""Flat torus T^2: parametrization, flow field, trajectory integration.

State is the pair (theta, phi); the flow is the standard irrational-slope
field u = (a, b) — deterministic, closed-form, and cheap to verify.
"""

from __future__ import annotations

import math
from typing import Optional


def torus_point(theta: float, phi: float, major: float = 2.2,
                minor: float = 0.8) -> tuple[float, float, float]:
    """Embed (theta, phi) into R^3 (angles in radians)."""
    return (
        (major + minor * math.cos(phi)) * math.cos(theta),
        (major + minor * math.cos(phi)) * math.sin(theta),
        minor * math.sin(phi),
    )


def flow_vector(theta: float, phi: float, strength: float = 1.0,
                slope: float = 1.6180339887) -> tuple[float, float]:
    """Analytic constant flow field on the torus (golden-slope winding)."""
    return (strength * math.cos(0.3), strength * slope * 0.6180339887
            * math.sin(0.3 + 0.5 * math.sin(theta)))


def wrap_angle(angle: float) -> float:
    """Wrap to [-pi, pi)."""
    return (angle + math.pi) % (2 * math.pi) - math.pi


def integrate(start: tuple[float, float] = (0.1, 0.2), steps: int = 90,
              dt: float = 0.045, strength: float = 1.0,
              method: str = "midpoint") -> list[tuple[float, float]]:
    """Integrate the flow; midpoint (default) or Euler (for comparison)."""
    if steps < 0:
        raise ValueError("steps must be >= 0")
    if method not in ("midpoint", "euler"):
        raise ValueError(f"unknown method {method!r}")
    state = (float(start[0]), float(start[1]))
    path = [state]
    for _ in range(steps):
        if method == "midpoint":
            k1 = flow_vector(state[0], state[1], strength)
            mid = (state[0] + 0.5 * dt * k1[0],
                   state[1] + 0.5 * dt * k1[1])
            k2 = flow_vector(mid[0], mid[1], strength)
            state = (state[0] + dt * k2[0], state[1] + dt * k2[1])
        else:
            k = flow_vector(state[0], state[1], strength)
            state = (state[0] + dt * k[0], state[1] + dt * k[1])
        path.append(state)
    return path


def trajectory_3d(start: tuple[float, float] = (0.1, 0.2), steps: int = 90,
                  dt: float = 0.045, strength: float = 1.0,
                  major: float = 2.2, minor: float = 0.8,
                  method: str = "midpoint") -> list[tuple[float, float, float]]:
    """Flow trajectory embedded in R^3 (for rendering)."""
    return [
        torus_point(th, ph, major, minor)
        for th, ph in integrate(start, steps, dt, strength, method)
    ]


def residuum(path_a: list[tuple[float, float]],
             path_b: list[tuple[float, float]]) -> float:
    """Mean angular distance between two trajectories (test metric)."""
    if len(path_a) != len(path_b):
        raise ValueError("trajectory length mismatch")
    if not path_a:
        return 0.0
    total = 0.0
    for (a, b) in zip(path_a, path_b):
        total += math.hypot(wrap_angle(a[0] - b[0]), wrap_angle(a[1] - b[1]))
    return total / len(path_a)
