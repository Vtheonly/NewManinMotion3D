"""Product of exponentials (PoE) — spatial revolute chains.

Pure-python 4x4 matrix math (no numpy) so the runtime has zero mandatory
dependencies.  Joints alternate axes (z, y, z, …); links advance along x by
`link_length`.  FK uses the spatial convention:

    T(theta) = exp(S1 t1) · … · exp(Sn tn) · M(home)

where each screw S_i is taken at the zero configuration.
"""

from __future__ import annotations

import math
from typing import Optional

Vec3 = tuple[float, float, float]
Mat4 = list[list[float]]

EPS = 1e-9


def identity() -> Mat4:
    return [[1.0, 0, 0, 0], [0, 1.0, 0, 0], [0, 0, 1.0, 0], [0, 0, 0, 1.0]]


def translation(v: Vec3) -> Mat4:
    """Pure translation (infinite-pitch screw)."""
    T = identity()
    T[0][3], T[1][3], T[2][3] = float(v[0]), float(v[1]), float(v[2])
    return T


def mat_mul(a: Mat4, b: Mat4) -> Mat4:
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)]
            for i in range(4)]


def apply(T: Mat4, p: Vec3) -> Vec3:
    """Apply a 4x4 rigid transform to a point."""
    return (
        T[0][0] * p[0] + T[0][1] * p[1] + T[0][2] * p[2] + T[0][3],
        T[1][0] * p[0] + T[1][1] * p[1] + T[1][2] * p[2] + T[1][3],
        T[2][0] * p[0] + T[2][1] * p[1] + T[2][2] * p[2] + T[2][3],
    )


def rotate(T: Mat4, v: Vec3) -> Vec3:
    """Apply only the rotation part to a direction."""
    return (
        T[0][0] * v[0] + T[0][1] * v[1] + T[0][2] * v[2],
        T[1][0] * v[0] + T[1][1] * v[1] + T[1][2] * v[2],
        T[2][0] * v[0] + T[2][1] * v[1] + T[2][2] * v[2],
    )


def skew(v: Vec3) -> list[list[float]]:
    return [[0.0, -v[2], v[1]], [v[2], 0.0, -v[0]], [-v[1], v[0], 0.0]]


def so3_exp(omega: Vec3, theta: float) -> list[list[float]]:
    """Rodrigues rotation about unit `omega` by `theta` radians.

    R = I + sin(theta) K + (1 - cos(theta)) K^2
    """
    w = math.sqrt(omega[0] ** 2 + omega[1] ** 2 + omega[2] ** 2)
    if w < EPS or abs(theta) < EPS:
        return [[1.0, 0, 0], [0, 1.0, 0], [0, 0, 1.0]]
    k = (omega[0] / w, omega[1] / w, omega[2] / w)
    K = skew(k)
    s, c = math.sin(theta), math.cos(theta)
    return [
        [(1.0 if i == j else 0.0) + K[i][j] * s
         + (1 - c) * (K[i][0] * K[0][j] + K[i][1] * K[1][j]
                      + K[i][2] * K[2][j])
         for j in range(3)]
        for i in range(3)
    ]


def se3_exp(axis: Vec3, point: Vec3, theta: float) -> Mat4:
    """Exponential of a zero-pitch screw (revolute joint) in SE(3).

    Twist: S = (w, v_s) with v_s = -w x q for a point q on the axis;
    e^{[S]theta} = [[R, G(theta) v_s], [0, 1]] with
    G(theta) = I*theta + (1-cos)K + (theta-sin)K^2.
    """
    n = math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2)
    if n < EPS:
        return identity()
    w = (axis[0] / n, axis[1] / n, axis[2] / n)
    K = skew(w)
    q = (point[0], point[1], point[2])
    v_s = (-w[1] * q[2] + w[2] * q[1],
           -w[2] * q[0] + w[0] * q[2],
           -w[0] * q[1] + w[1] * q[0])
    c, s = math.cos(theta), math.sin(theta)

    def G(v: Vec3) -> Vec3:
        Kv = (sum(K[i][j] * v[j] for j in range(3)) for i in range(3))
        Kv = tuple(Kv)
        KKv = tuple(sum(K[i][k] * Kv[k] for k in range(3)) for i in range(3))
        return tuple(theta * v[i] + (1 - c) * Kv[i]
                     + (theta - s) * KKv[i] for i in range(3))

    out = identity()
    R = so3_exp(w, theta)
    v = G(v_s)
    for i in range(3):
        for j in range(3):
            out[i][j] = R[i][j]
        out[i][3] = v[i]
    return out
