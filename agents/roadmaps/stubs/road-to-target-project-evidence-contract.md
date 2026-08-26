---
complexity: lightweight
review_by: 2027-02-18
---

# Road to a target-project evidence contract — stub

> **Source:** `agents/tmp.old/robert-c-martin/road-to-target-project-evidence-contract.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Class:** demand-gated successor of
> `road-to-target-project-assurance-readiness.md` (needs its
> `risk_class` output and `risk-officer`'s `residual_risk` note). Verified
> against `e1fe45077cab`; proposals are marked.

## Defect this closes

`src/skills/verify-completion-evidence/SKILL.md` (211 lines) enforces
fresh-output evidence in the current turn but produces prose: `json`,
`schema`, `machine` return 0 hits in the file. Nothing — not CI, not a
reviewer dispatcher, not a human — can read a completion claim without
re-reading the transcript. "Tests passed" is the whole contract.

## Proposed — one artefact per change, gate-generated, agent-annotated

*Proposal.* `agents/evidence/changes/<sha>.evidence.json`, validated by a
schema committed beside `src/config/assurance-policy.json` <!-- ref-ignore -->. Fields the
**gate runner** writes (the agent may not): `risk_class` and its
derivation, test results with flaky flags, diff-scoped mutation result
incl. survivors, static/SAST findings as baseline delta, architecture
violations, dependency changes with package-existence check, reviewer
identity and `separation_confirmed`, RED-run id for any test claimed as
TDD. Fields the **agent** writes, marked as claims: `known_limitations`,
`residual_risk` (from `risk-officer/SKILL.md:79`), `spec_to_test` map.
One more field: `verdict ∈ {pass, no-commit, escalate}` — the verifier
generates it, the human or the merge gate authorises it; these are never
the same party.

Principle: **everything a gate can measure, the gate writes; the agent
comments, never produces, evidence.** A survivor marked `equivalent` needs
a reason string, and the count of such markings is itself a nightly metric.

## What it reuses

- `verify-completion-evidence` procedure as the emission point (extend,
  do not fork).
- `check_review_prompt_binding.ts` pattern (prompt hash bound to verdict)
  for binding the artefact to the diff sha.
- The sibling `road-to-review-independence` recording fields for reviewer
  relation — same vocabulary, no second schema.

## Prerequisites for promotion

Parent Phase 2 merged (class is computed); bootstrap stub at least
partially promoted (otherwise most gate fields are `not-detectable`);
estate offset.

## Not in scope

Any UI; any storage outside the repo; traceability graphs beyond the flat
`spec_to_test` map (report's own over-engineering warning).
