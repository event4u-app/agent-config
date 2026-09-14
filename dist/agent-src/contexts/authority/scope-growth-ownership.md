# Scope Growth — Ownership

Loaded from [`scope-mechanics`](scope-mechanics.md). The size question — *is
this small and aligned enough to do now* — is the remediation ladder's. This is
the other axis, *whose decision is it*, and a change must clear BOTH to be done
inline: something small and council-owned is still not the agent's to decide,
and something agent-owned and large is still bounded by the smallest-diff rule.

```
SCOPE GROWTH DISCOVERED MID-MISSION IS ROUTED BY WHO OWNS IT, NOT BY HOW BIG
IT LOOKS. THE THREE LISTS BELOW ARE CLOSED. GROWTH THAT MATCHES THE FIRST IS
DONE AND RECORDED AS A SCOPE DELTA — IT IS NEVER ASKED ABOUT.
GROWTH THAT MATCHES NEITHER OF THE FIRST TWO IS NOT SCOPE GROWTH AT ALL:
IT IS A FOLLOW-UP ARTIFACT, AND THE MISSION DOES NOT EXPAND TO HOLD IT.
```

`active-remediation`'s ladder answers *how big is this and is it aligned*.
This answers the other axis — *whose decision is it* — and the two run
together: a change must clear BOTH to be done inline. Something small and
council-owned is still not the agent's to decide; something agent-owned and
large is still bounded by `minimal-safe-diff`.

### Agent-owned growth — done, recorded, never asked about

Six kinds, and the list is closed:

1. **A necessary internal refactor** — the change cannot land correctly
   without it, and it changes no public surface.
2. **A missing test** on a path this change touched.
3. **A regression on a touched path** — the change surfaced it, so the change
   owns it.
4. **A small dependency adjustment** inside the existing major, no new
   dependency.
5. **A local API change inside already-defined semantics** — the contract does
   not move, only its implementation.
6. **A Boy-Scout cleanup** that is ALL of: small, local, low blast radius,
   testable, and carrying no new product decision. Any one of the five
   missing and it is not this row.

Each is **recorded as a scope delta in the PR body** — one line naming what
grew and why it was the agent's. The record is what makes the autonomy
reviewable afterwards, which is the condition under which it is legitimate at
all; growth done and not recorded is indistinguishable from scope creep.

### Council-owned growth — resolved by the council, still not asked of the owner

Four kinds:

1. **A larger internal re-cut** — the shape of the change, not its size.
2. **Two equal technical strategies** with no evidence between them.
3. **A risky compatibility design** — a technical risk, which is still
   technical.
4. **An unclear boundary carrying no new product semantics.**

These route through the ownership ladder — independent session → council →
team — and the verdict becomes a `## Decisions` row. None of them reaches the
owner, however consequential: a technical decision does not become owner-owned
because it is hard.

### Owner-owned growth — the only rows that reach a person

Two, and only two:

1. **The work changes what the product or the business does.** New
   user-visible semantics, a commitment, a price, a policy.
2. **It needs a typed op** — an operation from ADR-260's eleven-op vocabulary
   for which no grant exists.

### Everything else is a follow-up artifact

A larger unrelated opportunity — a refactor the mission did not touch, a
subsystem that deserves attention, a debt the change merely passed — does
**not** expand the mission. It becomes a follow-up artifact (a roadmap under
`agents/roadmaps/`, per `active-remediation`'s third tier), named in the PR
body, and the mission delivers what it was given.

The failure this prevents is the one that looks like diligence: a mission that
absorbs every good idea it meets delivers none of them, and the PR that
carries it cannot be reviewed against anything.

