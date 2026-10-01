"""Composable highlight behaviors (issue #5).

One canonical implementation for every target class: behaviors are
resolved against the *mobject* (optionally a sub-target extracted by the
owning binding — see subtargets.py), then composed in order.  Works for
2D and 3D scenes alike because it operates on plain mobjects.
"""

from __future__ import annotations

from typing import Any, Optional

from ..domains.ui.palette import color as palette_color
from ..ir.highlight import normalize_behaviors, split_subtarget
from .context import RenderContext

TEMPORARY = ("pulse", "emphasis")


def apply_highlight(scene, ctx: RenderContext, step, duration) -> None:
    """Execute a highlight step: behaviors applied to the target mobject."""
    props = step.properties or {}
    behaviors = normalize_behaviors(props.get("behaviors") or ["outline"])
    target_color = palette_color(props.get("color", "warn"))
    label_text = props.get("label")
    run_time = float(duration if duration is not None else 1.0)

    artifact_id, subpath = split_subtarget(step.target or "")
    mob = _resolve_target(ctx, artifact_id, subpath)
    if mob is None:
        ctx.warn(f"highlight target {step.target!r} has no built mobject")
        return

    others = _other_mobjects(ctx, artifact_id)
    anims: list[Any] = []
    for behavior in behaviors:
        anims.extend(_behavior(scene, ctx, mob, behavior, target_color,
                                others, label_text, run_time))
    if anims:
        scene.play(*anims, run_time=run_time)
    # temporary emphasis reverts after the beat
    if any(b in TEMPORARY for b in behaviors) and not props.get("hold"):
        scene.play(mob.animate.set_color(mob.color), run_time=min(0.4,
                                                                 run_time))


def _resolve_target(ctx: RenderContext, artifact_id: str,
                    subpath: Optional[str]):
    from .subtargets import resolve_subtarget
    mob = ctx.mobjects.get(artifact_id)
    if mob is None:
        return None
    if subpath is None:
        return mob
    return resolve_subtarget(ctx, artifact_id, mob, subpath)


def _other_mobjects(ctx: RenderContext, keep_id: str) -> list[Any]:
    return [m for mid, m in ctx.mobjects.items()
            if mid != keep_id and mid not in ctx.document.relationships
            and hasattr(m, "set_opacity")]


def _behavior(scene, ctx, mob, behavior: str, color, others,
              label_text, run_time) -> list[Any]:
    from manim import (Arrow, Create, FadeIn, Indicate, SurroundingRectangle,
                       Text, UP)
    out: list[Any] = []
    if behavior == "outline":
        rect = SurroundingRectangle(mob, color=color, buff=0.14)
        out.append(Create(rect))
        scene.add(rect)
    elif behavior in ("glow",):
        for i, scale in enumerate((1.06, 1.12)):
            halo = SurroundingRectangle(mob, color=color, buff=0.08 + 0.06 * i)
            halo.set_stroke(width=1.4, opacity=0.5 - 0.2 * i)
            scene.add(halo)
    elif behavior == "pulse":
        out.append(Indicate(mob, color=color, scale_factor=1.12))
    elif behavior == "emphasis":
        out.append(mob.animate.set_color(color))
    elif behavior == "dim_others":
        out.append(*[o.animate.set_opacity(0.25) for o in others])
    elif behavior == "focus":
        pass  # alias: focus = outline + dim_others (already expanded)
    elif behavior == "arrow":
        arrow = Arrow(mob.get_corner(UP + UP * 0) if hasattr(mob, "get_corner")
                      else mob.get_center() + UP * 2, mob.get_center(),
                      color=color, buff=0.3)
        out.append(FadeIn(arrow))
        scene.add(arrow)
    elif behavior == "label":
        text = Text(str(label_text or ""), font_size=26, color=color)
        text.next_to(mob, UP, buff=0.22)
        out.append(FadeIn(text))
        scene.add(text)
    elif behavior == "region":
        rect = SurroundingRectangle(mob, color=color, buff=0.3)
        rect.set_fill(color, opacity=0.12)
        out.append(FadeIn(rect))
        scene.add(rect)
    elif behavior == "temporary":
        out.append(Indicate(mob, color=color))
    return out
