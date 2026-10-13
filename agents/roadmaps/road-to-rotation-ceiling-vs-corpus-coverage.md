---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-account-lifecycle-threat-rows
    relation: extends
    note: "Archived. Its Phase 3.1 added the 128th trigger corpus and was the change that first tripped the ceiling; this roadmap carries the conflict that change surfaced, not the change itself."
---
# Road to rotation ceiling vs corpus coverage

> **Source:** measured 2026-10-13 while executing
> `road-to-account-lifecycle-threat-rows` Phase 3.1. That step gave the
> `security` skill the trigger corpus `check_routing_coverage` requires of every
> touched skill, and the corpus tripped `trigger_eval_rotation`'s weekly
> paid-call ceiling. The ceiling raise was put to the AI council on 2026-10-13
> (members anthropic + openai configured, 1 of 2 answered — openai returned
> `ENOBUFS` — 2 rounds, $0.00, all seats subscription-authed), which classified
> it **owner-reserved** and declined to authorise it.

## Goal

The two ratchets stop contradicting each other. A PR that touches a skill
without a trigger corpus can add one — which `check_routing_coverage` requires
of it — without breaching `trigger_eval_rotation`'s weekly ceiling, and without
the ceiling being raised every time the suite count grows. Whoever reads
`MAX_WEEKLY_QUERIES`'s docblock afterwards finds a figure that matches the tree.

## Context

Two gates, each correct alone, now pull against each other.

**`check_routing_coverage`** requires a `src/skills/<name>/evals/triggers.json`
for every skill a diff touches, and its coverage seed is shrink-only: it rises
to the live value and may never be lowered. Coverage can therefore only grow.

**`trigger_eval_rotation`** replays those corpora against live provider routing
on a weekly cron (`.github/workflows/cross-model-canary.yml`,
`cron: "0 6 * * 1"`, gated on the Anthropic secret), assigns each suite to one
of twelve week-slots by an FNV-1a hash of its name at `QUERIES_PER_SUITE = 10`,
and caps the busiest week at `MAX_WEEKLY_QUERIES = 160`.

Measured on the tree 2026-10-13:

| Tree | Suites | Busiest slot | Peak week |
|---|---|---|---|
| `main` | 127 | 16 suites | **160** — exactly at the ceiling |
| `main` + one corpus hashing to slot 3 | 128 | 17 suites | **170** — over by 10 |

So `main` sits on the line, and the next corpus that lands in the busiest slot
breaches it, whoever writes that PR. Each added suite costs
`QUERIES_PER_SUITE` per ninety-day cycle whatever the schedule, so the collision
is guaranteed rather than contingent.

Three repairs that look available are not:

- **Lengthen the cycle.** Twelve weeks is 84 days and `check_trigger_evals`
  enforces a 90-day freshness window; thirteen weeks is 91 and misses it.
- **Lower `QUERIES_PER_SUITE`.** It is a measurement (~9.5, rounded up), not a
  dial — lowering it would fudge the measurement, not the bill.
- **Re-slot the hash.** The slot is name-derived on purpose, so a suite's week
  does not depend on the list it sits in; re-slotting voids the staleness
  guarantee for every suite at once.

One figure in the ceiling's own docblock no longer describes the tree: it says
the ceiling "reds at roughly 117 suites", and `main` passes at 127. That is an
estimate reality overtook — the hash spread was kinder than the estimate
assumed — and **not** evidence of an unnoticed past breach, which a reader of
the sentence alone could reasonably conclude. It is corrected in 1.3 rather
than left to be re-derived by the next person.

### blocker: owner-reserved-ceiling-raise

- **Status:** open
- **Blocks:** 1.1
- **Owner:** repository owner
- **Resolved when:** the owner records a decision on `MAX_WEEKLY_QUERIES` —
  either a new value with a reason, or a direction to decouple instead of
  raising. Until then 1.1 cannot be written, because the value it would write
  is the thing being decided.
- **Why it is reserved:** the ceiling is a spend bound. `decision-revisit-gate`
  reserves "spend or liability above a delegated threshold" to the owner, and
  160 *is* the delegated threshold, so going above it is the reserved case by
  construction. The ceiling's own prose reserves the crossing to "a human
  decides on rather than an invoice they discover", and it ships no `raised`
  list of the kind `skill-body-budget.json` has — so there is no declared
  agent-usable path. The council agreed, unprompted, in both rounds.

## Phase 1 — Let the two ratchets coexist

- [ ] **1.1 Record the owner's decision on the ceiling.** Whatever the owner
      decides — a new `MAX_WEEKLY_QUERIES`, or a direction to decouple without
      raising — write it into the docblock with its reason and its reopening
      condition, the way `skill-body-budget.json`'s `raised` list records a
      moved ceiling. If the decision is a raise, say in the same sentence how
      many further suites it buys, so the next reader knows the headroom
      without recomputing it.
      verify: `npx vitest run tests/scripts/trigger_eval_rotation.test.ts` is
      green over the live suite list, and the docblock names both the value and
      who decided it.
- [ ] **1.2 Decouple the suite count from the weekly bill, or state why not.**
      A corpus exists so a routing claim is checkable; whether every corpus is
      replayed against a paid provider every ninety days is a separate policy
      choice that nothing has yet made deliberately. Options to weigh and
      choose between, not to implement all of: replay a sampled subset and
      report the sample as a sample; split the suite set into a paid tier and a
      locally-evaluated regression tier; make the slot assignment
      capacity-aware so the peak week is bounded by the ceiling rather than by
      the hash. Whichever is chosen, the ceiling stops moving every time
      coverage rises — and if none is chosen, the roadmap records that monotonic
      spend growth was accepted knowingly.
      verify: adding one corpus to the tree no longer changes the peak week, or
      the decision to accept that it does is written down with its cost per
      added suite.
- [ ] **1.3 Fix the stale figure in the ceiling's docblock.** It reads "reds at
      roughly 117 suites" while `main` passes at 127; the figure assumed an even
      hash spread the tree does not have. Replace it with the quantity a reader
      can act on — the busiest slot's occupancy and how many more suites fit in
      it — and say that the peak is set by the spread, not by the count.
      verify: the docblock states no suite-count threshold that the live tree
      contradicts, checked by recomputing the peak from the tree.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-13 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The raise is taken and the decoupling is not | product | 1.1 unblocks the queue in one commit and 1.2 is quietly never done, so the same wall is hit two or three skills later and raised again — the ceiling becomes a number that follows the bill instead of bounding it | 1.1's verify requires the headroom to be stated in suites, which makes the next collision a date rather than a surprise; 1.2 accepts "we chose to grow" as an outcome, so it can be closed honestly instead of being skipped | Phase 1 — Let the two ratchets coexist |
| 2 | A decoupling that silently stops measuring | implementation | Sampling or a local tier could cut the bill by cutting the evidence, and a routing claim backed by a sample reads identical to one backed by a full pass | 1.2 requires a sample to be reported as a sample; the existing published records already name their corpus size, so a shrunken denominator is visible in the record rather than hidden behind it | Phase 1 — Let the two ratchets coexist |
| 3 | The queue blocks while this waits | implementation | Until 1.1 lands, any PR that touches a skill lacking a corpus is red on a gate it did not cause and cannot fix | Named in the blocker so the next author recognises it in one read instead of re-deriving the conflict; the rotation job is a weekly cron that fails only itself, so nothing ships broken in the meantime | Phase 1 — Let the two ratchets coexist |

## Acceptance Criteria

- [ ] AC-1 — `npx vitest run tests/scripts/trigger_eval_rotation.test.ts` is
      green over the live suite list, and the value it checks against carries a
      recorded owner decision rather than an agent's edit.
- [ ] AC-2 — Adding one trigger corpus to the tree either leaves the peak week
      unchanged, or changes it by an amount the docblock states in advance — so
      the next author learns the cost before the gate tells them.
- [ ] AC-3 — No figure in `MAX_WEEKLY_QUERIES`'s docblock is contradicted by
      recomputing the peak from the live tree.
