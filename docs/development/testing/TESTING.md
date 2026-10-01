# Testing Guide

## Suites

| Service | Command | What it covers |
|---------|---------|----------------|
| Scientific runtime (full) | `python -m unittest discover -s scientific/tests -t .` | IR schema/validation/serialization, registry, authoring API, safe evaluator, bindings, numerics (torus/PoE/Jacobian/protein/NN/attention), export round-trips, **real Manim execution of exported Python**, architecture rules, Python↔JS parity |
| Scientific runtime (no manim) | same command, system python | identical suite; manim-dependent tests auto-skip |
| API compiler + IR | `cd services/api && npm test` | Registries, validation, codegen (2D / moving-camera / 3D / custom), scene detection (JS), regressions + IR endpoints, JS mirrors, parity fixtures |
| Renderer | `python -m unittest discover -s services/renderer/tests` | AST scene detection, picking rules |
| Web engine | `cd services/web && npm test` | Easing, geometry, transforms, timeline + scene metadata, client detection |
| Web build | `cd services/web && npm run build` | Frontend compiles |

> Manim note: the scientific suite needs a manim-capable interpreter for
> the execution/architecture subsets (a venv with `pip install manim` is
> sufficient); everything else runs on a bare stdlib Python 3.12+.

## Conventions

- New capabilities **must** ship with tests in the same iteration.
- **Parity implementations** (change both or neither):
  - Scene detection: `services/api/src/compiler/sceneDetect.js` ↔
    `services/renderer/scene_detect.py`
  - Scientific IR: `services/api/src/ir/*` ↔ `scientific/{ir,registry,export}`
    — regenerate fixtures with `scripts/gen_parity_fixtures.py` and the JS
    mirror with `scripts/sync_schema_types.py`, then run both suites.
- The custom-code boundary in timeline steps is pinned by round-trip tests
  on all reference scenes — do not "normalize" custom steps.
- The 150-line production-file rule is enforced by
  `scientific/tests/test_architecture.py` for everything under
  `scientific/` and `presentation/`; legacy service debt is recorded in
  `problems/PROBLEM-REGISTRY.md` (P-008).

## Reference scene execution (manual smoke)

```bash
python -m scientific.run presentation/scenes/synth_wall.py SynthesizabilityWall --quality low
python -m scientific.run presentation/scenes/slide_01_tif_attention.py TifAttention --quality low
python -m scientific.run presentation/scenes/slide_02_torus_poe_kinematics.py TorusPoEKinematics --quality low
```

## Deferred (tracked to issue #16 / #28)

- Docker-based end-to-end render verification (build the stack, render one
  project per scene type, assert MP4 output) — including the renderer image
  shipping the scientific runtime.
- Deterministic reproducibility (hash-pinned images, golden outputs).
