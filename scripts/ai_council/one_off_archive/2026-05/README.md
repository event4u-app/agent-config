# One-off archive — 2026-05

> Archived per **Phase 0a.2** of `agents/roadmaps/road-to-rule-hardening.md`.
> Each script here was a single-purpose AI-council probe or measurement
> tied to a specific phase of `road-to-structural-optimization.md` (now
> archived) or `road-to-rule-hardening.md`. The session output lives
> under `agents/council-sessions/` (durable evidence) and the linter
> `scripts/check_one_off_location.py` enforces that no new
> `_one_off_*.py` lands outside this folder.

## Lifecycle rule (uniform — Phase 0.2 of context-layer-maturity)

> A one-off is **archived**, never deleted. The session manifest under
> `agents/council-sessions/` is the audit trail; the script itself is
> kept here so a future contributor can re-read intent, re-run a probe
> on a future branch, or extract a reusable helper.

## Inventory

| Script | Roadmap / Phase | Council session id |
|---|---|---|
| `_one_off_2a4_acceptance.py` | structural-optimization 2A.4 | various 2A sessions |
| `_one_off_context_layer_v1_estimate.py` | context-layer-maturity v1 cost estimate | `2026-05-03T17-56-21Z` |
| `_one_off_context_layer_v1_review.py` | context-layer-maturity v1 review | `2026-05-03T17-56-21Z` |
| `_one_off_followups_review.py` | road-to-1-16-followups review | session under `agents/council-sessions/` |
| `_one_off_nondestructive_inline_audit.py` | non-destructive-by-default audit | session under `agents/council-sessions/` |
| `_one_off_phase4_dispatch_latency.py` | structural-optimization 4.3.1 cluster latency benchmark | local benchmark, no council |
| `_one_off_phase6_trigger_jaccard.py` | structural-optimization Phase 6 trigger overlap | local measurement |
| `_one_off_phase_2a_budget_rebalance.py` | structural-optimization 2A budget rebalance | `2026-05-03T*` |
| `_one_off_phase_2a_post_revert.py` | structural-optimization 2A post-revert | `2026-05-03T*` |
| `_one_off_rebalancing_audit.py` | rebalancing roadmap audit | session under `agents/council-sessions/` |
| `_one_off_roundtrip.py` | council client roundtrip smoke test | local smoke test |
| `_one_off_rule_hardening_v1.py` | rule-hardening v1 review | `2026-05-03T19-16-25Z` |
| `_one_off_structural_open_questions.py` | structural-optimization open questions | session under `agents/council-sessions/` |
| `_one_off_structural_optimization.py` | structural-optimization initial review | session under `agents/council-sessions/` |
| `_one_off_structural_v3_gaps.py` | structural-optimization v3 gap audit | session under `agents/council-sessions/` |
| `_one_off_structural_v3_review.py` | structural-optimization v3 review | session under `agents/council-sessions/` |

## Re-running an archived script

Imports may have shifted (e.g. `scripts.ai_council.*`). If a probe
needs to be re-run against a current branch, copy it back to its
original location, fix imports, run, then move the working copy
back here. Do **not** edit in place — keep the archive immutable
beyond cosmetic README updates.
