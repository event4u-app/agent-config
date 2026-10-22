# Advisor pairing — the paired run on bounded implementation slices

<!-- evidence-type: analysis -->

> **Produced on** `feat/subagent-system-2583`, 2026-10-22, for step 3.2 of
> `road-to-a-tier-the-dispatch-carries`, against the claim `advisor-pairing-held` pre-registered
> in `docs/CLAIMS.md` before the run. Host: Claude Code **2.1.308**, subscription login. No
> metered API was called.

## What ran

- **Corpus:** `internal/bench/advisor-pairing/specs.json` — 20 bounded implementation specs
  (run-length encoding, Roman numerals, query-string parsing, semver comparison, …), each run
  three times: 60 slices.
- **Arms:** per slice, two print-mode child sessions (`--setting-sources project,local`, head
  `sonnet`) dispatching the shipped `ac-worker` (`omitClaudeMd: true`) once with
  `model: "haiku"` under `--advisor opus` (experimental advisor variable set), once with
  `model: "sonnet"` and no advisor.
- **Verification:** the worker writes `solution.mjs`; the harness imports it and runs the
  spec's cases itself — the model never grades its own output.
- **Cost:** worker usage from its own subagent transcript; the advisor's usage from the
  session's `claude-opus-5-5` entry, charged to the advisor arm (`LegResult.extra`); list
  prices from `internal/bench/pricing.yaml`.
- **Verdict:** `tierDownshiftVerdict`, output `internal/bench/advisor-pairing/verdict-2026-10-22.json`.

## Result

| Arm | Worker served | Verified | Cost (list USD) | Per verified slice |
|---|---|---:|---:|---:|
| `lite` executor + `high` advisor | `claude-haiku-5-5` ×60, advisor `claude-opus-5-5` | 60 / 60 | 17.03 | 0.2838 |
| `medium` alone | `claude-sonnet-5-5` ×60 | 58 / 60 | 1.18 | 0.0204 |

- **Quality: held.** The advisor arm failed 2 fewer slices (`parseq` twice on `medium`);
  paired difference −3.3 pp, interval half-width 4.5 pp, below the +5 pp bar.
- **Cost: no relief.** The advisor arm cost about **14 times** as much per verified slice.
  The advisor's input was billed uncached on every consultation — median 9,790 input tokens
  per slice, 85,827 output tokens over the run — at the `high` tier's price, which the
  `lite` executor's saving does not begin to cover.

**Verdict: `advisor-pairing-held` is a recorded null.** The pairing holds quality and loses on
cost; per that roadmap no adoption step follows, and a backed claim would have opened its own.

## Bounds

- One host version, an experimental advisor surface, list prices (a subscription bills none of
  them), n = 60 pairs from 20 specs.
- The advisor cost is dominated by the uncached input. A host that caches the advisor's
  context, or a run that consults it less than once per slice, is a different arm and would
  need its own pre-registration.
