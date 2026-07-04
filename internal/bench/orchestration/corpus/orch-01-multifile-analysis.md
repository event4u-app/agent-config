# orch-01 — Multi-file analysis (parallelizable: files → do-in-parallel)

**Classification signal:** N independent files, same analysis shape. Should
trigger `do-in-parallel` when `subagents.auto: on` or `ask` (with user confirm).

## Task prompt (paste into Claude Code session on fixture project)

```
Analyse the following four source files for potential bugs, edge cases,
and missing error handling. Each file is independent — report one
findings block per file.

Files:
- src/parser.ts
- src/formatter.ts
- src/cli.ts
- src/reducers.mjs

For each file, report:
1. Any input that would cause a crash or silent wrong result.
2. Any error paths that are missing.
3. One-line fix for each finding.
```

## Expected orchestration behaviour

- Classifier signal 3 (independent-slices structure) fires: 4 independent
  file targets, same analysis shape per file.
- Mode: `do-in-parallel` with up to `max_parallel` (default 3) concurrent
  implementers.
- Telemetry: `spawn_count` ≥ 2, `tiers` contains the implementer model tier,
  `verify_mode: deterministic` (structural output, no judge needed).

## Success criteria

- `spawn_count > 0` in the telemetry line (confirms real delegation happened).
- `token_delta` is non-zero (positive or negative).
- Wall clock is faster than sequential would be (subjective — note the
  timing in your experiment log).
