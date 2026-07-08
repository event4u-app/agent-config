---
complexity: structural
status: ready
---

# Road to maintainer bus-factor — make the project reviewable and inheritable, and dogfood its own review machinery

> The project is positioned as a governance *standard*, but ships like a
> single-maintainer repo: no CODEOWNERS, 8.0.0 solo-merged, no external
> reviewers. The bus-factor is 1. Two things are controllable without inventing
> contributors: (1) put the package's OWN review machinery (`ai-council`,
> `adversarial-review`, `agent-security-review`) on the critical path as a
> standing second set of eyes; (2) make a release *inheritable* — a documented,
> reproducible verification runbook a second maintainer could execute. This
> roadmap does both, honestly bounded: an AI gate is not a human reviewer, and
> the roadmap says so.

## Goal

Lower the bus-factor from 1 toward resilient: a required, dogfooded self-review
gate on every non-trivial PR, CODEOWNERS + branch protection, and a
release-verification runbook + succession doc that let a second person (or the
maintainer after a gap) ship a correct release without tribal knowledge.

## Context (measured, do not relitigate)

- Bus-factor signals (fresh `main`): no `.github/CODEOWNERS`; 8.0.0 (PR #764)
  solo-merged, 1 participant, no external reviewers, 37 checks green. Community
  scaffolding present (issue templates, PR template) but no review requirement.
- The review machinery to dogfood already exists in-repo: `ai-council`,
  `adversarial-review`, `agent-security-review` skills; advisor personas
  (`contrarian`, `first-principles`, `outsider`, `executor`, `expansionist`);
  `gateVerdict()` / council-verdict pattern; `check_claims.ts` and the proof
  drift gates.
- Honest bound (state it, don't paper over it): an AI adversarial-review gate
  raises the floor and catches regressions/claim-drift, but it is NOT equivalent
  to independent human review. The goal is resilience + reviewability, not a
  claim of external validation.
- The heavy CI (633+ test files, determinism/checksum/claims gates) already
  makes releases mechanically verifiable — what's missing is the human/process
  layer that makes them *inheritable*.

## Prerequisites

- [x] AI review machinery exists (`ai-council`, `adversarial-review`,
      `agent-security-review`, advisor personas).
- [x] Mechanical release gates exist (tests, determinism, claims).

## Phase 1 — Dogfood the review machinery as a pre-merge gate

- [ ] Add a required PR workflow that runs `adversarial-review` +
      `agent-security-review` (and, for large diffs, `ai-council` with the
      advisor personas) against the diff, posting findings as a review. This is
      the package reviewing itself with the exact machinery it sells.
- [ ] Define the gate's teeth: security-sensitive or claim-affecting findings
      block merge; style findings advise. Wire the verdict through the existing
      `gateVerdict()` pattern so the outcome is recorded, not just printed.
      <!-- council 2026-07-08 (claude-sonnet-4-5 + gpt-4o): confirmed this
      exact shape — block ONLY on security/claim findings; full ai-council
      only on large or claim-affecting diffs; a 100%-blocking gate at
      solo-maintainer token cost would be ignored or gamed. -->
- [ ] Record it honestly on the proof page: "PRs pass a dogfooded AI
      adversarial-review + security gate; this is a floor, not independent human
      review."

**Exit:** a required, recorded self-review gate runs on every non-trivial PR.
**Rollback:** demote to advisory (one workflow flag) — but a governance package
that won't gate its own PRs undercuts its thesis; prefer keeping teeth.

## Phase 2 — CODEOWNERS + branch protection

- [ ] Add `.github/CODEOWNERS` mapping the sensitive surfaces (kernel rules,
      router compiler, install/uninstall, hooks, claims/proof generators) to the
      maintainer today, and to future co-maintainers as they appear.
- [ ] Turn on branch protection requiring: green CI, the Phase-1 self-review
      gate, and CODEOWNERS review on the sensitive surfaces — so even the solo
      maintainer merges through the gate, not around it.
- [ ] Document the "why" in CONTRIBUTING: the maintainer holds themselves to the
      same gate as a contributor (the point of a governance standard).

**Exit:** CODEOWNERS + branch protection in effect; no direct-to-main merge on
sensitive surfaces bypasses the gate.
**Rollback:** loosen branch protection (repo setting) in a genuine emergency,
logged.

## Phase 3 — Make a release inheritable (the runbook)

- [ ] Write `docs/release-runbook.md`: the exact, reproducible steps to cut a
      release — which gates must be green, how to run the benchmark sweeps and
      pin reports, how to update CLAIMS/proof, how the version-bump + changelog +
      breaking-changes index work — such that a second maintainer could execute
      it cold.
- [ ] Add a `docs/succession.md` (bus-factor doc): where the secrets/tokens
      live, which operator-gated steps need credentials, what "healthy main"
      looks like, and the minimal knowledge to take over. No secrets in the doc —
      pointers only.
- [ ] Dry-run the runbook with the maintainer deliberately following ONLY the
      written steps (no tribal knowledge) on a no-op release; every gap found is
      a runbook fix.

**Exit:** a release can be cut by following the runbook alone; the succession
doc names every operator-gated dependency.
**Rollback:** none — documentation only.

## Phase 4 — Lower bus-factor toward >1 (opportunistic, honest)

- [ ] Identify the smallest reviewable surfaces a second reviewer could own
      (e.g. docs/claims, a single pack) and invite review there first — a
      realistic on-ramp, not "co-maintain the kernel on day one".
- [ ] Track the real number honestly: distinct humans who have reviewed/merged
      in the trailing 90 days. Report it as-is; a bus-factor of 1 stated plainly
      beats a bus-factor of 1 implied to be more.

**Exit:** at least one non-maintainer review path exists and is documented; the
trailing-90-day reviewer count is tracked and reported truthfully.
**Rollback:** none — process + reporting only.

## Acceptance criteria

- Every non-trivial PR passes a required, recorded dogfooded self-review gate;
  the proof page states its scope AND its limit (not human review).
- `.github/CODEOWNERS` + branch protection route even solo merges through the
  gate on sensitive surfaces.
- A release-verification runbook + succession doc exist and have survived a
  written-steps-only dry run.
- The real trailing-90-day human-reviewer count is tracked and reported without
  inflation.

## Blockers

### blocker: self-review-gate-cost
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1
- **What to do:** running `ai-council` on every PR has real token cost. Scope it:
  `adversarial-review` + `agent-security-review` on all non-trivial PRs (cheap),
  full `ai-council` only on large or claim-affecting diffs. Tune the trigger so
  the gate is not a tax on typo fixes.
- **Resolved when:** the gate runs within an acceptable per-PR budget and blocks
  on security/claim findings.

### blocker: second-reviewer-availability
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 4 (the >1 target only)
- **What to do:** a second human reviewer cannot be manufactured; this phase is
  opportunistic and gated on real external interest (couples to the adoption
  roadmap). Phases 1–3 do NOT depend on it — reviewability and inheritability are
  achievable solo.
- **Resolved when:** ≥1 non-maintainer has reviewed a merged PR, or the phase is
  explicitly deferred pending adoption.
