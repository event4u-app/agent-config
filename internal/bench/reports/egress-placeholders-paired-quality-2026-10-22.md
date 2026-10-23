# Egress placeholders — paired task quality (PREREG endpoint e)

Pre-registration: `internal/bench/egress-placeholders-PREREG.md` § (e), committed
before any Phase 2–3 data. The bar, verbatim: *"no regression beyond the paired
verdict's own noise floor on a task set drawn from council reviews and coding
tasks with and without replacement, scored through
`src/scripts/_lib/paired_verdict.ts`. Null: a loss is published, and D8 keeps
consumer defaults off."*

- **Revision measured:** `e7d10fac53` (`results.head`), the production engine in
  `src/scripts/_lib/egress_token.ts` + `egress_rules.ts`, unmodified.
- **Host:** Claude Code 2.1.308, subscription login, `--model sonnet` (served
  `claude-sonnet-5-5` on all 120 legs). No metered API was called.
- **Command:**
  `node_modules/.bin/tsx internal/bench/egress-paired-quality/run.ts check`, then
  `… run --delay 1500`, then `… verdict`. Rows in
  `internal/bench/egress-paired-quality/results.jsonl`, verdict in
  `verdict-2026-10-22.json` beside it.

## What ran

- **Tasks, seed 20261022, regenerated, never stored:** 48 review tasks (16
  snippets × 3 identifier instances) — each snippet carries synthetic,
  checksum-valid IBANs, e-mails, cards, phones or tax IDs and exactly one planted
  defect (off-by-one, wrong operator, missing `await`, swapped arguments, wrong
  status code) unrelated to any identifier's value; and 12 coding tasks (6
  function specs × 2) whose worked example carries identifiers.
- **Arms:** A is the task as written; B is the same text after `replaceValues`
  with a fresh `TokenScope` per pair, so identifiers arrive as `__TYPE_n_fp__`.
- **Pre-check, per pair, before any call:** arm A carries every planted value;
  arm B carries none of them in raw or canonical spelling, holds at least one
  token per planted value, and keeps the review line count. 60 of 60 pairs
  passed; none was dropped.
- **Child sessions:** `claude -p --setting-sources project,local --tools ""`
  from an empty temp dir, sequential, 1.5 s apart. A control probe showed the
  isolation: the same question about the operator's global rules answered NO
  with ~2.8k input tokens and YES with user settings loaded (~145k).
- **Scoring:** review — the reply must be one JSON object `{line, kind}` naming
  exactly the planted line and kind; coding — the reply's javascript block runs
  in a fresh `vm` context against 2–3 cases built from values the prompt never
  showed. Delta per pair = pass(B) − pass(A), into `decidePairedVerdict`.

## Scorer falsification first

`tests/lib/egress_paired_quality.test.ts` (green) proves the scorers reject
planted wrong answers before a green reading counts: a review answer one line
off, the right line with the wrong kind, two answers, prose, an extra key, a
string line number; a coding answer that hardcodes the first case, a buggy
variant per function, a bare unfenced block, a misnamed function, an infinite
loop. The test caught a real weakness on the way: the first `lastFour` cases let
`slice(-4)` on the raw string pass, so a case with the last group split was
added. It also asserts the pre-check rejects an unreplaced arm B, and that an
all-loss set is a `regression` through the verdict wiring.

## Result

| Family | Pairs | Arm A pass | Arm B pass | Discordant |
|---|---:|---:|---:|---:|
| review | 48 | 48 | 48 | 0 |
| coding | 12 | 12 | 12 | 0 |
| **all** | **60** | **60 (100 %)** | **60 (100 %)** | **0** |

Median input 2,964 (A) vs 2,955 (B) tokens, median output 23 in both.

**Verdict:** `underpowered` — 0 discordant pairs against the derived floor of 5.
**Against the bar:** no regression was observed, so no loss is published and the
null branch did not fire. It is *not* a pass: by the module's own definition an
underpowered verdict is an absent measurement. With no losing pair, the rule of
three bounds an unseen loss rate at 3/60 = **5 pp** (95 %).

## What a null would have looked like

At least 5 discordant pairs with losses dominating at one-sided exact p ≤ 0.05
— e.g. 5 of 5, or 8 of 9, pairs where arm A passed and arm B failed. That
verdict is `regression`, the loss is published, and D8 keeps consumer defaults
`off`.

## Limits — read before citing

- **Ceiling effect.** Both arms solved every task, so the set cannot tell the
  arms apart. A harder set, where the control fails sometimes, is what can move
  this from `underpowered` to a decision.
- **Not drawn from council reviews.** The bar names a set drawn from council
  reviews and coding tasks; these are synthetic snippets written for this run,
  sharing a session with the scorer. Real review prompts are longer and the
  identifiers there carry more context.
- **Defects unrelated to values.** By design no task needs an identifier's
  value; a task whose answer depends on the value (validate this IBAN, does this
  e-mail match) would be expected to degrade, and is not measured.
- **Instances are not independent.** Each snippet appears three times with
  different identifiers, so the 48 review pairs are 16 programmes.
- One model (`sonnet`), one machine, one host version, one run per arm.
