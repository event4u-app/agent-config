---
complexity: lightweight
status: ready
---

# Roadmap: Autonomous verify→repair loop (GAN-adapted, council-gated)

**Trigger:** Source-E competitive-harvest (2026-06-15). The external reference
(**Source-E**, § Provenance) ships a GAN-style planner/generator/evaluator loop
(`/gan-build`) — a bounded generate→evaluate→repair cycle with a numeric
pass-threshold, plateau early-stop, generator-cannot-self-judge separation, and
a **live-app verdict** (Playwright). It is the one Source-E verification pattern
AC does not already cover.

## Goal

Give AC an iterating **judge→revise→re-judge** loop. AC has the *judge half*
(the `judge-*` skills read a diff and only *recommend* a runtime probe; "the
judge never executes tools") but no loop that revises against a verdict and
re-judges, and no live-eval verdict source. Adopt only the **control structure**
— layered on AC's existing `judge-*` + `playwright-testing` + the
`autonomous-execution` N=3 cap — NOT Source-E's opus-pinned 3-agent set or its
UI-product rubric.

> **Conditional + deferred.** This is sequenced AFTER `road-to-mission-mode`'s
> Phase 1 gate. If missions ship plan-first, the loop is optional; if missions
> drive gated end-to-end execution, the loop becomes the graceful-failure
> recovery mechanism. The first phase is a PoC that proves the loop is
> **runtime-free** (multi-turn reasoning, not a daemon) before any build.

## Phase 1 — PoC: prove the loop is runtime-free

- [x] PoC: a `generate → run playwright-testing/quality-tools → judge →
      revise → re-judge` cycle expressed as **multi-turn agent reasoning** (the
      "loop" is the conversation, not executing code), bounded by the N=3 cap and
      a numeric pass-threshold, with the generator and judge as **separate**
      roles (generator cannot self-approve). <!-- worked trace in agents/evidence/analysis/verify-repair-loop-phase1-gate.md -->
- [x] Decision doc (`agents/evidence/`): is the loop expressible with no
      persistent cross-session state and no daemon (honoring
      `docs/contracts/no-runtime-boundary.md` from `road-to-mission-mode`)? If
      not → stop and re-scope; if yes → Phase 2. <!-- PROCEED — runtime-free for unit/quality scope; Playwright stays deferred -->


## Phase 2 — Productize the verify→repair skill

- [x] New skill (e.g. `verify-repair-loop`) composing the existing `judge-*`
      cluster + `playwright-testing` + `quality-tools`: run verdict → if FAIL and
      attempts < N, surface the verdict + a revision, re-run; plateau early-stop;
      generator/judge role separation enforced. <!-- src/skills/verify-repair-loop/SKILL.md — Architecture C (staged numeric gate → judge), 7 council safeguards -->
- [x] `evals/triggers.json` (5 should / 5 should-not) + a behavior eval. <!-- triggers.json + output-schema.yml (locks Iron Law/Procedure/Validation/Output/Do NOT) -->
- [x] Wire as an opt-in step in `/review-changes` and a candidate phase inside
      `road-to-mission-mode`'s verification step (NOT auto-on). <!-- review-changes step 6 + See also; mission/upgrade step 5 candidate phase -->


---

## Deferred (trigger-gated)

- [-] **Live-app Playwright as the canonical verdict source** (Source-E's
      strongest idea). **Trigger:** `road-to-mission-mode` ships a mission whose
      output is UI-observable AND `playwright-testing` is wired into a consumer's
      CI. Until then the loop uses test/quality verdicts, not live-app. <!-- moved to follow-up road-to-live-app-verdict.md (status: draft, trigger-gated) — Iron Law 3 resolved, not dropped -->


## Acceptance criteria

- [x] Phase 1 PoC decision doc recorded (runtime-free proof) before Phase 2. <!-- agents/evidence/analysis/verify-repair-loop-phase1-gate.md -->
- [x] `verify-repair-loop` skill ships with role separation + N=3 cap + numeric
      threshold + eval stub; opt-in, never auto-on. <!-- subagent-dispatched judge = real separation; threshold+regression-guard+plateau; opt-in wiring only -->
- [x] No daemon / persistent runtime introduced (no-runtime-boundary honored). <!-- loop = multi-turn reasoning; state in conversation / re-read file -->
- [x] Sequenced after `road-to-mission-mode` Phase 1; if missions ship
      plan-first, this roadmap may stay deferred. <!-- mission Phase-1 gate G1 = gated end-to-end → verify-loop needed; built -->


## Council notes (2026-06-15, deep + peer-review)

Council corrected an over-eager REJECT: the GAN loop is **NOT inherently
runtime** — "while (verdict != PASS && attempts < N)" can be multi-turn LLM
reasoning, not executing code. The fix is to scope a PoC that proves the
runtime-free interpretation, not to defer by catch-22. AC has the judge half but
no iterating loop or live-eval verdict; adopt the control structure only, reuse
AC's `judge-*` + `playwright-testing` + N=3 cap, reject the opus-pinned 3-agent
set and the UI-product rubric. Conditional on the mission-mode Phase 1 gate.

## Provenance

- Source-E (external agent-harness reference, code-audited 2026-06-15;
  maintainer-recoverable via `src/scripts/_lib/link_crypto.py decrypt`):
  `ENC1:KPeL+ygg/jMY1GhTqv0giUX6ZODHZCJEHN6zxZh5VvLwnrNmfGwwhvXN3Pz/N69lIhLQBEojZTwbXkJ7nKW44Dfn1m3JBzimqNcQynvJa7icti4F53l+EWAGMawPzAg=`
- Evidence: `agents/.harvest-local/source-e-findings/04-agents-verification.md`
  (GAN planner/generator/evaluator + `/gan-build`, numeric threshold, plateau
  early-stop, generator-cannot-self-judge, live-Playwright verdict).
- Council: live two-member run (claude-sonnet-4-5 + gpt-4o, deep, peer-review,
  2026-06-15).
