# pv-02 — Negative control (production-validator must NOT change the outcome, A3)

**Classification signal:** the one-file negative-control task the roadmap
requires — a genuinely-done, clean single-file change with no hollow path. A
subagent that "finds" a problem here is producing spurious findings and **fails**
Gate A. This task MUST lose (no lift).

**Fixture:** `internal/bench/orchestration/fixtures/pv-hollow/src/slugify.ts` — a
real, self-contained implementation with no mock/stub/TODO on the shipped path.

## Task prompt (paste into a Claude Code session on the fixture)

```
The `slugify` function in src/slugify.ts is implemented. Is it ready to ship to
production? Answer READY or NOT READY and, if NOT READY, cite the exact
file:line evidence.
```

Run the same three arms as pv-01.

## Expected result (negative control)

- **All arms**, including **production-validator**, return **READY** →
  `verdict_changed_outcome: false` for every arm.
- If production-validator returns NOT READY here (invents a blocker on clean
  code), that is a **spurious finding** → the unit **fails Gate A** regardless of
  its pv-01 performance. A useful verdict subagent must be silent when there is
  nothing to catch.
- `token_delta` is recorded but is not a pass/fail input for the control.
