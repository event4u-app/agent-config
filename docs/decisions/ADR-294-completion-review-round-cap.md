---
adr: 294
status: accepted
date: 2026-10-21
decision: completion-review-round-cap
supersedes: —
superseded_by: —
phase: road-to-a-review-that-ends · step 1.1
type: structural
review_trigger: >-
  Reopen when road-to-a-review-that-ends step 2.1's reading of the next 20
  reviews shows a high or critical row that a sixth pass would have found and
  the owner report did not carry, when an artefact reaches the cap through
  re-binds that ran a reviewer without changing the prompt_hash, or when the
  yield-by-round table moves so that pass 6 yields as much as pass 5.
reopen_policy: owner
protected_dimensions: none
provenance:
  kind: mixed
  decision_makers: [owner, ai-council]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E1
  discovery: complete
  basis:
    - agents/evidence/owner-directives/2026-10-21-review-cap-and-depth-flip.md
    - agents/evidence/analysis/review-severity-by-round-2026-10-21.md
    - agents/roadmaps/road-to-a-review-that-ends.md
    - docs/contracts/plan-review-gates.md
    - src/scripts/check_completion_review.ts
authority_basis: owner_intent
---

# ADR-294 — The completion review closes after five review passes

## Status

Accepted 2026-10-21. The number and the severity gate are the repository owner's
decision, filed verbatim under `agents/evidence/owner-directives/`: option (b) of
the `review-round-cap-is-an-owner-contract-change` blocker. How a pass is counted
is the agent's decision, put to the AI council the same day.

## Context

The completion review (Gate R2, `docs/contracts/plan-review-gates.md` § 2) had
no round limit. Measured over the review corpus, passes 1-5 yielded 1.49 / 1.54 /
0.78 / 0.79 / 0.71 high+critical rows per artefact, passes 6-10 0.38 and passes
11 and later 0.15; 18 of 188 reviews ran past round 2, the longest to 25
(`agents/evidence/analysis/review-severity-by-round-2026-10-21.md`).

The `round:` header field (step 1.2) counted every re-bind. A re-bind follows
any change to the reviewed diff, including CI fixes, base merges and regenerated
projections, so a literal cap on that counter would have ended reviews on CI
churn rather than on review yield. The first artefact to carry the field reached
`round: 7` with one reviewer pass. Separately, the § 2.7 archive rename ended the
chain, so a fresh skeleton restarted at round 1.

## Decision

1. **Five review passes.** `REVIEW_ROUND_CAP = 5`. The dispatcher refuses to
   write the skeleton of pass 6, and `check_completion_review` reports
   `round-cap-exceeded` on an artefact whose path records six passes.
2. **A pass is a reviewer dispatch, not a re-bind.** It is identified by its
   `prompt_hash`. Versions that predate `prompt_hash` count together as one
   pass: every in-place re-bind moved their `scope:`, so keying them by scope
   would count re-binds.
   `round:` must equal the number of passes the path records
   (`round-miscounted`). A re-bind in place keeps the round.
3. **The archive keeps the count.** The count walks the path's whole history,
   through the § 2.7 rename, and the dispatcher writes that count into the next
   skeleton.
4. **Severity gate at the cap.** No row stays `open`. A high or critical row the
   review cannot close is `deferred` with a Reason/Ref naming
   `<slug>.owner-report.md`, which must exist (`cap-deferral-without-owner-report`).
   A medium or low row is `deferred` with a ledger ref.

## Consequences

- A long-running branch keeps its review: re-binds after pass 5 stay legal.
- A high or critical finding is never closed by the cap; it is moved to a file
  the owner reads.
- The `prompt_hash` is written by the dispatcher, so the count is only as honest
  as the dispatch: a reviewer run outside the dispatcher, on a hand-written
  prompt, is invisible to it. This is the same trust boundary `prompt_hash`
  already has (§ 2.1).
- Reported `round:` values written before this ADR (every re-bind +1) read as
  `round-miscounted` once their path is re-bound; only the branch that introduced
  the field carries any.

## Alternatives

- **A literal cap on re-binds.** Rejected: it caps CI churn, not review yield,
  and leaves a branch at round 5 no legal way to absorb a later change.
- **A threshold on post-cap scope deltas with owner re-attestation.** Proposed in
  two of three council readings, with different thresholds (500 lines; ±50
  lines). Not built: no measurement says which delta size hides a defect.
  Revisit if step 2.1 finds a post-cap re-bind that carried one.
- **No cap** (option (c)). Declined by the owner.

## Council record

Three council runs on 2026-10-21, each DEGRADED to one seat (anthropic; the
openai seat failed with `exit_1` in all three). They are three single-seat
readings, not convergence. All three recommended counting passes rather than
re-binds and keeping the count through an archive; they split on whether a
post-cap re-bind needs owner re-attestation.
