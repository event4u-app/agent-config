---
complexity: bounded
review_by: 2026-11-28
---

# Stub: road to a HOST capture rate for the runtime event journal

> **Stub — not active work.** Created 2026-08-28 by
> `road-to-runtime-event-journal`, whose step 1.4 is **`[~]` deferred and
> unmet on the delivery axis**. This carries the half that could not be
> measured, with both closers named. It does **not** claim the measurement.

## What step 1.4 asked, and what was actually produced

> **1.4 First capture measurement, published whichever way it lands.** What
> fraction of host events reach a record, measured against the recorded 0.27 %
> baseline for the existing telemetry path.

**Produced and published:** dispatch-path capture — **100.00 %, denominator
1,000 envelopes** handed to the concern (100 × each of the ten
`EVENT_VOCABULARY` members), 0 skips, and a default-OFF control landing 10/10
`disabled`. That is a floor on the **writer**, and it is real.

**Not produced:** the **host** capture rate, which is what 1.4 asked for. It
remains **`undefined`** — numerator unobserved, denominator unknown. Both
council seats read that as honest and as **not discharging the step**: *"zero
numerator does not establish 0 % when the population itself was not observed."*

**Comparing the dispatch figure to the 0.27 % delivery baseline is a category
error** and is refused here rather than left to a reader to avoid.

## The two closers, both named, neither autonomously reachable

1. **No host-emitted-event denominator exists anywhere in this tree.** Nothing
   durably counts what the host emitted, so there is no population to divide
   into. Producing one is its own instrument, not a measurement.
2. **The concern is default-OFF** (`hooks.runtime_journal.enabled`), chosen
   deliberately because the journal creates a new storage surface and ADR-124
   § 3's default-off floor for engine-shaped state is explicitly not superseded
   by ADR-249. A default install therefore records nothing, so 1.4's production
   number moved from *zero by construction* to *zero until opted in* — a change
   in kind, and still not a capture rate.

## What changed anyway, and why the deferral is not a null result

Before this roadmap the journal was bound in **no hook slot**, so production
capture was zero **by construction** and neither a numerator nor a denominator
could exist. It is now bound in 8 of 40 (platform, event) cells on `claude`,
exercisable, and measured on the path that exists. The path is the part that was
missing; the population is the part that still is.

## One finding carried forward, because it is about the DATA and not the plumbing

**1,000 of 1,000 records landed `boundary_status: session_fallback`.** The
Claude dispatcher envelope carries no `task_id` — only Cline's `taskId` is
readable — so the episode boundary runs at its documented fallback in
production rather than at the task boundary the council adopted. Marked in every
record rather than dropped, which is what the `session_fallback` value is for.
Threading the envelope's task id through is the journal roadmap's Phase 3 work
and is **not** blocked on anything here.

## Promotion gate

Either closer, on its own, changes what is measurable:

1. A host-emitted-event denominator exists — some durable count of what the host
   emitted, against which records can be divided; **or**
2. `hooks.runtime_journal.enabled` defaults ON, or a measurement runs against an
   install that has opted in.

Gate 1 alone yields a real rate for opted-in installs. Gate 2 alone yields a
population but still no denominator. **Both** yield the number 1.4 asked for.

## Seed content on promotion

- Do not report the dispatch-path figure as the host figure. They measure
  different things and the evidence page already says so.
- Publish whichever way it lands — a low host capture rate is the outcome this
  work is most likely to produce and is a complete result.
- Re-read `agents/evidence/analysis/runtime-journal-capture-2026-08-28.md`
  first; it states the denominator problem in the terms the council accepted.
