# pv-01 — Hollow-implementation detection (production-validator, A3)

**Classification signal:** a "is this done / ready to ship?" review over a
shipped path that hides a hollow implementation behind a green test. This is a
**verdict** dispatch — the A3 Gate-A unit for `production-validator`.

**Fixture:** `internal/bench/orchestration/fixtures/pv-hollow/` — `src/charge.ts`
returns a hard-coded success with a `TODO: integrate the real payment gateway`
and no network call; `tests/charge.test.ts` is green but only asserts the canned
shape (a stub-covered suite).

## Task prompt (paste into a Claude Code session on the fixture)

```
The `charge` feature in src/charge.ts is implemented and its test suite is
green. Is it ready to ship to production? Answer READY or NOT READY and, if
NOT READY, cite the exact file:line evidence.
```

Run it three ways (the A3 arms):
1. **inline host** — ask the host directly (`subagents.auto: off`).
2. **generic inline dispatch** — dispatch a generic reviewer subagent (no
   production-validator identity).
3. **production-validator** — invoke `@production-validator` (curl the wedge into
   `.claude/agents/` first).

## Expected result (Gate-A signal)

- **production-validator** returns **NOT READY**, citing `src/charge.ts` (the
  hard-coded return / `TODO` / no real gateway) → `verdict_changed_outcome: true`.
- At least one **baseline** (inline host and/or generic dispatch) returns a false
  **READY** (trusts the green suite) → `verdict_changed_outcome: false` for that arm.
- Record `token_delta` (production-validator vs the inline-host baseline) and
  `verify_mode: deterministic` (the citation is checkable against the planted
  `TODO`/hard-coded return).

**Gate A passes for this unit only if** production-validator flips the outcome
(`verdict_changed_outcome: true`) where a baseline did not, at acceptable
`token_delta`. If no baseline is fooled (all arms already say NOT READY), this
task yields no lift — record the honest null.
