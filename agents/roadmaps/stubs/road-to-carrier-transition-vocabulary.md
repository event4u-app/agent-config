---
complexity: bounded
review_by: 2027-06-30
---

# Stub: road to a transition vocabulary for deferral carriers

> **Stub — not active work.** Created 2026-09-02, when the carrier lifecycle
> state shipped. Both council seats asked for a deliberately immobile first
> version, so every transition below **fails closed today**. This records what
> the vocabulary would have to express, and why building it now would be
> premature.

## What fails closed today, and where

`src/scripts/lint_carrier_integrity.ts` walks from the archived parent and
resolves its `carried-to=` destination. Every transition that moves or re-points
a carrier therefore breaks that resolution and reds, with no way to say it was
deliberate:

| Transition | How it reds today |
|---|---|
| Rename the carrier | destination no longer resolves — reported as a deletion |
| Re-parent it | the `parent_roadmap:` back-link no longer names the archived source |
| Archive it while it holds live obligations | refused by the `status: carrier` archival check |
| Move it to `skipped/` | refused — skipping is not fulfilment |
| Carry its items onward to a second carrier | the original parent's link breaks when the intermediate goes |
| Resolve one item and remove it | invisible: nothing compares the item count to a previous reading |
| Split it across two receivers | no annotation expresses one source, two destinations |

The first five are the right behaviour for an immobile version: they refuse
rather than infer. The last two are the honest gaps — a partial resolution and a
split are both legitimate acts with no way to declare them.

## What a vocabulary would have to carry

1. **A stable carrier identity independent of its path.** One seat asked for
   this and it was deliberately not built: the roadmap system uses paths as
   identifiers everywhere, and a separate id scheme for carriers alone is a
   framework for one instance. It becomes worth it when a rename must be
   expressible as a rename rather than as a deletion plus an addition.
2. **An atomic transfer between two carrier identities**, so an onward carry is
   one declared act rather than a broken link plus a new one.
3. **A per-item resolution record**, so removing an item from a carrier is
   distinguishable from losing it. Today only whole-file loss is detectable.
4. **A split declaration** — one source, two destinations, each carrying a named
   subset.

## Why it is not built now

There is exactly **one** carrier in the tree. A vocabulary designed against a
single instance encodes that instance's shape, and every one of the four items
above is a guess about a transition nobody has needed yet. The council's own
framing: a new lifecycle state is *"complex infrastructure for what may be a
single edge case"*, and the version that shipped is the narrow one both seats
could agree on.

**Resumption trigger:** a second carrier appears, OR any of the five refusing
transitions above is genuinely needed and is currently being worked around.

## See also

- `src/scripts/lint_carrier_integrity.ts` — the standing validator whose
  refusals this vocabulary would replace with declarations.
- `agents/roadmaps/road-to-council-topology-evidence-followups.md` — the one
  carrier, and § Unguarded-carrier gap for what does and does not guard it.
