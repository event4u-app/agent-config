---
complexity: lightweight
review_by: 2026-09-22
---

# Stub: road to the per-pack cost-delta emitter

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-23 when
> [`road-to-org-pack-fitness.md`](../archive/road-to-org-pack-fitness.md) was
> drained. It carries that roadmap's cancelled Phase 3. Outcome state on the
> parent: **transferred**.

## The probe that promotes this

```
A PER-PR DELTA-COMMENT SURFACE EXISTS IN THE TREE.
```

Nothing else. This is a **conditional capability record, not an execution
commitment** — the phrasing is the council's, and it matters: recording the item
here implies no approval of the spend blockers on the roadmap that would build
the surface.

## Why the parent cancelled it

`road-to-org-pack-fitness` Phase 3 would emit a per-pack token-passport delta for
a PR that touches `src/packs/**`, into a per-PR delta comment being built in
[`road-to-standing-payload-diet`](../road-to-standing-payload-diet.md).

Measured state of that dependency at commit 407915361: **0 of 19 steps done**,
with two open Class-2 blockers of its own (`b-behavioural-bench-spend`,
`b-colleague-machine-readings`). Nothing in the tree carries a delta-comment
surface today.

The council (2026-08-23, verdict (c), 2 of 2 convergent) read that as
**"nominally live but operationally deferred"** — no credible delivery path — and
ruled that it must not keep the parent open indefinitely, while the capability
should not die with the cancellation either. Hence: cancel there, record here.

One seat put the bound precisely, and it is repeated because it is the whole
scope of this stub: the carried item is *"a narrowly bounded emitter item whose
prerequisite is the landed delta-comment surface and whose inclusion does not
imply approval of that roadmap's spend."*

## What it would build — the parent's own two steps, verbatim in intent

1. **Emit the per-pack delta from the passport.** For a PR touching
   `src/packs/**` or any artefact a pack claims, compute the passport delta per
   affected pack in the shape the delta comment consumes.
   *verify:* a per-pack delta for a synthetic two-commit range, and an empty
   result for a range touching no pack artefact.
2. **Advisory, never a gate.** Emitting a number is cheap and reversible;
   failing a build on it is neither. A per-pack cost ratchet is a separate
   decision with its own owner, and doing both in one change makes the ratchet
   arrive without ever being decided.
   *verify:* the emitter has no non-zero exit path attached to a threshold
   comparison.

## What already ships

The token passport itself — Phase 1 of the parent — is done and reconciled
against the census. This stub is only the **surface**, not the measurement. That
asymmetry is the reason cancelling Phase 3 cost little: the numbers exist and are
generated; what is missing is a place a reviewer sees them.

## Blocking cost

```yaml
blocking_cost:
  observations:
    - dimension: blocked_items
      value: 0
      source: "the parent closed complete on Phases 1-2; no step depended on Phase 3"
  unknowns: [interruptions, context_tokens]
```

A real measured zero on `blocked_items`. The cost of *not* having it is a
generated passport nobody opens — which is a value question, not a blocking one.

## Reopens when

The probe returns true **and** per-pack attribution is still judged useful.
Neither half is assumed: if the delta comment lands and nobody wants per-pack
attribution in it, this stub is cancelled rather than promoted.
