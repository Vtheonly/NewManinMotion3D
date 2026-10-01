"""Torus flow matching vs screw kinematics — reference scene B (issue #32 §9).

3D scene composing: torus manifold + flow trajectory, PoE chain, screw axis,
Jacobian arrows, obstacle + clash + DLS resolution, live values and formula.
The scene file is narrative composition; all math lives in
scientific.domains.kinematics.
"""

from __future__ import annotations

from scientific import DataRef, Derived, Literal, ScientificScene
from scientific.domains.kinematics.chain import PoEChain
from scientific.domains.kinematics.jacobian import jacobian
from scientific.domains.kinematics.obstacles import (is_clash,
                                                     resolve_clash)
from scientific.domains.kinematics.screw import Screw, axis_segment
from scientific.manim_adapter import ThreeDScientificScene

CFG = DataRef("kinematics/joint_config.json")


def build() -> ScientificScene:
    from scientific.runtime import resolve
    cfg = resolve(CFG)
    thetas = list(cfg["thetas"])
    obstacle_center = list(cfg["obstacleCenter"])
    obstacle_radius = float(cfg["obstacleRadius"])

    chain = PoEChain(thetas, cfg["linkLength"])
    clash = is_clash(chain.joint_positions(), obstacle_center,
                     obstacle_radius)
    resolved = resolve_clash(chain, obstacle_center, obstacle_radius)

    scene = ScientificScene(
        "torus_poe_kinematics", title="Torus Flow vs Screw Kinematics",
        scene_type="three_d",
        camera={"backgroundColor": "bg", "phi": 68, "theta": -42,
                "distance": 12.0},
    )

    scene.node("kinematics.torus", "torus", majorRadius=2.4, minorRadius=0.85,
               flowStrength=1.0, steps=80, dt=0.045,
               position=(-3.2, -0.4, 0.0))

    scene.node("kinematics.chain", "chain", thetas=thetas,
               linkLength=cfg["linkLength"], position=(2.2, 0.0, 0.0))
    scene.node("kinematics.jacobian", "jacobian_arrows", scale=0.5)
    scene.node("kinematics.obstacle", "obstacle", center=obstacle_center,
               radius=obstacle_radius, position=(2.2, 0.0, 0.0))

    screw = Screw(chain.joint_axes()[0], (0.0, 0.0, 0.0))
    start, end = axis_segment(screw, length=2.2)
    scene.node("text.label", "screw_label", text="screw axis ξ₁",
               fontSize=22, color="muted", position=(2.2, 0.0, 1.9))

    scene.formula("jac_formula", "tau = J(theta).T @ F",
                  terms={"Jt": "J(theta).T", "F": "F"},
                  bindings={"theta": Literal(thetas[0])},
                  highlights=["Jt"], position=(-3.2, -2.9, 0.0),
                  fontSize=40)

    scene.live_value("clash_state", Literal(1 if clash else 0),
                     format="clash = {value}")
    scene.live_value("clearance", Derived(
        "c * 100.0", {"c": Literal(resolved["clearance"])}),
        format="resolved clearance = {value:.1f} cm")
    scene.live_value("screw_speed", Literal(0.35),
                     format="flow |omega| = {value:.2f} rad/s")
    scene.bind("theta", Literal(thetas[0]))

    scene.relationship("chain", "obstacle", id="clash_marker",
                       kind="distance", live=True,
                       label="d = {clearance}", color="fail")

    with scene.stage(stage_id="flow", title="Torus Flow Matching") as st:
        st.play("torus", "create", duration=2.0)
        st.camera({"orbit": 0.18}, duration=3.2)

    with scene.stage(stage_id="assembly", title="PoE Assembly") as st:
        st.play("chain", "create", duration=1.8)
        st.show("screw_label")
        st.play("jacobian_arrows", "grow", duration=1.4)
        st.highlight("jac_formula", color="warn")

    with scene.stage(stage_id="clash", title="Steric Clash") as st:
        st.show("obstacle")
        st.annotate("chain", "{clash_state}", duration=1.2)
        st.wait(0.5)

    with scene.stage(stage_id="resolve", title="DLS Resolution") as st:
        st.custom(
            "# advanced boundary: reconfigure the chain with DLS thetas\n"
            "chain_mob = ctx.mobs['chain']\n"
            "resolved = %r\n"
            "from scientific.domains.kinematics.chain import PoEChain\n"
            "from scientific.domains.kinematics.jacobian import jacobian as J\n"
            "chain2 = PoEChain(resolved['thetas'], 0.9)\n"
            "positions = chain2.joint_positions()\n"
            "import manim\n"
            "new_mob = manim.VGroup()\n"
            "for a, b in zip(positions, positions[1:]):\n"
            "    seg = manim.VMobject(stroke_color='#39C88E', stroke_width=5)\n"
            "    seg.set_points_as_corners([[a[0], a[1], a[2]],\n"
            "                                [b[0], b[1], b[2]]])\n"
            "    new_mob.add(seg)\n"
            "for p in positions:\n"
            "    new_mob.add(manim.Dot3D(point=[p[0], p[1], p[2]],\n"
            "                             radius=0.07, color='#4FA3FF'))\n"
            "new_mob.shift([2.2, 0.0, 0.0])\n"
            "scene.remove(chain_mob)\n"
            "scene.play(manim.Create(new_mob), run_time=1.6)\n"
            "ctx.mobs['chain'] = new_mob" % ({"thetas": resolved["thetas"]},))
        st.annotate("chain", "{clearance}", duration=1.4)

    with scene.stage(stage_id="verdict", title="Verdict") as st:
        st.camera({"theta": 35, "phi": 62}, duration=2.4)
        st.wait(0.5)

    return scene


class TorusPoEKinematics(ThreeDScientificScene):
    """Rendered from sci-ir/1 scene 'torus_poe_kinematics'."""

    def get_scene(self) -> ScientificScene:
        return build()


if __name__ == "__main__":
    from scientific.run import main
    main([__file__])
