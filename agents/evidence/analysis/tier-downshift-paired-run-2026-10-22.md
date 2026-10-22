# Tier downshift — the paired run on read-only fan-out slices

<!-- evidence-type: analysis -->

> **Produced on** `feat/subagent-system-2583`, 2026-10-22, for step 2.2 of
> `road-to-a-tier-the-dispatch-carries`, against the two claims pre-registered in step 2.1
> (`tier-downshift-quality-held`, `tier-downshift-limit-relief` in `docs/CLAIMS.md`). Host:
> Claude Code **2.1.308**, subscription login. No metered API was called.

## What ran

- **Corpus:** `internal/bench/tier-downshift/corpus.json` — 60 read-only fan-out questions
  over this tree (file counts per directory, the owning file of an exported function, import
  lines per hook), each answer computed by the generator, so verification is an exact match.
- **Tree:** a `git archive` snapshot of commit `5653d32f32` (`results.head`) so the answers
  could not move while the branch kept changing.
- **Arms:** for every slice, two print-mode child sessions (`--setting-sources project,local`,
  head `sonnet`) dispatching the shipped `ac-researcher` definition (`omitClaudeMd: true`)
  once with `model: "haiku"` (lite) and once with no model argument (inherit → the head's
  `sonnet`).
- **Cost:** each leg's usage read from its own subagent transcript, priced with
  `internal/bench/pricing.yaml` (list prices, sourced 2026-05-14), cache weights as priced
  there.
- **Verdict:** `tierDownshiftVerdict` (`src/scripts/_lib/tier_downshift_verdict.ts`),
  output in `internal/bench/tier-downshift/verdict-2026-10-22.json`, rows in `results.jsonl`.

## Result

| Arm | Served (all legs) | Verified | Escalated | Cost (list USD) | Per verified slice |
|---|---|---:|---:|---:|---:|
| lite | `claude-haiku-5-5` ×60 | 60 / 60 | 0 | 0.0910 | 0.00152 |
| inherit | `claude-sonnet-5-5` ×60 | 60 / 60 | 0 | 0.9290 | 0.01548 |

- **Quality:** no pair disagreed. The paired difference is 0 pp; with no discordant pair the
  rule of three bounds an unseen disagreement at 3/60 = **5.0 pp**, which is exactly the
  pre-registered margin. Escalation rate 0, below the 0.3 kill. Verdict **held**.
- **Cost:** the lite arm cost about a tenth per verified slice. Verdict **relief**.
- Median leg input was the same in both arms (≈ 11,400 tokens): the saving is the price per
  token, not fewer tokens.

## Bounds — read before citing

- **Held at the margin, not inside it.** Sixty clean pairs are the smallest sample that can
  hold this bar at all. One discordant pair against `lite` would have made the run
  underpowered.
- **The kind is narrow.** These questions are exact lookups a grep answers; a read-only
  fan-out that summarises or judges is not this kind, and the table does not put it at `lite`.
- **The inherit arm ran on `sonnet`.** In this repository's sessions the head is usually an
  Opus model, so the inherit arm here is cheaper than a typical inherit leg; the relief in a
  real session is larger, not smaller.
- **No escalation was exercised.** The re-run charge path is tested in the evaluator, not
  seen in data.
- One operator machine, one host version, list prices — a subscription bills none of them.
