"""Kinematics renderers: torus+flow, PoE chain, jacobian arrows, obstacles."""

from __future__ import annotations

from manim import Dot3D, Sphere, Surface, VGroup, VMobject, Arrow3D

from ...domains.kinematics.chain import PoEChain
from ...domains.kinematics.jacobian import jacobian
from ...domains.kinematics.torus import torus_point, trajectory_3d
from ...domains.ui.palette import color as palette_color
from ...registry import bind_renderer


def _torus(node, ctx):
    props = node.properties
    major = float(props.get("majorRadius", 2.2))
    minor = float(props.get("minorRadius", 0.8))
    steps = int(props.get("steps", 90))
    dt = float(props.get("dt", 0.045))
    strength = float(props.get("flowStrength", 1.0))

    surface = Surface(
        lambda u, v: torus_point(u, v, major, minor),
        u_range=[0, 6.2831853], v_range=[0, 6.2831853],
        resolution=(24, 12),
        fill_opacity=0.18,
        checkerboard_colors=[palette_color("accent"), palette_color("panel2")],
        stroke_color=palette_color("border"), stroke_width=0.6,
    )
    path = trajectory_3d(steps=steps, dt=dt, strength=strength,
                         major=major, minor=minor)
    flow = VMobject(stroke_color=palette_color("warn"), stroke_width=4.0)
    flow.set_points_smoothly([[p[0], p[1], p[2]] for p in path])
    return VGroup(surface, flow)


def _chain(node, ctx):
    props = node.properties
    thetas = [float(t) for t in (props.get("thetas") or [0.0])]
    chain = PoEChain(thetas, float(props.get("linkLength", 0.9)))
    positions = chain.joint_positions()
    group = VGroup()
    for a, b in zip(positions, positions[1:]):
        seg = VMobject(stroke_color=palette_color("fg"), stroke_width=5.0)
        seg.set_points_as_corners([[a[0], a[1], a[2]], [b[0], b[1], b[2]]])
        group.add(seg)
    for p in positions:
        group.add(Dot3D(point=[p[0], p[1], p[2]], radius=0.07,
                        color=palette_color("accent")))
    return group


def _jacobian(node, ctx):
    """Arrows at the end effector of the referenced chain node."""
    props = node.properties
    scale = float(props.get("scale", 0.55))
    chain_node = _find_chain(ctx)
    if chain_node is None:
        return VGroup()
    chain = PoEChain([float(t) for t in chain_node.properties.get("thetas", [])],
                     float(chain_node.properties.get("linkLength", 0.9)))
    ee = chain.end_effector()
    arrows = VGroup()
    for i, column in enumerate(jacobian(chain)):
        end = [ee[0] + column[0] * scale, ee[1] + column[1] * scale,
               ee[2] + column[2] * scale]
        if abs(column[0]) + abs(column[1]) + abs(column[2]) < 1e-6:
            continue
        arrows.add(Arrow3D(start=[ee[0], ee[1], ee[2]], end=end,
                           color=palette_color("ok" if i % 2 else "info"),
                           thickness=0.012, height=0.12))
    return arrows


def _find_chain(ctx):
    for candidate in ctx.document.objects_by_type("kinematics.chain"):
        return candidate
    return None


def _obstacle(node, ctx):
    props = node.properties
    center = [float(c) for c in (props.get("center") or [0, 0, 0])]
    radius = float(props.get("radius", 0.55))
    return Sphere(center=center, radius=radius, resolution=(18, 12),
                  fill_color=palette_color("fail"), fill_opacity=0.35,
                  stroke_color=palette_color("fail"), stroke_width=1.2)


bind_renderer("kinematics.torus", _torus)
bind_renderer("kinematics.chain", _chain)
bind_renderer("kinematics.jacobian", _jacobian)
bind_renderer("kinematics.obstacle", _obstacle)
