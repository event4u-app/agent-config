---
complexity: lightweight
---

# Stub: road to the demand-gate audience default

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-22 when
> [`road-to-demand-gate-audience-followup.md`](../archive/road-to-demand-gate-audience-followup.md)
> was drained. Its last live item is closed to an autonomous run on **both**
> halves, for two different reasons, so the record moves here rather than sitting
> in the active estate looking like work in progress. Outcome state recorded on
> the parent: **transferred**.

## Disposition

**No consumer-facing behaviour changes. The shipped default remains
`project.audience: public`.** Nothing in this transfer touches it. Neither an
evidence failure nor an owner's absence authorises changing — or permanently
rejecting — a live default.

This transfer is **administrative only**: it neither approves nor rejects the
audience-default flip.

## Unresolved decision — the item, verbatim from the parent

> A stated position on whether an unconfigured repo running this package is more
> likely internal than public — evidence, or an explicit maintainer judgement
> recorded as such.

What it would gate: flipping the shipped default of `project.audience` from
`public` to `internal`. The parent describes that as "a **consumer-facing default
change**: it alters agent behaviour in every existing install, including those
whose maintainers never read the change." The argument for flipping, preserved so
a reopening does not re-derive it: most repositories running this package are not
products with a market, so `public` is arguably the least likely of the four
possible values.

## Why neither half could be closed here

The two halves fail for genuinely different reasons, and collapsing them into one
"null" would obscure the reserved decision — so they are stated separately:

| Half | State | Why |
|---|---|---|
| Evidence | **Terminal null** | Nothing in or reachable from this tree can report the audience mix of installs. Not "not measured yet" — there is no instrument and none can be built from here. |
| Maintainer judgement | **Owner-reserved, unresolved** | The item's own words are "an explicit maintainer judgement recorded as such". That is a maintainer's act by construction. |

Only the *evidence* route reached a null. The item as a whole is **not** closed.

## Authority for this disposition

Per the `road-to-drain-commands` ruling (2026-08-22, 2 of 2 seats convergent):
a council may not manufacture the owner decision a blocker reserves, and
recording an owner's *absence* as an owner's *decision* fabricates satisfaction
of a terminal condition. A second council pass (2026-08-22, 2 of 2 convergent)
applied that precedent to this item and chose transfer-to-stub over cancellation
for exactly that reason — cancelling would have read as a permanent rejection
nobody ruled.

The transfer target was checked rather than assumed, because the whole point is
to leave the active estate: `stubs` is in `EXCLUDE_DIRS` at
`src/agent-src/scripts/update_roadmap_progress.ts:88`, alongside `archive`,
`skipped` and `later`, and `check_estate_count` reads that same `collect()`. So
the exclusion is real and not a naming convention.

## Reopens when — either one alone is sufficient

- **Evidence** exists: an instrument that can report the audience mix of installs.
- **Or** an explicit maintainer judgement is recorded as such.

The item's own wording is "evidence, **or** an explicit maintainer judgement" —
either suffices, and neither implies council approval of the flip.

## Work already done, and where it lives

- The migration note is **complete**:
  [`demand-gate-default-flip-migration-note.md`](../../evidence/analysis/demand-gate-default-flip-migration-note.md)
  — what changes for a repo that never sets the key. A reopening starts from it.
- The counter-test was re-pointed and sabotage-probed in both directions:
  `tests/contracts/demand_gate_audience.test.ts:72-108`.
