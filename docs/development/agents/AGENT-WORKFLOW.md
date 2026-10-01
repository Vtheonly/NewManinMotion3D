# Agent Workflow

> How future agents (human or AI) extend this project. Rules originate from
> the issue tracker's mandatory multi-iteration addendum.

## Ground rules

1. **One iteration, one bounded scope.** Never implement the whole roadmap in
   one PR. Declare scope before you start; do not silently expand it.
2. **Read first, then code.** Read `roadmap/TASK-REGISTRY.md`,
   `architecture/ARCHITECTURE.md`, and the latest iteration report before
   planning.
3. **Leave the repo green.** Every iteration ends with all test suites
   passing and a buildable frontend.
4. **Document what actually happened**, including failures and deferred work,
   in `iterations/ITERATION-NNN.md`. Plans are not reports.

## Workflow per iteration

1. Pick the next issue/iteration from `roadmap/ROADMAP.md` (respect
   dependencies).
2. Create branch `issue-<n>/iteration-<nnn>-<slug>`.
3. Implement:
   - capabilities go through the **registries** (see ARCHITECTURE.md §4);
   - frontend integration ships with the capability (not after);
   - tests ship with the capability.
4. Run all suites:
   ```bash
   python -m unittest discover -s scientific/tests -t .   # scientific runtime
   cd services/api     && npm test        # node:test (compiler + IR parity)
   cd services/web     && npm test        # engine + scene suites
   cd services/renderer && python -m unittest discover -s tests
   cd services/web     && npm run build   # must succeed
   ```
   (The scientific suite's execution subset needs a manim-capable venv;
   parity fixtures: `scripts/gen_parity_fixtures.py` + `scripts/sync_schema_types.py`.)
5. Write `iterations/ITERATION-NNN.md` (goals, tasks, files, tests, bugs,
   limitations, deferred).
6. Update `roadmap/TASK-REGISTRY.md` statuses + change log.
7. Commit, push, PR to `main`, reference the issue number.

## Registry extension cheat-sheet

- New object type → `registerObjectType` (`registry/objects.js` or plugin)
- New animation → `registerAnimation(phase, key, {...})`
- New scene type → `registerSceneType(key, {...})` **and** frontend
  `SCENE_TYPES` entry
- Changed scene detection → update BOTH `sceneDetect.js` and
  `scene_detect.py` + both test suites

## Boundaries (do not cross)

- Core orchestration (`codegen.js`) must never branch on concrete types.
- The frontend must not invent scene semantics the server doesn't register.
- The renderer must never execute user code for detection (`ast` only).
- One concept, one registration — duplicates throw by design.
