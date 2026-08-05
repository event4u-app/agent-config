---
adr: 211
status: accepted
date: 2026-08-03
decision: harvest-freeze-resume-conditions
supersedes: —
superseded_by: —
phase: feedback-sweep 2026-08 follow-up (decision-revisit of the 2026-07-20 restraint)
type: structural
review_trigger: >-
  Recurring cadence (Amendment B): at every minor release OR at latest every
  3 months, whichever comes first, the question "does the harvest freeze
  still hold under current conditions?" is put to the AI council as its own
  agenda item and the outcome is appended to this record's history. A freeze
  review that is skipped twice in a row is itself a violation of this record.
  Additionally reopen when (a) the exit path becomes unreachable (e.g. the
  renewal set is retired unfinished), or (b) a borrow admitted under Amendment
  D's red-test clause turns out not to have closed its pre-registered risk —
  that would falsify the clause's construction, not just the single borrow.
  NEVER reopen on an external-adoption signal: per ADR-216 that is not a valid
  condition for this record.
---

# ADR-211 — The harvest freeze gets a canonical record, an internal exit, a review cadence, and a latent-risk door

## Status

**Accepted.** Backdated canonicalization plus four amendments, executed in the
same change: the freeze rule that has governed harvest/borrow work since
2026-07-20 moves from council prose into this record, and its resume
condition is repaired from an externally-gated single condition into an
OR-condition with an internally reachable arm.

## Context

The harvest freeze was decided on 2026-07-20 as part of the
surface-consolidation restraint set
(`agents/settings/contexts/surface-consolidation-restraint.md`), refined by
the AI council on 2026-08-02 (split-by-pain, recorded in
`road-to-package-renewal.md` § Locks), and applied on 2026-08-03 to park four
feedback-sweep roadmaps (PR #1120, council disposition claude-sonnet-4-5 +
gpt-4o, 2 rounds). It had no canonical decision record — a rule that blocks
four roadmaps but lives only in council prose and roadmap lock sections is
itself backdoor debt.

**Exact prior wording (before this record):**

> *"Harvest freeze until the first external adopter. No new
> competitive-harvest / capability-adoption roadmap opens until ≥1 real
> external adoption is documented."* (restraint context, 2026-07-20)
>
> *"Split by pain — borrows that close a RECORDED internal failure
> (return-prevention) proceed with an inline lock note; purely additive
> capability stays frozen behind the freeze's own reopen condition."*
> (council 2026-08-02)

Two construction defects were identified in review (2026-08-03):

1. **The resume condition is a potential deadlock.** "First external adopter"
   is an event outside the maintainer's control that may never occur for a
   primarily internally-used project. A restraint with a practically
   unreachable exit condition degenerates into a permanent ban that is not
   labelled as one — which contradicts the falsifiability doctrine the freeze
   itself belongs to.
2. **"Recorded internal failure" is post-hoc gameable.** Whoever wants a
   borrow can construct a failure finding for it. The council currently
   catches this as a second instance, but the evidence direction was never
   written down: the finding must exist BEFORE the borrow proposal.

A third gap surfaced during the parked-item re-audit: between "recorded
failure" and "purely additive" there is a real third category — verified
latent risks (known weaknesses that have not yet fired, e.g. a single point
of failure that has so far held). The binary freeze had no slot for it.

## Decision

The freeze **stays**. It is canonicalized here with four amendments:

### Amendment A — resume condition becomes an OR with an internal arm

> **AMENDED BY [ADR-216](ADR-216-restraint-reanchored-to-capacity.md)
> (2026-08-05, Amendment E): the external arm is STRUCK.** The OR-structure is
> retired as unnecessary — with adoption removed there is only one arm, so
> there is nothing left to OR. External adoption is not a project goal and is
> therefore not a valid gate. The wording below is preserved as the historical
> record of what Amendment A said; the operative condition is Amendment E.
>
> ~~**External arm:** ≥1 real external adoption is documented.~~

The freeze lifts when ALL three of the following hold:

  1. the renewal set (`road-to-package-renewal.md` and its sub-roadmaps) is
     fully closed,
  2. `road-to-hook-latency-repair.md` is complete (the latency budget is
     green on the real invocation path), and
  3. an AI-council reconfirmation ("does the freeze still serve its purpose
     now?") has been run with a documented outcome — the council can extend
     the freeze at that point, but the extension must be an explicit,
     recorded decision, never a default.

**All three are satisfied as of 2026-08-05, so the freeze is lifted in full.**
See ADR-216 § D1 and this record's § History.

### Amendment E — the restraint is anchored to capacity, not to adoption (ADR-216)

The freeze's binding constraint is **maintainer capacity**, never external
adoption. Stated in full because the original rationale said otherwise and that
wording propagated:

- **Before:** "harvest freeze until the first external adopter … the binding
  constraint is adoption, not capability."
- **After:** harvest work is restrained while foundational work is open, because
  one maintainer cannot carry both and harvest roadmaps reliably accumulate
  additive features while foundations wait. The condition is whether the
  foundational set is closed — nothing about who is watching from outside.

The capacity argument was always the real one and stands complete with no
reference to adoption. The four roadmaps parked on 2026-08-03 competed with the
renewal set for the maintainer's time; that is why they were parked.

**No gate in this tree may be anchored on an external-adoption signal** (ADR-216
§ D5). Recording an adoption fact as context is fine; gating work on one is a
defect. Amendments B, C and D are unaffected — all three are
adoption-independent.

### Amendment B — review cadence

The freeze is re-put to the council at every minor release or at latest every
3 months, whichever comes first (mechanism: this record's `review_trigger`;
outcomes are appended to § History). A lock without a review cadence ages
unnoticed.

### Amendment C — pre-registration of failure findings

A borrow qualifies under the split-by-pain rule only if the cited failure
finding **predates the borrow proposal** — a ledger entry, issue, bench
regression, or review finding with commit/timestamp provenance. Post-hoc
constructed findings do not qualify. Evidence direction: finding → borrow,
never the reverse.

### Amendment D — latent-risk clause (the third category)

A borrow may also proceed while the freeze holds if it closes a
**pre-registered latent risk**, demonstrated by a **failing test written and
committed BEFORE the borrow** (red test first, with provenance; the borrow
makes it green). The red test must demonstrate the risk behaviorally (e.g. a
chaos test: kill a council seat's provider, observe the failure mode) — a
test that merely describes an intent does not qualify. This keeps the borrow
failure-closing by construction and makes the category ungameable by the
same mechanism as Amendment C.

## Consequences

- The four roadmaps parked in `agents/roadmaps/later/` on 2026-08-03 stay
  parked; their resume lines now cite this record instead of hardcoding the
  old single condition.
- The 2026-08-03 item re-audit (PR body of the amendment PR) found **zero
  EXTRACT candidates** — every pre-dating recorded failure relevant to the
  parked items was already fixed at its root (council quorum `a4f4eb8e6`,
  gpt-5 transport branch `af3ed6e7e`, kernel-prefix gate `154d36619`
  PR #1084, 13+5 dead scan roots `47bb0f099`/`e89c1b733`) or already
  extracted in PR #1120 (`route:explain`, symlink battery). Three items were
  marked LATENT-CANDIDATE under Amendment D (council-seat resilience, gate
  mutation testing, universal doc-reference gate) — each with the red test
  that would qualify it sketched in its roadmap file, none activated now.
- The freeze can no longer silently become permanent: the internal arm is
  reachable through work that is already planned and sequenced.

## Alternatives considered

- **Delete the freeze.** Rejected — it just demonstrated its value on PR
  #1120 (item-granular sorting: failure-closing pieces extracted, additive
  pieces parked, unproven-feasibility pieces refused), and three independent
  signal sources (external reviews 9.11–9.14, the 2026-08-03 council, the
  capacity reality of one maintainer with an open renewal set) point the same
  way.
- **Keep the freeze as-is.** Rejected — the single external resume condition
  is a deadlock in waiting, and the missing pre-registration clause leaves
  the split-by-pain rule gameable.
- **Add a standing exemption list instead of Amendment D.** Rejected — a list
  is curated by argument; a red test is evidence. The red-test-first shape
  matches the house measure-then-build lesson.

## References

- `agents/settings/contexts/surface-consolidation-restraint.md` — the
  2026-07-20 restraint set (amended in the same change to point here).
- `road-to-package-renewal.md` § Locks — the 2026-08-02 split-by-pain
  refinement.
- PR #1120 — the 2026-08-03 parking + council disposition; the four parked
  roadmaps under `agents/roadmaps/later/`.
- Commit provenance for the re-audit: `a4f4eb8e6`, `af3ed6e7e`, `154d36619`
  (PR #1084), `47bb0f099`, `e89c1b733`.

## History

- 2026-08-03 — record created; Amendments A–D accepted; item re-audit result:
  0 EXTRACT / 3 LATENT-CANDIDATE / rest STAY (honest null on extraction).
- 2026-08-05 — **Amendment A internal arm satisfied; Amendment B cadence review
  discharged.** Conditions A.1 and A.2 verified met by inspection (both
  prerequisite roadmaps archived, 0 open / 0 deferred). Condition A.3 satisfied by
  an AI-council session (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds,
  blind peer review) convened on a 40-source ecosystem sweep. Council convergent:
  lift for **verification infrastructure only**, under a two-slot mechanically
  enforced concurrency cap; **capability remains frozen** behind a separate arm
  (an external finding reproduced by local measurement; the adoption half of that
  condition was struck the same day by ADR-216).
  Council also found Amendment D **structurally unable to admit capability** — a
  test referencing not-yet-existing code cannot fail for the right reason —
  recorded as a construction defect and repaired by the separate capability arm
  rather than by patching D, which stays as written for defect closure. This
  freeze record stays in force; the narrowing is
  [`ADR-215`](ADR-215-harvest-freeze-verification-arm-lift.md).
- 2026-08-05 — **Amendment E accepted; freeze LIFTED IN FULL.**
  [`ADR-216`](ADR-216-restraint-reanchored-to-capacity.md) strikes the external
  arm, re-anchors the rationale from adoption-waiting to capacity-restraint, and
  records the owner decision that external adoption is not a project goal and
  therefore not a valid gate anywhere in the tree. With the external arm gone the
  remaining three conditions are all satisfied, so the freeze is lifted in full
  rather than partially — ADR-215's verification-versus-capability split dissolves
  and only its capacity-based concurrency cap survives. Amendments B, C and D are
  untouched. Same-day sequence: A.3 satisfied by council (mechanism), then E by
  owner decision (purpose).
