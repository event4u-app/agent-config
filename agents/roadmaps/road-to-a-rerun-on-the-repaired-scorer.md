---
complexity: lightweight
review_by: 2026-12-15
tree_pin: 9ed90dbe85
---

# Road to a rerun on the repaired scorer — stub

> **Stub — not active work.** Created by round `inbox-2026-11-bn` (2026-11-04).
> **Source:** `agents/tmp.old/inbox-2026-11-bn/` — owner chat: rerun the
> benchmarks on the current tree, then write the next improvement roadmaps
> from what the rerun shows.
> **Owner cap (OQ-64, answered 2026-11-04):** $100 total for steps 1-2,
> enforced per sweep with `--max-usd`. The earlier $150 S4 grant and $250
> bench grant do not carry over; the powered comparison is not covered.

## Why it waits

Every published ab-v2 headline (`docs/benchmark.md` weak host, strong host,
cost-factor sweep) was scored before the 2026-10-28 oracle repair and is not
re-scored. The pinned reports keep scores only, no per-run diff, so they
cannot be re-scored offline: the only way to a post-repair number is a new
paid run. That spend is owner-reserved.

## What runs when the cap is granted

1. **Same question, repaired scorer.** Rerun the three pinned studies at
   their original arms, host and seeds with the current oracles; report
   `discipline_given_capability` and capability beside discipline. Old and new
   numbers never share a run id; the old ones stay, labelled pre-repair.
2. **Installed profiles as arms.** No arm today installs `minimal`,
   `essential` (what `balanced` resolves to) or `full` as a consumer would;
   the cost-factor sweep injected rule text. Add installed-profile arms beside
   the rules-only ones so the profile cost on the site is measured, not
   transferred.
3. **Write the next roadmaps from the residue.** Cluster failures of the
   rerun by cause, one `road-to-<observed-failure>` per cluster that has task
   ids and a reproducing artifact; nothing from a score delta alone. Each one
   names its cheaper alternative and a held-out re-test.

## Promotion probe

```
PROMOTE WHEN: the owner has recorded a dollar cap for steps 1-2
(agents/owner-questions.md or an owner directive), AND
road-to-benchmark-claims-that-name-their-scorer Phase 3 has landed
(so the new runs keep their diffs).
```

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-11-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Spend overruns the cap | product | A sweep at the original seed counts costs more than the owner granted | `--max-usd` hard cap per sweep; a refused budget ends the sweep and does not resume past the cap | What runs when the cap is granted |
| 2 | The rerun reads as a correction of the old numbers | product | A new number beside an old one invites subtraction | Old and new never share a run id; pre-repair rows stay with their label | What runs when the cap is granted |
| 3 | A residue cluster becomes a roadmap without a case | implementation | Step 3 could turn a score delta into a plan | Each cluster needs task ids and a reproducing artifact; a delta alone writes no file | What runs when the cap is granted |

## Non-goals

The comparison against vanilla, a short instruction file and neighbour
packages with adequate power belongs to `road-to-assurance-benchmark`; this
stub re-measures what is already published.
