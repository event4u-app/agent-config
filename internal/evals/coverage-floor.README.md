# Behavioural-eval coverage floor — lowering policy

`coverage-floor.json` pins the per-tier behavioural-eval coverage
(`src/skills/<skill>/evals/evals.json`) that `skill_eval_coverage --check`
guarantees. The ratchet only ever **rises**: raise a count with
`./scripts-run src/scripts/skill_eval_coverage --write-floor` after authoring
new evals (never by hand-raising above the measured count — that would fail
`--check` immediately).

## Lowering the floor (council requirement)

A coverage count may **legitimately** drop — e.g. two skills merged into one,
or a redundant/duplicated eval removed. When that happens the floor must track
reality, but it must never be silently gutted.

```
A LEGITIMATE COVERAGE DROP IS ALLOWED ONLY BY EDITING THE FLOOR COUNT
DOWNWARD *WITH A LOGGED REASON* BELOW — NEVER BY DELETING coverage-floor.json,
DELETING A TIER KEY, OR ZEROING A COUNT TO DODGE THE RATCHET.
```

- Edit only the specific count(s) that dropped, to the new measured value
  (confirm with `./scripts-run src/scripts/skill_eval_coverage`).
- Append one row to the log below: date, tier, `old → new`, and the reason.
- Deleting the file or a tier key, or lowering without a logged reason, is a
  policy violation — the same bright-line discipline as
  `tier-floor-exemptions.json` (no silent exemptions; every exception carries a
  reason).

## Lowering log

Mirrors the reason-logging pattern of `tier-floor-exemptions.json`.
Append-only — newest last.

| Date | Tier | Old → New | Reason |
|------|------|-----------|--------|
| _(none yet)_ | | | |

## See also

- `coverage-floor.json` — the pinned floor this policy governs.
- `tier-floor-exemptions.json` — priority-tier bright-line exemptions (same
  reason-logging discipline).
- `src/scripts/skill_eval_coverage.ts` — the metric + `--check` ratchet.
