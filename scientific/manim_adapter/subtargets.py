"""Sub-target resolution — drill into composite artifacts (issue #5/#32).

Composite bindings (graph networks, matrices, formulas, tables, machines)
register a ``subtargets`` resolver through :func:`register`.  Given a
dotted path like ``node:a`` / ``edge:a-b`` / ``cell:2:3`` / ``term:Jt``,
the resolver returns the child mobject so highlights and annotations can
address *parts* of a semantic object without flattening its identity.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from .context import RenderContext

Resolver = Callable[[RenderContext, str, str, Any], Any]

_resolvers: dict[str, Resolver] = {}


def register(type_key: str, resolver: Resolver) -> None:
    _resolvers[type_key] = resolver


def resolve_subtarget(ctx: RenderContext, artifact_id: str, mob: Any,
                      subpath: str) -> Optional[Any]:
    node = ctx.document.objects.get(artifact_id)
    if node is None:
        return None
    resolver = _resolvers.get(node.type)
    if resolver is None:
        ctx.warn(f"type {node.type!r} does not expose sub-targets "
                 f"({artifact_id}.{subpath})")
        return None
    return resolver(ctx, artifact_id, subpath, mob)


def _graph_subtarget(ctx: RenderContext, artifact_id: str, subpath: str,
                     mob: Any) -> Optional[Any]:
    children = getattr(mob, "submobjects", [])
    kind, _, name = subpath.partition(":")
    prefix = f"{kind}:"
    for child in children:
        key = getattr(child, "suprepto_subtarget", "")
        if key == subpath:
            return child
    # fallback: position-based lookup via stored labels
    return next((c for c in children
                 if getattr(c, "suprepto_subtarget", "") == subpath), None)


def _generic_indexed(ctx: RenderContext, artifact_id: str, subpath: str,
                     mob: Any) -> Optional[Any]:
    kind, _, index = subpath.partition(":")
    try:
        idx = int(index)
    except ValueError:
        return None
    children = getattr(mob, "submobjects", [])
    return children[idx] if 0 <= idx < len(children) else None


register("graph.network", _graph_subtarget)
register("math.matrix", _generic_indexed)
register("presentation.table", _generic_indexed)
