---
complexity: lightweight
review_by: 2027-02-28
parent_roadmap: road-to-experience-loop-broadening
estate_growth_exempt: The two later/ receivers are mechanically required by the archival contract to express a carried deferral (council 2026-08-30, 2/2, carry not cancel); without them Iron Law 3 blocks the archive and three criteria would have to be cancelled instead, which is the information loss this gate exists to prevent.
estate_offset_exempt: >-
  Added as the mechanically required receiver of a carried deferral, not as a
  new plan. Iron Law 3 forbids archiving road-to-experience-loop-broadening with
  an unresolved [~]; the AI council (2026-08-30, anthropic + openai, 2/2)
  resolved all three deferrals to CARRY rather than cancel; and
  archive_completed_roadmaps accepts a carry destination only under
  agents/roadmaps/ or agents/roadmaps/later/ with a parent_roadmap back-link --
  so the carry cannot be expressed without this file existing. The alternative
  was cancelling three criteria, which is both the information loss this gate
  exists to prevent and an owner-reserved decision.
---

# Road to the experience loop's two owner-reserved decisions

> **Parked in `later/` — blocked on an external trigger, not on effort.** Carries the two deferred steps out of
> `road-to-experience-loop-broadening`, which closed 2026-08-30 as
> *implementation complete; operational validation deferred*. Both rest on
> decisions **no council may take**, which is why they left the roadmap rather
> than being resolved inside it. AI council 2026-08-30, anthropic + openai,
> 2/2: closing with these two `[~]` is legitimate provided their status and
> blockers travel with them. This file is that travel.

## 7.6 — Incremental card updates rather than rewrites

Carried verbatim:

> **7.6 Incremental card updates rather than rewrites.** Deferred: needs E8.
> `from-skipped-parent` promoted `ADD / UPDATE / REMOVE` delta-updates from
> optional to core, with a reflector/curator split whose boundary is "the model
> may interpret evidence; it may not rewrite the evidence".

**Blocked on:** decision **E8** — state-taxonomy arity, 4 classes or 5. An open
maintainer decision on the parent roadmap, unresolved at closure.

**What shipped without it:** the card mechanism itself (steps 7.1–7.5) —
admission gate, the falsifier/expiry/epistemic-type contract, narrowing-only
failures, and the one-rung scope ladder. Nothing the parent roadmap promised is
blocked on 7.6; it is an enhancement to how a card is *updated*, and cards are
currently written whole.

**Promotion probe:** E8 is decided, in either direction.

## 9.6 — The Class-C question

Carried verbatim:

> **9.6 The Class-C question, as an owner decision.** May selection or routing
> consume experience at runtime? Reading it at runtime means deleting it changes
> *what* the system does, which the state-store test classifies Class C. Without
> an owner yes it stays a report.

**Blocked on:** the `runtime-consumption-of-experience` blocker, which is
`resolved` as *(c) defer until 9.4 has a measured effect*. 9.4 is committed as a
**pre-registration with no run behind it**, so that condition has not fired.

**The half that is owner-reserved, and why no council closes it.** Options (a)
grant runtime consumption and (d) an observed/derived-only filter both cross
`docs/contracts/no-runtime-boundary.md`'s recorded architectural boundary. A
council may recommend crossing it and may not authorise it — recorded 2026-08-29
by anthropic + openai, 2/2, with openai volunteering the point unprompted.

**Why keeping it deferred is what makes AC-7 true.** AC-7 — *nothing in any
selection or routing path imports the experience report* — holds precisely
because this stays a report. Step 6.3's test enforces the import boundary over
twelve enumerated routing paths. Resolving 9.6 the other way is what would
require that test to change, which is the visible act the boundary deserves.

**Promotion probe, in two conjuncts (the blocker's own `revisit-if`):** step 9.4
demonstrates a reproducible efficacy gain **measured externally**, AND a proposal
exists naming an observed/derived-only filter with rollback criteria. At that
point it goes to the owner, not to a council.

## See also

- `agents/roadmaps/stubs/road-to-experience-lifecycle-operational-proof.md` —
  the sibling stub carrying AC-9, which needs elapsed time rather than a
  decision.
- `src/scripts/_lib/experience_card.ts` — 7.1–7.5's shipped contract.
