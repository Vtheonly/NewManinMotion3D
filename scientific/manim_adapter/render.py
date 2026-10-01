"""IR -> Manim render orchestration.

Pipeline: camera prologue -> resolve live values -> build mobjects in
parent-before-child order -> auto-show unreferenced artifacts -> play the
timeline (which reveals referenced artifacts and attaches relationships).
"""

from __future__ import annotations

from typing import Any, Optional

from ..ir.document import SceneDocument
from ..registry import renderer_for
from .camera import apply_camera
from .context import RenderContext


def render_document(scene: Any, document: SceneDocument,
                    data_root: Optional[str] = None) -> RenderContext:
    from . import bindings  # noqa: F401  (registers all renderers)
    from ..diagnostics import Diagnostics
    ctx = RenderContext(document=document, data_root=data_root or "",
                        diagnostics=Diagnostics(
                            scene_id=document.id,
                            schema=document.schema,
                            data_root=str(data_root or "")))
    apply_camera(scene, document.camera, document.scene_type)
    ctx.resolve_values()
    for ref in _data_provenance(document):
        ctx.diagnostics.provenance_add(ref)
    ctx.diagnostics.snapshot(ctx.values)

    revealed: set[str] = set()
    for node_id in _build_order(document):
        node = document.objects[node_id]
        _build_node(scene, ctx, node, revealed)

    referenced = _referenced_ids(document)
    auto = [nid for nid in _build_order(document) if nid not in referenced]
    for node_id in auto:
        _reveal(scene, ctx, node_id, revealed)

    from .timeline import attach_pending, play_timeline
    attach_pending(scene, ctx, revealed)
    play_timeline(scene, ctx, revealed=revealed)
    ctx.diagnostics.snapshot(ctx.values)
    return ctx


def _data_provenance(document: SceneDocument) -> list[str]:
    """Every DataRef path used by bindings and live values (sorted)."""
    refs = set()
    for source in list(document.bindings.values()) + \
            [v.source for v in document.values.values()]:
        if isinstance(source, dict) and source.get("kind") == "data":
            refs.add(str(source.get("ref", "")))
    return sorted(refs)


def _build_order(document: SceneDocument) -> list[str]:
    """Parent-before-child ordering (stable for insertion order)."""
    ordered: list[str] = []
    placed: set[str] = set()
    pending = list(document.objects.keys())
    while pending:
        progressed = False
        remaining = []
        for nid in pending:
            node = document.objects[nid]
            if node.parent_id is None or node.parent_id in placed:
                ordered.append(nid)
                placed.add(nid)
                progressed = True
            else:
                remaining.append(nid)
        pending = remaining
        if not progressed:  # cycle guard (validation rejects these earlier)
            ordered.extend(pending)
            break
    return ordered


def _build_node(scene, ctx: RenderContext, node, revealed: set[str]) -> None:
    fn = renderer_for(node.type)
    if fn is None:
        ctx.warn(f"no renderer bound for type {node.type!r} ({node.id})")
        return
    mob = fn(node, ctx)
    if mob is None:
        return
    _apply_transform(mob, node)
    if node.parent_id and node.parent_id in ctx.mobjects:
        from manim import VGroup
        parent_mob = ctx.mobjects[node.parent_id]
        if isinstance(parent_mob, VGroup):
            parent_mob.add(mob)
        mob.shift(_position_of(parent_mob))
    ctx.mobjects[node.id] = mob
    if node.type == "hud.fixed" and document_is_3d(ctx):
        scene.add_fixed_in_frame_mobjects(mob)
        revealed.add(node.id)


def _apply_transform(mob, node) -> None:
    tr = node.transform
    if tr.position != (0.0, 0.0, 0.0):
        mob.move_to([tr.position[0], tr.position[1], tr.position[2]])
    if tr.rotation:
        import math
        mob.rotate(math.radians(tr.rotation))
    if tr.scale != 1.0:
        mob.scale(tr.scale)


def _position_of(mob):
    c = mob.get_center()
    return [c[0], c[1], c[2] if len(c) > 2 else 0.0]


def _reveal(scene, ctx: RenderContext, node_id: str, revealed: set[str]) -> None:
    if node_id in revealed or node_id not in ctx.mobjects:
        return
    if not (ctx.document.objects[node_id].type == "hud.fixed"
            and document_is_3d(ctx)):
        scene.add(ctx.mobjects[node_id])
    revealed.add(node_id)


def _referenced_ids(document: SceneDocument) -> set[str]:
    ids: set[str] = set()
    for stage in document.timeline:
        for step in stage.steps:
            if step.target:
                ids.add(step.target)
            for src in _step_sources(step):
                ids.add(src)
    for rel in document.relationships.values():
        ids.update(rel.sources)
    return ids


def _step_sources(step) -> list[str]:
    return [s for s in (step.properties or {}).values()
            if isinstance(s, str)]


def document_is_3d(ctx: RenderContext) -> bool:
    return ctx.document.scene_type == "three_d"
