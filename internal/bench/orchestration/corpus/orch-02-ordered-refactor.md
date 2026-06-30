# orch-02 — Ordered refactor plan (ordered-plan structure → do-in-steps)

**Classification signal:** Explicit numbered plan with ordered steps that
depend on each other. Should trigger `do-in-steps` via classifier signal 2.

## Task prompt (paste into Claude Code session on fixture project)

```
Refactor the fixture project in three ordered steps. Each step depends
on the previous one:

1. Extract all magic string literals in src/parser.ts into named
   constants at the top of the file.

2. Add JSDoc comments to every exported function in src/formatter.ts,
   describing the parameter types and what edge cases it handles.

3. Write a test in tests/ that covers the error paths introduced in
   step 1's constants — at least one test per constant used in a branch.

Do these in order. Report when each step is complete before moving to
the next.
```

## Expected orchestration behaviour

- Classifier signal 2 (ordered-plan structure) fires: 3 explicit numbered
  steps with inter-step dependency ("each step depends on the previous").
- Mode: `do-in-steps` with a judge gate between steps.
- Telemetry: `spawn_count` ≥ 3 (one per step plus judge), `verify_mode: judge`.

## Success criteria

- `spawn_count > 0` in the telemetry line.
- `verify_mode: "judge"` in the orchestration sub-object.
- All three files modified in the correct order.
