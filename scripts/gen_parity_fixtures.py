#!/usr/bin/env python3
"""Regenerate the Python/JS parity fixtures and goldens.

Writes into services/api/tests/fixtures/ir/:
  - sample_2d / torus_demo / wall_demo / suprepto_demo — .json (canonical
    documents) + .py (emitter goldens)
  - corpus.json      — validation verdict corpus
  - type-metadata.json — registry metadata golden

After changing the Python registry or emitter, run:
    python scripts/gen_parity_fixtures.py
    python scripts/sync_schema_types.py
    cd services/api && npm test            # parity must pass
    python -m unittest discover -s scientific/tests -t .
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from scientific import (  # noqa: E402
    DataRef, Derived, Literal, ScientificScene, describe_types,
)
from scientific.export import emit  # noqa: E402
from scientific.ir import to_json  # noqa: E402

FIXTURES = REPO / "services" / "api" / "tests" / "fixtures" / "ir"


def sample_2d() -> ScientificScene:
    scene = ScientificScene("sample_scene", title="Sample")
    scene.node("ui.panel", "panel", width=6.0, height=3.0, title="Panel",
               position=(-2.5, 1.0, 0.0))
    scene.node("text.label", "caption", text="hello", fontSize=24,
               position=(-2.5, 2.6, 0.0))
    scene.formula("eq", "tau = J(theta).T @ F",
                  terms={"Jt": "J(theta).T"},
                  bindings={"theta": Literal(0.6)},
                  highlights=["Jt"], fontSize=40,
                  position=(2.0, -0.5, 0.0))
    scene.live_value("energy", Derived("a * b + 1",
                                        {"a": Literal(2), "b": Literal(3)}),
                     format="E = {value:.2f}")
    scene.bind("theta", Literal(0.6))
    scene.relationship("panel", "eq", id="link", kind="arrow", live=True,
                       color="accent")
    with scene.stage(stage_id="s1", title="Intro") as st:
        st.show("panel").play("eq", "write", duration=1.5)
        st.highlight("eq", color="warn")
        st.annotate("panel", "E = {energy}", duration=1.0)
        st.camera({"zoom": 0.85}, duration=2.0)
        st.transform("panel", {"width": 7.0}, duration=1.2)
        st.custom("print('custom code preserved')")
    return scene


def torus_demo() -> ScientificScene:
    scene = ScientificScene("torus_demo", title="Torus Demo",
                            scene_type="three_d",
                            camera={"phi": 70, "theta": -40})
    scene.node("kinematics.torus", "torus", majorRadius=2.2,
               minorRadius=0.8, steps=90, dt=0.045)
    scene.node("kinematics.chain", "chain", thetas=[0.3, 0.5, 0.2],
               linkLength=0.9)
    scene.node("kinematics.jacobian", "jac", scale=0.55)
    scene.node("kinematics.obstacle", "obstacle", center=[1.0, 0.5, 0.3],
               radius=0.55)
    with scene.stage(stage_id="flow", title="Flow") as st:
        st.show("torus").play("chain", "create", duration=2.0)
        st.highlight("chain", color="warn")
    return scene


def wall_demo() -> ScientificScene:
    scene = ScientificScene("wall_demo", title="Wall Demo",
                            scene_type="moving_camera",
                            camera={"backgroundColor": "bg", "zoom": 0.92})
    scene.node("ui.grid", "wall", columns=4, rows=3, cellWidth=1.5, gap=0.24)
    scene.node("ui.panel", "banner", width=10.0, height=1.1,
               position=(0.0, 3.4, 0.0))
    scene.node("ui.stamp", "stamp_1", verdict="ok", position=(1.0, -1.0, 0.0))
    scene.node("nn.network", "scorer", layers=[4, 6, 1], seed=11)
    scene.live_value("hero_energy", DataRef("synth/protein.json", "energy"),
                     format="ΔG = {value:.2f} kcal/mol")
    with scene.stage(stage_id="intro", title="The Wall") as st:
        st.show("wall").play("banner", "fade_in", duration=1.2)
    return scene


def suprepto_demo() -> ScientificScene:
    """Fixture exercising the Suprepto sections (state/machine/comparison)."""
    scene = ScientificScene("suprepto_demo", title="Suprepto Demo")
    scene.node("ui.panel", "stage_panel", width=5.0, height=2.5)
    scene.node("presentation.metric_card", "readout", title="x",
               provider="x", format="{value:.1f}",
               position=(2.2, 1.2, 0.0))
    scene.node("graph.network", "graph", layout="circle",
               nodes=[{"id": "a", "label": "A"},
                      {"id": "b", "label": "B", "color": "accent2"},
                      {"id": "c", "label": "C"}],
               edges=[{"from": "a", "to": "b", "weight": 0.7},
                      {"from": "b", "to": "c", "weight": 1.0,
                       "directed": True}],
               position=(0.0, -1.8, 0.0))
    scene.state("x", 0.0, keyframes=[(0, 0), (2, 10)], easing="linear")
    scene.derive("speed", "x / 2", inputs={"x": "x"}, kind="derived")
    scene.machine("gd",
                  states=[{"id": "initial", "label": "Initial"},
                          {"id": "updated", "label": "Updated"}],
                  transitions=[{"id": "t1", "source": "initial",
                                "target": "updated", "trigger": "step",
                                "sets": {"x": 4.0}}],
                  initial="initial")
    scene.compare("cmp", kind="before_after",
                  metrics=[{"label": "score", "a": 1.0, "b": 2.5}],
                  title="Score change")
    scene.annotate("stage_panel", provider="speed",
                   format="v = {value:.2f}", id="live_speed")
    with scene.stage(stage_id="run", title="Run") as st:
        st.show("stage_panel").interpolate("x", to=10, duration=2.0)
        st.set("x", 3.0)
        st.transition("gd", to="updated")
        st.compare("cmp")
        st.highlight("graph", behaviors=["focus"], color="warn")
        st.custom("print('suprepto boundary')")
    return scene


def _step(op: str, **kwargs):
    from scientific.ir import Step
    return Step(op=op, **kwargs)


def corpus() -> list[dict]:
    cases = []

    def add(name: str, scene: ScientificScene, expect_valid: bool):
        cases.append({"name": name, "expectValid": expect_valid,
                      "document": json.loads(to_json(scene.document))})

    add("valid_2d", sample_2d(), True)
    add("valid_3d", torus_demo(), True)
    add("valid_wall", wall_demo(), True)
    add("valid_suprepto", suprepto_demo(), True)

    broken = sample_2d()
    broken.document.objects["panel"].type = "nope.ghost"
    add("unknown_type", broken, False)

    broken = sample_2d()
    broken.document.objects["panel"].properties = {"width": "wide"}
    add("bad_property_type", broken, False)

    broken = sample_2d()
    broken.document.timeline[0].steps.append(_step("show", target="ghost"))
    add("unknown_target", broken, False)

    broken = sample_2d()
    broken.document.objects["panel"].parent_id = "caption"
    broken.document.objects["caption"].parent_id = "panel"
    add("parent_cycle", broken, False)

    broken = suprepto_demo()
    broken.document.state_symbols["x"].driver = {"kind": "warp"}
    add("bad_driver", broken, False)

    broken = suprepto_demo()
    broken.document.machines["gd"].initial = "nowhere"
    add("bad_machine_initial", broken, False)

    broken = suprepto_demo()
    broken.document.comparisons["cmp"].kind = "sideways"
    add("bad_comparison_kind", broken, False)

    broken = suprepto_demo()
    broken.document.annotations["live_speed"].provider = "phantom"
    add("bad_annotation_provider", broken, False)
    return cases


def main() -> int:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    fixtures = {
        "sample_2d": sample_2d(),
        "torus_demo": torus_demo(),
        "wall_demo": wall_demo(),
        "suprepto_demo": suprepto_demo(),
    }
    for name, scene in fixtures.items():
        (FIXTURES / f"{name}.json").write_text(
            json.dumps(json.loads(to_json(scene.document)), indent=2) + "\n",
            encoding="utf-8")
        (FIXTURES / f"{name}.py").write_text(emit(scene.document),
                                             encoding="utf-8")
    (FIXTURES / "corpus.json").write_text(
        json.dumps(corpus(), indent=2) + "\n", encoding="utf-8")
    (FIXTURES / "type-metadata.json").write_text(
        json.dumps(json.loads(json.dumps(describe_types())), indent=2) + "\n",
        encoding="utf-8")
    print(f"regenerated {len(fixtures)} fixtures + corpus + metadata "
          f"in {FIXTURES}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
