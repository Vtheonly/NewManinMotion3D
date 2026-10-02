"""
THE SYNTHESIZABILITY WALL — de novo protein design
===================================================
A short scientific animation:
AI designs a "perfect" protein -> in silico metrics all pass ->
the design hits the Synthesizability Wall -> the physical lab pipeline
(synthesis, expression, folding, purification, validation) rejects it.

Render (Manim Community >= 0.17):
    manim -qh -p synth_wall.py SynthesizabilityWall

No LaTeX and no image assets required.
"""

from manim import *
from manim.utils import rate_functions as rf
import numpy as np

config.background_color = "#070b17"

# ------------------------------------------------------------------ palette
DIG_BG    = "#0b1226"     # digital world background
GRID_COL  = "#27497e"
CYAN      = "#41e0ff"
CYAN_SOFT = "#9fd7ff"
TEAL      = "#0f96c4"
LOOP_COL  = "#0c7ba3"
GREEN     = "#38d39f"
AMBER     = "#ffd166"
RED       = "#e4572e"
RED_SOFT  = "#ff8f8f"
LAB_BG    = "#ece2d0"     # physical world background
INK       = "#4a3b2c"
INK_SOFT  = "#54432f"
BRICK     = "#5d6673"
MORTAR    = "#2e3440"
MUTED     = "#93a7c4"
WHITEISH  = "#eaf6ff"

# ------------------------------------------------------------------ helpers

def make_grid(x0, x1, y0, y1, step, color, opacity):
    g = VGroup()
    x = x0
    while x <= x1:
        g.add(Line([x, y0, 0], [x, y1, 0]))
        x += step
    y = y0
    while y <= y1:
        g.add(Line([x0, y, 0], [x1, y, 0]))
        y += step
    g.set_stroke(color, width=1, opacity=opacity)
    return g


def mark_check(color=GREEN, s=1.0):
    m = VGroup(
        Line([-0.16, -0.02, 0], [-0.05, -0.14, 0]),
        Line([-0.05, -0.14, 0], [0.19, 0.13, 0]),
    ).set_stroke(color, width=4.5)
    m.scale(s)
    return m


def mark_cross(color=RED, s=1.0):
    m = VGroup(
        Line([-0.13, 0.13, 0], [0.13, -0.13, 0]),
        Line([-0.13, -0.13, 0], [0.13, 0.13, 0]),
    ).set_stroke(color, width=4.5)
    m.scale(s)
    return m


def make_helix(length=2.05, radius=0.30, slant=0.5, turns=4,
               col_a=CYAN, col_b=TEAL):
    """Cartoon ribbon helix: stacked slanted tiles, alternating shade = 3D feel."""
    tiles = VGroup()
    n = turns * 2
    seg_h = (length / n) * 1.45
    for i in range(n):
        tile = RoundedRectangle(corner_radius=0.085, width=2 * radius,
                                height=seg_h, stroke_width=0)
        tile.set_fill(col_a if i % 2 == 0 else col_b, opacity=1)
        tile.move_to([0, -length / 2 + (i + 0.5) * (length / n), 0])
        tile.rotate(slant)
        tiles.add(tile)
    gloss = Line(np.array([-radius * 0.42, length / 2 - 0.18, 0]),
                 np.array([-radius * 0.42, -length / 2 + 0.18, 0]))
    gloss.set_stroke(WHITE, width=2.2, opacity=0.22)
    return VGroup(tiles, gloss)


def make_protein(col_a=CYAN, col_b=TEAL, loop_col=LOOP_COL):
    """A 3D-style four-helix bundle (ribbon-diagram look)."""
    helices = VGroup()
    specs = [(-0.72, 1.85, 0.10), (-0.24, 2.15, -0.06),
             (0.24, 1.85, 0.07), (0.72, 2.15, -0.10)]
    for x, L, tilt in specs:
        h = make_helix(length=L, col_a=col_a, col_b=col_b)
        h.rotate(tilt)
        h.move_to([x, 0, 0])
        helices.add(h)

    tops = [h.get_top() + DOWN * 0.06 for h in helices]
    bots = [h.get_bottom() + UP * 0.06 for h in helices]
    loops = VGroup(
        ArcBetweenPoints(tops[0], tops[1], angle=-1.15),
        ArcBetweenPoints(bots[1], bots[2], angle=1.15),
        ArcBetweenPoints(tops[2], tops[3], angle=-1.15),
    )
    loops.set_stroke(loop_col, width=4.6)

    protein = VGroup(loops, helices)
    protein.loops = loops
    protein.helices = helices
    return protein


def recolor_anims(protein, cols):
    col_a, col_b, loop_c = cols
    anims = []
    for h in protein.helices:
        tiles = h[0]
        for i, t in enumerate(tiles):
            anims.append(t.animate.set_fill(col_a if i % 2 == 0 else col_b))
    anims.append(protein.loops.animate.set_stroke(loop_c))
    return anims


STAGE_COLS = [
    (CYAN,     TEAL,     LOOP_COL),
    ("#7fd8cf", "#2f8f86", "#5f7d7a"),
    ("#cdc46e", "#8f8a2f", "#7a7a55"),
    ("#e0a05f", "#a05f2f", "#8a6a4f"),
    ("#e06a6a", "#963232", "#8a4a4a"),
]


def make_neural_net(layer_sizes=(4, 6, 6, 3), gap_x=0.75, gap_y=0.42):
    edges, layers = VGroup(), VGroup()
    dots_per_layer = []
    for li, n in enumerate(layer_sizes):
        dots = VGroup()
        for i in range(n):
            d = Dot(radius=0.075, color=CYAN_SOFT)
            d.move_to([li * gap_x, (i - (n - 1) / 2) * gap_y, 0])
            dots.add(d)
        dots_per_layer.append(dots)
        layers.add(dots)
    for l1, l2 in zip(dots_per_layer, dots_per_layer[1:]):
        for a in l1:
            for b in l2:
                edges.add(Line(a.get_center(), b.get_center(),
                               stroke_width=1.2, stroke_opacity=0.35,
                               color=TEAL))
    net = VGroup(edges, layers)
    net.layers = layers
    return net


def make_sequence():
    """Colored amino-acid tiles (1-letter code, rough residue-type coloring)."""
    letters = "AKLEELEKKAFE"
    cmap = {"A": "#7bc96f", "L": "#7bc96f", "K": "#5aa7e8",
            "E": "#e86a6a", "F": "#9b7fd4"}
    tiles = VGroup()
    for i, aa in enumerate(letters):
        tile = RoundedRectangle(corner_radius=0.07, width=0.34, height=0.34,
                                stroke_width=0).set_fill(cmap[aa], 0.92)
        tile.move_to([i * 0.39, 0, 0])
        lab = Text(aa, font_size=15, weight=BOLD, color="#0b1026")
        lab.move_to(tile.get_center())
        tiles.add(VGroup(tile, lab))
    tiles.move_to(ORIGIN)
    return tiles


def make_wall():
    bricks = VGroup()
    x_left, x_right, y_bottom, y_top = 2.62, 3.58, -3.05, 3.05
    bh, bw = 0.52, 0.5
    rows = int((y_top - y_bottom) / bh) + 1
    for r in range(rows):
        y = y_bottom + bh * (r + 0.5)
        offset = 0 if r % 2 == 0 else bw / 2
        x = x_left - bw + offset
        while x < x_right:
            xl, xr = max(x, x_left), min(x + bw, x_right)
            if xr - xl > 0.06:
                b = Rectangle(width=xr - xl, height=bh * 0.88)
                b.set_fill(BRICK, 1).set_stroke(MORTAR, 1.5)
                b.move_to([(xl + xr) / 2, y, 0])
                bricks.add(b)
            x += bw
    plate = RoundedRectangle(corner_radius=0.10, width=0.66, height=3.5)
    plate.set_fill("#10141c", 0.88).set_stroke(AMBER, 1.2)
    plate.move_to([3.1, 0, 0])
    wlab = Text("SYNTHESIZABILITY WALL", font_size=16, weight=BOLD, color=AMBER)
    wlab.rotate(PI / 2).move_to([3.1, 0, 0])
    edge = Line([2.62, -3.05, 0], [2.62, 3.05, 0]).set_stroke("#ff5d5d", 3, opacity=0.55)
    plate.set_opacity(0)
    wlab.set_opacity(0)
    wall = VGroup(bricks, edge, plate, wlab)
    wall.bricks, wall.edge, wall.plate, wall.label = bricks, edge, plate, wlab
    return wall


# ---- lab icons -----------------------------------------------------------

def icon_dna(color=INK):
    f1 = FunctionGraph(lambda t: 0.17 * np.sin(4.2 * t), [-0.72, 0.72, 0.01],
                       color=color, stroke_width=3)
    f2 = FunctionGraph(lambda t: 0.17 * np.sin(4.2 * t + PI), [-0.72, 0.72, 0.01],
                       color=color, stroke_width=3)
    rungs = VGroup()
    for t in (-0.52, -0.18, 0.16, 0.5):
        y = 0.17 * np.sin(4.2 * t)
        rungs.add(Line([t, y, 0], [t, -y, 0], stroke_width=2.2, color=color))
    return VGroup(f1, f2, rungs).scale(0.95)


def icon_flask(color=INK):
    body = Polygon((-0.13, 0.55), (0.13, 0.55), (0.13, 0.18),
                   (0.5, -0.5), (-0.5, -0.5), (-0.13, 0.18),
                   stroke_width=3, color=color)
    liq = Line([-0.32, -0.2, 0], [0.32, -0.2, 0], stroke_width=2.5, color=color)
    dots = VGroup(*[Dot([x, -0.33, 0], radius=0.035, color=color)
                    for x in (-0.15, 0.02, 0.18)])
    return VGroup(body, liq, dots).scale(0.95)


def icon_funnel(color=INK):
    body = Polygon((-0.55, 0.42), (0.55, 0.42), (0.09, -0.22),
                   (0.09, -0.55), (-0.09, -0.55), (-0.09, -0.22),
                   stroke_width=3, color=color)
    swirl = ArcBetweenPoints([-0.28, 0.2, 0], [0.12, -0.12, 0],
                             angle=-1.3, stroke_width=2.5, color=color)
    agg = Dot([0, -0.72, 0], radius=0.06, color="#8f2f3b")
    return VGroup(body, swirl, agg).scale(0.95)


def icon_column(color=INK):
    tube = RoundedRectangle(corner_radius=0.09, width=0.5, height=1.05,
                            stroke_width=3, color=color)
    bands = VGroup(*[Line([-0.19, dy, 0], [0.19, dy, 0],
                          stroke_width=2.2, color=color)
                     for dy in (0.24, 0.0, -0.24)])
    drop = Dot([0, -0.72, 0], radius=0.055, color=color)
    return VGroup(tube, bands, drop).scale(0.95)


def icon_cd(color=INK):
    ax_y = Line([-0.58, -0.42, 0], [-0.58, 0.5, 0], stroke_width=2.5, color=color)
    ax_x = Line([-0.58, -0.42, 0], [0.62, -0.42, 0], stroke_width=2.5, color=color)
    curve = FunctionGraph(
        lambda t: -0.52 * np.exp(-(((t + 0.18) / 0.13) ** 2))
                  -0.36 * np.exp(-(((t - 0.08) / 0.17) ** 2)) + 0.02,
        [-0.5, 0.55, 0.01], color="#b3541e", stroke_width=3)
    curve.shift(UP * 0.45)
    lab = Text("CD", font_size=12, color=color).move_to([0.42, 0.42, 0])
    return VGroup(ax_y, ax_x, curve, lab).scale(0.9)


def make_station(icon, name, idx, center):
    ped = Circle(radius=0.78).set_fill("#f4ecdd", 0.95).set_stroke("#c9b48e", 1.6)
    ped.move_to(center)
    icon.move_to(center)
    label = Text(f"{idx}  ·  {name}", font_size=16, weight=BOLD, color=INK_SOFT)
    label.next_to(ped, DOWN, buff=0.2)
    return VGroup(ped, icon, label)


def make_chip(txt):
    label = Text(txt, font_size=16, color="#ffb3b3")
    x = mark_cross(RED_SOFT, s=1.0)
    content = VGroup(x, label).arrange(RIGHT, buff=0.16)
    box = RoundedRectangle(corner_radius=0.11, width=content.width + 0.55,
                           height=0.52, color="#c0392b",
                           stroke_width=1.6).set_fill("#2a1114", 0.96)
    content.move_to(box.get_center())
    return VGroup(box, content)


def make_blob():
    pts = []
    n = 16
    for i in range(n):
        a = i / n * TAU
        r = 0.5 + 0.10 * np.sin(3 * a + 1.2) + 0.06 * np.cos(5 * a)
        pts.append([r * np.cos(a), r * np.sin(a), 0])
    blob = Polygon(*pts).set_fill("#b6404d", 1).set_stroke("#77222e", 2)
    speck = VGroup(*[Dot([dx, dy, 0], radius=0.05, color="#77222e")
                     for dx, dy in [(-0.16, 0.1), (0.12, -0.05), (0.02, 0.22)]])
    return VGroup(blob, speck).scale(0.8)


def make_panel(rows):
    panel = RoundedRectangle(corner_radius=0.16, width=4.5, height=4.3,
                             color="#2b5d8f", stroke_width=1.6)
    panel.set_fill("#0d1b33", 0.93)
    title = Text("IN SILICO QC", font_size=20, weight=BOLD, color=CYAN_SOFT)
    title.move_to(panel.get_top() + DOWN * 0.42)
    underline = Line(title.get_left() + DOWN * 0.18,
                     title.get_right() + DOWN * 0.18)
    underline.set_stroke(CYAN, 1.6, opacity=0.5)
    items, checks = VGroup(), VGroup()
    y0 = title.get_bottom()[1] - 0.5
    L, R = panel.get_left()[0], panel.get_right()[0]
    for i, (name, val) in enumerate(rows):
        yy = y0 - i * 0.62
        lab = Text(name, font_size=16, color="#cfe6ff")
        lab.move_to([L + 0.45, yy, 0], aligned_edge=LEFT)
        val_m = Text(val, font_size=16, weight=BOLD, color=WHITE)
        val_m.move_to([R - 0.95, yy, 0], aligned_edge=RIGHT)
        ck = mark_check(GREEN, s=1.0).move_to([R - 0.35, yy, 0])
        items.add(VGroup(lab, val_m))
        checks.add(ck)
    frame = VGroup(panel, title, underline)
    return frame, items, checks


def make_banner():
    t = Text("ALL CHECKS PASSED", font_size=17, weight=BOLD, color="#7df2c8")
    ck = mark_check(GREEN, s=1.1)
    content = VGroup(ck, t).arrange(RIGHT, buff=0.18)
    box = RoundedRectangle(corner_radius=0.12, width=content.width + 0.5,
                           height=0.52, color=GREEN,
                           stroke_width=1.6).set_fill("#0c2b1e", 0.95)
    content.move_to(box.get_center())
    return VGroup(box, content)


def make_lab_decor():
    bench = Line([3.8, -2.62, 0], [27, -2.62, 0]).set_stroke("#8a6f52", 6)
    legs = VGroup(*[Line([x, -2.62, 0], [x, -3.25, 0], stroke_width=4,
                         color="#8a6f52") for x in (6, 14, 22)])
    glass = VGroup()
    beaker = Rectangle(width=0.5, height=0.55, stroke_width=2, color="#a58f6f")
    beaker.move_to([23.2, -2.32, 0])
    glass.add(beaker)
    glass.add(icon_flask("#a58f6f").scale(0.8).move_to([24.3, -2.33, 0]))
    tubes = VGroup(*[RoundedRectangle(corner_radius=0.05, width=0.13, height=0.5,
                                      stroke_width=2, color="#a58f6f")
                     .move_to([25.15 + 0.2 * k, -2.33, 0]) for k in range(3)])
    rack = Rectangle(width=0.75, height=0.12, stroke_width=2, color="#a58f6f")
    rack.move_to([25.35, -2.52, 0])
    glass.add(tubes, rack)
    g = VGroup(bench, legs, glass).set_opacity(0.75)
    return g


def cap(text, x, y=3.0, size=19, color=CYAN_SOFT):
    return Text(text, font_size=size, color=color).move_to([x, y, 0])


def verdict_column(header, kind, caption, header_col, mark_col):
    h = Text(header, font_size=23, weight=BOLD, color=header_col)
    row = VGroup()
    for i in range(5):
        m = mark_check(mark_col) if kind == "c" else mark_cross(mark_col)
        m.move_to([i * 0.58, 0, 0])
        row.add(m)
    row.move_to(DOWN * 0.62)
    c = Text(caption, font_size=14, color=MUTED).move_to(DOWN * 1.2)
    return VGroup(h, row, c)


# --------------------------------------------------------------------- scene

class SynthesizabilityWall(MovingCameraScene):

    # camera helpers ---------------------------------------------------
    def _cam_init(self):
        self._cw = self.camera_frame.width
        self.camera_frame.scale(13.4 / self._cw).move_to([-2.0, 0.25, 0])
        self._cw = 13.4

    def zoom(self, width, center=None, rt=1.0):
        f = width / self._cw
        anim = (self.camera_frame.animate.move_to(center).scale(f)
                if center is not None else self.camera_frame.animate.scale(f))
        self.play(anim, run_time=rt)
        self._cw = width

    # ------------------------------------------------------------------
    def construct(self):
        self._cam_init()

        # ================= STAGE : two worlds + wall =================
        digital_bg = Rectangle(width=30, height=12).set_fill(DIG_BG, 1).set_stroke(width=0)
        digital_bg.move_to([-12, 0, 0])
        grid = make_grid(-14, 2.6, -3.8, 3.8, 0.9, GRID_COL, 0.10)
        d_dots = VGroup(*[Dot([x, y, 0], radius=0.045, color=CYAN_SOFT).set_opacity(0.22)
                          for x, y in [(-6.3, 2.4), (-4.4, -2.6), (-2.8, 1.9),
                                       (-0.6, -2.9), (0.9, 2.6), (2.1, -1.7),
                                       (-5.4, 0.2), (1.6, 0.9)]])
        d_tag = Text("IN SILICO WORLD", font_size=14, color="#3f6f9f")
        d_tag.move_to([-6.3, 3.3, 0])

        lab_bg = Rectangle(width=27, height=12).set_fill(LAB_BG, 1).set_stroke(width=0)
        lab_bg.move_to([16.5, 0, 0])
        lab_decor = make_lab_decor()
        lab_title = Text("THE BENCH — experimental reality",
                         font_size=19, weight=BOLD, color=INK_SOFT)
        lab_title.move_to([10.6, 3.2, 0])

        wall = make_wall()

        stage = VGroup(digital_bg, grid, d_dots, d_tag,
                       lab_bg, lab_decor, lab_title, wall)
        self.add(stage)

        # ================= 1 · TITLE =================
        title = Text("THE SYNTHESIZABILITY WALL", font_size=50, weight=BOLD, color=WHITEISH)
        subtitle = Text("why computationally perfect proteins can fail in the lab",
                        font_size=22, color=MUTED)
        subtitle.next_to(title, DOWN, buff=0.4)
        title.move_to([-2, 0.55, 0])
        subtitle.move_to([-2, -0.35, 0])
        self.play(FadeIn(title, shift=UP * 0.25), run_time=0.8)
        self.play(FadeIn(subtitle, shift=UP * 0.2), run_time=0.6)
        self.wait(1.2)
        self.play(FadeOut(title), FadeOut(subtitle), run_time=0.6)

        # ================= 2 · AI GENERATES A SEQUENCE =================
        net = make_neural_net().scale(0.95).move_to([-5.2, 0.55, 0])
        net_label = Text("generative model", font_size=14, color=MUTED)
        net_label.move_to([-5.2, -0.95, 0])
        c1 = cap("A neural network proposes a brand-new protein", -2)
        self.play(FadeIn(net, scale=0.85), FadeIn(net_label), run_time=0.6)
        self.play(FadeIn(c1), run_time=0.4)
        self.wait(0.3)

        for layer in net.layers:
            self.play(*[Indicate(d, color=CYAN, scale_factor=1.6) for d in layer],
                      run_time=0.3)

        seq = make_sequence().move_to([-0.8, 0.55, 0])
        beam = Line([-4.1, 0.55, 0], [-3.05, 0.55, 0],
                    stroke_width=2.5, color=CYAN).set_opacity(0.7)
        pulse = Dot([-4.1, 0.55, 0], radius=0.06, color=WHITE)
        self.play(Create(beam), pulse.animate.move_to([-3.05, 0.55, 0]), run_time=0.4)
        self.play(LaggedStart(*[FadeIn(t, shift=UP * 0.1) for t in seq],
                              lag_ratio=0.08), run_time=1.1)
        self.play(FadeOut(beam), FadeOut(pulse), run_time=0.25)
        self.wait(0.4)

        # ================= 3 · IN SILICO FOLDING =================
        self.play(FadeOut(c1), run_time=0.3)
        c2 = cap("Folding prediction:  ΔG = −48.2 REU  ·  structure locked", -2)
        self.play(FadeIn(c2), run_time=0.35)

        protein = make_protein().move_to([-1.2, 0.3, 0])
        self.play(FadeOut(seq, scale=0.85),
                  FadeIn(protein, scale=0.6),
                  Rotate(protein, angle=0.45),
                  run_time=0.85)
        ring = Circle(radius=1.35, color=CYAN).set_stroke(opacity=0.6)
        ring.move_to(protein.get_center())
        self.play(ring.animate.scale(1.35).set_stroke(opacity=0), run_time=0.6)

        # ================= 4 · METRICS DASHBOARD =================
        rows = [("Predicted ΔG (Rosetta)", "−48.2 REU"),
                ("pLDDT confidence", "94.6"),
                ("pAE", "1.8 Å"),
                ("Backbone RMSD", "0.6 Å"),
                ("Solubility score", "0.93")]
        frame, items, checks = make_panel(rows)
        panel = VGroup(frame, items, checks).move_to([0.3, 0.35, 0])
        banner = make_banner().move_to([0.3, -2.15, 0])
        prot_cap = Text("designed in 3 s · folded in silico",
                        font_size=14, color=MUTED).move_to([-3.75, -1.6, 0])

        self.play(FadeOut(net), FadeOut(net_label), FadeOut(c2),
                  protein.animate.move_to([-3.75, 0.05, 0]),
                  FadeIn(frame, shift=LEFT * 0.3),
                  run_time=0.9)
        c3 = cap("Computational quality control — every metric passes", -2)
        self.play(FadeIn(c3), FadeIn(prot_cap), run_time=0.4)

        for row, ck in zip(items, checks):
            self.play(FadeIn(row, shift=RIGHT * 0.12), run_time=0.2)
            self.play(FadeIn(ck, scale=1.7), run_time=0.14)
        self.play(FadeIn(banner, scale=1.25), run_time=0.45,
                  rate_func=rf.ease_out_back)
        self.wait(0.7)

        # ================= 5 · APPROACHING THE WALL =================
        c4 = cap("All metrics green  →  move to experimental validation", -2)
        trail = DashedLine([-3.75, 0.35, 0], [2.6, 0.35, 0], dash_length=0.16,
                           color=CYAN, stroke_width=2).set_opacity(0.35)
        self.play(FadeOut(panel), FadeOut(c3), FadeOut(prot_cap),
                  FadeIn(c4), Create(trail), run_time=0.6)
        self.play(protein.animate.move_to([1.42, 0.35, 0]),
                  run_time=1.15, rate_func=rf.ease_in_cubic)

        # ================= 6 · IMPACT =================
        self.zoom(10.8, [2.1, 0.2], rt=0.6)
        self.play(FadeOut(c4), FadeOut(trail), run_time=0.3)
        contact = protein.get_right() + RIGHT * 0.05
        self.play(Wiggle(wall.bricks, scale_value=1.015, angle=0.012),
                  Flash(contact, color=AMBER, flash_radius=0.75,
                        line_length=0.16),
                  wall.plate.animate.set_opacity(1),
                  wall.label.animate.set_opacity(1),
                  run_time=0.6)
        self.play(protein.animate.stretch(0.9, 0).stretch(1.06, 1),
                  run_time=0.15, rate_func=rf.linear)
        self.play(protein.animate.stretch(1 / 0.9, 0).stretch(1 / 1.06, 1)
                  .shift(LEFT * 0.12),
                  run_time=0.35, rate_func=rf.ease_out_back)
        dust = VGroup(*[Dot(contact + np.array([dx, dy, 0]), radius=0.03,
                            color="#cfd6e4")
                        for dx, dy in [(0.05, 0.2), (-0.02, 0.05), (0.09, -0.1)]])
        self.play(FadeIn(dust), run_time=0.1)
        self.play(dust.animate.shift(DOWN * 0.7), FadeOut(dust),
                  wall.edge.animate.set_stroke(opacity=0.95),
                  run_time=0.5, rate_func=rf.ease_in_cubic)
        c5 = cap("Here, matter has the final say", 2.1, y=2.6, color=AMBER)
        self.play(FadeIn(c5), run_time=0.4)
        self.wait(0.8)

        # ================= 7 · ENTER THE LAB =================
        self.play(FadeOut(c5), run_time=0.3)
        self.zoom(13.6, [6.6, 0.2], rt=1.2)
        c6 = cap("Every step of the physical pipeline can veto the design",
                 6.6, color=INK_SOFT)
        self.play(FadeIn(c6), run_time=0.45)
        self.wait(0.5)

        path = DashedLine([3.9, 0.8, 0], [20.4, 0.8, 0], dash_length=0.18,
                          color="#8a7a63", stroke_width=2.5).set_opacity(0.55)
        stage.add(path)
        token = make_protein().scale(0.52).move_to([4.05, 0.8, 0])
        self.play(FadeOut(c6), Create(path), FadeIn(token, scale=1.3),
                  run_time=0.7)

        station_specs = [
            (5.3,  icon_dna(),    "Synthesis",    "gene synthesis fails · GC repeats"),
            (8.7,  icon_flask(),  "Expression",   "expresses as inclusion bodies"),
            (12.1, icon_funnel(), "Folding",      "misfolds and aggregates"),
            (15.5, icon_column(), "Purification", "precipitates on the column"),
            (18.9, icon_cd(),     "Validation",   "measured fold ≠ design"),
        ]
        stations, chips = VGroup(), []
        for i, (sx, icon, name, chip_txt) in enumerate(station_specs):
            stations.add(make_station(icon, name, i + 1, np.array([sx, 0.8, 0])))
            chips.append(make_chip(chip_txt).move_to([sx, -1.18, 0]))
        stage.add(stations)

        icon_crosses = []
        for i, (sx, _, _, _) in enumerate(station_specs):
            st = stations[i]
            self.play(token.animate.move_to([sx, 0.8, 0]),
                      self.camera_frame.animate.move_to([min(sx + 0.7, 19.6), 0.2, 0]),
                      run_time=0.75, rate_func=rf.ease_in_out_sine)
            self.play(Circumscribe(st[0], color=RED, buff=0.12), run_time=0.5)
            cross = mark_cross(RED, s=1.6).move_to(st[1].get_center())
            icon_crosses.append(cross)
            self.play(FadeIn(chips[i], scale=1.5),
                      GrowFromCenter(cross),
                      *recolor_anims(token, STAGE_COLS[i]),
                      token.animate.rotate(0.14 if i % 2 == 0 else -0.14),
                      run_time=0.6, rate_func=rf.ease_out_back)
            self.wait(0.25)

        # ================= 8 · REJECTED =================
        blob = make_blob().move_to(token.get_center())
        self.play(Transform(token, blob), run_time=0.5)
        self.play(token.animate.move_to([18.9, -2.3, 0]),
                  run_time=0.5, rate_func=rf.ease_in_cubic)
        self.play(token.animate.stretch(0.85, 1).stretch(1.08, 0), run_time=0.12)
        self.wait(0.3)

        self.play(FadeOut(VGroup(*chips, *icon_crosses, token, c6)),
                  run_time=0.45)
        self.play(self.camera_frame.animate.move_to([12.0, 0.2, 0]), run_time=0.7)

        stamp_txt = Text("DESIGN REJECTED BY EXPERIMENT",
                         font_size=27, weight=BOLD, color=RED)
        stamp_box = RoundedRectangle(width=stamp_txt.width + 0.7,
                                     height=stamp_txt.height + 0.42,
                                     stroke_width=3, color=RED)
        stamp = VGroup(stamp_box, stamp_txt).rotate(-0.1).move_to([12.0, -1.15, 0])
        self.play(FadeIn(stamp, scale=2.0), run_time=0.35, rate_func=rf.rush_into)
        self.play(self.camera_frame.animate.shift(0.09 * RIGHT),
                  run_time=0.07, rate_func=rf.there_and_back)
        self.wait(0.8)

        # ================= 9 · THE CONTRAST =================
        self.play(FadeOut(stamp), FadeOut(protein), run_time=0.4)
        self.zoom(15.6, [3.0, 0.15], rt=1.1)
        col_l = verdict_column("IN SILICO", "c", "every metric green",
                               CYAN_SOFT, GREEN).move_to([-0.7, 0.6, 0])
        col_r = verdict_column("IN THE LAB", "x", "every step failed",
                               RED, RED).move_to([6.7, 0.6, 0])
        self.play(FadeIn(col_l, shift=LEFT * 0.4),
                  FadeIn(col_r, shift=RIGHT * 0.4), run_time=0.8)
        self.wait(1.4)

        # ================= 10 · FINAL MESSAGE =================
        self.play(FadeOut(VGroup(stage, col_l, col_r)), run_time=0.9)
        t1 = Text("Computationally perfect", font_size=44, weight=BOLD, color=WHITEISH)
        neq = Text("≠", font_size=66, weight=BOLD, color=AMBER)
        t2 = Text("experimentally realizable", font_size=44, weight=BOLD, color=RED_SOFT)
        stack = VGroup(t1, neq, t2).arrange(DOWN, buff=0.32).move_to([3.0, 0.35, 0])
        sub = Text("Design for the bench: put synthesizability inside the loop.",
                   font_size=20, color=MUTED).next_to(stack, DOWN, buff=0.55)
        self.play(FadeIn(t1, shift=LEFT * 0.5), run_time=0.6)
        self.play(FadeIn(neq, scale=1.6), run_time=0.4, rate_func=rf.ease_out_back)
        self.play(FadeIn(t2, shift=RIGHT * 0.5), run_time=0.6)
        self.play(FadeIn(sub), run_time=0.6)
        self.wait(2.4)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=1.0)
        self.wait(0.4)
