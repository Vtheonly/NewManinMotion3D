"""TIF attention over a binding pocket — reference scene (issue #26 #1).

3D scene composing: protein pocket (trace representation), target-anchor
orientation frames, spatial cross-attention with distance bias, weighted
links, score matrix, fixed HUD and camera orbit.
"""

from __future__ import annotations

from scientific import DataRef, Derived, Literal, ScientificScene
from scientific.domains.attention.model import CrossAttention
from scientific.domains.biology.protein.model import ProteinModel
from scientific.manim_adapter import ThreeDScientificScene

ANCHORS = DataRef("attention/anchors.json")


def build() -> ScientificScene:
    from scientific.runtime import resolve
    cfg = resolve(ANCHORS)
    queries = list(cfg["queries"])
    keys = list(cfg["keys"])
    bias = float(cfg["distanceBias"])

    pocket = ProteinModel(residues=22, seed=9)
    att = CrossAttention(queries, keys, temperature=cfg["temperature"],
                         distance_bias=bias)

    scene = ScientificScene(
        "tif_attention", title="Teleological Anchor Guidance",
        scene_type="three_d",
        camera={"backgroundColor": "bg", "phi": 72, "theta": -35,
                "distance": 11.0},
    )

    scene.node("biology.protein", "pocket", residues=22, seed=9,
               representation="cartoon", color="accent2")

    frame_ids = []
    for i, query in enumerate(queries):
        fid = f"frame_{query}"
        anchor = att.anchors_q[i]
        scene.node("attention.frame", fid, euler=[12 * i, 8 * i, 0],
                   size=0.55, origin=list(anchor))
        frame_ids.append(fid)

    scene.node("attention.matrix", "score_matrix",
               queries=queries, keys=keys, temperature=cfg["temperature"],
               distanceBias=bias, topK=cfg["topK"],
               position=(-4.6, 2.6, 0.0), scale=0.85)

    for i, j, weight in att.top_links(int(cfg["topK"])):
        scene.node("attention.link", f"link_{i}_{j}",
                   fromId=f"frame_{queries[i]}", toId="pocket",
                   weight=round(weight, 3))

    scene.formula("score_formula",
                  "s(q,k) = q.k / sqrt(d) - gamma * d(a_q, a_k)",
                  terms={"bias": "gamma * d(a_q, a_k)"},
                  bindings={"gamma": Literal(bias)},
                  highlights=["bias"], position=(-4.6, -2.7, 0.0),
                  fontSize=34)

    scene.node("hud.fixed", "hud_mode", text="TIF cross-attention  |  "
               "distance-biased", corner="UL")
    scene.node("hud.fixed", "hud_bias", text=f"gamma = {bias:.2f}",
               corner="LL")

    scene.live_value("entropy", Derived(
        "h / log(k)",
        {"h": Literal(att.row_entropy(att.scores()[0])),
         "k": Literal(len(keys))}),
        format="H[α] = {value:.2f} nats")
    scene.live_value("top_weight", Literal(round(att.top_links(1)[0][2], 3)),
                     format="max α = {value:.3f}")

    for fid in frame_ids:
        scene.relationship(fid, "pocket", id=f"guide_{fid}",
                           kind="link", live=True, weight=0.4)

    with scene.stage(stage_id="pocket", title="Binding Pocket") as st:
        st.play("pocket", "create", duration=2.0)

    with scene.stage(stage_id="anchors", title="Target Anchors") as st:
        for fid in frame_ids:
            st.play(fid, "grow", duration=0.6)
        st.show("score_matrix")

    with scene.stage(stage_id="attention", title="Cross-Attention") as st:
        st.show("hud_mode").show("hud_bias")
        st.highlight("score_formula", color="warn")
        st.annotate("score_matrix", "{entropy}", duration=1.2)
        st.camera({"orbit": 0.14}, duration=3.0)

    with scene.stage(stage_id="verdict", title="Guidance") as st:
        st.annotate("pocket", "{top_weight}", duration=1.3)
        st.camera({"theta": 55, "phi": 68}, duration=2.2)
        st.wait(0.4)

    return scene


class TifAttention(ThreeDScientificScene):
    """Rendered from sci-ir/1 scene 'tif_attention'."""

    def get_scene(self) -> ScientificScene:
        return build()


if __name__ == "__main__":
    from scientific.run import main
    main([__file__])
