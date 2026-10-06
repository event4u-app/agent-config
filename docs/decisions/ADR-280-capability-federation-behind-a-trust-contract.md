---
adr: 280
status: accepted
date: 2026-10-06
decision: capability-federation-behind-a-trust-contract
supersedes: —
superseded_by: —
phase: road-to-leading-every-row · blocker b8
type: structural
reopen_policy: owner
protected_dimensions: purpose
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - docs/decisions/ADR-088-no-external-runtime-federation.md
    - docs/decisions/ADR-124-embedded-engine-doctrine.md
    - agents/roadmaps/archive/road-to-leading-every-row.md
    - agents/roadmaps/later/road-to-federation-behind-adr-278.md
    - src/rules/agent-authority.md
review_trigger: >-
  A neighbour capability is proposed that one of the four answers in § Decision
  forbids, OR ADR-124 is reopened, OR the owner moves any of the four answers.
  A neighbour that turns out to be useless or unavailable does NOT reopen it —
  that is the fallback the trust contract already requires.
---

# ADR-280 — Capability federation behind a trust contract

## Status

Accepted 2026-10-06. Owner-directed: the owner answered blocker
`b8-adr-278-federation` of `agents/roadmaps/archive/road-to-leading-every-row.md` with
option (a) — author the record with the four answers as recommended — recorded
there as Decisions row D6. This file writes that answer down; it adds no answer
the owner did not give.

The blocker named the record ADR-278. That number was taken on 2026-10-05 by an
unrelated record, so this one takes the next free number and is found by its
slug, `capability-federation-behind-a-trust-contract`, as the blocker's exit
condition already reads.

`provenance.kind` is `human` with `decision_makers: [owner]`, because the ADR
schema has no `owner` kind; that is the closest value and it states the same fact.

## Context

ADR-088 § 3 reserves one question to its own record: should this suite ever
invoke a neighbour tool's capability, and if so, on what terms. It names four
answers that record must give — (a) identity, (b) generic design, (c)
maintenance model, (d) trust contract — and says that until such a record is
accepted, runtime coupling is out of scope.

The inbox round behind `road-to-leading-every-row` compared this tree row by row
against four installed neighbour packages. Two lanes of that round
(`road-to-a-tree-that-keeps-its-neighbours`, `road-to-neighbours-that-pull-their-weight`)
ship inventory, coexistence and a precedence rubric without invoking anything.
The third, `later/road-to-federation-behind-adr-278`, is parked on this record:
every phase it holds would invoke a neighbour, which ADR-088 § 3 forbids without it.

## Decision

The four answers ADR-088 § 3 asks for, as the owner gave them:

1. **(a) Identity — this suite orchestrates neighbours and never becomes a
   platform that drives them.** It may route a task to a capability the
   consumer installed; it never hosts, schedules, supervises or keeps alive
   another tool's runtime. ADR-088 § 1's "does not bridge to, or drive, external
   tool runtimes" stays literal for *driving*.
2. **(b) Generic design — by shape, never by name.** The only adapter is the
   census classes of the coexistence lane plus the `effect:` field a concern
   declares (kill register K13 of the programme). No vendor-named artefact,
   bridge or adapter is created; `check_no_external_sources` stays the
   backstop for that.
3. **(c) Maintenance model — a neighbour's proof expires when its digest
   changes.** Whatever was established about a neighbour (its effect class,
   its fingerprint, a measured result) is keyed on the installed digest and is
   void the moment the digest moves. Nothing is maintained per neighbour by
   hand; a changed neighbour is an unknown neighbour until re-measured.
4. **(d) Trust contract — a neighbour's result is typed evidence, and the stop
   gate alone decides completion.** A neighbour's output enters as evidence
   carrying a provider stamp. It never discharges `verify-before-complete`,
   never authorises a Hard-Floor action, and never outranks the four bands of
   `src/rules/agent-authority.md`. A neighbour that is absent, changed or
   failing degrades to the native path; it never blocks it.

**What this record does by itself:** it is the record ADR-088 § 3 requires, so
invoking a neighbour capability within the four answers above is no longer out
of scope. **What it does not do:** it ships no invocation. The first invocation,
its record sink, the fallback ladder and the benchmark reading are the parked
lane's phases, each landing as its own reviewed change.

## Not reopened

- ADR-088 §§ 1, 2 and 4 stand as written. § 3's reservation is discharged by
  this record and is not weakened beyond the four answers.
- ADR-124's literal reading — no cross-vendor runtime federation in the sense
  of driving another vendor's runtime — stands. This record narrows nothing of
  ADR-124; driving stays forbidden by answer (a).
- The safety floors (`non-destructive-by-default`, `commit-policy`,
  `verify-before-complete`) and the four authority bands are untouched;
  answer (d) is what keeps them on this side of the boundary.

## Consequences

- `later/road-to-federation-behind-adr-278` meets the decision half of its
  entry condition. It still waits on its own inputs (step 0.1 there) and on the
  two coexistence lanes it depends on.
- A proposal to drive a neighbour's runtime, to add a vendor-named bridge, or to
  let a neighbour's output close a task has a recorded answer to point at.

## Evidence

- ADR-088 § 3 (`docs/decisions/ADR-088-no-external-runtime-federation.md`, the
  "Federation is a separate, explicit decision" paragraph) names the four
  questions this record answers.
- The owner's answer is recorded as D6 and blocker b8 of
  `agents/roadmaps/archive/road-to-leading-every-row.md` (2026-10-06).
- Two AI-council passes on 2026-10-06 (recorded in that blocker) routed the
  question to the owner 4/4 and proposed no narrowing; they did not author or
  choose the answers.

## Alternatives considered

- **(b) Decline for a round** — not taken; the owner chose (a).
- **(c) Narrow further by striking answers** — not taken; the owner accepted the
  four answers as recommended.
- **An empty ADR skeleton** — rejected earlier in the blocker: it would satisfy
  the exit condition while deciding nothing.

## References

- ADR-088 (no external runtime federation; § 3 reservation)
- ADR-124 (embedded engine doctrine)
- `agents/roadmaps/archive/road-to-leading-every-row.md` — blocker b8, Decisions D6
- `agents/roadmaps/later/road-to-federation-behind-adr-278.md` — the lane this record unparks
