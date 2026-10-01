# Issue #1 — Decouple the Architecture from 2D Manim Scenes

> Working notes for this issue. Implementation record: Iteration 001.
> Status after Iteration 001: architectural acceptance criteria met;
> residual capability deferred to #6 / #15 / #16 (see task registry A-20…A-24).

## Interpretation decisions (recorded for traceability)

1. **"Must be implemented incrementally"** — Iteration 001 delivers the
   architectural foundation only (registries, scene types, detection, schema,
   bounded frontend, tests, docs). Domain visualizations are not included.
2. **"Frontend must be updated"** — bounded integration shipped: scene type
   selection, camera editing, codegen parity, migration. Full editor
   integration (gizmos, 3D canvas) explicitly belongs to #15 per the issue
   text ("the frontend must be updated **through issue #15**").
3. **"Scene detection"** — implemented twice with identical rules (JS regex
   for the API, Python `ast` for the renderer), cross-checked by tests; never
   executes user code.
4. **"Unknown object types"** — validation fails with a registry-derived
   message (prevents silent placeholder circles); codegen still carries a
   neutral fallback as defence in depth.
5. **"Custom scene classes"** — `sceneType: "custom"` + `scene.baseClass`
   names a user-defined base; the generated code renders against it, and the
   renderer detects the class from source order if the name is absent.

## Acceptance criteria vs. delivered

| Criterion | Status |
|---|:---:|
| Old 2D-only architectural coupling removed | ✅ registries; no hardcoded MainScene anywhere in the pipeline |
| 2D, moving-camera, 3D scene types have clear extension points | ✅ `registerSceneType` + `emitPrologue` |
| Custom scene classes can be discovered and rendered | ✅ detection JS+PY; worker fallback; render-code auto-detect |
| Compiler/renderer responsibilities separated | ✅ compiler returns sceneName; renderer verifies/detects |
| Plugin/registry boundaries established | ✅ generic registry core; duplicate rejection |
| Frontend impact documented and integrated where required | ✅ bounded integration + ARCHITECTURE.md §2.4 |
| Architecture documentation updated | ✅ `architecture/ARCHITECTURE.md` |
| Tests pass and regressions covered | ✅ 65 new tests; legacy-project regression cases |
| Task registry and iteration report updated | ✅ `roadmap/TASK-REGISTRY.md`, `iterations/ITERATION-001.md` |
