---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md
estate_growth_exempt: "Adds one active roadmap against a floor of 1. It exists because a 2/2 AI-council round found the tree is citing the wrong lock for its most-repeated external finding — ten arrivals answered by a spend blocker that gates a different question — and the correction is a split into three owners, which needs a file rather than a note. The three sibling roadmaps in this change touch the authorization parser, the findings ledger and three defect sweeps; none of them can carry a routing correction about delivery mode. Parking it means the eleventh arrival meets the same wrong lock."
---
# Road to the tenth arrival

> **Source:** `agents/tmp.old/inbox-2026-09-e/` — an external multi-model review
> round on release 14.16.0, where three independent reviewers raised the same
> finding again. The routing correction below was put to the AI council
> (2026-09-04, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds,
> quorum 2/2) rather than to the maintainer, because it is a mechanism question
> the tree's own evidence settles.

## Goal

The recurring activation/delivery finding is three items with three owners
instead of one item behind one lock, the two that need no owner decision are
done, and the third reaches the owner as a decision packet rather than as a
tenth restatement.

## The routing error

`agents/evidence/analysis/inbox-2026-09-d-disposition.md:78-102` records the
finding's ninth arrival, names the eight prior rounds by directory, and routes
the whole thing to `road-to-mixed-trigger-activation-cost.md`, held by
`b-behavioural-bench-spend` — *"spend-bearing and therefore owner-reserved; no
agent lifts it."*

That blocker gates a different question. Its own text
(`road-to-mixed-trigger-activation-cost.md:516-536`) asks whether the **remaining
15 always-on rules** cost measurable behaviour rather than only tokens, via a
paired A/B run billing model tokens across 5-8 tasks.

The `lean_projection.mode` flip's recorded holds are three, and none of them is
that bench:

| hold | where it is written | what it actually asks for |
|---|---|---|
| activation charge | `src/config/hook-token-budget.json`, `rule-inject_reason` | move the `user_prompt_submit` (4,096 B) and `pre_tool_use` (2,048 B) slot-sum rows, which the 20,480 B concern row sits above on purpose. The row says so itself: *"The run that flips `lean_projection.mode: delivery` is the run that must move those two slot rows"* |
| host scope | `docs/CLAIMS.md:357` | the flip is Claude-only |
| authority | council 2026-08-23, quoted in `archive/road-to-trigger-delivered-rule-bodies.md:498` | *"flag to owner for post-roadmap review given the authority question is genuinely close"* |

The council's finding, both seats: *"the disposition uses a spend lock from an
adjacent workstream to halt the delivery-mode workstream. That is a routing
error."* Neither seat found any hold that prevents **preparation**; only the
shipped-default decision and actual spend are owner-reserved.

The third sub-item bundled into the same finding — the trigger corpus at 100 of
299 skills — is held by nothing at all. It inherited a blocker by association.

## Phase 1 — Correct the record

- [ ] **1.1 Amend the disposition rather than writing a new verdict over it.**
      The ninth-arrival section stays; it gains the mechanism check it was
      missing — that `b-behavioural-bench-spend` does not gate the flip, which
      three holds do, and which of those permit preparation. A recurrence
      answered by a corrected lock is a different answer from a recurrence
      answered again.
      verify: the disposition names all three real holds with their sources and
      states that the bench gates the always-on-tier question only.
- [ ] **1.2 Record the split with owners.** Three sub-items, each with its own
      owner and its own blocker, so the eleventh arrival meets three states
      rather than one bundle.
      verify: the record names sub-items, owners and blockers, and the council
      round is cited with its date, members and quorum.

## Phase 2 — Trigger corpus (unblocked, agent-doable)

Held by nothing. Both council seats agreed, and codex added the constraint that
makes it real work rather than a phrase-adding exercise.

- [ ] **2.1 Measure the current coverage from the tree, not from the review.**
      The "100 of 299" figure comes from the disposition file. Re-derive it,
      name the instrument, and state what the denominator counts — the review's
      figure and a `grep -l 'triggers:' src/skills/*/SKILL.md` disagree, and a
      coverage number nobody can reproduce cannot show movement later.
      verify: the count is reproduced by a named command whose output is quoted,
      and any divergence from 100/299 is explained rather than silently adopted.
- [ ] **2.2 Expand coverage with collision and ambiguity validation.** Adding
      199 trigger sets carelessly raises false activation, which is the failure
      mode that would make the whole finding worse. Each addition carries a
      positive fixture and a near-miss that must stay silent — the discipline
      `design-fidelity`'s routing matrix already applies to rules.
      verify: every new trigger set has both fixtures, and the near-miss rows
      fail if the trigger is widened by one word.
- [ ] **2.3 Publish activation at the new coverage.** `docs/CLAIMS.md:240` says
      activation is "separately measured and is near zero". That measurement is
      the denominator the authority question lacks. Surface it, then re-read it
      after 2.2.
      verify: the measurement's instrument and its reading are named, before and
      after, and a null — activation stays near zero at 299 — is published as
      the finding it is rather than treated as a failed step.

## Phase 3 — Delivery-mode preparation (agent prepares, owner ships)

Sequenced after Phase 2 deliberately. Sizing the budget rows before knowing the
load at 299 skills sizes them against the wrong corpus — the council's own
correction to a shorter plan.

- [ ] **3.1 Size the two slot-sum rows against the measured delivery load.**
      The `rule-inject` row is 20,480 B against slot sums of 4,096 and 2,048.
      Produce the moved rows with their derivation, not a guess.
      verify: the derivation cites the measured emission at the post-2.2 corpus,
      and `bench_hook_injection` reads the concern within the proposed rows.
- [ ] **3.2 Prepare the flip as a held change set.** Claude-scoped, with the
      unsupported hosts named and verified unchanged, a rollback, and the tests.
      Nothing in this phase changes a shipped default.
      verify: `lean_projection.mode` still resolves to `eager-all` on every host
      after this phase, and a test asserts it.
- [ ] **3.3 Hand the owner a decision packet, not a summary.** The exact diff,
      the before/after cost with its method, the residual risk, the rollback, and
      the one policy question the 2026-08-23 council flagged as genuinely close.
      Landing the budget-policy rows may itself need maintainer review — the
      council's seats split on this and the split is recorded rather than
      resolved.
      verify: the packet exists, names the unresolved authority question in the
      owner's words, and states which of its parts a maintainer must approve
      before landing versus after.

## Phase 4 — What stays where it is

- [ ] **4.1 Leave the behavioural bench attached to its own question.**
      `b-behavioural-bench-spend` keeps gating the always-on-tier question on
      `road-to-mixed-trigger-activation-cost`. It is not a sub-item of this
      finding, and folding it in would rebuild the bundle this roadmap unpicks.
      verify: that roadmap's blocker text is unchanged, and this roadmap does not
      claim to unblock it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The split is read as authorization to flip | product | Correcting the lock removes the reason the flip was refused, and a prepared change set one approval away is exactly the state where an autonomous run talks itself into shipping | 3.2 requires `eager-all` to still resolve on every host after the phase, with a test; 3.3 makes the owner's decision the deliverable rather than the flip | Phase 3 — Delivery-mode preparation |
| 2 | Trigger expansion raises false activation | product | 199 new trigger sets against a corpus tuned for 100 is the one way this work makes the product worse rather than better, and the failure is invisible until a wrong skill fires | 2.2 requires a near-miss fixture per addition that fails on a one-word widening — the same discipline the routing matrix already enforces for rules | Phase 2 — Trigger corpus |
| 3 | Phase 2 produces no movement and the finding is called closed | implementation | If activation stays near zero at 299, the temptation is to report the sub-item done and let the flip question lapse back into the bundle | 2.3 requires a null to be published as a finding, and Phase 1's record keeps the three sub-items separately stated so an unmoved one stays visibly open | Phase 2 — Trigger corpus |
| 4 | The budget rows land dormant and mislead a later reader | implementation | Moving slot sums for a mode nobody has enabled leaves the file asserting headroom the shipped configuration does not use | 3.1 ties the derivation to the measured emission, and 3.3 states explicitly which parts need approval before landing rather than after | Phase 3 — Delivery-mode preparation |

## Acceptance Criteria

- [ ] AC-1 — The disposition record names the three real holds on the flip, states
      that `b-behavioural-bench-spend` gates a different question, and cites the
      council round that established it.
- [ ] AC-2 — The finding exists as three sub-items with three named owners and
      three separate blocker states.
- [ ] AC-3 — Trigger coverage is re-derived by a reproducible command, expanded
      with a positive and a near-miss fixture per addition, and activation is
      published at the new coverage — including if it did not move.
- [ ] AC-4 — A held change set and a decision packet exist for the flip, and
      `lean_projection.mode` still resolves to `eager-all` on every host.
- [ ] AC-5 — `b-behavioural-bench-spend` remains attached only to the always-on-tier
      question, unmodified by this roadmap.
