# Example A — Synthesizability Wall (`presentation/scenes/synth_wall.py`)

Reference target of issue #32 §9 (Example A): a large narrative scene
composed from reusable primitives rather than one giant source file.

## What the scene narrates

1. **Intro — the wall**: a 6×4 grid of candidate proteins (deterministic
   folds), banner, camera push-in.
2. **Validation**: OK/FAIL stamps revealed row by row (custom steps), the
   scoring network grows in, the score formula highlights and annotates a
   live pseudo-energy.
3. **Verdict**: the hero sequence appears with highlighted mutation sites,
   the pass-rate badge grows and annotates the live rate.

## Numbers are real (deterministic model outputs)

- Candidates: `ProteinModel(residues=18+(i%3)*4, seed=3+i)` per cell —
  contacts, radius of gyration and synthesizability score feed the MLP.
- Scorer: `MLP([4, 6, 1], seed=11)`; each candidate's feature vector is
  `[contacts/40, Rg/2, synth score, 0.5+(i%5)/10]`; `score()` squashes to
  [0, 1].
- Verdicts: `verdict_from_score(score, 0.5)` — the wall summary
  (`x/24 pass`) is computed, never hardcoded.
- Hero energy: `DataRef("synth/protein.json", "energy")` — explicit data
  file, identical model parameters as the hero protein.

## Composition map (all primitives, no bespoke drawing in the scene)

| Concept | Primitive | Module |
|---|---|---|
| Wall layout | `ui.grid` + `domains/ui/grids.py` | layout math |
| Candidate protein | `biology.protein` (trace, scaled) | `domains/biology/protein/model.py` |
| Validation verdict | `ui.stamp` (geometric check/cross) | `manim_adapter/bindings/ui.py` |
| Scoring network | `nn.network` (live activations) | `domains/nn/network.py` |
| Score formula | `math.formula` + terms/highlights | `bindings/math.py` + latexify |
| Hero sequence | `biology.sequence` + highlights | `domains/biology/protein/sequence.py` |
| Summary badge | `ui.badge` + live values | `domains/presentation/stages.py` |
| Row reveal | `custom` steps (documented boundary) | `ANIMATION.md` §4 |
| Camera | `moving_camera` zoom ops | `syntax/CAMERA.md` |

The scene file itself is narrative composition: it stays under the
150-line limit enforced by the architecture test.

## Running

```bash
python -m scientific.run presentation/scenes/synth_wall.py \
    SynthesizabilityWall --quality low
# or directly, or via manim:
manim -ql presentation/scenes/synth_wall.py SynthesizabilityWall
```

Verified output (iteration 001 evidence): renders end-to-end; 14
animations; deterministic MP4 at 480p15. The document (55 objects, 3
stages) round-trips through the exporter byte-exactly (tested).
