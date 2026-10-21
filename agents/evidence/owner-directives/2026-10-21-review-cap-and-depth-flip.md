<!-- evidence-type: analysis -->

# Owner directive — a five-round review cap, and a depth flip on structurally safe paths only

| Field | Value |
|---|---|
| Ordered by | the repository owner, in their own session prompt |
| Date | 2026-10-21 |
| Scope | `road-to-a-review-that-ends` blocker `review-round-cap-is-an-owner-contract-change`; `road-to-a-step-that-costs-what-it-changes` blocker `class-depth-flip-reopens-the-risk-null` |
| Source of the order | the owner's answer to the two numbered questions put to them in the session that executed both roadmaps |
| Grants by itself | the two transitions named below, nothing else |

## The instruction, verbatim

> 2 - 5 Runden, und flippe nur die strukturell sicheren Pfade

## What it answers

1. **"2 - 5 Runden"** answers the round-cap question with option **(b)**: the
   completion review is capped at five rounds, with the severity gate of
   `road-to-a-review-that-ends` step 1.1. The leading "2" is the option number of
   that question's block, in which option 2 read "5 Runden".
2. **"flippe nur die strukturell sicheren Pfade"** answers the depth-flip question
   with option **(d)**: depth may be lowered only for steps whose changed paths are
   all documentation, roadmap or evidence prose, or test fixtures, on the same
   shadow threshold (D14 (2)); option (a) is decided later on step 4.3's samples.

## What it does not grant

- The flip is conditional, not immediate. Option (d) keeps "the same shadow
  threshold": no depth is lowered before the shadow reading meets D14 (2) for the
  class concerned.
- Nothing about R2/R3 depth, and nothing about rule delivery (step 4.2).
- The mechanism of the cap (passes, not re-binds; the archive keeps the count) is
  an agent decision recorded in ADR-294, routed to the council on 2026-10-21; the
  owner set the number and the severity gate only.
