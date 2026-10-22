# The cross-model canary's uniform zero — classified

<!-- evidence-type: analysis -->

> **Produced on** `feat/subagent-system-2583`, 2026-10-22, for step 0.1 of
> `road-to-free-hands-a-paid-head-checks` (defect D8). Read from the uploaded
> `trigger-eval-rotation` artefacts of the scheduled `cross-model-canary.yml` runs, downloaded
> with `gh run download`, and from the failing step's log.

## The classes

A suite's score can be zero for three different reasons, and the step needs each run named:

- **answer scored wrong** — the model answered and the routing missed;
- **empty answer** — the model answered with no skills;
- **no call at all** — no request was answered, and the router's error path recorded "no skill
  loaded, zero tokens".

The result JSON carries `input_tokens` and `output_tokens` per suite; a suite with zero on
both had no answered call.

## Per scheduled run

| Run | Date | Suites | Suites with 0 input tokens | Scored as | Class |
|---|---|---:|---:|---|---|
| 39246020072 | 2026-10-19 | 14 | 14 | precision 0 / recall 0, all 14 | **no call at all** |
| 38259344262 | 2026-10-12 | 12 | 12 | precision 0 / recall 0 | **no call at all** |
| 37314182466 | 2026-10-05 | 5 | 5 | precision 0 / recall 0 | **no call at all** |
| 36421723953 | 2026-09-28 | 5 | 0 | real answers, recall below floor | answer scored wrong |
| 35594461434 | 2026-09-21 | 5 | 0 | real answers, recall below floor | answer scored wrong |
| 34837504719 | 2026-09-14 | 5 | 0 | precision 1.0, recall 0.6-0.8 against a floor of 1 | answer scored wrong |
| 34114844799 | 2026-09-07 | 5 | 0 | real answers, recall below floor | answer scored wrong |
| 33390681739 | 2026-08-31 | 5 | 0 | precision 1.0, recall 0.4-0.8 | answer scored wrong |

The 2026-10-19 run completed fourteen suites in nineteen seconds (log lines 11:38:26 to
11:38:45) — the duration of fourteen failed requests, not of fourteen answered ones.

## The mechanism

`AnthropicFetchRouter.routeAsync` (`src/scripts/_lib/trigger_routers.ts`) returns
`[[], 0, 0]` on a non-OK response and on a thrown fetch, which `run_eval_async` scores as
"observed: false" for every query. A dead key, an exhausted credit balance or a 401 therefore
reads as a routing regression at precision 0 / recall 0. The HTTP status is not kept, so the
artefact cannot say which of those it was; the account's API credit is the leading
candidate, because the same account's API rung ran dry for the council in the same period
(owner note of 2026-10-07: run the council through the CLI, the API account has no credit).

## What changed with this step

`run_rotation` now marks a live suite with no usage on any call `answered: false`, still fails
it, and prints `NO ANSWER — the router returned no usage on any call` instead of a precision
figure (`tests/scripts/trigger_eval_rotation.test.ts` › marks a live suite whose router never
answered as unanswered). The September reds are a separate, real finding: precision 1.0 with
recall under a floor of 1, which is a floor question, not a transport one. Phase 5's liveness
design starts from these two classes.
