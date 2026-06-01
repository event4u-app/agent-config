# Roadmap Trajectory — Commitment vs. Delivery History

Historical one-shot report (generator retired). JSON sibling: [`roadmap-trajectory.json`](roadmap-trajectory.json).

> **Generator retired 2026-06-01** (`road-to-linter-debt-and-meta-subtraction`, Phase 3 — meta-system subtraction audit). `scripts/measure_roadmap_trajectory.py` met kill-criterion **KC3** (no live consumer: not wired into any taskfile / CI / hook, not imported by any script — only historical references). The script was a one-shot audit tool; this report preserves its finding. Re-derive on demand from `agents/roadmaps/archive/` checkbox grammar if the metric is ever needed again.

Closes Phase 5.1 of [`step-1-v2-feedback-followup`](../roadmaps/step-1-v2-feedback-followup.md) (council U4 / feedback file [08](../council-sessions/2026-05-14-v2-analysis/feedback/08-roadmap-trajectory.md)).

## Aggregate

| Metric | Value |
|---|---|
| Roadmaps in `archive/` | **146** |
| Scored (≥ 1 actionable checkbox) | **114** |
| Mean completion ratio | **91.9 %** |
| Median completion ratio | **100.0 %** |
| Above 80 % completion | **102 / 114** (89.5 %) |
| Below 50 % completion | **6 / 114** |
| Zero completion | **5 / 114** |

**Trajectory signal:** strong. Median 100 %, mean 91.9 %, 89.5 % of scored roadmaps cleared the 80 % threshold. The council U4 prediction-vs-delivery test holds: archived roadmaps deliver against their stated checkboxes.

## Below-threshold archives (the actual investigation surface)

| Ratio | Roadmap | done / actionable | Reading |
|---|---|---|---|
| 41.7 % | `road-to-distribution-and-adoption.md` | 5 / 12 | partial — distribution work moved to a successor roadmap mid-flight (followed by `road-to-event4u-namespace-and-claude-desktop.md` at 100 %). Not a delivery failure; superseded mid-execution |
| 0.0 % | `00-phase4-overview.md` | 0 / 14 | meta / overview file — checkbox style is informational ("status of …"), not tracked work. Filed under archive once the phase wrapped |
| 0.0 % | `deferred-followups.md` | 0 / 16 | named container for explicitly-parked items. Zero is the correct value — these are decisions to NOT do work |
| 0.0 % | `intent-based-orchestration.md` | 0 / 49 | aspirational draft, archived without execution. Trajectory cost is honestly recorded |
| 0.0 % | `road-to-rule-quality-research.md` | 0 / 2 | spike-shaped, never converted to actionable items before archival |
| 0.0 % | `road-to-ultimate.md` | 0 / 40 | aspirational draft, archived without execution |

## Reading the signal

Three of the five zero-completion archives are **honestly-recorded parks** (`deferred-followups.md`, `intent-based-orchestration.md`, `road-to-ultimate.md`) — they were filed under `archive/` because they were *no longer in-flight*, not because they were delivered. This is the right outcome: parked work moves to the archive, the trajectory metric registers it as zero, and the project carries a truthful record.

One (`00-phase4-overview.md`) is a meta / overview file whose checkboxes are status-of-the-phase pointers, not commitments.

One (`road-to-rule-quality-research.md`) is a spike that didn't survive conversion.

**Net:** the 6 / 114 "below 50 %" cohort splits into 1 truly partial delivery (superseded mid-flight) + 4 honest parks + 1 spike. There is no pattern of silent commitment-to-archive drift.

## Open question 3 from feedback file 08 — answered

> _Is there a category of roadmap that should be exempt from the trajectory metric (e.g. exploratory / spike roadmaps where dropping items is the expected outcome)?_

**Working answer:** no exemption needed. The zero-completion roadmaps in the cohort are correctly named (`deferred-`, `intent-based-`, `-ultimate`, `-research`). The trajectory metric reading them as zero is **information, not noise** — it tells the reader these were parked decisions, not delivered work. Adding an exemption flag would let drift hide behind the flag.

## How to re-run

```bash
python3 scripts/measure_roadmap_trajectory.py --print-table
```

The script counts `[x]` as done, `[ ]` as open, `[~]` as work-in-progress, `[-]` as cancelled (excluded from denominator). Output: this file's sibling `roadmap-trajectory.json` and the table you see above.

## Related

- [`agents/runtime/council/sessions/2026-05-14-v2-analysis/feedback/08-roadmap-trajectory.md`](../council-sessions/2026-05-14-v2-analysis/feedback/08-roadmap-trajectory.md) — origin council finding
- [`docs/contracts/roadmap-complexity-standard.md`](../../docs/contracts/roadmap-complexity-standard.md) — sibling standard
- [`scripts/measure_roadmap_trajectory.py`](../../scripts/measure_roadmap_trajectory.py) — generator
