# Findings: road-to-plan-governance-gates (round 4)
<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: 8ef78703da0a56402e7bbffa4413a34a761e3bfdab4dbca00b080ba71aeeb882 | diff: 9603e29f610dc1566bf1931ea6daf784e9f31725 | reviewer: r2-fresh-subagent-round4 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 9603e29f610dc1566bf1931ea6daf784e9f31725
  scope_hash: 8ef78703da0a56402e7bbffa4413a34a761e3bfdab4dbca00b080ba71aeeb882
  roadmap: agents/roadmaps/archive/road-to-plan-governance-gates.md
  roadmap_hash: 5b087b623a17d4019701ae24a8c0c5d6d5b7e8a01065277499bb017b208a3c92
  ac_hash: 547d6024c1af2654c850bd4193e15c008919a686583db09fa8d8adc1d77a8a36
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-04T10:34:28Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/lint_plan_risk_register.ts:435 | An `**Honest-null:**` line anywhere in the `## Risk Register` body set `honestNullSeen` and skipped `validateTable` entirely, so a register carrying BOTH the honest-null line and a risk table passed with zero row checks — bad ranks, bad risk types, empty mitigations and dangling anchors all unreported. Contradicts § 1.3 ("valid only as exactly this shape") and diverges from Gate R2, which reports the analogous skip-plus-table combination and still validates the rows. | fixed | table now validated whenever present; contradictory combination reported as `contradictory_register`; three regression tests added |
| 2 | medium | src/agent-src/contexts/execution/plan-confidence-gate.md:106 | The shipped Gate-C context told the agent that generic writes to `agents/runtime/state/gate-c-*.json` "are a lint violation", while contract § 4.1 in the same diff states the rule has no lint and no hook entry — an agent reading the context believes a mechanical guard exists where the contract declares `enforced_by: none`. | fixed | context now states the rule is agent-carried with no lint and links § 4.1; archived roadmap carries an inline correction note |
| 3 | medium | docs/contracts/plan-review-gates.md:509 | The § 5 `accepted-risk` residual named "the adversarial-leak E2E in the R2 acceptance suite" as its detection floor, but no such test exists and none is added by this diff — the residual read as mitigated when nothing detects it. | fixed | claim withdrawn, not papered over: the residual is now stated as having NO detection floor, with the reason (the leak would occur in host prompt assembly, which no in-repo test observes) and an explicit note on what IS mechanical (dispatcher-built inputs + CI hash re-derivation catch a wrong-input reviewer, not an extra-context one) |
| 4 | low | agents/roadmaps/archive/road-to-plan-governance-gates.md:512 | Acceptance criterion 6 claimed both validators are registered "with real floors", but the shipped `check_completion_review` entry documents the opposite in its own note (`scanned` is `>= 1` by construction, so `min_scanned: 1` can never trip) — the criterion was checked `[x]` against a floor the config itself calls toothless, without the inline amendment note the same class of correction received in round 2. | fixed | inline amendment note added: R1's floor is real (12 vs 19 actual), R2's is not, and R2's actual teeth (blocking dead-scan-scope assertion) are named |

## Provenance

Fourth and final blind review round, dispatched by `dispatch_r2_reviewer.ts`
and answered by a fresh subagent with no implementation context (contract § 5).
Bound to scope `8ef78703…` (head `9603e29f6`).

No critical or high findings — the round-1/2/3 defect classes did not recur.
All four rows are the same shape: a **claim without a mechanism**, which is the
failure class this roadmap exists to prevent, so all four were fixed rather
than accepted. Three were doc-honesty corrections (withdraw the claim, name
what is actually enforced); one was a real validator hole where a declaration
suppressed a whole table check.

Renamed out of the `*.findings.md` glob because the fixes above move the
content past this scope (contract § 2.1). The binding artefact for the merge is
the final round, reviewed on frozen content.
