---
complexity: lightweight
review_by: 2026-12-09
---

# Stub: road to a census that refuses to publish from a partial store

> **Stub — not active work.** Found 2026-09-09 by the drain run holding
> `road-to-the-14-22-0-disposition-residuals`, whose step 1.3 was instructed to
> re-emit the skill-activation census and did not. The run avoided the defect by
> hand; nothing in the tree would have stopped it. An AI council (2026-09-09,
> 2 seats) named it as a separate item and said it should be tracked rather than
> fixed inside a ledger-correction commit. Recorded here rather than built
> drive-by, and rather than as a blocker on that roadmap, because it is not a
> residual of the 14.22.0 review and would otherwise hold a finished file open.

## The defect, reproduced

`src/scripts/report_skill_activation.ts` resolves the transcript stores to read
from the **current project path**. Run from the canonical checkout it finds the
maintainer's main store; run from a git worktree it finds that worktree's own,
much smaller store, and says nothing about the difference.

Measured 2026-09-09 from
`.claude/worktrees/feat-blocker-not-hidden-in-archive`:

| Reading | sessions | assistant turns | Skill invocations |
|---|---:|---:|---:|
| committed record (`agents/evidence/metrics/skill-activation-census.json`) | 30 | 11,338 | 0 |
| what this worktree resolves | 2 | 425 | 1 |

`--emit` writes the second over the first with no warning and no refusal. The
published claim `skill-activation-census-zero` in `docs/CLAIMS.md` is
`status: backed`, and its headline word is **ZERO** — so a single `--emit` from
the wrong directory turns a 30-session zero into a 2-session one, and
`check_skill_activation_claim` would then be green against the corrupted record,
because that gate compares the claim to the record and never asks whether the
record still describes the world. Its own docblock says so
(`report_skill_activation.ts:342-349`).

## Why the obvious guard is not obviously right

The cheap version — refuse when `process.cwd()` is not the canonical checkout —
is a path heuristic, and path heuristics in this tree have a record of being
wrong in both directions (a CI checkout is not the maintainer's path either).

The shape that reads better is data-driven: `--emit` refuses when the store set
it resolved does not cover the `stores` array the existing record names, i.e.
when re-emitting would DROP a store rather than update one. That has no path
assumption in it, states its refusal in terms a reader can check, and leaves a
first emit (no prior record) unaffected. It needs an explicit override for the
legitimate case where a store genuinely goes away.

Neither is written here. Choosing between them changes what a published claim's
provenance is allowed to be, which is worth one decision rather than a
drive-by patch.

## Promotion probe

Promote when either fires:

1. A census record is found in git history whose `stores` array shrank between
   two commits with no accompanying note — i.e. the defect has actually landed
   once. `git log -p --follow agents/evidence/metrics/skill-activation-census.json`
   is the whole probe.
2. The owner decides the provenance question above (path guard vs store-coverage
   guard) — a one-line answer is enough to make this buildable.

Until then the mitigation is what this stub is: the failure mode is written
down, and `road-to-the-14-22-0-disposition-residuals` step 1.3 records the one
run that met it and declined.
