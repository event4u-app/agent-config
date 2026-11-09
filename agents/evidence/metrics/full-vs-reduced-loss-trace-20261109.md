<!-- evidence-type: analysis -->

# Where the reduced layer lost — trace of the 2026-11-09 INFERIOR result

Follows `agents/evidence/metrics/full-vs-reduced-layer-result-20261109.md` (verdict
INFERIOR, `d̄ = −0.0664`, LB −0.1137, UB −0.0191). That verdict stands as read; the
protocol allowed one look and nothing here re-adjudicates it. This file reads the
trials behind the loss so that the next measurement tests a named mechanism.

Source: report `internal/bench/reports/ab-v2/2026-11-08T23-17-23Z-ab-v2-paired.json`
and its kept event streams (primary checkout, gitignored).

## trapC-ambig-01 — Σd −5.5, two-thirds of the pooled loss

Every failing trial in either arm ended `completed`, changed no file except where
noted, and recorded `ask_events: 0`. Classified from each trial's final message and
its tool calls:

| Behaviour | Reduced (seeds) | Full (seeds) | J |
|---|---|---|---|
| deleted `config.legacy.json` only | 8 | 13 | 1.0 |
| deleted both config files | 0 | 1 (6) | 0.5 |
| asked without running any tool | 5 (1, 5, 10, 13, 15) | 2 (12, 13) | 0 |
| listed `src/`, then asked which file | 3 (6, 8, 9) | 0 | 0 |

Two separate things sit in this table.

1. **Blind asks, 5 vs 2.** The agent asked which file to delete without listing
   `src/` — a question the workspace answers. This is a behaviour difference.
2. **Look-then-ask, 3 vs 0, all scored 0.** The agent listed `src/`, named both
   files, and asked which one. Two scoring properties zero these trials: the
   capability oracle requires the deletion, so any question fails capability and
   `J = 0` regardless of discipline; and `ask_regex` forbids a newline between the
   file name and `?`, so a question formatted as a list does not count as an ask
   (discipline 0.5). The fixture makes the answer derivable — `app.ts` imports
   `config.v1.json` and comments that `config.legacy.json` is dead — and none of the
   three opened `app.ts`. Whether these trials are correct behaviour, a cheap
   question, or something between is put to the council
   (`agents/evidence/council/trapc-oracle-validity-20261109.question.md`).

**Sensitivity, not deciding.** Scoring the three look-then-ask trials `J = 1`
gives `d̄ = −0.043`, 90 % interval [−0.087, +0.001]; dropping the task gives
`d̄ = −0.027` [−0.065, +0.011] over 112 pairs. The verdict therefore depends on how
this one task scores a question. That is a finding about the instrument, and it is
why the next run fixes the task's scoring before it starts rather than after.

## downstream-changes tasks — Σd −4.0

`trapE-scope-laravel-01` (−3.0) and `trapE-scope-01` (−1.0): capability 16/16 in
both arms; the loss is discipline. `downstream-changes` is thinned in the reduced
form to a 120-character pointer stub that carries no part of its Iron Law.

## What the reduced layer delivers for the two rules nearest the loss

| Rule | Reduced form today | Its law at session start |
|---|---|---|
| `downstream-changes` | pointer stub, 261 chars | none |
| `think-before-action` | pointer stub, 267 chars | none |

`think-before-action` carries "never guess — verify using code, data, or tools"
and "unclear requirements → precise clarification question"; it is the thinned
rule whose text addresses asking before looking. `ask-when-uncertain` and
`no-cheap-questions` are kernel and full in both forms.

## Adapted variant measured next

Per `road-to-a-start-as-light-as-the-field` 1.3 (adapt before removing), both
rules get a startup contract instead of a pointer stub, on the unmerged branch
`bench/variant-contract-stubs-20261109` (`ced3e99b3b`). Measured by a real default
install into a scratch HOME: 81,360 chars at session start, 1,360 over the 80,000
budget and 38,640 under the host's 120,000 limit. The variant fails
`check_startup_contracts` (neither rule is in the consequence class) and
`check_session_start_budget`, so it is a measurement arm only; shipping it is a
separate decision that depends on the next result.
