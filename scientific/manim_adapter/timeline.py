"""Timeline interpretation — declarative stages to manim animations."""

from __future__ import annotations

from typing import Any, Optional

from .camera import play_camera_op
from .context import RenderContext
from .relationships import attach_relationship
from .step_ops import annotate, highlight, play_animation, run_custom, transform


def play_timeline(scene: Any, ctx: RenderContext,
                  revealed: Optional[set[str]] = None) -> None:
    """Execute every stage of the document timeline in order."""
    revealed = set(revealed or ())
    for stage in ctx.document.timeline:
        for step in stage.steps:
            _run_step(scene, ctx, step, revealed)
    attach_pending(scene, ctx, revealed)




def _run_step(scene, ctx: RenderContext, step, revealed: set[str]) -> None:
    op = step.op
    if op == "custom":
        run_custom(scene, ctx, step.code or "pass")
        return
    if op == "wait":
        scene.wait(float(step.duration or 0.5))
        return
    if op == "camera":
        play_camera_op(scene, step.properties, float(step.duration or 2.0),
                       ctx.document.scene_type)
        return
    mob = _target(ctx, step.target)
    if mob is None:
        return
    duration = float(step.duration) if step.duration is not None else None

    if op == "show":
        scene.add(mob)
        revealed.add(step.target)
    elif op == "play":
        play_animation(scene, ctx, mob, step, duration)
        revealed.add(step.target)
    elif op == "highlight":
        highlight(scene, mob, step, duration)
    elif op == "annotate":
        annotate(scene, ctx, mob, step, duration)
    elif op == "transform":
        transform(scene, ctx, step, duration)
    attach_pending(scene, ctx, revealed)


def _target(ctx: RenderContext, target_id):
    if target_id is None:
        return None
    if target_id not in ctx.mobjects:
        ctx.warn(f"step targets unknown or unbuilt node {target_id!r}")
        return None
    return ctx.mobjects[target_id]


def attach_pending(scene: Any, ctx: RenderContext, revealed: set[str]) -> None:
    """Attach relationships whose sources are all visible now."""
    for rel in ctx.document.relationships.values():
        if rel.id in ctx.mobjects:
            continue
        if all(s in revealed for s in rel.sources):
            attach_relationship(scene, ctx, rel)
            revealed.add(rel.id)
