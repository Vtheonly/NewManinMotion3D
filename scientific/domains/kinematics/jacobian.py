"""Geometric Jacobian and damped-least-squares (DLS) resolution.

Column i for a revolute joint: [ z_i x (p_ee - o_i) ; z_i ].
Used for jacobian-arrow visualisation and clash resolution.
"""

from __future__ import annotations

import math
from typing import Optional

from .chain import PoEChain
from .poe import Vec3


def _sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a: Vec3, b: Vec3) -> Vec3:
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def _norm(v: Vec3) -> float:
    return math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)


def jacobian(chain: PoEChain,
             thetas: Optional[list[float]] = None) -> list[Vec3]:
    """Linear (top) rows of the geometric Jacobian — one 3-vector per joint."""
    thetas = chain._cfg(thetas)
    frames = chain.current_frames(thetas)
    p_ee = chain.end_effector(thetas)
    return [_cross(axis, _sub(p_ee, origin)) for axis, origin in frames]


def jacobian_full(chain: PoEChain,
                  thetas: Optional[list[float]] = None) -> list[tuple[Vec3, Vec3]]:
    """Both rows: [(linear_i, angular_i)] per joint."""
    thetas = chain._cfg(thetas)
    frames = chain.current_frames(thetas)
    p_ee = chain.end_effector(thetas)
    return [(_cross(axis, _sub(p_ee, origin)), axis) for axis, origin in frames]


def dls_step(jac: list[Vec3], error: Vec3, damping: float = 0.15) -> list[float]:
    """One damped-least-squares step: dtheta = J^T (J J^T + lambda^2 I)^-1 e.

    Solved with a small Gaussian elimination (3x3 system) — no numpy.
    """
    n = len(jac)
    if n == 0:
        return []
    # A = J J^T + lambda^2 I   (3x3)
    A = [[sum(jac[k][i] * jac[k][j] for k in range(n)) +
          (damping ** 2 if i == j else 0.0) for j in range(3)] for i in range(3)]
    b = list(error)
    x = _solve3(A, b)
    return [sum(jac[k][i] * x[i] for i in range(3)) for k in range(n)]


def _solve3(A: list[list[float]], b: list[float]) -> list[float]:
    """Gaussian elimination with partial pivoting for 3x3 systems."""
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(3):
        pivot = max(range(col, 3), key=lambda r: abs(M[r][col]))
        if abs(M[pivot][col]) < 1e-12:
            return [0.0, 0.0, 0.0]
        M[col], M[pivot] = M[pivot], M[col]
        for r in range(col + 1, 3):
            factor = M[r][col] / M[col][col]
            for c in range(col, 4):
                M[r][c] -= factor * M[col][c]
    x = [0.0, 0.0, 0.0]
    for r in (2, 1, 0):
        s = M[r][3] - sum(M[r][c] * x[c] for c in range(r + 1, 3))
        x[r] = s / M[r][r]
    return x


def residual(chain: PoEChain, target: Vec3) -> float:
    return _norm(_sub(chain.end_effector(), target))


def numerical_jacobian_check(chain: PoEChain, delta: float = 1e-5) -> float:
    """Max column error between analytic and FD Jacobian (test helper)."""
    analytic = jacobian(chain)
    base = chain.end_effector()
    worst = 0.0
    for i in range(len(chain.thetas)):
        bumped = list(chain.thetas)
        bumped[i] += delta
        shifted = chain.end_effector(bumped)
        fd = tuple((shifted[k] - base[k]) / delta for k in range(3))
        err = _norm(_sub(analytic[i], fd))
        worst = max(worst, err)
    return worst
