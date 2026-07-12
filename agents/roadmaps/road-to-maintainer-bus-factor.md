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
      <!-- PARTIAL 2026-07-10: the ADVISORY + INERT-WITHOUT-SECRET half shipped —
      `.github/workflows/self-review-gate.yml` (mirrors cross-model-canary: a
      no-spend dry-run plan job on every PR + a secret-gated live-advisory job
      that posts findings and skips as a logged no-op when ANTHROPIC_API_KEY is
      absent) driving `src/scripts/self_review_gate.ts` (loads the two review
      skill bodies as the system prompt, collects structured findings, posts a
      PR review). STILL MAINTAINER: (a) the API secret + per-PR budget sign-off
      to make it run LIVE (blocker `self-review-gate-cost`), (b) making it
      REQUIRED = Phase 2 branch protection, (c) the large-diff `ai-council`
      escalation. Built advisory, not blind. -->
- [x] Define the gate's teeth: security-sensitive or claim-affecting findings
      block merge; style findings advise. Wire the verdict through the existing
      `gateVerdict()` pattern so the outcome is recorded, not just printed.
      <!-- council 2026-07-08 (claude-sonnet-4-5 + gpt-4o): confirmed this
      exact shape — block ONLY on security/claim findings; full ai-council
      only on large or claim-affecting diffs; a 100%-blocking gate at
      solo-maintainer token cost would be ignored or gamed. -->
      <!-- done 2026-07-10: `self_review_gate.ts` exposes pure, unit-tested
      `classifyBlocking()` (blocks iff kind∈{security,claim} × severity∈
      {critical,high}) + `gateVerdict(findings,{enforce})` mirroring
      `check_quality_regression.gateVerdict` (0 pass / 2 block). The verdict is
      RECORDED via `renderReview()` (advisory phrasing = "WOULD block"), not just
      printed. Shipped `enforce:false` (advisory); the `--enforce` flip that
      arms the teeth is the maintainer's act, one flag. -->
- [ ] Record it honestly on the proof page: "PRs pass a dogfooded AI
      adversarial-review + security gate; this is a floor, not independent human
      review."
      <!-- OPEN 2026-07-10: the literal "PRs pass a dogfooded AI gate" proof-page
      CLAIM is FALSE while the gate is inert-without-secret (no live run), so
      recording it now would breach check_claims / no-invented-facts. The honest
      advisory status IS documented in `docs/self-review-gate.md` (gate exists,
      advisory, inert without the secret; how to arm it). The proof-page floor
      CLAIM is the maintainer's to create the moment the gate goes live with the
      secret — not before. -->
      <!-- OPEN — same `self-review-gate-cost` block (the teeth decision). -->
- [ ] Record it honestly on the proof page: "PRs pass a dogfooded AI
      adversarial-review + security gate; this is a floor, not independent human
      review."
      <!-- OPEN — records the Phase-1 gate, which is deferred above. -->

**Exit:** a required, recorded self-review gate runs on every non-trivial PR.
**Rollback:** demote to advisory (one workflow flag) — but a governance package
that won't gate its own PRs undercuts its thesis; prefer keeping teeth.

## Phase 2 — CODEOWNERS + branch protection

- [x] Add `.github/CODEOWNERS` mapping the sensitive surfaces (kernel rules,
      router compiler, install/uninstall, hooks, claims/proof generators) to the
      maintainer today, and to future co-maintainers as they appear.
      <!-- done 2026-07-09: .github/CODEOWNERS maps kernel rules, router
      compiler, install, hooks, claims/proof generators, release pipeline,
      workflows, and schemas to @matze4u (real paths verified). Enabling branch
      protection to REQUIRE Code-Owner review is the repo-admin step below. -->
- [ ] Turn on branch protection requiring: green CI, the Phase-1 self-review
      gate, and CODEOWNERS review on the sensitive surfaces — so even the solo
      maintainer merges through the gate, not around it.
      <!-- OPEN — repo-admin action (GitHub → Settings → Rules), not a code
      change. CODEOWNERS is in place; requiring it via branch protection is the
      maintainer's UI step (branch-protection-policy.md is the source of truth). -->
- [x] Document the "why" in CONTRIBUTING: the maintainer holds themselves to the
      same gate as a contributor (the point of a governance standard).
      <!-- done 2026-07-09: CONTRIBUTING.md § "Reviewability and the self-imposed
      gate" — CODEOWNERS routing, the maintainer-through-the-gate principle, the
      honest AI≠human-review bound, and the small second-reviewer on-ramp. -->

**Exit:** CODEOWNERS + branch protection in effect; no direct-to-main merge on
sensitive surfaces bypasses the gate.
**Rollback:** loosen branch protection (repo setting) in a genuine emergency,
logged.

## Phase 3 — Make a release inheritable (the runbook)

- [x] Write `docs/release-runbook.md`: the exact, reproducible steps to cut a
      release — which gates must be green, how to run the benchmark sweeps and
      pin reports, how to update CLAIMS/proof, how the version-bump + changelog +
      breaking-changes index work — such that a second maintainer could execute
      it cold.
      <!-- done 2026-07-09: docs/release-runbook.md — the 9-step release.ts
      pipeline, both entry points (task release + release-labeled PR), the manual
      approve-workflows checkpoint, post-release verification, and --resume
      recovery; grounded in release.ts + release.yml + the release contracts. -->
- [x] Add a `docs/succession.md` (bus-factor doc): where the secrets/tokens
      live, which operator-gated steps need credentials, what "healthy main"
      looks like, and the minimal knowledge to take over. No secrets in the doc —
      pointers only.
      <!-- done 2026-07-09: docs/succession.md — secret/token inventory (pointers
      only: RELEASE_PR_TOKEN, npm OIDC, Cloudflare/MCP, AI keys), operator-gated
      steps, a "healthy main" definition, and the minimal takeover checklist. -->
- [ ] Dry-run the runbook with the maintainer deliberately following ONLY the
      written steps (no tribal knowledge) on a no-op release; every gap found is
      a runbook fix.
      <!-- OPEN — maintainer-run: a written-steps-only no-op release dry-run is
      the real freshness test. Runbook § 7 gives a static staleness check; the
      live dry-run needs the maintainer. -->

**Exit:** a release can be cut by following the runbook alone; the succession
doc names every operator-gated dependency.
**Rollback:** none — documentation only.

## Phase 4 — Lower bus-factor toward >1 (opportunistic, honest)

- [ ] Identify the smallest reviewable surfaces a second reviewer could own
      (e.g. docs/claims, a single pack) and invite review there first — a
      realistic on-ramp, not "co-maintain the kernel on day one".
      <!-- OPEN — the on-ramp surfaces are IDENTIFIED (CONTRIBUTING names
      docs/claims or a single pack as the small first surface), but the actual
      INVITE needs a real external person — blocked on second-reviewer-availability. -->
- [x] Track the real number honestly: distinct humans who have reviewed/merged
      in the trailing 90 days. Report it as-is; a bus-factor of 1 stated plainly
      beats a bus-factor of 1 implied to be more.
      <!-- done 2026-07-09: docs/succession.md tracks the trailing-90-day
      distinct-reviewer count honestly (currently 1) + a gh recompute one-liner;
      bound by the backed CLAIMS entry `bus-factor-tracked`. -->

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

> **Status (2026-07-09).** Criterion 4 is MET — the trailing-90-day reviewer
> count is tracked honestly (1) in `docs/succession.md` + the backed
> `bus-factor-tracked` CLAIMS entry. Criteria 2 and 3 are PARTIALLY met: the
> code half is done (`.github/CODEOWNERS` + the runbook + succession doc all
> exist), but the repo-admin half (enabling branch protection to require
> Code-Owner review) and the written-steps-only live dry-run are maintainer
> actions, left open. Criterion 1 (the dogfooded self-review gate) is OPEN —
> Phase 1 is blocked on `self-review-gate-cost` (a live AI-review CI workflow
> needs the maintainer's API-secret + per-PR budget + block-vs-advise teeth
> decision; not safely shippable blind). The inheritability + honest-reporting
> slice is complete; the gate + admin + human-dry-run remain. Roadmap stays open.

## Blockers

### blocker: self-review-gate-cost
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1
- **What to do:** running `ai-council` on every PR has real token cost. Scope it:
  `adversarial-review` + `agent-security-review` on all non-trivial PRs (cheap),
  full `ai-council` only on large or claim-affecting diffs. Tune the trigger so
  the gate is not a tax on typo fixes.
- **Resolved when:** the gate runs within an acceptable per-PR budget and blocks
  on security/claim findings.
- **Resolution (2026-07-10, template rule 22 sweep):** not a human gate — the
  scoping decision is already made IN this blocker's own text (in-session
  `adversarial-review` + `agent-security-review` for non-trivial PRs; full
  spend-bearing `ai-council` only on large / claim-affecting diffs). The two
  cheap lenses are in-session skills (no external spend), and implementing +
  tuning the trigger is agent-executable Phase-1 work. The only spend-bearing
  branch (`ai-council` on big diffs) stays governed by the standing
  spend-authorization discipline at run time — no separate roadmap gate
  needed. The "Resolved when" stays Phase 1's exit criterion.

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

## Routing note (feedback-8.11-2, 2026-07-12)

The reviewers' "maintainer map" ask is split: the one-page orientation map
shipped as `docs/maintainers/system-map.md` (a map, not a contract); the
DEEP operating material (release runbook, incident playbooks, succession,
per-subsystem ownership) stays owned by THIS roadmap's phases — the map
links here, not the other way around.
