---
complexity: structural
review_by: 2026-11-06
probe: none
---

# Stub: the governance-vs-consumer share is measured and has never been acted on

> **Stub — not active work.** The measurement half shipped and was archived
> (`agents/roadmaps/archive/road-to-meta-ratio-measured.md`); the AI council
> that supplied its mechanism explicitly **declined** a ratio ratchet, and
> `ADR-253` declines a per-PR user-artifact gate. What no object in this estate
> holds is the half the reviewers keep asking for: a decision to spend the next
> cycles on consumer capability rather than on self-governance. That is a
> prioritisation call about what this package is for, which is owner-reserved
> under `decision-revisit-gate`'s reserved set — an agent may neither take it
> nor keep re-deriving it from zero every round.

> **Arrivals:** 3 (at least) — latest `inbox-2026-09-q` (2026-09-06); earlier:
> `agents/tmp.old/inbox-2026-09-e/` (the round that produced the measurement
> roadmap, itself recording two consecutive prior cycles that neither built nor
> declined). This counter exists so the fourth round meets a number instead of
> a fresh argument.

## The measured state at `99d14b2e7`

- `CHANGELOG.md:496` — 14.18.0: governance-only **55** vs consumer-only **16**
  (taxonomy 1.0.0), a ratio of 3.44 : 1.
- `docs/archive/CHANGELOG-pre-14.18.0.md:26` — 14.17.0: **31** vs **13**, 2.38 : 1.
- The obligation to answer the mix is enforced pre-push by
  `src/scripts/check_release_highlights.ts`; the ratio itself is gated by nothing,
  deliberately.

## The owner question, posed rather than parked

Which of these is the intent for the next two cycles?

1. **Deliberately consumer-heavy** — the next release heads are expected to
   invert the mix, and a head that does not says why. No threshold, no gate.
2. **Accept the current shape** — self-governance is the product for now; the
   measurement stays published and the recurring criticism is answered once with
   that reason, and closed.
3. **Rolling window instead of per release** — measure the mix over the last
   five releases so a single governance-heavy cycle is not read as a trend.

None of the three is agent-decidable. Recording the answer here closes the
recurrence; recording nothing has produced three arrivals so far.

## What this stub is NOT

Not a proposal to build a ratio gate — that was measured, put to the council,
and declined; re-proposing it without new evidence is the mechanism-match
failure `decision-revisit-gate` names. Not a claim that the current mix is
wrong. It records a question with a count on it.
