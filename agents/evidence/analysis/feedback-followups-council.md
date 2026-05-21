# Council synthesis — road-to-feedback-followups

**Date:** 2026-05-09
**Members:** anthropic/claude-sonnet-4-5 + openai/gpt-4o
**Rounds:** 2
**Cost:** $0.0641 actual
**Artefact reviewed:** `agents/roadmaps/road-to-feedback-followups.md`
**Raw responses:** `/tmp/council-feedback-resp.json` (not committed
per `ai_council.session_retention_days`)

## Convergent critiques (both members agree — incorporated)

| # | Issue | Fix applied |
|---|---|---|
| 1 | **Phase ordering hazard.** P2.2 (108-warning audit) must snapshot baseline BEFORE Phase 1 modifies skills, else triage is non-reproducible. | Inserted **Phase 0 — Baseline snapshot** as the first action; Phase 1 (PR #64 cleanup) follows; Phase 2 (broader audit) reads from the snapshot. |
| 2 | **`≤95 warn` AC underivation.** Stated absolute, behaves relative — unclear how Phase 1's new warnings count. | AC rewritten: net-of-Phase-1, baseline-anchored. |
| 3 | **P1.1 rename external-ref gap.** No audit of README, tutorials, public docs before rename. | Added external-reference sweep + deprecation strategy to P1.1. |
| 4 | **Coarse step verification hooks.** "Inspect step" has no quality bar; showcase has no content rubric. | Added explicit minima per task. |
| 5 | **P3.1 governance-cleanup uncheckable.** No enforcement mechanism. | Reframed as advisory (PR template + skill-author note), explicitly forward-only. |
| 6 | **P5.2 strategic decision masquerading as task.** "Applied" circular; "council-validated" conflicts with user autonomy. | Reframed as advisory input — user decides. |
| 7 | **P2.1 test specificity missing.** What does the regression test check? | Specified: cluster head no longer fires `no_steps`; non-cluster commands still fire it. |

## Divergent critiques (council split — kept original)

- **Anthropic vs Reviewer A on production-safety scope.** Anthropic
  rejects expanding Phase 1 to runtime-safety proofs as scope creep
  for a linter-focused cleanup. **Kept** — Phase 1 stays linter-only.
- **Anthropic on README-link AC pedantry.** Adversarial edge-case
  thinking, not real risk. **Kept** AC as-is.
- **Anthropic on long-term adoption strategy.** Out of scope —
  separate `road-to-distribution-and-adoption` roadmap exists.
  **Kept** scope tight.

## Phase-4 placement tension (unresolved by council)

Anthropic flagged a contradiction: prose says "highest-leverage,
deferring loses the moment" yet Phase 4 is mid-roadmap. **Decision:**
soften the urgency framing in the roadmap; PR #64 merge IS the
blocker for the fortnight, adoption follows. Reviewer pressure
acknowledged but not auto-promoted.

## Out-of-scope confirmations (both members agreed)

- Display-name redesign — user opted README-only.
- 6-week stability gate — user waived.
- 4× `check-no-roadmap-refs` — fixed in PR #62.
- 3× PR #46 regressions — density-gating reclassified.

These remain dropped; no roadmap entries.


## Close-out council (2026-05-09) — Phase 4 + Tier-2/3/4 decision points

Second council session for the roadmap close-out — synthesises the
four open decision points from `agents/evidence/analysis/roadmap-priority-2026Q2.md`
and the Phase-4 (Adoption signal) framing.

**Members:** anthropic/claude-sonnet-4-5 + openai/gpt-4o · 2 rounds ·
$0.0399 actual. Raw responses at `/tmp/council-runs/close-feedback-followups.json`
(not committed per `ai_council.session_retention_days`).

| # | Question | Verdict | Trigger |
|---|---|---|---|
| Q1 | Phase 4 close-out | Option A — user-action-deferred, checkboxes unticked | Stars ≥ 5 OR ≥ 3 inbound showcase requests |
| Q2 | Tier-2 pair | `proof-not-features` + `chat-history-cross-agent-hardening` Phase 1, with Phase 1 sequenced FIRST | Low-effort confidence builder unlocks momentum for the heavier verification work |
| Q3 | Tier-3 ordering | `event-driven-discipline` BEFORE `deep-research-adoption` Phase 2 | Phase 2's 6-week stability gate cannot be earned without infrastructure hardening first |
| Q4 | Wing roadmaps | Stay in Tier 4 | Escalate Wing 3 (`gtm-and-growth`) if star plateau persists past 8 weeks post-`proof-not-features` AND ≥ 3 inbound GTM requests |

Round-2 convergence on all four. Reviewer-A demonstrated stronger
systems thinking on Q3 (dependency sequencing) and Q1 (timing ≠ validity);
both reviewers added measurable triggers where round 1 left qualitative
judgments. Verdicts folded back into the priority advisory (§ Verdicts).
