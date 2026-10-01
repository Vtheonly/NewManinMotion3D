# Example B — Torus Flow vs Screw Kinematics (`slide_02_torus_poe_kinematics.py`)

Reference target of issue #32 §9 (Example B): a 3D scene where every
domain concept (torus state, flow, PoE chain, screw, Jacobian, obstacle,
clash, resolution, camera, labels, animation) is a canonical abstraction.

## Narrative stages

1. **Torus Flow Matching** — the T² manifold with an integrated flow
   trajectory (midpoint ODE), camera ambient orbit.
2. **PoE Assembly** — the revolute chain appears; the screw axis is
   labelled; geometric-Jacobian arrows grow; the formula
   `tau = J(theta).T @ F` highlights its transpose term.
3. **Steric Clash** — the obstacle appears (from the data manifest); the
   live clash flag annotates the chain.
4. **DLS Resolution** — a documented custom step rebuilds the chain at the
   DLS-resolved angles and cross-fades to it; the live clearance annotates.
5. **Verdict** — `move_camera` to a final orientation.

## Where the math lives (all pure, all tested)

| Concept | Module | Verified by |
|---|---|---|
| T² embedding + flow + midpoint integration | `domains/kinematics/torus.py` | torus point values; determinism; midpoint-vs-Euler accuracy |
| so(3)/se(3) exponentials (Rodrigues + twist form) | `domains/kinematics/poe.py` | Rz(90°) mapping; axis-point invariance; FK(0) straight line |
| Chain FK (spatial convention) | `domains/kinematics/chain.py` | single-joint rotation; config length validation |
| Geometric Jacobian (current frames) | `domains/kinematics/jacobian.py` | finite-difference match < 1e-4 |
| DLS step (3×3 solve, no numpy) | `domains/kinematics/jacobian.py` | residual decrease property |
| Obstacle clearance/clash/escape/resolve | `domains/kinematics/obstacles.py` | segment distance; guaranteed-clash construction; clearance improvement |
| Screw axis + moment + velocity | `domains/kinematics/screw.py` | moment of origin axis; velocity ⊥ arm |

The scene file composes these; it contains no trigonometry.

## Configuration comes from data

`DataRef("kinematics/joint_config.json")` supplies thetas, link length,
obstacle centre/radius and damping — explicit, versioned, reproducible. The
clash is computed from geometry at build time (never a hardcoded boolean);
the resolved thetas are computed by the same DLS routine the renderer's
custom step reuses.

## Rendering details worth noting

- `three_d` scene type with `phi/theta/distance` prologue; `orbit` and
  `move_camera` camera ops (syntax/CAMERA.md).
- The trajectory is a smooth VMobject through the embedded 3D points; the
  torus is a low-resolution `Surface` with palette checkerboard.
- The custom boundary step is the single documented place where the scene
  reaches into runtime animation directly (ANIMATION.md §4) — its code is
  preserved verbatim by export (pinned by round-trip tests).

## Running

```bash
python -m scientific.run presentation/scenes/slide_02_torus_poe_kinematics.py \
    TorusPoEKinematics --quality low
```

Verified output (iteration 001 evidence): renders end-to-end; 11
animations; deterministic MP4 at 480p15; the document (6 objects, 5 stages,
live values, relationship) round-trips byte-exactly through the exporter.
