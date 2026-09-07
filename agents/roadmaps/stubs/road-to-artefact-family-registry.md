---
complexity: lightweight
review_by: 2027-03-07
---

# Stub: a declared artefact-family registry

> **Stub — not active work.** Transferred here on **2026-09-07** by
> `road-to-observed-learning-signal`, whose `artefact-family-registry` blocker
> closed as **descoped to a stub** on an AI council disposition (drain run 19,
> 2026-09-06). The parent roadmap is complete; this subject is not, and the two
> facts are kept apart deliberately so a completed roadmap can never be read as
> an achieved goal here.

## What the registry would be

A declared family registry with shared and member-specific columns, so that a
change to one member's **shared** rule is checked against its siblings. The
propagation failure it would guard against is real: a shared rule changed in one
family member and not the others stays undetected until a human notices it by
hand.

## Why it is not being built now

`src/scripts/audit_skill_overlap.ts` already surfaces the clusters a registry
would enumerate, and **nothing in the tree reads a registry today**, so building
one now produces a measurement rather than a gate.

That is the cheap half of the argument. The load-bearing half is evidentiary:
**no propagation-failure instance is recorded.** An absence search does not
satisfy "an instance is recorded" — searching the tree and finding nothing is a
different fact from observing one, and a registry built on the first is a
measurement tool with no consumer and no case behind it.

## Reopening condition — observation-based, never calendar-based

```
ONE RECORDED CASE OF A SHARED RULE CHANGED IN ONE FAMILY MEMBER
AND NOT ITS SIBLINGS.
```

That is the whole trigger, and it is mechanical: it is an **event**, not a date.
`review_by` above exists because every parked artefact in this estate carries
one; it is a prompt to re-read this file, **not** a deadline after which the
registry is built or abandoned. A date passing changes nothing about whether the
instance has occurred.

When one occurs: cite it **in this file**, then open a roadmap that reads
`audit_skill_overlap.ts`'s cluster output as the registry's seed data.

The owner may also decide to build it preemptively without waiting for an
instance. That decision is available and has not been taken; the council's
disposition refused to *substitute* for it, not to foreclose it.

## Ownership

Owner: maintainer. Recorded so the descope does not become abandonment wearing
bookkeeping — an artefact with no named owner and no mechanical trigger is
abandoned whatever its frontmatter says.

## Recorded instances

None yet. This section exists so that adding the first one is an edit to a
heading that already exists, rather than a decision about where it goes.
