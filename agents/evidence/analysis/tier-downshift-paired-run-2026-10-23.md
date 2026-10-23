# Tier downshift — the paired run, rerun on a pinned tree

<!-- evidence-type: analysis -->

> **Produced** 2026-10-23 for step 4.2 of `road-to-a-tick-the-shipped-path-earns`, against
> the two claims pre-registered on 2026-10-22 (`tier-downshift-quality-held`,
> `tier-downshift-limit-relief` in `docs/CLAIMS.md`). It supersedes
> `tier-downshift-paired-run-2026-10-22.md` as the evidence for both. Host: Claude Code
> **2.1.308**, subscription login. No metered API was called.

## Why the first run is not evidence

Three defects, each read in the tree rather than assumed:

- **The corpus was not bound to the commit it named.** `results.head` said `f4e20ba12f`,
  the report said `5653d32f32`. Recomputing the old corpus from a `git archive` of each
  (`benchSelfTest`, `internal/bench/pinned_tree.ts`) disagrees at both: the answer `461`
  for `count-ts-src/scripts/_lib` is 460 at `f4e20ba12f` and at `5653d32f32`, and
  `imports-delegation_nudge_hook.ts` is 12, not 13, at `5653d32f32`. At `75da434d` the
  old corpus matches. The run passed 60/60 against an answer key that was right at a
  third commit.
- **`verified` read the head session's reply**, not the measured leg's answer.
- **The interval was inverted.** Zero discordant pairs used the rule of three, one used
  Wald, and Wald is looser: at 59 pairs one lite failure was held where zero were refused.
  The old verdict "held" sat exactly on the bar (3/60 = 5.0 pp, read with `<=`).
- The cost side priced `claude-haiku-5-5` with a row sourced 2026-05-14 for a former
  generation at 2.5x the served model's rate.

## What ran

- **Tree:** `git archive` of commit `fe4fa4bcd7b9bffaba49a233b18a6e82bdcfcc7b`, extracted
  with a `.bench-pin` marker; the child sessions were pointed at that directory, never
  the working tree.
- **Corpus:** `internal/bench/tier-downshift/corpus.json`, 60 slices, regenerated from
  that archive and stamped with the commit (`count-ts-src/scripts/_lib` is 470 there).
- **Rows:** `internal/bench/tier-downshift/results-fe4fa4bcd7.jsonl`, 120 legs, 0
  errors, each carrying the commit. `verified` is the leg's own last transcript message.
- **Self-test:** corpus, rows and tree agree on the commit (`run.ts selftest`), checked
  before the run and again before the verdict.
- **Arms:** unchanged — head `sonnet`, `ac-researcher` dispatched once with
  `model: "haiku"` (lite) and once with no model argument (inherit).
- **Bound:** exact one-sided 95 % Clopper–Pearson on the rate of pairs only lite failed;
  held only strictly below 5 pp.
- **Prices:** `internal/bench/pricing.yaml` per-model rows `claude-haiku-5-5` and
  `claude-sonnet-5-5`, read 2026-10-23 from
  <https://platform.claude.com/docs/en/about-claude/pricing> (Haiku 5.5: $0.10 input,
  $0.125 five-minute cache write, $0.01 cache hit, $0.50 output per MTok for prompts up to
  100,000 tokens; Sonnet 5.5: $2, $2.50, $0.10, $10).
- **Verdict:** `internal/bench/tier-downshift/verdict-2026-10-23.json`.

## Result

| Arm | Served (all legs) | Verified | Escalated | Cost (list USD) | Per verified slice |
|---|---|---:|---:|---:|---:|
| lite | `claude-haiku-5-5` ×60 | 59 / 60 | 0 | 0.0478 | 0.00081 |
| inherit | `claude-sonnet-5-5` ×60 | 60 / 60 | 0 | 0.5915 | 0.00986 |

- **One discordant pair, against lite:** `imports-block_kernel_rule_writes.ts`. The file has
  8 lines starting `import ` at the pin; the haiku leg answered 6, the sonnet leg 8.
- **Quality:** difference +1.67 pp, one-sided upper bound **7.66 pp**, not below the 5 pp
  margin; lower bound −4.78 pp, so no breach either. Escalation rate 0.
  Verdict **underpowered**.
- **Cost:** lite is about a twelfth per verified slice, but the pre-registration backs the
  cost claim only together with the quality claim. Verdict **underpowered**.

Under the old Wald branch this same run would have read 1.67 + 3.24 = 4.91 pp and been
"held". The bound, not the data, made that verdict.

## What it means

Neither claim is backed and neither is refuted. Sixty pairs cannot hold a 5 pp bar with a
single lite failure: the exact bound needs at least 59 clean pairs to dip below 5 pp at
zero failures and about 93 pairs at one. The kind keeps `inherit`, which is the outcome
this roadmap's risk register names for a rerun that fails the bar.

## Bounds — read before citing

- Exact-lookup read-only fan-out only; one operator machine, one host version, list prices.
- The haiku rate holds for prompts up to 100,000 tokens; every leg here was far below.
- The bound is one-sided 95 %, the level the pre-registered rule of three used. At the
  conventional one-sided 97.5 %, sixty pairs cannot hold the bar even with no failure.
