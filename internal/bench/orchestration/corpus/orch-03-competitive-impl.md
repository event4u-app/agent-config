# orch-03 — Competitive implementation (do-competitively)

**Classification signal:** Broad solution space with explicit trade-off
("two approaches"). Should trigger `do-competitively` via classifier
signal 3 + broad solution space hint.

## Task prompt (paste into Claude Code session on fixture project)

```
Implement error recovery for src/parser.ts using two different
approaches. I want to compare them before committing:

Approach A: Return a Result<T, ParseError> type (wrap errors in a
typed union) — do not throw.

Approach B: Throw custom typed errors (ParseError extends Error)
and let callers decide whether to catch.

For each approach, implement the change to src/parser.ts and write
one test demonstrating how callers use it. Then pick the better
approach for this codebase and explain the choice in one paragraph.
```

## Expected orchestration behaviour

- Broad solution space: two explicitly named approaches with a judge step.
- Mode: `do-competitively` — two implementers, one judge picks the winner.
- Telemetry: `spawn_count` ≥ 3 (2 implementers + 1 judge), `verify_mode: judge`.
- Note: most expensive mode (N+1 calls per slice) — confirms budget impact is
  real and surfaced in `token_delta`.

## Success criteria

- `spawn_count >= 3` in the telemetry line.
- `verify_mode: "judge"` in the orchestration sub-object.
- `token_delta > 0` (competitive mode always costs more than single-agent —
  the cost is the trade-off assessment, not blind implementation).
