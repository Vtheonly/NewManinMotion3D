"""PoEChain — serial revolute chain with spatial FK and current frames."""

from __future__ import annotations

from typing import Optional

from .poe import (Mat4, Vec3, apply, identity, mat_mul, rotate, se3_exp,
                  translation)


class PoEChain:
    """Joints alternate about z and y; links advance along x by link_length."""

    def __init__(self, thetas: list[float], link_length: float = 0.9):
        if not thetas:
            raise ValueError("chain needs at least one joint angle")
        self.thetas = [float(t) for t in thetas]
        self.L = float(link_length)

    # ── configuration-independent structure ────────────────────────
    def joint_axes(self) -> list[Vec3]:
        return [(0.0, 0.0, 1.0) if i % 2 == 0 else (0.0, 1.0, 0.0)
                for i in range(len(self.thetas))]

    def joint_frames(self) -> list[tuple[Vec3, Vec3]]:
        """(axis, origin) per joint at the ZERO configuration."""
        frames: list[tuple[Vec3, Vec3]] = []
        T = identity()
        for axis in self.joint_axes():
            origin = (T[0][3], T[1][3], T[2][3])
            frames.append((axis, origin))
            T = mat_mul(T, translation((self.L, 0.0, 0.0)))
        return frames

    def ee_home(self) -> Vec3:
        return (len(self.thetas) * self.L, 0.0, 0.0)

    # ── kinematics ─────────────────────────────────────────────────
    def fk(self, thetas: Optional[list[float]] = None) -> list[Mat4]:
        """[T_0=I, T_1, …, T_n] — world transform after each joint."""
        thetas = self._cfg(thetas)
        frames = self.joint_frames()
        Ts = [identity()]
        T = identity()
        for (axis, origin), theta in zip(frames, thetas):
            T = mat_mul(T, se3_exp(axis, origin, theta))
            Ts.append([row[:] for row in T])
        return Ts

    def current_frames(self,
                       thetas: Optional[list[float]] = None
                       ) -> list[tuple[Vec3, Vec3]]:
        """(axis, origin) per joint at the CURRENT configuration."""
        thetas = self._cfg(thetas)
        frames = self.joint_frames()
        T = identity()
        out: list[tuple[Vec3, Vec3]] = []
        for i, ((axis, origin), theta) in enumerate(zip(frames, thetas)):
            if i == 0:
                out.append((axis, origin))
            else:
                out.append((rotate(T, axis), apply(T, origin)))
            T = mat_mul(T, se3_exp(axis, origin, theta))
        return out

    def joint_positions(self,
                        thetas: Optional[list[float]] = None) -> list[Vec3]:
        """World points: base, joint origins, end effector (in order)."""
        thetas = self._cfg(thetas)
        frames = self.joint_frames()
        T = identity()
        points: list[Vec3] = [(0.0, 0.0, 0.0)]
        for i, ((axis, origin), theta) in enumerate(zip(frames, thetas)):
            if i > 0:
                points.append(apply(T, origin))
            T = mat_mul(T, se3_exp(axis, origin, theta))
        points.append(apply(T, self.ee_home()))
        return points

    def end_effector(self, thetas: Optional[list[float]] = None) -> Vec3:
        return self.joint_positions(thetas)[-1]

    def _cfg(self, thetas: Optional[list[float]]) -> list[float]:
        cfg = self.thetas if thetas is None else [float(t) for t in thetas]
        if len(cfg) != len(self.thetas):
            raise ValueError(
                f"expected {len(self.thetas)} angles, got {len(cfg)}")
        return cfg
