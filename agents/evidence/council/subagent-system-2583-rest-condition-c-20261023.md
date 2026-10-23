<!-- evidence-type: analysis -->

# Condition (c) of the worker-reuse decision: keep it and add a pre-registered second reading (split council, default applied)

AI council, 2026-10-23. anthropic + openai seats, CLI, subscription-authed, USD 0.00, one round
each, 2/2 present in both runs. Prompts committed verbatim beside this file:
`subagent-system-2583-rest-condition-c-20261023.question.md` and
`subagent-system-2583-rest-condition-c-r2-20261023.question.md`. Raw responses:
`agents/runtime/council/responses/subagent-system-2583-rest-condition-c-20261023.md` and
`…-r2-20261023.md` (local, gitignored).

## The question

Condition (c) of `decideWorkerReuse` (`src/scripts/_lib/worker_reuse.ts:102-103`) compares a
stopped worker's whole transcript (about 7,000 tokens in the 2026-10-22 window) with the fresh
first call's **written-or-uncached** tokens (median 863.5, which excludes the 84 % cache-read
prefix). Over 81 complete joins it refused every resume (`transcript_over_cold_start` 64,
`no_candidate` 17), while the pre-registered claims read the resumes as cheaper (ratio 0.170) and
no worse (+10.9 pp).

## Verdicts — not convergent

| Round | anthropic | openai |
|---|---|---|
| 1 | (b) remove (c) now | (d) keep (c), add a pre-registered second reading |
| 2 | (d) | (b) |

Both seats, in both rounds, agree on three things:

- the comparison sets two unlike quantities against each other — a real defect, not a tuning
  question;
- the filed reading stays, labelled as the result of the policy as implemented: "0/81 complete
  joins eligible … does not establish that reuse was more expensive or lower-quality than a fresh
  start";
- a corrected, like-for-like reading is computed over the same window and labelled separately.

They disagree on whether the shipped function changes now. Removing (c) after a reading it
produced risks tuning to the data (the round-2 anthropic seat); keeping a known apples-to-oranges
comparison gives it unearned standing (the round-2 openai seat).

## Applied

A split is not a council decision. The choice is reversible and the guard is shadow-only, so the
run applied the default nearest the status quo that also contains everything both seats agree
on — option (d): `worker_reuse.ts` is unchanged; the report computes a second reading,
`c_like_for_like` (transcript tokens against the fresh first call's **total** input, cache-read
included), labelled as pre-registered on 2026-10-23 after the primary window, for information
only; the decision on (c) waits for a later window that was not used to choose it. Listed for the
owner in the PR as a non-convergent council question.

Counter-condition named by both sides: a long cache-read context may cost latency or quality that
the token figures do not capture, so neither reading alone settles (c).
