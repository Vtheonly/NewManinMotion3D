"""Camera handling: prologue configuration + animated camera ops.

Mirrors the compiler scene registry semantics (issue #1): background color
always; frame width/height/scale/center for moving camera; phi/theta/
distance/zoom/gamma for 3D.
"""

from __future__ import annotations

from typing import Any

from ..domains.ui.palette import color as palette_color


def apply_camera(scene: Any, camera: dict, scene_type: str) -> None:
    """Set the static camera/background configuration before any mobject."""
    bg = camera.get("backgroundColor")
    scene.camera.background_color = palette_color(bg) if bg else "#101014"

    if scene_type == "moving_camera":
        frame = getattr(scene.camera, "frame", None)
        if frame is None:
            return
        width = _num(camera.get("frameWidth"))
        height = _num(camera.get("frameHeight"))
        if width and width > 0:
            frame.width = width
        if height and height > 0:
            frame.height = height
        zoom = _num(camera.get("zoom"))
        if zoom and abs(zoom - 1.0) > 1e-3:
            frame.scale(zoom)
        cx, cy = _num(camera.get("centerX")), _num(camera.get("centerY"))
        if cx is not None or cy is not None:
            frame.move_to([cx or 0.0, cy or 0.0, 0.0])
    elif scene_type == "three_d":
        kwargs: dict[str, float] = {}
        phi = _num(camera.get("phi"))
        theta = _num(camera.get("theta"))
        if phi is not None:
            import math
            kwargs["phi"] = phi * math.pi / 180.0
        if theta is not None:
            import math
            kwargs["theta"] = theta * math.pi / 180.0
        distance = _num(camera.get("distance"))
        if distance is not None:
            kwargs["distance"] = distance
        zoom = _num(camera.get("zoom"))
        if zoom and abs(zoom - 1.0) > 1e-3:
            kwargs["zoom"] = zoom
        if kwargs:
            scene.set_camera_orientation(**kwargs)


def play_camera_op(scene: Any, props: dict, duration: float,
                   scene_type: str) -> None:
    """Animated camera step (timeline op 'camera')."""
    props = props or {}
    if scene_type == "moving_camera":
        frame = getattr(scene.camera, "frame", None)
        if frame is None:
            return
        anim = None
        zoom = _num(props.get("zoom"))
        cx, cy = _num(props.get("centerX")), _num(props.get("centerY"))
        if zoom is not None and abs(zoom - 1.0) > 1e-3:
            anim = frame.animate.scale(zoom)
        if cx is not None or cy is not None:
            target = frame.animate.move_to([cx or 0.0, cy or 0.0, 0.0])
            anim = target if anim is None else None
        if anim is not None:
            scene.play(anim, run_time=duration)
    elif scene_type == "three_d":
        if "orbit" in props:
            scene.begin_ambient_camera_rotation(rate=float(props["orbit"]))
            scene.wait(duration)
            scene.stop_ambient_camera_rotation()
        elif props.get("phi") is not None or props.get("theta") is not None:
            import math
            kwargs: dict[str, float] = {}
            phi = _num(props.get("phi"))
            theta = _num(props.get("theta"))
            if phi is not None:
                kwargs["phi"] = phi * math.pi / 180.0
            if theta is not None:
                kwargs["theta"] = theta * math.pi / 180.0
            if kwargs:
                scene.move_camera(**kwargs, run_time=duration)


def _num(value: Any):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
