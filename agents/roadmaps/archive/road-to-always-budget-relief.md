---
status: in_progress
complexity: lightweight
---

# Road to Always-Budget Relief

**Status:** IN PROGRESS — Phase 1 + 2 + 4 executed 2026-05-08.
Phase 3 cancelled (premise dissolved by kernel-router refactor;
budget at 54.4 % / 22,328 chars headroom — 11× over acceptance).
Strategy locked in
[`agents/settings/contexts/adr-always-budget-relief-strategy.md`](../contexts/adr-always-budget-relief-strategy.md).
**Started:** 2026-05-03 (parked for next PR).
**Trigger:** External review of PR #36 (rating 8.8 / 10) called out
that the Always-rule extended budget remains at 47,448 / 49,000 chars
(1,552 chars headroom, 96.8 % utilisation). One Top-5 rule growth
flips the gate red. Phase 2A of `road-to-structural-optimization.md`
empirically proved that splitting an Always-rule into rule +
`load_context:` under Model (b) produces a **net character increase**
(measured +186 chars on `language-and-tone`) — so the obvious lever
("auslagern") is closed. New strategies needed.
**Mode:** Lightweight planning roadmap. No phase begins before PR #36
is merged. Slow-rollout is reactivated explicitly (see Phase 4).

## Purpose

Find a structurally sound way to widen Always-rule budget headroom
**without** repeating the failed Model (b) context-split attempt.
The deliverable is a **picked strategy** (one of the five below)
plus a per-rule playbook the next contributor can follow without
re-debating the model.

## Phases

### Phase 1 — Strategy Inventory (≤ 0.5 day)

Enumerate the five non-mutually-exclusive strategies. Score each on
expected char delta, breakage risk, and reviewability cost.

- [x] **1.1 Demote.** Inventoried in ADR § S1; precondition (Auto
      honour-rate ≥ 95 % over 50-interaction sample) flagged
      unvalidated; pilot design recorded.
- [x] **1.2 Merge.** Inventoried in ADR § S2; vocabulary-overlap
      replaced by trigger-condition orthogonality matrix per Council
      Round 2; candidate pairs flagged hazard / candidate.
- [x] **1.3 Hard-condense.** Inventoried in ADR § S3 with three
      condensation tiers (safe / risky / unsafe); Iron-Law motivational
      framing forbidden from condensation.
- [x] **1.4 Top-rule rewrite.** Inventoried in ADR § S4; #1 by chars
      = `language-and-tone` at 3,988 raw chars; Iron-Law-to-prose
      ratio recorded; rewrite breakage-prone (kernel-membership
      criterion 3 carrier).
- [x] **1.5 Shared-context amortisation.** Inventoried in ADR § S5;
      break-even formula recorded (≈30 chars citation tax per rule);
      `asking-and-brevity-examples` flagged eligible at N = 3.

### Phase 2 — Pick Strategy (≤ 0.5 day, council-light)

- [x] **2.1** 5-axis scoring matrix recorded in ADR § Picked strategy
      (char delta · breakage risk · effort · reversibility · downstream
      coupling). S3 = 10, S5 = 11, S1 = 15, S2 = 19, S4 = 20 (lower wins).
- [x] **2.2** Primary = S3 (Hard-condense, Tier-1 + Tier-2 only).
      Fallback = S5 (N-rule sharing on `asking-and-brevity-examples`).
      Locked in [`agents/settings/contexts/adr-always-budget-relief-strategy.md`](../contexts/adr-always-budget-relief-strategy.md)
      with 6-month expiry (2026-11-08).
- [x] **2.3** One synchronous council round (Sonnet-4.5 + GPT-4o,
      `agents/council-responses/always-budget-relief.json`,
      2026-05-08); structural feedback folded into ADR; no nesting.

### Phase 3 — Execute (deferred — premise dissolved)

- [-] **3.1** Cancelled. Budget at 54.4 % (26,672 / 49,000 chars,
      22,328 chars headroom = 11× acceptance criterion). No rule edit
      is justified against the kernel-membership contract while the
      trigger condition is dormant.
- [-] **3.2** Cancelled. Reactivates only when
      `check_always_budget.py` extended total > 39,200 chars (80 %
      warn band) or any kernel rule > 5,500 raw chars — see ADR
      reactivation triggers.
- [-] **3.3** Cancelled. `.github/budget-baseline.txt` (49,311) is
      already a ceiling under current 26,672 measurement; recovery-band
      carve-out is unused. Leave both untouched until reactivation.

### Phase 4 — Slow-Rollout Reactivation (≤ 0.25 day)

Document the lesson from PR #36's condensation of the rollout
schedule under autonomous mandate.

- [x] **4.1** Slow-rollout note added to
      `.agent-src.uncondensed/rules/scope-control.md` § "Kernel-rule
      edits — slow-rollout guarantee" with detail in
      `.agent-src.uncondensed/contexts/authority/kernel-rule-edits.md`.
      One PR per kernel-rule edit, ≥ 24 h between merges; autonomous
      mandate does not lift the soak window.
- [x] **4.2** CI guard `scripts/check_kernel_rule_bundle.py` added to
      `taskfiles/ci-fast.yml` (`task check-kernel-rule-bundle`) and
      wired into `.github/workflows/consistency.yml` after
      `check-always-budget`. Override label
      `bundled-always-rules-acknowledged`. Smoke-tested locally
      (1-rule pass, 2-rule fail, 2-rule + label pass).

## Observation — roadmap complexity standard

`road-to-structural-optimization.md` was structurally sound but
extremely dense (Council rounds + Locked Decisions + Gating-DAGs +
Kill-switches). The pattern is **right for structural / contract
roadmaps**, **wrong as a default for feature roadmaps**.

Action item — **observation only**, not yet a rule. Captured here so
a second instance triggers `learning-to-rule-or-skill`:

- [-] **Obs.1** Parked-pending-trigger. Single-instance lesson recorded
      in this roadmap; no rule proposed yet. Reactivates when a
      second feature roadmap (not structural / contract) crosses
      ~ 800 content lines or imports the heavy frontmatter apparatus
      — at that point promote to `roadmap-complexity-tier.md` as an
      Auto rule.

## Acceptance

- One primary strategy locked in
  `agents/settings/contexts/adr-always-budget-relief-strategy.md`.
- ≥ 2,000 chars net headroom delta after Phase 3 (50 % target if the
  strategy is reversible cheaply).
- Slow-rollout note merged in `scope-control` (or sibling).
- No regression in `tests/test_always_budget.py` or
  `tests/golden/`.

## Out of scope

- New Always-rules. This roadmap reduces existing footprint only.
- Auto-rule budget — Auto rules are loaded on demand, the budget
  pressure is on Always.
- Cross-platform parity. Same scope as `road-to-rule-hardening.md`:
  Augment + Claude Code first.

## Reference

- Prior attempt: `agents/roadmaps/archive/road-to-structural-optimization.md`
  Phase 2A (reverted, +186 chars net on `language-and-tone`).
- Empirical lesson:
  `agents/settings/contexts/adr-always-rule-context-split-not-viable.md` (created
  by `road-to-rule-hardening.md` Phase 0a.3).
- Sibling: `road-to-rule-hardening.md` (obligation surface),
  `road-to-context-layer-maturity.md` (context layer).
