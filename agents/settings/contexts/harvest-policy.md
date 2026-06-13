# Harvest Policy — adopt now, defer-with-trigger, drop

When an external repo (a competitor, a peer, a one-off reference like
an external reference) surfaces an idea worth considering for this package, the
default disposition was binary: **adopt now** or **drop**. That binary
made every speculative-but-promising idea either premature ("we'll need
this someday so let's land it") or invisible ("not today, never written
down again").

This context codifies the **third bucket** that bridges that gap:
**defer-with-trigger**. The bucket is mechanical, not editorial — every
deferred item carries the exact condition that reopens it.

## The three buckets

| Bucket | When | Action | Owner |
|---|---|---|---|
| **Adopt now** | Falls within the visible 6-week plate, ICE high enough to displace another candidate, no blocker | Land it in the current plate. Counts against the 5-slot hard cap. | Plate owner (whoever shipped the harvest analysis) |
| **Defer-with-trigger** | Real value, but adoption today is **speculative architecture** — premature without a concrete consumer | Write the ICE score, the **trigger condition**, and the **adoption shape**. Do **not** consume a plate slot. | Same as Adopt-now; reviewed each plate. |
| **Drop** | ICE too low, scope-misaligned, or out-of-charter | Mention once in the analysis with the reject reason; do **not** carry forward. | n/a |

## Required format for a Defer-with-trigger entry

Every deferred item must have **all four** fields. Missing any field →
the item is not defer-with-trigger; it's either adopt-now or drop.

1. **Trigger condition.** Specific, observable, falsifiable — written
   so any reviewer can answer "has it fired?" with yes / no, no
   judgement call. Examples that **pass**:
   - *"≥1 consumer surfaces a concrete HTTP-MCP use case (browser
     client, remote agent, or CI agent calling a centralized MCP
     server)."*
   - *"At least one feature in any consumer project surfaces documented
     AC count >5 OR cross-cutting impact across ≥3 modules."*

   Examples that **fail** (vague / judgement-laden / non-falsifiable):
   - *"When we feel the need."*
   - *"Once HTTP-MCP becomes important."*
   - *"If the ecosystem catches up."*

2. **Adoption shape.** What the artifact looks like the day the trigger
   fires. Specific enough that reopening doesn't require a new
   harvest analysis — just execute the shape. Lines / files /
   skills / commands enumerated.

3. **Sunset path.** What stays authoritative-link only and never gets
   inlined, even if the trigger fires. Prevents the deferred bucket
   from becoming a back-door fork of upstream runtime code.

4. **Owner + cadence.** Owner = current plate owner unless ownership is
   explicitly handed off. Cadence = **reviewed each plate** — the plate
   owner reads the deferred list, asks "has any trigger fired?", and
   either promotes to adopt-now (consumes a slot) or leaves it.

## Why review cadence is "each plate", not "monthly"

Plate boundaries are the natural moment to ask "what fits in the next
six weeks?" — that's already when slot allocation gets debated. A
calendar cadence layered on top adds review meetings without adding
information. If a trigger fires mid-plate, the discoverer surfaces it
immediately; the plate owner decides whether it's worth interrupting
the current plate or queuing for the next one.

## Where deferred items live

In the **same** roadmap that produced the analysis, under a phase
labelled `out-of-horizon (deferred-with-trigger)`. That phase is
visible (so the items aren't forgotten) but **not counted** against
the plate's 5-slot cap.

## When the trigger never fires

Indefinite dormancy is the **intended** outcome. A deferred item that
sits for 6 plates without firing has been correctly deferred —
speculative architecture is the cost we're explicitly avoiding.

A deferred item is **dropped** (not promoted) when the upstream source
becomes obsolete, the design space evolves, or a different solution
ships that obviates the need. Dropping is documented in the same
roadmap with a one-line reason and the date.

## Anti-patterns

- **Trigger as TODO.** *"When someone has time"* is not a trigger;
  it's a dropped item with extra ceremony. Drop it.
- **Adoption shape as wishlist.** *"Some kind of HTTP bridge"* is not
  an adoption shape; the future agent will redo the harvest analysis.
  Either write the shape or drop the item.
- **Defer-with-trigger as plate overflow.** Items that would adopt-now
  except the plate is full are **not** defer-with-trigger — they're
  next-plate adopt-now. Don't pretend they need a trigger.
- **Authoritative-link drift.** A deferred item whose authoritative
  link goes 404 has lost its sunset path. Re-pin to a commit SHA on
  every plate review.

## Example — external HTTP-bridge reference

Reference for the format above.
an internal harvest roadmap (local-only)
**P2.1**:

- **Trigger condition.** Both must fire: (a)
  `road-to-mcp-server.md` Phase 1 ships a working stdio prompt fetch
  in ≥1 confirmed client, AND (b) ≥1 consumer surfaces a concrete
  HTTP-MCP use case. Either alone is insufficient.
- **Adoption shape.** Extract the `mcp-stdio-kernel.js` pattern (six
  load-bearing pieces) as a reference appendix in the existing
  `mcp-request-signing` guideline. The full Express bridge stays
  authoritative-link only.
- **Sunset path.** the upstream bridge source (~1.6k LOC),
  its plugin marketplace manifest, its MCP tool
  surface — never inlined.
- **Owner / cadence.** Plate owner; reviewed each plate.

## Citation hooks

- Future harvest analyses (`agents/evidence/analysis/compare-*-harvest.md`)
  should link this context for the defer-with-trigger format.
- Roadmap authors writing `out-of-horizon (deferred-with-trigger)`
  phases reference this context inline.
- [`docs/contracts/`](../../docs/contracts/) ADRs that codify a
  deferred decision link here for the trigger-format vocabulary.
