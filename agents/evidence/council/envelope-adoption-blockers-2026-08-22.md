# Council disposition — subagent envelope adoption

<!-- evidence-type: analysis -->

**Date:** 2026-08-22 · **Members:** 2/2 (anthropic, openai) · **Mode:** `design`,
depth `standard`, blind peer review · **Cost:** $0.0371.

## Decision 1 — `b-classifier-vs-contract`: (b), conditionally. Convergent.

**Narrow the contract to the validator's five required fields. Do not widen the
validator to the union of what producers happen to send.** Seat B: *"A union
would preserve incompatible semantics indefinitely, while producer-side adapters
make drift visible."* Seat A: widening *"institutionalizes divergence by making
every future fork legal."*

### The correction both seats made, and it is the substantive one

The question treated "the contract" as one thing. It is **four**, and conflating
them is why one contract had three states:

1. **Body schema** — the five required fields.
2. **Lifecycle frame** — `DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` from a
   model, `BLOCKED` orchestrator-side. **Not a body field**, so narrowing the
   body does not delete it.
3. **Delivery protocol** — serialize once, persist that serialization, emit the
   identical value as the final text-only message. This is spawn-contract rule
   (f), and it **survives**: its two clauses are delivery invariants, never
   candidates for the validator's five.
4. **Classification** — validate and record against an explicit contract and
   classifier version.

### The clause nobody can satisfy, named rather than shipped

Seat B: `team_dispatch.ts:280` asks a **read-only** model with no command or
filesystem access to return its review JSON. That model **cannot** write a disk
copy first, so rule (f) is an impossible prompt obligation for that producer.
The trusted **dispatcher** must own it — parse, project into the canonical body,
add the lifecycle frame, write the durable copy, emit the identical value.

Recorded in the contract, **not implemented** in this run. A projection adapter
is a mechanism, and claiming it because a council named it would be the
buildable-on-paper failure the roadmap's own Risk 4 describes.

### The precondition one seat set, and the check that removed it

Seat A: before narrowing, *"run one envelope emission by hand against the
validator and confirm it passes"* — because `0 valid envelopes of 1,845 stops`
has three possible causes: a validator that rejects valid input, producers that
do not emit the fields, or a shape nobody can produce.

**Done, 2026-08-22.** `validateResponse` accepts a minimal envelope
(`{summary, handoff, confidence, findings: [], risks: []}`) and a rich one
(`findings[{title, evidence_refs, mutating}]` plus `artifact_paths`) — both
`valid: true`. The `team_dispatch` model shape fails four of five checks.

So the contract is **implementable**, the validator is **correct**, and the rate
is zero because producers do not emit the shape. Cause (2), not (1) or (3).

## Decision 2 — `b-production-window-reach`: SPLIT, and the split is recorded as one

**Seat A: (a).** Publish the drain window with its agent-type composition and a
machine-local caveat. *"Phase 2's stated goal is measuring mechanism behaviour
under realistic traffic, not generalizing to a production population. Parking on
an unstated bar is retrospective scope creep."* And on (b): *"a polite
no-decision"* absent evidence that a production-sourced sample is being
collected within a bounded window.

**Seat B: (b).** Park until an independently sourced window exists. *"A single
machine's drain-run data can validate mechanics, but calling it a production
window does not establish production reach."* Crucially: *"Option (a) may still
be run, but it should be renamed a **machine-local mechanism experiment** and
should not discharge Phase 2."*

### What both seats agree on, which is what was acted on

They disagree on whether to run the measurement. They **agree it does not
discharge Phase 2.** So: the measurement is published (seat A's substance) under
a name that is not Phase 2 (seat B's condition), and Phase 2 closes `[-]` with
the arrival condition named rather than being claimed on drain traffic.

No user round-trip was taken, and none was needed: the blocker's own
`Resolved when` admits either outcome, and the intersection of the two seats is
a legal one.

## Step 2.3 — both seats REFUSED the reading the question offered

The question proposed that the pre-pointer baseline (0 of 1,845) **is** the
pointer-removed arm, being a larger sample than any arm this run could emit.

**Both seats rejected it.** Seat B: *"temporally and compositionally confounded;
it does not show that removing only the pointer from the current mechanism causes
the current positive effect to disappear."*

And both named a **sequencing dependency** the step does not state: *"returns to
0"* is only meaningful **after** a contemporaneous pointer-present arm produces a
**non-zero** rate. Seat A: if the pointer-present arm stays 0, sensitivity is
**unknown** and 2.3 parks until the mechanism works at all — which is exactly
today's state, since the rate is 0 and the pointer has only just landed.

A deliberate arm must hold constant: agent type, dispatcher, prompt except the
pointer, contract and classifier versions, collection interval, environment.

## Dated follow-up carried from seat B

**2026-08-25** — publish versioned body / lifecycle / delivery contracts,
implement the dispatcher-owned projection adapter, test byte-equivalent
write-before-emit ordering, and tag historical observations with their actual
contract and classifier versions.
