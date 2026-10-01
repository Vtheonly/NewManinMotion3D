"""Synthesizability Wall — reference scene A (issue #32 §9).

Composes reusable primitives (ui grid/panel/stamp/badge, biology protein/
sequence, nn network, math formula, live values) into a candidate-validation
wall narrative.  All numbers come from the deterministic domain models and
explicit data files — nothing is a hardcoded visual.
"""

from __future__ import annotations

from scientific import DataRef, Derived, Literal, ScientificScene
from scientific.domains.biology.protein.model import ProteinModel
from scientific.domains.biology.protein.sequence import synthesizability_score
from scientific.domains.nn.network import MLP
from scientific.domains.presentation.stages import summarize, validation_rows
from scientific.domains.ui.grids import cell_center
from scientific.manim_adapter import MovingCameraScientificScene

COLUMNS, ROWS = 6, 4


def candidates():
    """Deterministic candidate wall (explicit model, explicit inputs)."""
    scorer = MLP([4, 6, 1], seed=11)
    out = []
    for i in range(COLUMNS * ROWS):
        protein = ProteinModel(residues=18 + (i % 3) * 4, seed=3 + i)
        inputs = [
            protein.contacts() / 40.0,
            protein.radius_of_gyration() / 2.0,
            synthesizability_score(protein.sequence()),
            0.5 + (i % 5) / 10.0,
        ]
        out.append({
            "name": f"cand_{i + 1:02d}",
            "protein": protein,
            "score": scorer.score(inputs),
        })
    return out


def build() -> ScientificScene:
    cands = candidates()
    rows = validation_rows([{"name": c["name"], "score": c["score"]}
                            for c in cands])
    summary = summarize(rows)

    scene = ScientificScene(
        "synthesizability_wall", title="Synthesizability Wall",
        scene_type="moving_camera",
        camera={"backgroundColor": "bg", "zoom": 0.92},
    )

    scene.node("ui.panel", "banner", width=12.4, height=1.15,
               position=(0.0, 3.55, 0.0))
    scene.node("text.label", "banner_title", text="Synthesizability Wall",
               fontSize=34, weight="bold", position=(0.0, 3.55, 0.0))

    scene.node("ui.grid", "wall", columns=COLUMNS, rows=ROWS,
               cellWidth=1.5, cellHeight=1.5, gap=0.24)

    for idx, (cand, row) in enumerate(zip(cands, rows)):
        col, r = idx % COLUMNS, idx // COLUMNS
        x, y = cell_center(col, r, COLUMNS, ROWS, 1.5, 1.5, 0.24)
        pid = f"prot_{cand['name']}"
        scene.node("biology.protein", pid,
                   residues=len(cand["protein"].residues),
                   seed=3 + idx, representation="trace",
                   color="accent2", position=(x - 0.28, y + 0.14, 0.0),
                   scale=0.5)
        scene.node("ui.stamp", f"stamp_{cand['name']}",
                   verdict=row["verdict"], position=(x + 0.5, y - 0.5, 0.0),
                   scale=0.62)

    scene.node("nn.network", "scorer", layers=[4, 6, 1], seed=11,
               position=(7.3, 0.0, 0.0), scale=0.85)
    scene.formula("score_formula", "S = sigma(NN(x_p))",
                  terms={"NN": "NN(x_p)"}, highlights=["NN"],
                  position=(7.3, 2.35, 0.0), fontSize=38)

    hero = ProteinModel(residues=26, seed=7)
    scene.node("biology.sequence", "hero_seq", sequence=hero.sequence(),
               highlight=[3, 7, 11], blockSize=0.34,
               position=(-1.2, -3.55, 0.0))
    scene.node("ui.badge", "pass_badge",
               text=f"{summary['ok']}/{summary['total']} pass",
               tone="ok" if summary["rate"] >= 0.5 else "fail",
               position=(5.6, -3.55, 0.0))

    scene.live_value("hero_energy", DataRef("synth/protein.json", "energy"),
                     format="ΔG = {value:.2f} kcal/mol")
    scene.live_value("pass_rate", Derived(
        "ok / total",
        {"ok": Literal(summary["ok"]), "total": Literal(summary["total"])}),
        format="pass rate = {value:.0%}")
    scene.bind("gamma", Literal(0.25))

    with scene.stage(stage_id="intro", title="The Wall") as st:
        st.show("wall").play("banner_title", "write", duration=1.4)
        st.camera({"zoom": 1.12}, duration=2.6)
        st.wait(0.4)

    with scene.stage(stage_id="validation", title="Validation") as st:
        # Custom-boundary step: reveal one row of stamps per iteration
        # (hand-written runtime code, preserved verbatim by the exporter).
        for r in range(ROWS):
            first = r * COLUMNS + 1
            st.custom(
                f"# reveal validation stamps for row {r}\n"
                f"ids = [f'stamp_cand_{{i:02d}}' "
                f"for i in range({first}, {first + COLUMNS})]\n"
                "stamps = [ctx.mobs[i] for i in ids if i in ctx.mobs]\n"
                "scene.play(*[manim.FadeIn(s) for s in stamps], "
                "run_time=0.8)")
        st.play("scorer", "grow", duration=1.6)
        st.highlight("score_formula", color="warn")
        st.annotate("score_formula", "{hero_energy}", duration=1.2)

    with scene.stage(stage_id="verdict", title="Verdict") as st:
        st.play("hero_seq", "create", duration=1.6)
        st.play("pass_badge", "grow", duration=1.0)
        st.annotate("pass_badge", "{pass_rate}", duration=1.2)
        st.wait(0.6)

    return scene


class SynthesizabilityWall(MovingCameraScientificScene):
    """Rendered from sci-ir/1 scene 'synthesizability_wall'."""

    def get_scene(self) -> ScientificScene:
        return build()


if __name__ == "__main__":
    from scientific.run import main
    main([__file__])
