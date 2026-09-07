---
adr: 257
status: accepted
date: 2026-09-07
decision: unpaid-route-may-propose-and-score-never-decide
supersedes: —
superseded_by: —
phase: road-to-admissible-council-seats · Phase 2
type: structural
reopen_policy: directional
protected_dimensions: governance
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-sonnet-4-5, openai/codex-default]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E1
  basis:
    - agents/roadmaps/archive/road-to-admissible-council-seats.md
    - agents/roadmaps/later/road-to-governed-evidence-production.md
    - src/rules/evaluator-independence.md
    - src/scripts/ai_council/seat_policy.ts
    - src/scripts/ai_council/transport_resolver.ts
    - docs/CLAIMS.md
review_trigger: >-
  Reopened by a recorded instance in which the boundary itself caused a wrong
  outcome — an unpaid route's proposal or score that a human or a gate could
  not act on BECAUSE the route was barred from carrying the verdict. Explicitly
  NOT a reopen trigger: a route becoming cheaper, more capable, or better
  reviewed. The boundary is about who may carry a verdict on this package's own
  work, and capability was never the reason for it. Also NOT a trigger: the
  arrival of a gateway or free seat, which is the class this record anticipates.
---

# ADR-257 — a route this package did not pay for may propose and may score, never decide

## Status

**Accepted** · 2026-09-07. Supersedes nothing. Narrows a recorded park onto a
second axis rather than lifting it.

## Context

`agents/roadmaps/later/road-to-governed-evidence-production.md` records
`metered-backend-park`, **narrowed 2026-09-01** to permit a metered backend in
one role only: it "may **generate** candidate text. It may not score, rank,
filter, select between, or supply any input to the verdict for the arms being
compared — whatever the module is called."

That narrowing answers one axis — a *metered* route in an *A/B evidence* run.
It does not answer the axis this roadmap opens: what may a route do that this
package **did not pay for at all** — a gateway seat, a free tier, a
subscription this package does not hold — anywhere in the council, not only in
an A/B arm.

The gap matters now rather than later because Phase 2 of the roadmap made
refusal *sayable* (`policy_exclusion`, `content_ceiling`) before any such seat
exists. A vocabulary for refusing a seat is only half a policy; the other half
is the statement of what an admitted seat may then do. Writing it while no such
seat exists is the point: a boundary authored against a concrete candidate is
authored knowing which answer that candidate needs.

## Decision

A route this package did not pay for **may propose** findings and **may score**
them. It may **never** carry a verdict, chair a session, or act as evaluator of
record.

Concretely, and in the vocabulary the codebase already uses:

| May | May not |
|---|---|
| Generate candidate findings, text, or hypotheses | Be the seat whose output is recorded as the council's verdict |
| Produce a score that a human or a quorum rule then reads | Chair — no ordering, framing, synthesis, or tie-break authority |
| Sit on a jury whose aggregate is one input | Act as evaluator of record for any gate, claim, or completion review |
| Be cited by name in a record as a proposer or scorer | Be counted toward a quorum that decides anything |

Two properties of the boundary, stated because both were argued:

1. **It is about accountability, not capability.** The reason an unpaid route
   may not decide is that this package cannot answer for what it did — not that
   it is weak. So a capability improvement is explicitly not a reopening
   condition (see `review_trigger`).
2. **Scoring is not deciding, and the line between them is consumption.** A
   score becomes a verdict the moment a gate consumes it. That is why the
   roadmap's own shadow-only step exists and why Risk 5 names this transition:
   "scoring quietly becomes deciding".

## Consequences

- `src/rules/evaluator-independence.md` cites this record. Its Iron Law already
  forbids authoring a verdict into an evaluator's prompt; this adds the
  companion question of **which seat may hold the pen at all**.
- The refusal vocabulary from Phase 2 is the enforcement surface available
  today: a route that must not decide can be excluded per-seat with a named,
  machine-readable reason that `council:status` prints.
- **Honest enforcement — `instruction-only`.** No gate reads which seat carried
  a verdict. `seat_policy.ts` can refuse a seat a config names, and nothing
  observes an agent recording an unpaid route's score as a decision. The
  boundary is model-carried, and that is stated here rather than implied away —
  the same honesty stance `evaluator-independence` takes for its own items 2
  and 4.

## Evidence

| Claim | Basis |
|---|---|
| The metered park was narrowed to a PROPOSER only, on a different axis from this one | `agents/roadmaps/later/road-to-governed-evidence-production.md` § Phase 2 — "A metered call may **generate** candidate text. It may not score, rank, filter, select between, or supply any input to the verdict for the arms being compared", NARROWED 2026-09-01 |
| No unpaid seat exists in this tree today, so the boundary is authored against no concrete candidate | `_VALID_PROVIDERS` is closed at five names in `src/scripts/ai_council/config.ts`, and `grep -c base_url src/scripts/ai_council/config.ts` returns 0 |
| A refusal can now be SAID per seat, which is what makes the boundary actionable | `src/scripts/ai_council/seat_policy.ts` — six `PolicyExclusion` values on `AbsentReason`, printed by `council:status` |
| Scoring becomes deciding at CONSUMPTION, and nothing consumes a jury score today | `tests/scripts/ai_council/jury_aggregate.test.ts` § AC-9 greps `src/` and asserts no importer of `jury_aggregate` outside its own module |
| The claim this bounds is filed and unresolved | `docs/CLAIMS.md` → `free-jury-judge-agreement`, `status: unbacked`, pre-registered 2026-09-07 |
| Both seats were present under a standing delegation | AI council 2026-09-06, anthropic/claude-sonnet-4-5 + openai/codex-default, quorum 2/2, CLI subscription transport, `$0.0000`, under the maintainer's standing delegation |

**Evidence this record does NOT have, and the shape of the gap is the point.**
There is **no measurement** that an unpaid panel scores well — that question is
`free-jury-judge-agreement`, which is filed `unbacked` and whose measurement was
declined for this round, so this record deliberately does not rest on it. There
is **no owner statement**: it is a council decision under delegation, and a
future owner ruling is neither anticipated nor prejudged here. And there is **no
enforcement** — the § Consequences honesty note says so plainly: no gate reads
which seat carried a verdict, so the boundary is model-carried.

## Alternatives

- **Say nothing until such a seat exists.** Rejected: the boundary would then
  be authored against a concrete candidate, by a session that wants the seat.
- **Bar an unpaid route entirely.** Rejected: it discards the one role for which
  a diverse, unpaid panel has a real argument — scoring against known ground
  truth, where agreement is measurable and no verdict is carried. Barring it
  would also be a stronger claim than the evidence supports.
- **Permit deciding under a human counter-signature.** Rejected as
  under-specified: a counter-signature nobody can verify after the fact is a
  verdict with a name attached, not an accountability mechanism.

## References

- `agents/roadmaps/later/road-to-governed-evidence-production.md` — `metered-backend-park`, narrowed 2026-09-01, the first axis.
- `src/rules/evaluator-independence.md` — the prompt-side half of the same concern.
- `src/scripts/ai_council/seat_policy.ts` — the refusal vocabulary this record presumes.
- `docs/CLAIMS.md` — `free-jury-judge-agreement`, the pre-registered claim this boundary bounds.
