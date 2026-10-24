<!-- evidence-type: analysis -->

# Owner directive — AC-4 takes the shipped `action` wording

| Field | Value |
|---|---|
| Ordered by | the repository owner, in their own session prompt |
| Date | 2026-10-24 |
| Scope | `road-to-a-release-that-says-whether-it-needs-you` AC-4 |
| Source of the order | the owner's answer to the numbered question on AC-4, put to them in the orchestrating session of the 2026-10-24 roadmap drain |
| Grants by itself | the amendment named below, nothing else |

## The instruction, verbatim

> 1

## What it answers

The council split on 2026-10-18 (`agents/evidence/council/release-impact-ac4-wording-20261018.md`)
on whether the criterion's text may follow the shipped behaviour; both seats held
the behaviour itself right. Option 1 was: amend AC-4 to the shipped `action`
form and close it. The ordered wording `openai` proposed is adopted verbatim.

## Precondition `openai` set, checked before the amendment

`npx vitest run tests/lib/classify_update.test.ts` → 69 passed on 2026-10-24: the
matrix size floor (≥ 40) and the ordered engines rule (`action` unless suppressed
or no newer candidate) are each asserted.
