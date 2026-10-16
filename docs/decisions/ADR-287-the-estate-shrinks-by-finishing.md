---
adr: 287
status: accepted
date: 2026-10-16
decision: the-estate-shrinks-by-finishing
supersedes: —
superseded_by: —
phase: round inbox-2026-10-t · owner ruling on the WIP question
type: structural
reopen_policy: owner
protected_dimensions: [purpose]
review_trigger: >-
  Reopened by the owner, and only by the owner. The condition worth naming in
  advance is the one this record accepts as a risk: if the active estate grows
  while the completed-step count does not move for a sustained stretch, then
  "finish them" has become "keep them", and the premise of this ruling is
  false. That is a reading somebody has to take — no gate produces it, and
  this record deliberately installs none. Do NOT reopen on the count alone: a
  large estate is the accepted shape here, not the trigger.
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
authority_basis: owner_intent
evidence:
  strength: E1
  discovery: complete
  basis:
    - agents/roadmaps/stubs/road-to-consumer-capability-share.md
    - agents/roadmaps-progress.md
    - src/scripts/check_estate_count.ts
    - docs/decisions/ADR-253-per-pr-user-artifact-gate-declined.md
---

# ADR-287 — The estate shrinks by finishing, not by capping

## Context

The size of the active roadmap estate has been raised as a risk nine times.
`agents/roadmaps/stubs/road-to-consumer-capability-share.md` carries the
count, and round `inbox-2026-10-t` added the ninth arrival together with two
conflicting proposals for a work-in-progress limit — **12** in one supplied
plan, **8** in another, neither derived from a measurement.

The question had never been put to the owner as a decision. It had been
circled twice from the other side: an AI council **declined** a ratio ratchet,
and `ADR-253` **declines** a per-PR user-artifact gate. Both refusals are
about mechanisms, and neither answers whether the estate should be bounded at
all.

### The state the ruling was taken against

Measured at `4b655be8c`, 2026-10-16, from `agents/roadmaps-progress.md` and a
count over `agents/roadmaps/*.md`:

| | |
|---|---|
| Active (non-draft) roadmaps | **30** |
| Steps, done / total | **98 / 860 — 11 %** |
| Open steps | **762** |
| Open blockers in the active tree | **15** |
| Overdue stubs | **43** |
| Owner decisions waiting | **13** |

The same round added eight roadmaps to that estate in one change, every one of
them carrying an `estate_offset_exempt` claim, which moved the ratchet floor
from 22 to 30 without anything objecting. That is what made the question
urgent rather than perennial.

### What was offered

Three options went to the owner: a hard cap of 12, a hard cap of 8, or no
count limit with the per-change exemption bounded so each new roadmap costs an
existing one. All three required closing or parking roadmaps.

## Decision

### D1 — There is no work-in-progress cap on the active roadmap estate

Not 12, not 8, not any number. The count of active roadmaps is not a budget
and no gate may treat it as one.

### D2 — Parking is not an estate-management device

A roadmap moves to `later/` because its own work is blocked on a condition it
names, and for no other reason. "The estate is large" is not a wake condition,
so it may not produce one. The same holds for `skipped/`: a decision against
pursuit, never a decision about volume.

### D3 — The estate shrinks by completion

The only sanctioned way for the active count to fall is roadmaps being
finished and archived. This is the whole of the ruling, and the two clauses
above are what it rules out.

### D4 — `check_estate_count` is untouched, because it is not a cap

The gate measures the estate against the base ref's own floor and refuses
**silent growth**; it has never forced a parking and does not become a cap
under this record. Its escape, `estate_offset_exempt`, stays unbounded —
deliberately, because bounding it was option 3 and option 3 was declined. An
added roadmap still owes a written reason, which is what the gate is for:
growth is now a thing somebody chose and wrote down, not a thing that may
happen quietly.

## Consequences

**The binding constraint moves, and this is the point of the record rather
than a side effect.** With no cap and no parking, the number that decides
whether this estate is healthy is not 30 — it is 762 open steps against 98
done, and the 15 blockers plus 13 owner decisions that stand between some of
those steps and anyone working them. An estate that may only shrink by
finishing is an estate whose real bottleneck is throughput and the owner
queue. Nothing in this record improves either; it says plainly which number to
watch.

**The accepted risk, named rather than discovered later.** Unbounded growth is
now permitted by decision. A later round may add eight more roadmaps with
eight more exemption reasons and no gate will object, because this record
removed the only lever that would have. The `review_trigger` above states the
reading that would falsify the premise — a growing estate whose done-count
does not move — and deliberately installs no instrument to produce it. An
automatic reading would be a cap by another route.

**Unchanged:** every safety floor; the council's refusal of a ratio ratchet;
`ADR-253`'s refusal of a per-PR gate; the shrink-only measurement in
`check_estate_count`; the obligation on every added roadmap to carry its
reason.

**Closed:** the WIP half of the recurring ask. Arrival ten meets this record
instead of a fresh argument.

**Still open, and NOT answered here:** the other half of that stub — whether
the next cycles go to consumer capability or to self-governance. Its three
options stand unanswered, and this ruling is about volume, not about subject.

## Alternatives considered

**A hard cap at 12 or 8 (options 1 and 2 as offered).** Declined by the owner.
Both required parking 18 or 22 roadmaps today on no stated criterion; the
numbers came from two supplied plans that disagreed with each other and
neither derived its figure from anything. A cap also answers the wrong
question: it bounds how much is *planned*, while the measured problem is how
little is *finished*.

**Bounding the per-change exemption (option 3 as offered).** Declined. It is a
cap expressed as a rate rather than a level — each new roadmap would have cost
an existing one, which is the closing-or-parking the owner rejected.

**A ratio ratchet on governance-versus-consumer work.** Already declined by an
AI council before this round, on its own evidence. Not reopened here; it is a
different question wearing the same complaint.

## Evidence

- **The recurrence and its count.**
  `agents/roadmaps/stubs/road-to-consumer-capability-share.md` — nine arrivals
  recorded, the ninth added by round `inbox-2026-10-t` with the two
  conflicting WIP numbers.
- **The measured state.** `agents/roadmaps-progress.md` at `4b655be8c`:
  "30 open roadmaps · 98 / 860 steps done · 11% · 15 open blockers in the
  active tree · 43 overdue stubs, 13 owner decisions". The open-step figure is
  the difference, re-derived by counting `- [ ]` across `agents/roadmaps/*.md`.
- **The floor that moved.** `check_estate_count` reported
  `active_roadmaps 22 → 29` and then `30` across the round's three changes,
  each authorised by an `estate_offset_exempt` claim written in the same diff.
- **The two prior refusals this record does not disturb.** The council's
  declined ratio ratchet and `ADR-253`'s declined per-PR gate, both recorded
  on the stub.

## References

- `agents/roadmaps/stubs/road-to-consumer-capability-share.md` — the stub
  carrying the recurrence; its consumer-share question stays open.
- `src/scripts/check_estate_count.ts` — the shrink-only measurement D4 leaves
  in place.
- `docs/decisions/ADR-253-per-pr-user-artifact-gate-declined.md` — the adjacent
  refusal.
- `docs/decisions/ADR-286-discoverability-is-a-goal-asking-is-not.md` — the
  other owner ruling taken in this round.

## History

- **2026-10-16** — accepted. Owner ruling, taken in round `inbox-2026-10-t`
  after three capping options were offered and all three declined in the same
  sentence: the roadmaps are to be finished, not closed or parked.
- **2026-10-16, later the same day — one figure in § The state the ruling was
  taken against is corrected, and the correction strengthens the record rather
  than disturbing it.** The table reads **15** open blockers in the active tree,
  taken from `agents/roadmaps-progress.md`. A sweep that counted `## Blockers`
  entries whose `Status:` does not begin `resolved` returns **20**, and executed
  each one's own `Resolved when` clause rather than trusting the field:
  `agents/evidence/analysis/active-blocker-disposition-20261016.md`. **The table's
  15 is not an error** — the dashboard excludes `status: draft` roadmaps, and the
  five it leaves out are exactly the difference; the wider count is recorded here
  because a blocker in a draft roadmap is still a decision somebody owes, and
  three of those five are `Class: 3` human-only. None of the twenty had gone
  stale. Three were closed by council that day; of the seventeen that
  remain, eleven wait on an owner decision for which a recommendation is already
  written. The Decision is untouched — a larger blocker count makes
  § Consequences' claim that the binding constraint is the owner queue more
  exact, not less.
