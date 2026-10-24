<!-- evidence-type: analysis -->

# Free-hands shadow window, 2026-10-23 to 2026-10-24

The pre-registered shadow window of `road-to-free-hands-a-paid-head-checks` 6.2, run once by the
harness `internal/bench/free-hands-shadow/run.ts` against the PREREG
`internal/bench/free-hands-shadow-PREREG.md`. Corpus ref `44493165`, verifier `fhs-verify/1`.
Paid arm: `haiku` through the subscription CLI. Free arm: the keyless route
`text.pollinations.ai/openai`, served id `gpt-oss-20b`. Spend USD 0.00 on both arms. The owner
approved the egress after a payload audit (666 payloads, 0 secret findings).

The generated summary is `internal/bench/reports/free-hands-shadow.md`. This file records what the
generated summary does not: how the window ran, and every row that is not a clean pass/pass. The raw
ledgers live under the gitignored `agents/runtime/bench/free-hands-shadow/`.

## Result

| kind | calls | paid pass | free pass | quality bar | relief bar | audit agreement | flip |
|---|---|---|---|---|---|---|---|
| classify | 333 | 97.9 % | 96.7 % | met | met | 98.5 % of 66 | ready |
| extract | 333 | 100.0 % | 92.2 % | not met (free 7.8 % > paid 0.0 % + 5 pp) | met | 98.5 % of 65 | not ready |

Every one of the 666 calls carries a paid and a free answer, each with a deterministic verdict —
the 6.2 verify condition. The blind audit asked 136 questions, 5 stayed unanswered, and 2 disagreed
with the deterministic verdict, both on the free side; the deterministic verdict stays the record.

## Rows that are not a clean pass/pass

| outcome | count | ids or note |
|---|---|---|
| free `server_error` (route 5xx) | 24 | 23 extract, 1 classify |
| free answered, failed verification | 10 | 9 classify, 1 extract |
| free `other` | 2 | extract |
| free `billing` (402 `FREE_LIMIT`) | 1 | `classify:docs/decisions/ADR-275-…` at 05:12:05Z, the fourth call: pacing counted from the start of the previous free call, not from its reply; fixed red-first before the window continued |
| paid failed, free passed | 7 | classify only: `meta/skills/command.md`, `emphasis-budget.md`, `eloquent/SKILL.md`, `notes-first-reasoning.md`, `scope-growth-ownership.md`, `feature/refactor/command.md`, `frugality-charter.md` |

Five of the seven paid failures stopped the run ("the paid arm returned nothing"); a bounded restart
loop resumed it each time from the next uncalled item, so no item was asked twice.

**Extract misses its quality bar on availability, not on content.** Of the 26 free extract failures,
23 are route 5xx, and only 3 are wrong or unusable answers. The PREREG counts every free failure
against the bar, and that definition stays fixed for this window; separating transport failures
from answer failures is a change for a new, pre-registered window.

## The aborted first start

The first start on 2026-10-23 wrote two rows before stopping on `policy_model_mismatch`: the
route lists `openai-fast` and serves `gpt-oss-20b`. Both ledgers of that start were set aside as
`*.aborted-served-id-20261023T0449.jsonl` and are not part of the window. The fix (decision A16:
probe the served id once, keep the exact match) landed before the window restarted.

## AC-3

One typed classify ask (`classify:src/rules/laravel-translations.md`) through the production
chooser, 2026-10-24 05:15:43Z: served by `hands`, `route_billing: free-quota`, served model
`gpt-oss-20b`, deterministic verdict `pass`. Recorded in `ac3-demo.json` beside the ledger and in the
orchestration telemetry.

## Running it again

The run-local council file must lift the paid-CLI counter, which defaults to 50 calls a day; one
window plus its audit needs 802. `internal/bench/free-hands-shadow/council.example.yml` now carries
`cli_call_budget.max_calls_per_day.anthropic: 1000`, and a harness test pins it above that sum.

The corpus ref is the last commit touching the PREREG. Archiving the roadmap rewrote one link in the
PREREG, so the ref has moved past `44493165`: this window cannot be resumed, and the next window
starts from its own pre-registration.
