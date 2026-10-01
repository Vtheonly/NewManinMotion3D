"""Drivers — how a state symbol's value evolves with time.

A driver is the *only* time-dependent part of the state engine:

- ``StaticDriver`` holds one constant value;
- ``KeyframeDriver`` interpolates through sorted ``(time, value)`` keyframes
  with an easing curve — this is what makes "x moves from 0 to 10 and a live
  readout continuously shows the interpolated value" true rather than
  scripted (issue #4);
- ``SeriesDriver`` samples an external time-indexed series (issue #11).

Drivers are pure: they never touch manim or the scene graph.
"""

from __future__ import annotations

from typing import Any, Iterable, Optional, Sequence

from .easing import ease, is_easing


class DriverError(ValueError):
    """Malformed driver specification."""


class StaticDriver:
    kind = "static"

    def __init__(self, value: Any):
        self.value = value

    def value_at(self, t: float) -> Any:
        return self.value

    def to_dict(self) -> dict:
        return {"kind": "static", "value": self.value}

    def keyframes(self) -> list[tuple[float, Any]]:
        return [(0.0, self.value)]


class KeyframeDriver:
    """Piecewise-numeric driver: value(t) eased between keyframes."""

    kind = "keyframes"

    def __init__(self, keyframes: Sequence[Sequence[float]],
                 easing: str = "smooth"):
        if not keyframes:
            raise DriverError("keyframe driver needs at least one keyframe")
        frames: list[tuple[float, float]] = []
        for kf in keyframes:
            if len(kf) != 2:
                raise DriverError(f"keyframe must be (time, value): {kf!r}")
            frames.append((float(kf[0]), float(kf[1])))
        frames.sort(key=lambda kv: kv[0])
        self.keyframe_list = frames
        self.easing = easing if is_easing(easing) else "smooth"

    def value_at(self, t: float) -> float:
        frames = self.keyframe_list
        if t <= frames[0][0]:
            return frames[0][1]
        if t >= frames[-1][0]:
            return frames[-1][1]
        for index in range(len(frames) - 1):
            t0, v0 = frames[index]
            t1, v1 = frames[index + 1]
            if t0 <= t <= t1:
                span = (t1 - t0) or 1.0
                alpha = (t - t0) / span
                return v0 + (v1 - v0) * ease(self.easing, alpha)
        return frames[-1][1]  # pragma: no cover

    def to_dict(self) -> dict:
        return {"kind": "keyframes",
                "keyframes": [list(kf) for kf in self.keyframe_list],
                "easing": self.easing}

    def keyframes(self) -> list[tuple[float, Any]]:
        return list(self.keyframe_list)


class SeriesDriver:
    """Samples an (explicitly supplied) time-indexed series."""

    kind = "series"

    def __init__(self, times: Iterable[float], values: Iterable[float]):
        pairs = sorted((float(t), float(v)) for t, v in zip(times, values))
        if not pairs:
            raise DriverError("series driver needs at least one sample")
        self.samples = pairs

    def value_at(self, t: float) -> float:
        if t <= self.samples[0][0]:
            return self.samples[0][1]
        if t >= self.samples[-1][0]:
            return self.samples[-1][1]
        for index in range(len(self.samples) - 1):
            t0, v0 = self.samples[index]
            t1, v1 = self.samples[index + 1]
            if t0 <= t <= t1:
                span = (t1 - t0) or 1.0
                return v0 + (v1 - v0) * ((t - t0) / span)
        return self.samples[-1][1]  # pragma: no cover

    def to_dict(self) -> dict:
        return {"kind": "series",
                "times": [t for t, _ in self.samples],
                "values": [v for _, v in self.samples]}

    def keyframes(self) -> list[tuple[float, Any]]:
        return list(self.samples)


def driver_from(spec: Optional[dict]):
    """Build a driver from its serialized dict form."""
    if spec is None:
        return None
    kind = spec.get("kind", "static")
    if kind == "static":
        return StaticDriver(spec.get("value"))
    if kind == "keyframes":
        return KeyframeDriver(spec.get("keyframes") or [],
                              spec.get("easing", "smooth"))
    if kind == "series":
        return SeriesDriver(spec.get("times") or [],
                            spec.get("values") or [])
    raise DriverError(f"unknown driver kind {kind!r}")
