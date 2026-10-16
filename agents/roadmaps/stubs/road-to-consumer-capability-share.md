---
complexity: structural
review_by: 2026-11-06
probe: none
---

# Stub: the governance-vs-consumer share is measured and has never been acted on

> **Arrivals:** 9 (at least) — latest `inbox-2026-10-t` (2026-10-16): two parallel
> analyses again ask that cycles go to consumer capability rather than to
> self-governance, and supply two conflicting WIP numbers (12 and 8) for the
> active-roadmap estate. The count before it read: 8 (at least).


> **Stub — not active work.** The measurement half shipped and was archived
> (`agents/roadmaps/archive/road-to-meta-ratio-measured.md`); the AI council
> that supplied its mechanism explicitly **declined** a ratio ratchet, and
> `ADR-253` declines a per-PR user-artifact gate. What no object in this estate
> holds is the half the reviewers keep asking for: a decision to spend the next
> cycles on consumer capability rather than on self-governance. That is a
> prioritisation call about what this package is for, which is owner-reserved
> under `decision-revisit-gate`'s reserved set — an agent may neither take it
> nor keep re-deriving it from zero every round.

> **Arrivals:** 8 (at least) - latest `inbox-2026-10-m` (2026-10-12): at least six of nineteen 16.4.0 release reviews read the published 38 vs 1 as the main risk and ask again for a consumer-value budget; the published line now reproduces, and `measure_release_mix --from 16.3.0 --to 16.4.0` prints `consumer 1 · governance 42 · maintenance 1 · mixed 41`, the 41 being the bucket the published line used to omit — `road-to-what-a-release-says-about-itself` step 2.1 shipped on 2026-10-13, so the line now reads `governance-only N vs consumer-only M (mixed K, maintenance L; …)` and names every bucket. No new mechanism proposed; the owner question below is unanswered. The count before it read: 7 (at least) - latest `inbox-2026-10-e` (2026-10-06): four of fifteen release reviews of 16.3.0 read the governance mix as the main risk and ask for a consumer-value budget; the published 23 vs 1 does not reproduce (`measure_release_mix --from 16.2.0 --to 16.3.0` prints 83 vs 3), no new mechanism proposed. The count before it read: 6 (at least) — corrected upward from 3 on 2026-09-11 by round
> `inbox-2026-09-y`, which subject-matched three further prior rounds this line
> had not counted. Latest `inbox-2026-09-y` (2026-09-11); before it
> `inbox-2026-09-q` (2026-09-06) and `agents/tmp.old/inbox-2026-09-e/` (the round
> that produced the measurement roadmap, itself recording two consecutive prior
> cycles that neither built nor declined). This counter exists so the seventh
> round meets a number instead of a fresh argument.
>
> **What the seventh round will meet if nothing changes.** The mix was 62:13 at
> release 14.23.0 and 76:10 at 15.0.0 — the ratio moved further from the
> direction five earlier readings asked for. The three options below are
> unchanged and still unanswered; the count sets the venue, never the verdict.

## The measured state at `99d14b2e7`

- `CHANGELOG.md:496` — 14.18.0: governance-only **55** vs consumer-only **16**
  (taxonomy 1.0.0), a ratio of 3.44 : 1.
- `docs/archive/CHANGELOG-pre-14.18.0.md:26` — 14.17.0: **31** vs **13**, 2.38 : 1.
- The obligation to answer the mix is enforced pre-push by
  `src/scripts/check_release_highlights.ts`; the ratio itself is gated by nothing,
  deliberately.

## The owner question, posed rather than parked

Six arrivals so far, and no answer is recommended here. Which of these is the
intent for the next two cycles?

1. **Deliberately consumer-heavy** — the next release heads are expected to
   invert the mix, and a head that does not says why. No threshold, no gate.
2. **Accept the current shape** — self-governance is the product for now; the
   measurement stays published and the recurring criticism is answered once with
   that reason, and closed.
3. **Rolling window instead of per release** — measure the mix over the last
   five releases so a single governance-heavy cycle is not read as a trend.

None of the three is agent-decidable. Recording the answer here closes the
recurrence; recording nothing has produced six arrivals so far.

## What this stub is NOT

Not a proposal to build a ratio gate — that was measured, put to the council,
and declined; re-proposing it without new evidence is the mechanism-match
failure `decision-revisit-gate` names. Not a claim that the current mix is
wrong. It records a question with a count on it.
