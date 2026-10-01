# Roadmap

> Multi-iteration execution plan for the scientific animation toolkit.
> Rule zero (from the issue tracker): **never implement the whole roadmap in
> one iteration** — every iteration has bounded scope, tests, docs, and a
> written report of what actually happened.

## Iteration history

| Iteration | Date | Issue(s) | Scope | Report |
|-----------|------|----------|-------|--------|
| 001 | 2026-10-01 | #1 | Registry-based compiler, scene types (2D / moving-camera / 3D / custom), scene detection, schema v3, bounded frontend integration | [ITERATION-001.md](../iterations/ITERATION-001.md) |

## Sequencing guidance (dependency-aware)

1. **#1 Decouple architecture** — foundation. *(Iteration 001 done; residual
   tasks A-20…A-24 remain, consumed by later issues.)*
2. **#3 Governance** — task registry + agent workflow *(started in Iteration
   001; extend as iterations land)*
3. **#6 Camera architecture** — consumes A-21 (camera animation); unblocks
   every 3D-heavy feature
4. **#2 Scientific framework core** — canonical scene/state model on top of
   the registries
5. **#4 Reactive state** → **#5 Highlighting** → **#7 Graphs/functions** →
   **#11 Data-driven animation** — the reactive spine
6. **#8–#10, #12** — visualization domains (matrices, neural networks,
   attention, generic graphs) — each registers new object types + animations
7. **#13, #17–#22** — scientific domain layers (molecular, Lie geometry,
   GFlowNet, structural biology, medchem, diagnostics)
8. **#14** — high-level API once primitives stabilize
9. **#15 Frontend integration** — continuous; every iteration ships the
   frontend part of what it builds (rule from issue #1 comments)
10. **#16 Testing/Docker** — continuous; every iteration ships its tests
11. **#23–#28** — data binding, presentation systems, package architecture,
    reference scenes, defense deck, E2E verification
12. **#29** — the end-state universal editor (convergence point)

## Iteration ground rules (mandatory for every iteration)

1. Bounded scope declared **before** implementation; never silently expanded.
2. Each iteration leaves the repo coherent and testable.
3. Tests accompany every capability; all suites green before merge.
4. `iterations/ITERATION-NNN.md` records what actually happened, including
   failures and deferred work.
5. `roadmap/TASK-REGISTRY.md` updated with final statuses.
6. Frontend integration ships with (not after) the capability it exposes.
7. One PR per iteration (or per issue when iterations are small), merged to
   `main` after tests pass.
