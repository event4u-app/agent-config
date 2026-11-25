<!-- evidence-type: analysis -->

# Owner directive — a follow-up roadmap for owner overrides that block releases

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-11-25 |
| Scope | one roadmap, `road-to-owner-overrides-that-do-not-block-releases`, added as active above the WIP cap of 25 (`WIP_CAP` in `src/scripts/_lib/estate_wip.ts`) |
| Grants by itself | that this addition may be exempted from one-in-one-out and the WIP cap. It lowers no test, CI gate or Hard-Floor obligation, and it decides none of the questions the roadmap puts to the council or the owner |

**Context.** A release dispatch of `main` on 2026-11-25 was refused. PR #3037
had been merged by the owner over a red ratification step (an override of a
split council, ADR-282). That merge left the required check on `main`'s tip
red, and the release job's source-check gate refused on it. Two options were
put to the owner: record the override and unblock the release, or revert #3037.
The owner chose the first and asked for a follow-up roadmap. Owner, verbatim:

> 1 - Und dann erstelle eine folgeroadmap, dass wir das problem dauerhaft beheben müssen <!-- md-language-check: ignore -->

Translated: "1 — and then create a follow-up roadmap so that we fix the problem
permanently."

## What it authorises

1. **`road-to-owner-overrides-that-do-not-block-releases`, active.** Its
   `estate_offset_exempt` and `estate_growth_exempt` reasons may cite this
   record, so `check_estate_count` honours them above the WIP cap.
2. **Nothing else.** The roadmap's release-gate rule is decided in its own
   phase, by council or owner. This record does not choose it.
