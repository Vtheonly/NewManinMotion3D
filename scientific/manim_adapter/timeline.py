"""Timeline interpretation — declarative stages to manim animations."""

from __future__ import annotations

from typing import Any, Optional

from .camera import play_camera_op
from .compare_ops import run_compare
from .context import RenderContext
from .highlight_ops import apply_highlight
from .machine_ops import run_transition
from .relationships import attach_relationship
from .state_ops import run_interpolate, run_set
from .step_ops import annotate, play_animation, run_custom, transform


def play_timeline(scene: Any, ctx: RenderContext,
                  revealed: Optional[set[str]] = None) -> None:
    """Execute every stage of the document timeline in order."""
    revealed = set(revealed or ())
    _attach_live_annotations(scene, ctx)
    for stage in ctx.document.timeline:
        if ctx.diagnostics is not None:
            ctx.diagnostics.begin()
        for step in stage.steps:
            _run_step(scene, ctx, step, stage.id, revealed)
    attach_pending(scene, ctx, revealed)


def _run_step(scene, ctx: RenderContext, step, stage_id: str,
              revealed: set[str]) -> None:
    op = step.op
    if ctx.diagnostics is not None:
        ctx.diagnostics.step(stage_id, op, step.target, step.duration)
    if op == "custom":
        run_custom(scene, ctx, step.code or "pass")
        return
    if op == "wait":
        scene.wait(float(step.duration or 0.5))
        return
    if op == "camera":
        play_camera_op(scene, step.properties, float(step.duration or 2.0),
                       ctx.document.scene_type)
        if ctx.diagnostics is not None:
            ctx.diagnostics.camera(step.properties or {},
                                   float(step.duration or 2.0))
        return
    if op == "set":
        run_set(scene, ctx, step)
        return
    if op == "interpolate":
        run_interpolate(scene, ctx, step)
        return
    if op == "transition":
        run_transition(scene, ctx, step)
        return
    if op == "compare":
        run_compare(scene, ctx, step)
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
        apply_highlight(scene, ctx, step, duration)
    elif op == "annotate":
        annotate(scene, ctx, mob, step, duration)
    elif op == "transform":
        transform(scene, ctx, step, duration)
    attach_pending(scene, ctx, revealed)


def _attach_live_annotations(scene, ctx: RenderContext) -> None:
    """Persistent annotations (issue #5): live text bound to providers.

    A live annotation tracks its target for the whole render: the label
    re-renders from the provider's value tracker every frame (issue #4)
    and follows the target through camera moves and transforms (updaters
    re-evaluate ``next_to`` continuously).
    """
    from manim import FadeIn
    from .state_ops import live_text
    for ann in ctx.document.annotations.values():
        mob = ctx.mobjects.get(ann.target)
        if mob is None:
            continue
        template = (ann.format or
                    ctx.provider_format(ann.provider) if ann.provider
                    else ann.value or "{value}")
        label = live_text(ctx, ann.provider, template,
                          font_size=24, color="accent") if ann.provider \
            else None
        if label is None:
            continue
        if ann.follow:
            from .sides import side
            where = side(ann.side)
            label.add_updater(lambda m: m.next_to(mob, where, buff=0.22))
        scene.add(label)
        ctx.mobjects[f"__ann_{ann.id}"] = label
        if not ann.live:
            scene.remove(label)  # static variant revealed on demand


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
