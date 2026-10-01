"""Timeline playback: closed set of step operations (manim implementations).

Split from timeline.py to keep files small; ANIMATIONS/RATE_MAP mirror the
authoring names validated by ir.timeline.validate_step.
"""

from __future__ import annotations

from typing import Any

from manim import (
    Create, DrawBorderThenFill, FadeIn, FadeOut, GrowFromCenter, Indicate,
    Uncreate, Write, DOWN,
)

from ..domains.ui.palette import color as palette_color
from .context import RenderContext
from .sides import side

ANIMATIONS = {
    "write": Write,
    "create": Create,
    "uncreate": Uncreate,
    "fade_in": FadeIn,
    "fade_out": FadeOut,
    "grow": GrowFromCenter,
    "indicate": Indicate,
    "draw": DrawBorderThenFill,
}

RATE_MAP = {
    "linear": "linear", "smooth": "smooth", "ease_in": "rush_into",
    "ease_out": "rush_from", "there_and_back": "there_and_back",
    "rush_into": "rush_into", "rush_from": "rush_from",
}


def rate_fn(name: str | None):
    if not name:
        return None
    import manim
    return getattr(manim, RATE_MAP.get(name, "smooth"), None)


def play_animation(scene, ctx, mob, step, duration) -> None:
    name = step.animation or "fade_in"
    kwargs = {}
    if duration is not None:
        kwargs["run_time"] = duration
    rate = rate_fn(step.rate)
    if rate is not None:
        kwargs["rate_func"] = rate
    if name == "shift_in":
        scene.play(FadeIn(mob, shift=DOWN * 0.6), **kwargs)
        return
    scene.play(ANIMATIONS.get(name, FadeIn)(mob), **kwargs)


def highlight(scene, mob, step, duration) -> None:
    props = step.properties or {}
    target = palette_color(props.get("color", "warn"))
    scene.play(mob.animate.set_color(target),
               run_time=float(duration or 1.0))


def annotate(scene, ctx, mob, step, duration) -> None:
    from manim import Text
    props = step.properties or {}
    text = ctx.format(str(props.get("value", "")))
    label = Text(text, font_size=26, color=palette_color("accent"))
    label.next_to(mob, side(props.get("side", "RIGHT")), buff=0.25)
    scene.play(FadeIn(label), run_time=float(duration or 1.0))


def transform(scene, ctx, step, duration) -> None:
    props = step.properties or {}
    mob = ctx.mobjects.get(step.target)
    if mob is None:
        return
    anim = None
    if "position" in props:
        pos = props["position"]
        anim = mob.animate.move_to([float(pos[0]), float(pos[1]),
                                    float(pos[2]) if len(pos) > 2 else 0.0])
    elif "scale" in props:
        anim = mob.animate.scale(float(props["scale"]))
    elif "color" in props:
        anim = mob.animate.set_color(palette_color(props["color"]))
    if anim is None:
        ctx.warn(f"transform step on {step.target!r} had no supported property")
        return
    scene.play(anim, run_time=float(duration or 1.5))


def run_custom(scene, ctx, code: str) -> None:
    """The advanced boundary: hand-written runtime code (kept verbatim)."""
    import manim
    namespace = {
        "scene": scene, "ctx": ctx, "manim": manim,
        "doc": ctx.document, "values": ctx.values, "mobs": ctx.mobjects,
    }
    exec(compile(code, "<custom-step>", "exec"), namespace)  # noqa: S102
