---
adr: 286
status: accepted
date: 2026-10-16
decision: discoverability-is-a-goal-asking-is-not
supersedes: ADR-216 (§ Context only)
superseded_by: —
phase: round inbox-2026-10-t · owner ruling on the adoption question
type: structural
reopen_policy: owner
protected_dimensions: [purpose]
review_trigger: >-
  Reopened by the owner, and only by the owner, because it declares a purpose.
  Two conditions worth naming in advance. First, if a discoverability surface
  turns out to require either consumer telemetry or an in-product ask to be
  worth doing at all — then the separation this record rests on is false and
  the whole decision is wrong, not merely incomplete. Second, if the in-product
  half is ever proposed again with evidence this round could not produce: a
  measured benefit, a defensible cadence, and a stop condition the tree can
  check without the user's external identity. Do NOT reopen on an adoption
  signal of any size: D5 of ADR-216 survives this record untouched, so the
  number of people using this package is not a condition anything here may
  wait on.
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
authority_basis: owner_intent
evidence:
  strength: E1
  discovery: complete
  basis:
    - docs/decisions/ADR-216-restraint-reanchored-to-capacity.md
    - docs/contracts/adoption-signal-floor.md
    - agents/roadmaps/skipped/road-to-adoption-without-narrative-debt.md
    - src/scripts/skill_linter.ts
    - SECURITY.md
---

# ADR-286 — Discoverability is a goal; asking is not

## Context

ADR-216 recorded the owner's ruling that **external adoption is explicitly not
a project goal**, struck the adoption arm from every governing gate, and
re-anchored the surviving restraint to maintainer capacity. That record names
its own exit in its `review_trigger`:

> If external adoption is ever adopted AS a goal, that is a fresh product
> decision and needs its own record, not a revival of these gates.

This is that record, and it is deliberately **narrower than the exit it uses**.

### What brought the question back

Round `inbox-2026-10-t` carried four goals from the owner, two of which are
adoption work by definition: a periodic in-product prompt asking for a GitHub
star until one is given, and wider distribution of the package. The analysis
verified that the second of those collides with ADR-216 and that **zero files
supersede it**; the matching roadmap had already been disposed of on that
ruling 72 days earlier
(`agents/roadmaps/skipped/road-to-adoption-without-narrative-debt.md`).

The round surfaced the collision as an owner-reserved transition rather than
planning against it, and offered three resolutions: adopt adoption as a goal,
keep ADR-216 unchanged, or adopt the narrow half. The owner chose the narrow
half.

### Why the narrow half, and not the whole

The two halves are not equally supported, and that asymmetry is the whole
argument for splitting them.

**The outward half is ordinary correctness work wearing a growth label.** A
repository whose description disagrees with its own package manifest, whose
topic list advertises a language its CI forbids, and whose registry
submissions sit half-finished is not *under-marketed* — it is *wrong about
itself*. Fixing that needs no adoption goal to justify it and produces a
truthful tree whether or not anyone arrives. Calling it a goal simply stops
the work being refused by a record that was aimed at something else.

**The in-product half could not be sized by anybody in the round.** Nobody
produced a measured benefit. The two parallel analyses disagreed about the
cadence by a factor of four — "monthly until starred" is up to twelve asks a
year against a recommended cap of three per 365 days. And the stop condition
the owner stated, *until he has starred*, is not checkable by this tree: it
needs the user's external identity, which the privacy floor
(`docs/contracts/adoption-signal-floor.md`) forbids this package from
collecting or transmitting. A mechanism whose benefit is unmeasured, whose
cadence is contested, and whose exit condition is unobservable is not ready to
be built, independently of whether it is permitted.

**And the two halves need different permissions.** The outward half is a set
of edits to files this project owns and forms it submits itself. The in-product
half would put a request for a favour inside a tool the user is using for
something else, every month, in a package whose own linter errors on
self-promotional phrasing in any shipped skill
(`src/scripts/skill_linter.ts`, the anti-nag gate). One of those is a tidying
job; the other is a change to what this software does to the person running it.

## Decision

### D1 — Discoverability is a declared goal

The project **does** pursue being findable and being accurately described.
Concretely and exhaustively, this covers:

- the repository's own metadata — description, homepage, topic list — agreeing
  with the package manifest and with the tree;
- listings in package registries and tool directories the project submits
  itself to, including completing submissions already in flight;
- published badges that state a true, re-derivable or honestly-labelled fact
  about the package;
- documentation and examples that make what the package does legible to
  someone who has not read its source.

Work in this list no longer needs a justification outside itself, and may no
longer be refused on the grounds that adoption is not a goal.

### D2 — In-product asking is not, and this is a refusal rather than a deferral

No surface of this package asks its user for a star, a rating, a review, a
testimonial, a referral, or any other act of promotion. Not in the CLI, not in
a hook, not in a skill, not in a session-start notice, not once, not capped,
not opt-out. The existing anti-nag gate in `skill_linter.ts` stays, and this
record extends its intent to every surface rather than only to skill bodies.

This is not "later". The `review_trigger` above names what would have to be
true for it to be reopened, and all three conditions are things nobody has
produced, not things nobody has scheduled.

### D3 — ADR-216's D5 survives untouched: a goal is not a gate

**No gate, blocker, resume condition, or reopen trigger in this tree may be
anchored on an external-adoption signal.** D5 of ADR-216 is unchanged by this
record and is restated here because this is exactly the record a future reader
would cite to weaken it.

The distinction is the load-bearing one in this ADR. A roadmap may now say
*"publish the registry listing"* as work worth doing. Nothing may say *"wait
until N people install this"*, *"resume when an external adopter asks"*, or
*"gate this on download growth"*. The thirty-three steps ADR-216 unblocked stay
unblocked, the harvest queue stays restrained by capacity alone, and the
concurrency cap is untouched.

### D4 — The privacy floor is untouched, and no measurement follows from this

`docs/contracts/adoption-signal-floor.md` stands in full: no consumer
telemetry, no outbound call from a consumer's machine to a maintainer endpoint,
no collection of who is using this package. Adopting discoverability as a goal
creates **no** entitlement to measure whether it worked.

The honest consequence, stated rather than discovered later: the effect of
every item under D1 is observable only through public signals the project does
not control — a registry's own listing page, a download count that counts
fetches rather than people. This record accepts that the goal it declares is
one whose success cannot be measured from inside the tree, and declines to
relax the floor to fix that.

### D5 — The skipped roadmap is not revived wholesale

`road-to-adoption-without-narrative-debt` stays in `skipped/`. Parts of it fall
inside D1 and may be re-planned as new work with the current tree verified
under them; its disposition is not reversed, and nothing is resurrected on the
strength of this record alone. The same applies to
`skipped/road-to-reach-gated-platforms`.

## Not reopened

ADR-216's decisions are untouched. Specifically:

- **D1** (ADR-211 Amendment E: the external arm is struck from the harvest
  freeze) — unchanged.
- **D2** (the restraint rationale is re-anchored to capacity) — unchanged.
- **D3** (ADR-215's capability arm correction) — unchanged.
- **D4** (the polish gate is retired with its roadmap) — unchanged.
- **D5** (adoption may never be a gate) — unchanged, and restated as D3 above.
- The concurrency cap and its enforcing gate
  (`src/scripts/lint_roadmap_family_cap.ts`) — unchanged.

What this record supersedes is one sentence of ADR-216's **Context**: the
premise that external adoption is not a project goal is now true of the
in-product half only. ADR-216 keeps `status: accepted` because every decision
in it is live.

## Consequences

**Unblocked:** the outward half of the reach work from round
`inbox-2026-10-t` — repository metadata, topic list, the registry and
directory submissions already in flight, the download badge, and the
documentation that makes the package legible. Where those actions need the
owner's own GitHub login they remain owner-reserved for that reason, not for
this one; they are held at
`agents/roadmaps/stubs/road-to-bus-factor-external-actions.md` and
`agents/roadmaps/stubs/road-to-a-visibility-sync-that-can-write.md`.

**Closed:** the star-prompt question. It was asked in this round, answered
here, and is not an open item anywhere in the tree.

**Unchanged:** every safety floor, the Hard Floor, the privacy floor, the
anti-nag gate, the capacity cap, and D5's prohibition on adoption as a gate.

**Honest cost, in both directions.** Declaring discoverability a goal admits a
class of work with no measurable payoff into a tree that otherwise demands
evidence for what it spends capacity on; D4 says plainly that the payoff is
unmeasurable rather than pretending a public download count stands in for it.
And refusing the in-product half gives up whatever the asks would have
produced — which nobody could estimate, which is the reason it is refused
rather than the reason it costs nothing.

## Alternatives considered

**Adopt external adoption as a goal in full (option 1 as offered).** Rejected
by the owner. It would have admitted the in-product half on the same evidence
that could not size it, and it would have put pressure on D5 — a project that
wants adoption has a standing reason to gate on adoption signals, which is the
failure ADR-216 exists to prevent.

**Keep ADR-216 unchanged (option 2 as offered).** Rejected. It leaves the
repository describing itself incorrectly and half-submitted to directories, on
the authority of a record aimed at a different question. ADR-216 struck
adoption as a *gate* for good reasons; using it to refuse a correction to the
repository's own description is a use it was not written for.

**Split by surface instead of by act** — allow asking in the CLI but not in a
host session. Rejected: the split would track where a user is least likely to
be rather than what the package does to them, and the round's own analysis
established that the CLI is the surface most users never see, so it is the
split that maximises annoyance per unit of reach.

**Make the in-product half conditional on a measurement.** Rejected as a
deferral wearing a condition's clothes. The measurement that would justify it
is forbidden by D4, so the condition could never be met and the item would sit
open forever — the shape this project's own deferral discipline refuses.

## Evidence

- **ADR-216 is live, owner-reserved, and names this exit.** `adr_cite_check
  ADR-216` at `5fa963cec`: `status accepted`, `reopen_policy owner (declared)`,
  `protected dims purpose`, trigger state `indeterminate`. Its
  `review_trigger` carries the "fresh product decision … needs its own record"
  clause verbatim.
- **Nothing supersedes it.** `grep -l 'supersedes:.*ADR-216' docs/decisions/*.md`
  returned zero files at `5fa963cec`, which is what made this an owner question
  rather than an already-settled one.
- **The disposition it produced.**
  `agents/roadmaps/skipped/road-to-adoption-without-narrative-debt.md`, added
  2026-08-05, disposed on this ruling and recording "reopen only as a fresh
  product decision".
- **The privacy floor the in-product half collides with.**
  `docs/contracts/adoption-signal-floor.md` — the Iron Law forbidding consumer
  telemetry, and the clause forbidding an outbound call to a maintainer
  endpoint.
- **The anti-nag gate D2 extends.** `src/scripts/skill_linter.ts` — the
  update-check and self-promo patterns, severity `error`, reported as 0 hits
  across every shipped skill.
- **The support argument that is NOT adoption.** `SECURITY.md:21-22` — fixes
  land on the latest published version and older releases are not backported.
  Staying current is a support property, which is why the update roadmaps in
  this round never needed this ADR.

## References

- `docs/decisions/ADR-216-restraint-reanchored-to-capacity.md` — the record
  this one narrows, whose decisions all survive.
- `docs/contracts/adoption-signal-floor.md` — the privacy floor D4 leaves
  standing.
- `agents/roadmaps/stubs/road-to-bus-factor-external-actions.md`,
  `agents/roadmaps/stubs/road-to-a-visibility-sync-that-can-write.md` — where
  the owner-reserved outward actions are held.
- `agents/roadmaps/skipped/road-to-adoption-without-narrative-debt.md`,
  `agents/roadmaps/skipped/road-to-reach-gated-platforms.md` — dispositions
  this record does not reverse.

## History

- **2026-10-16** — accepted. Owner ruling, taken in round `inbox-2026-10-t`
  after the round surfaced the ADR-216 collision as an owner-reserved
  transition and offered three resolutions. The owner chose the narrow one.
