# Utilization-window decision criteria — pre-registered

> Design artifact for `road-to-feedback-8.11-2` Phase 0. The engagement
> observation window (telemetry.artifact_engagement, id-only,
> PII-excluded-by-construction) has been RUNNING in the agent-config repo
> since 2026-07-12. Per the repo's claims convention, the window's decision
> rules are fixed HERE, BEFORE the numbers accumulate — the reviewer's
> warning was precise: without pre-fixed criteria "the window ends with
> many events and no decidable statement." Companion claim:
> `docs/CLAIMS.md § utilization-window-decidability`.

## Observation floor (all three, else "underpowered")

1. **≥ 100 recorded task boundaries** in `.agent-engagement.jsonl`
   (boundary_kind `task` or `phase-step`).
2. **≥ 2 distinct hosts** contributed records (host identity read from the
   session context at analysis time, not stored in the event — the event
   schema stays id-only; if host cannot be attributed without widening the
   schema, the floor degrades to "≥ 2 distinct recording periods ≥ 14 days
   apart" and this deviation is recorded in the closing report).
3. **≥ 45 elapsed days** since 2026-07-12.

Below the floor at day 90 → the window is **underpowered**: extend ONCE by
30 days. Still below → STOP, record the honest null ("insufficient natural
usage volume to decide utilization"), and do NOT rebuild collection
apparatus without a new demand signal.

## Decision rules (fixed now — no goalpost-moving)

| # | Observation at window close | Bound decision |
|---|---|---|
| D1 | Artifact kind entry (skill/rule/command/guideline/persona id) **loaded-never-consulted** across the full window (requires the U1a `loaded` denominator; if U1a has not landed, D1 degrades to consulted-set analysis and says so) | Goes on the **retirement-candidate list** feeding U1's ranked cut list — candidate, not auto-cut; kernel + safety floors exempt by construction |
| D2 | Artifact **consulted-never-applied** with ≥ 5 consultations and applied-ratio < 10% | Goes on the **trigger-review queue** (description/trigger overhaul, not deletion) |
| D3 | Window closes **above the floor** | The first U1 report MUST name ≥ 1 concrete keep/cut/review decision per artifact kind, or record per kind why the data does not support one |
| D4 | Window closes **below the floor** (after the one extension) | Honest null; lifecycle-automation and field-outcome-ledger gates STAY closed (their revisit-if remains "≥ 1 full window") |

## Explicitly out of scope for this window

- **Outcome-quality attribution** (did artifact X improve the result) —
  needs the `loaded` denominator plus far more volume; stays with U1a.
- **Cost-vs-rework economics** — owned by the orchestration telemetry
  track (`road-to-subagent-value-realization-followup`).
- **Cross-repo aggregation** — the window is this repo only (council
  condition from the 8.11 disposition).

## Kill criterion

If the window closes decidable (D3) but its decisions are cited by zero
actual portfolio changes within 2 releases, the analysis layer (not the
telemetry) is the dead weight — record that honest null before building
any further reporting on top.
