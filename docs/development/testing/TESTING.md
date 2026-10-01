# Testing Guide

## Suites

| Service | Command | What it covers |
|---------|---------|----------------|
| API compiler | `cd services/api && npm test` | Registries, validation, codegen (2D / moving-camera / 3D / custom), scene detection (JS), regressions |
| Renderer | `python -m unittest discover -s services/renderer/tests` | AST scene detection, picking rules |
| Web engine | `cd services/web && npm test` | Easing, geometry, transforms, timeline + scene metadata, client detection |
| Web build | `cd services/web && npm run build` | Frontend compiles |

## Conventions

- New capabilities **must** ship with tests in the same iteration.
- Scene detection has two implementations (JS + Python) that must stay
  behaviourally aligned — change both or neither.
- Regression tests for legacy behaviour live in
  `services/api/tests/compiler.test.mjs` (v2 project JSON, legacy codegen
  output).

## Deferred (tracked to issue #16)

- Docker-based end-to-end render verification (build the stack, render one
  project per scene type, assert MP4 output).
- Deterministic reproducibility (hash-pinned images, golden outputs).
