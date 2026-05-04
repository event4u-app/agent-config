---
status: ready
complexity: lightweight
---

# Road to Always-Budget Relief

**Status:** READY FOR EXECUTION — activated 2026-05-04 by
`road-to-feedback-consolidation.md` Phase 2.6 once tier retrofit
landed; PR #36 (precondition) merged on `main` 2026-05-04.
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

- [ ] **1.1 Demote.** Move an Always-rule to Auto with a precise
      trigger description. Inventory: which Top-10 Always-rules
      have demote-candidate triggers? Open question: does the host
      agent honour Auto descriptions reliably enough that demotion
      is not a silent regression?
- [ ] **1.2 Merge.** Combine two adjacent Always-rules whose
      Iron Laws compose without contradiction. Inventory: pairs
      with overlapping vocabulary (`ask-when-uncertain` +
      `no-cheap-questions`, `commit-policy` +
      `non-destructive-by-default`). Risk: merged rules are
      harder to cite and easier to mis-apply.
- [ ] **1.3 Hard-compress.** Procedural compression beyond the
      current caveman pass — drop full sentences in favour of
      tables, collapse failure-mode catalogues to a single line
      that links into a context, ruthlessly cut Iron-Law
      restatements. Risk: loses the rhetorical weight that makes
      the rule actually fire.
- [ ] **1.4 Top-rule rewrite.** Identify the ≥ 5,000-char rule
      whose Iron Law is doing 80 % of the work, rewrite it from
      scratch under a 3,000-char target. Inventory: which rule is
      currently #1 by chars and what is its Iron-Law-to-prose
      ratio?
- [ ] **1.5 Shared-context amortisation (N-rule sharing).** Phase 2A
      ruled out *single*-rule context split (citation tax > rule
      gain). N-rule sharing was **not** ruled out: if three rules
      cite the same context block, the citation tax amortises.
      Inventory: which contexts are already cited by ≥ 3 Always-rules
      (`asking-and-brevity-examples`, `language-and-tone-examples`)?
      What is the break-even N?

### Phase 2 — Pick Strategy (≤ 0.5 day, council-light)

- [ ] **2.1** Score each Phase 1 strategy on a 5-axis matrix:
      char delta (target ≥ 2,000 net), breakage risk
      (low/medium/high), implementation effort (≤ 1 day / ≤ 1 week
      / longer), reversibility, downstream coupling.
- [ ] **2.2** Pick exactly one primary strategy and one fallback.
      Lock the decision in
      `agents/contexts/adr-always-budget-relief-strategy.md` with
      a 6-month expiry — re-pick if the chosen strategy delivers
      < 50 % of the target headroom by then.
- [ ] **2.3** No nested council debate. One synchronous council
      round, binding revisions only.

### Phase 3 — Execute (effort = picked strategy)

- [ ] **3.1** Implement the picked strategy on a **single** rule
      first. Measure char delta against the budget linter. Soak
      ≥ 24 h before touching a second rule.
- [ ] **3.2** Roll out across the rule family. Each rule lands in
      its **own** PR — no bundling under autonomous mandate
      (see Phase 4 reactivation).
- [ ] **3.3** Update the budget baseline in
      `.github/budget-baseline.txt` and retire any
      recovery-band carve-outs.

### Phase 4 — Slow-Rollout Reactivation (≤ 0.25 day)

Document the lesson from PR #36's compression of the rollout
schedule under autonomous mandate.

- [ ] **4.1** Add a one-paragraph note to
      `.agent-src.uncompressed/rules/scope-control.md` (or a
      sibling) restating the rule: each Always-rule edit ships in
      its own PR, with ≥ 24 h between merges. Autonomous mandate
      does not lift this — it is a soak-time guarantee, not a
      governance preference.
- [ ] **4.2** CI guard: fail any PR that touches > 1 file in
      `.agent-src.uncompressed/rules/` AND modifies always-loaded
      rules. Allow override via PR label
      `bundled-always-rules-acknowledged`.

## Observation — roadmap complexity standard

`road-to-structural-optimization.md` was structurally sound but
extremely dense (Council rounds + Locked Decisions + Gating-DAGs +
Kill-switches). The pattern is **right for structural / contract
roadmaps**, **wrong as a default for feature roadmaps**.

Action item — **observation only**, not yet a rule. Captured here so
a second instance triggers `learning-to-rule-or-skill`:

- [ ] **Obs.1** If a second feature roadmap (not structural / contract)
      grows past ~ 800 content lines or imports the heavy frontmatter
      apparatus, propose `roadmap-complexity-tier.md` as an Auto rule.
      Until then, single-instance lesson — no rule.

## Acceptance

- One primary strategy locked in
  `agents/contexts/adr-always-budget-relief-strategy.md`.
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
  `agents/contexts/adr-always-rule-context-split-not-viable.md` (created
  by `road-to-rule-hardening.md` Phase 0a.3).
- Sibling: `road-to-rule-hardening.md` (obligation surface),
  `road-to-context-layer-maturity.md` (context layer).
