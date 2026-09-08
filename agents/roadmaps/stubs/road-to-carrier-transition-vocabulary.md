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
| Archive it while it holds live obligations | refused by `lint_carrier_integrity`'s destination-side branch, which reds when an archived parent's `carried-to=` destination is itself an archived carrier. There is no `status: carrier` archival check, and the earlier wording named one: `archive_completed` iterates `collect()`, `collect()` skips carriers, so the archival sweep never considers a carrier and nothing in it refuses one. The refusal holds because the same gate requires every live carrier to be named by an archived parent, so a carrier with no parent to red on cannot exist in the first place |
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

## The resumption trigger has FIRED — 2026-09-07, and the premise above is stale

> **This section adds a dated observation and builds nothing.** No transition
> was declared, no vocabulary was designed, no gate was written. It is here
> because the trigger one section above is a promise to notice, and it fired
> without anything noticing.

**A second carrier exists.** `agents/roadmaps/road-to-the-skill-surface-framing-choice.md`
declares `status: carrier` with `parent_roadmap: road-to-the-activation-census-consequence`,
and landed on `main` on **2026-09-07** in `a42179585` (PR #1884,
`drain/the-activation-census-consequence`). Measured, not inferred:
`grep -rIln '^status: carrier' agents/roadmaps/` returns two paths, and
`lint_carrier_integrity` reports `2 live carrier(s) justified` where its own
2026-09-02 run reported one.

**So § Why it is not built now rests on a premise that is no longer true.** That
section's stated reason was *"There is exactly **one** carrier in the tree. A
vocabulary designed against a single instance encodes that instance's shape."*
The sentence is left standing above and corrected here rather than rewritten,
because the deferral was honest when written and the record of *why* it was taken
is worth more than a tidy file. This stub was last touched on 2026-09-02
(`6641d4719`, #1810); the second carrier arrived five days later.

**What is NOT claimed.** That the vocabulary is now justified — one additional
instance answers the "framework for one instance" objection and answers nothing
about which of the four capabilities is needed; that any of the seven
transitions has been attempted or worked around; that two carriers constitute a
population; or that the council's "deliberately immobile first version" has been
superseded. The `n = 2` here is a count, not a trend.

**Why nothing was built.** Designing a carrier-identity scheme, an atomic
transfer, a per-item resolution record, or a split declaration means shipping
repository-wide lifecycle infrastructure and, for any of them to bind, a CI gate.
That authority was found absent by an AI council on 2026-09-01 (drain 14, verdict
**3A**: *"adding a CI gate is a governance act whose authority this run has not
established"*) and the seats **diverged** on it again on 2026-09-01 (drain 15),
so no mandate exists. A divergent council carries none. The trigger's condition
being met supplies the *engineering* premise and not the *authority*, and those
are different questions.

**The trigger stays fired.** It is not reset, downgraded, or re-dated, and no
calendar date is attached to it. The next authorised run — or the owner — inherits
a met condition plus this record of what met it. Recording it is the whole of
this lane's discharge, and the sibling carrier's own § What still does not guard
it names why the recording was needed at all: *"No mechanism monitors the 38
resumption triggers, so an item whose trigger fires stays `[~]` until a human
looks."* This is that failure with a live instance attached — a fired trigger on
a sibling artefact, unnoticed for five days, found only because a human-directed
run happened to read the file.

## See also

- `src/scripts/lint_carrier_integrity.ts` — the standing validator whose
  refusals this vocabulary would replace with declarations.
- `agents/roadmaps/later/road-to-council-topology-evidence-followups.md` — the one
  carrier, and § Unguarded-carrier gap for what does and does not guard it.
