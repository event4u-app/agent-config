---
complexity: bounded
review_by: 2026-09-30
probe: none
---

# Stub: road to a resume probe that reads the condition, not the reference

> **Stub — not active work.** Found 2026-08-30 by the drain run, while sweeping
> `agent-config gates --all` for blockers. Not a blocker on any active roadmap —
> a defect in the instrument that decides when a **parked** roadmap may return.

## The finding

`agent-config gates --all --json` reports:

```
"resumeFired": 1,
"resumed": [{ "file": "later/road-to-elicitation-front-door.md",
              "verdict": "fired",
              "why": "road-to-suggestion-block-capture archived" }]
```

That roadmap's own resume condition reads:

> **Parked on arrival. Resume when `claim:suggestion-capture-rate` carries a
> resolved non-DROP verdict with a citable figure.** Without that instrument
> every verdict metric below is unresolvable-by-construction.

`docs/CLAIMS.md:903` — `claim: suggestion-capture-rate` — carries
**`status: unbacked`** and no figure. The condition is **not met**. The probe
says `fired` anyway.

## Why it fires

`src/agent-src/scripts/resume_probe.ts:520` — when a condition names a roadmap,
the probe resolves that roadmap's *location* and treats **archived** as
satisfaction:

```
reasons.push(`${slug} archived`);
continue;                       // no `unmet`, no `unresolvable`
```

`:544` then computes `unmet ? 'unmet' : unresolvable ? 'undecidable' : 'fired'`,
so an archived reference with nothing else outstanding fires.

**The gap is that a roadmap can archive without its claim resolving**, which is
exactly what happened here: `road-to-suggestion-block-capture`'s own archival
record classes the relevant items as a *capability-gated drain-run transfer*.
The probe reads "the named roadmap is finished" where the condition says "the
named roadmap produced a figure".

Note what is NOT wrong: the sibling path branch (`:485-499`) is sound on its own
terms — a condition saying an artefact will appear is satisfied by its
appearance, and the code says so. The roadmap branch inherits that reasoning
without the premise holding.

## Why it matters

Acting on this verdict unparks a roadmap whose blocking instrument has produced
no reading, and whose own entry condition says every downstream metric is
*unresolvable-by-construction* without it. It also costs an `active_roadmaps`
slot against a ratchet that is at its floor. A false `fired` is therefore more
expensive than a false `unmet`, and the probe's own comment at `:540-542` says it
is *"conservative on purpose"* — this branch is where it is not.

## What would close it

Any one of these, and choosing between them is part of the work:

1. **Read the referenced thing, not its location.** Where a condition names a
   claim id, resolve that claim in `docs/CLAIMS.md` and require a non-`unbacked`
   status. The parser already extracts `claim:<id>`-shaped tokens elsewhere.
2. **Return `undecidable` for a condition the probe cannot actually evaluate.**
   The verdict already exists and is already reported separately; a condition
   naming both a roadmap and a claim is the same conjunction the probe refuses
   to half-weigh at `:475`, and could be refused here for the identical reason.
3. **Record that archival does not imply satisfaction** and require an explicit
   marker on the archived roadmap that the resume condition may read.

## Both polarities, when it is fixed

A fix must be shown to keep firing on a condition that genuinely IS met — the
failure mode of tightening this is a probe that reports `unmet` forever and
parks everything permanently, which is worse than the defect. `resumeUndecidable`
already stands at 72 of 73, so the decidable set is one file wide and a
regression here would be invisible.

## Related

- `src/agent-src/scripts/resume_probe.ts:485-544` — the two verdict branches.
- `src/agent-src/scripts/roadmap_gates.ts:256-282` — the reporting surface.
- `docs/CLAIMS.md:903` — the claim the condition actually names.
