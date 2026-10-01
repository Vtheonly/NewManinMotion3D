"""Emission helpers: nodes, formulas and timeline steps -> authoring calls."""

from __future__ import annotations

import keyword

from .literals import py_literal


def _kwarg(k: str, v) -> str:
    """One keyword argument; Python-keyword names use dict splatting."""
    if k.isidentifier() and not keyword.iskeyword(k):
        return f"{k}={py_literal(v)}"
    return f"**{{{py_literal(k)}: {py_literal(v)}}}"


def placement_kwargs(node) -> list[str]:
    """Authoring placement kwargs for a node's parent/space/transform."""
    extra = []
    if node.parent_id:
        extra.append(f"parent={py_literal(node.parent_id)}")
    if node.space != "scene2d":
        extra.append(f"space={py_literal(node.space)}")
    if node.label:
        extra.append(f"label={py_literal(node.label)}")
    tr = node.transform
    if tr.position != (0.0, 0.0, 0.0) or tr.rotation or tr.scale != 1.0:
        extra.append(f"position={py_literal(list(tr.position))}")
        if tr.rotation:
            extra.append(f"rotation={py_literal(tr.rotation)}")
        if tr.scale != 1.0:
            extra.append(f"scale={py_literal(tr.scale)}")
    return extra


def emit_node(w, node) -> None:
    parts = [py_literal(node.type), py_literal(node.id)]
    parts.extend(_kwarg(k, v) for k, v in sorted(node.properties.items()))
    parts.extend(placement_kwargs(node))
    w(f"    scene.node({', '.join(parts)})")


def emit_expr(w, expr, node) -> None:
    kwargs = [f"source={py_literal(expr.source)}"]
    if expr.terms:
        kwargs.append(f"terms={py_literal(expr.terms)}")
    if expr.bindings:
        kwargs.append(f"bindings={py_literal(expr.bindings)}")
    if expr.highlights:
        kwargs.append(f"highlights={py_literal(expr.highlights)}")
    if expr.format is not None:
        kwargs.append(f"format={py_literal(expr.format)}")
    if node is not None:
        kwargs.extend(_kwarg(k, v) for k, v in sorted(node.properties.items())
                      if k != "source")
        kwargs.extend(placement_kwargs(node))
    w(f"    scene.formula({py_literal(expr.id)}, {', '.join(kwargs)})")


def emit_step(w, step) -> None:
    op = step.op
    target = py_literal(step.target) if step.target else None
    dur = (f", duration={py_literal(step.duration)}"
           if step.duration is not None else "")
    if op == "show":
        w(f"        st.show({target})")
    elif op == "play":
        anim = [py_literal(step.animation)]
        if step.duration is not None:
            anim.append(f"duration={py_literal(step.duration)}")
        if step.rate:
            anim.append(f"rate={py_literal(step.rate)}")
        w(f"        st.play({target}, {', '.join(anim)})")
    elif op == "highlight":
        w(f"        st.highlight({target}{_highlight_tail(step)}{dur})")
    elif op == "annotate":
        val = step.properties.get("value") if step.properties else None
        w(f"        st.annotate({target}, {py_literal(val)}{dur})")
    elif op == "wait":
        w(f"        st.wait({py_literal(step.duration or 0.5)})")
    elif op == "camera":
        w(f"        st.camera({py_literal(step.properties or {})}{dur})")
    elif op == "transform":
        w(f"        st.transform({target}, "
          f"{py_literal(step.properties or {})}{dur})")
    elif op == "set":
        value = (step.properties or {}).get("value")
        w(f"        st.set({target}, {py_literal(value)})")
    elif op == "interpolate":
        w(f"        st.interpolate({target}{_interpolate_tail(step)})")
    elif op == "transition":
        w(f"        st.transition({target}{_transition_tail(step)}{dur})")
    elif op == "compare":
        w(f"        st.compare({target}{dur})")
    elif op == "custom":
        w(f"        st.custom({py_literal(step.code or '')})")


def _highlight_tail(step) -> str:
    props = step.properties or {}
    tail = ""
    if props.get("behaviors"):
        tail += f", behaviors={py_literal(props['behaviors'])}"
    if "color" in props:
        tail += f", color={py_literal(props['color'])}"
    if props.get("label"):
        tail += f", label={py_literal(props['label'])}"
    return tail


def _interpolate_tail(step) -> str:
    props = step.properties or {}
    tail = f", to={py_literal(props.get('to', 0.0))}"
    tail += f", duration={py_literal(step.duration if step.duration is not None else 2.0)}"
    if "from" in props:
        tail += f", from_={py_literal(props['from'])}"
    if step.rate:
        tail += f", rate={py_literal(step.rate)}"
    return tail


def _transition_tail(step) -> str:
    props = step.properties or {}
    tail = ""
    if props.get("to"):
        tail += f", to={py_literal(props['to'])}"
    if props.get("event"):
        tail += f", event={py_literal(props['event'])}"
    return tail
