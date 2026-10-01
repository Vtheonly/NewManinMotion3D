"""State-machine transition rendering (issue #11).

Transitions apply their ``sets`` to the reactive engine (through value
trackers, so live consumers update), then reveal a state chip that shows
the machine's current state — the visual narrative
Initial -> Computation -> Intermediate -> Highlight -> Updated.
"""

from __future__ import annotations

from typing import Any, Optional

from ..domains.ui.palette import color as palette_color
from .context import RenderContext

STATE_TONES = {"initial": "info", "computation": "accent", "updated": "ok",
               "highlight": "warn", "converged": "ok", "final": "ok",
               "intermediate": "info"}


def run_transition(scene, ctx: RenderContext, step) -> None:
    props = step.properties or {}
    machine = ctx.document.machines.get(step.target)
    if machine is None:
        ctx.warn(f"transition targets unknown machine {step.target!r}")
        return
    transition = _pick(machine, props)
    if transition is None:
        ctx.warn(f"no matching transition in {machine.id!r} for {props}")
        return

    for symbol, value in transition.sets.items():
        ctx.state_engine().set_value(symbol, value, notify=False)
        if symbol in ctx.trackers:
            ctx.trackers[symbol].set_value(float(value))
        if ctx.diagnostics is not None:
            ctx.diagnostics.state_change(symbol, value)
    ctx.machine_states[machine.id] = transition.target
    if ctx.diagnostics is not None:
        ctx.diagnostics.machine_transition(machine.id, transition.id,
                                          transition.target)

    target_state = _state_by_id(machine, transition.target)
    label = (target_state or {}).get("label") or transition.target
    _show_state_chip(scene, ctx, machine.id, label, step)


def _pick(machine, props):
    to, event = props.get("to"), props.get("event")
    for tr in machine.transitions:
        if to and tr.target == to:
            return tr
        if event and (tr.trigger == event or tr.id == event):
            return tr
    return machine.transitions[0] if machine.transitions else None


def _state_by_id(machine, state_id):
    return next((s for s in machine.states
                 if str(s.get("id")) == state_id), None)


def _show_state_chip(scene, ctx: RenderContext, machine_id: str,
                     label: str, step) -> None:
    """A badge-style chip showing the current machine state (per machine)."""
    from manim import RoundedRectangle, Text, UP, LEFT
    chip_key = f"__machine_{machine_id}"
    text = Text(label, font_size=24, color=palette_color("fg"))
    tone = STATE_TONES.get(label.lower(), "info")
    box = RoundedRectangle(corner_radius=0.12, width=text.width + 0.5,
                           height=0.52,
                           fill_color=palette_color(tone), fill_opacity=0.22,
                           stroke_color=palette_color(tone), stroke_width=1.5)
    box.insert(0, text)
    text.move_to(box.get_center())
    old = ctx.mobjects.pop(chip_key, None)
    if old is not None:
        scene.remove(old)
    duration = float(step.duration if step.duration is not None else 1.0)
    if ctx.mobjects:
        anchor = next(iter(reversed(list(ctx.mobjects.values()))))
        box.next_to(anchor, UP, buff=0.4)
    scene.play(_fade_in(box), run_time=min(1.0, duration))
    ctx.mobjects[chip_key] = box
    if ctx.diagnostics is not None:
        ctx.diagnostics.animation(f"machine:{machine_id} -> {label}")


def _fade_in(box):
    from manim import FadeIn
    return FadeIn(box)
