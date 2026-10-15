<!-- evidence-type: analysis -->

# Merge danger gate — the owner's load

Pin `a10aa16a1fe1a27b7ff54bcb564154a28877625f`, window from `2026-09-07T00:00:00+02:00`, first-parent history. Produced by

```bash
./scripts-run src/scripts/report_merge_gate_load --pin a10aa16a1fe1a27b7ff54bcb564154a28877625f --since 2026-09-07T00:00:00+02:00
```

A re-run of that command at the same pin and timestamp is byte-identical.

**Caveat.** The classifier is this checkout's, so its path sets are applied to
the whole window: a commit from before a trigger existed is classed as if it
had. The figures say what the gate *would* hand over today, not what it did.

## Commits per verdict

| Verdict | Commits |
|---|---|
| `routine` | 283 |
| `needs-council` | 99 |
| `needs-owner` | 103 |
| total | 485 |

## Commits per trigger

A commit with several triggers is counted under each.

| Trigger | Commits |
|---|---|
| `governance-surface` | 60 |
| `deploy-or-release` | 54 |
| `ci-workflow` | 53 |
| `security-surface` | 34 |
| `dependency-manifest` | 29 |
| `owner-reserved-decision` | 25 |
| `consequence-class-rule` | 24 |
| `council-surface` | 19 |
| `merge-authority-surface` | 14 |
| `ratification-contract` | 11 |
| `merge-rule-carrier` | 10 |
| `reviewer-trust-chain` | 7 |
| `consumer-template` | 2 |
| `removed-directory` | 1 |

## Per day with a merge

30 day(s) with a first-parent commit, cut in the offset of `2026-09-07T00:00:00+02:00`.

| Verdict | Median per day | Maximum | Days with none |
|---|---|---|---|
| `needs-council` | 3 | 13 | 4 |
| `needs-owner` | 2.5 | 12 | 9 |

## Hand-offs to the owner, by cause

| Cause | Count | Source |
|---|---|---|
| `needs-owner` | 103 | replay |
| a `dangerous` seat | 0 | clearance records at the pin |
| a split — not cleared with at least one clearing seat | 0 | clearance records at the pin |
| not cleared, no clearing seat (degraded or no quorum) | 0 | clearance records at the pin |
| `needs-council` with no clearance record — no council on record | 99 | replay minus records |

Clearance records at the pin: 0 cleared, 0 not cleared, 0 dangerous, 0 unreadable. A `needs-council` commit
with no record either predates the record (the gate merged on free prose, or
the owner merged it himself) or was handed over; the replay cannot tell which.

## Named rows

| Commit | Day | Verdict | Triggers | Subject |
|---|---|---|---|---|
| `82a131feb` | 2026-10-07 | `needs-owner` | `consumer-template`, `council-surface`, `owner-reserved-decision`, `ratification-contract` | docs(governance): ADR-281 and the texts it corrects (partial, self-modification roadmap) (#2251) |
| `edd18fea6` | 2026-10-07 | `needs-owner` | `merge-authority-surface`, `merge-rule-carrier`, `owner-reserved-decision` | feat(merge): auto-merge on the owner's word, with a council danger gate (ADR-282) (#2256) |
