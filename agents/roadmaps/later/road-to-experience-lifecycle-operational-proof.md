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

# Road to operational proof of the experience-card lifecycle

> **Parked in `later/` — blocked on an external trigger, not on effort.** Carries **AC-9 verbatim** out of
> `road-to-experience-loop-broadening`, which closed 2026-08-30 as
> *implementation complete; operational validation deferred*. AI council
> 2026-08-30, anthropic + openai, **2/2 convergent on (b)**: descope rather than
> re-scope.

## What moved here, verbatim

> AC-9 — At least one repeated-failure pattern has produced a reviewed card, and
> at least one card has been either promoted through `learning-to-rule-or-skill`
> or expired — so the lifecycle closes in both directions rather than only
> accumulating.

## Why it was not re-scoped

The tempting repair was to rewrite AC-9 as a claim about the *mechanism* — a
card can be promoted, a card can expire, both demonstrated by test. Both council
seats refused it, and the reason is the distinction the criterion exists to
hold: **"can close" is not "has closed"**. The mechanism is built and exercised
(steps 7.1–7.5, with tests covering admission, the falsifier/expiry/epistemic
contract, narrowing-only failures and the one-rung ladder). What has not
happened is a real card completing a real lifecycle, and no amount of work
today produces it.

## Why it cannot be met by effort

1. **No failure pattern exists to mine.** `extract_audit_patterns --min-count 2`
   over the full 935-line audit stream mints exactly one pattern,
   `implement:success:delegation-policy`, count 914. Authoring a failure card
   without a backing pattern is the invented card step 7.1 exists to refuse.
2. **Nothing can have expired.** The card store was created on 2026-08-30 and
   its one card carries `expiry: 2027-02-28`. Promotion past `repo` needs
   held-out or independent transfer evidence, which only accumulated runs
   produce.

## Promotion probe — data quality FIRST, then the lifecycle

The council's substantive addition, and the reason this stub is not simply
"wait": a follow-up gated only on elapsed time never closes if the sensor cannot
record what it is waiting for.

```
GATE 1 (DATA QUALITY, checked first): the `outcome` field has recorded at least
one NON-SUCCESS, NON-SKIPPED value end-to-end, from a controlled event.

GATE 2 (LIFECYCLE, only once gate 1 passes): the audit store holds a
non-success pattern signature at count >= 2 across independent `work_id`s, a
reviewed admitted card derived from it exists, AND the card store holds either a
real promotion transition or a card whose expiry has passed.
```

**What the corpus actually shows, measured 2026-08-30 — and it is NOT what the
council hypothesised.** Both seats suspected `outcome` might be a producer
constant like `rules_applied`. It is not. The distribution is `success` 914 +
`skipped` 29, and each value is written by a different producer at a different
phase: `implement:success` from `orchestration_record.ts`, `report:skipped` from
`review_skipped_record.ts`. The field is **capable** of variation —
`envelopeOutcome` maps four outcomes and step 2.2 added a fifth path — but the
observed distribution is degenerate: one pair per producer, no non-success ever
recorded.

So the honest state is narrower than "the sensor is broken" and wider than
"there was nothing to learn": **the field can vary and never has**, and gate 1
is what distinguishes those two. Until it passes, a wait on gate 2 is a wait on
a signal nothing has yet demonstrated the stream can carry.

## What this stub does NOT carry

The card mechanism itself. Steps 7.1–7.5 shipped and are not reopened here.
AC-10's removal also shipped, motivated by a real mined pattern — so the loop
has demonstrably produced *a* card and *a* removal. What is outstanding is
narrowly the **failure** half and the **lifecycle close**.

## See also

- `agents/knowledge/experience-rules-applied-is-a-producer-constant.md` — the
  card the loop produced, and the precedent for what gate 1 would confirm.
- `src/scripts/_lib/experience_card.ts` — the contract this stub's cards obey.
- `src/scripts/_lib/audit_field_provenance.ts` — where a confirmed second
  constant field would be recorded, if gate 1 fails that way.
