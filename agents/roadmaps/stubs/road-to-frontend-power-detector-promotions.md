---
complexity: lightweight
---

# Stub: road to the frontend-power detector promotions

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated stub.
> Created 2026-08-23 when
> [`road-to-frontend-power`](../archive/road-to-frontend-power.md) was drained.
> Three steps promote catalog rows to `backed` at `M1 = 0`, and the run that
> would have promoted them is the run that **authored the corpus** — which is
> Risk 6 of the parent roadmap, by name. Framework of record:
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md).
> Outcome state on the parent: **transferred**.

## The criteria, verbatim from the parent

> **E3.3 Browser-engine rules, one at a time,** each on a new epoch at
> M1 = 0: L7, text-overflow, clipped-overflow, content-hidden-at-rest,
> edge-flush-cards, gray-on-color. Implemented against computed styles; any
> adapted shape carries a borrows row.
> `verify:` § Detector status shows the promotion with its epoch hash, and each
> promoted row has either a `provenance/borrows.jsonl` entry or an explicit
> own-analysis label.

> **E4.3 Promote the structural rows** V7, L2, T3, L6, each on its own epoch at
> M1 = 0.
> `verify:` each promoted row reads `backed` in § Detector status and
> `lint_design_antipattern_parity` is green.

> **E4.4 Copy rules, measured (A10).** Run Source A's four copy rules against
> the clean corpus; adopt only those at M1 = 0 and publish the rest as nulls.
> The prior council rejection was made without a number; this supplies one.
> `verify:` each of the four has either a `backed` row or a named null with its
> M1 count.

## What moves here — the complete list

| Item | Parent location | Why it moves |
|---|---|---|
| E3.3 six browser-engine rows | Phase E3 | Each needs an M1 = 0 on a clean corpus this run did not author. The render primitive it depends on **landed**; the corpus independence did not. |
| E4.3 four structural rows | Phase E4 | Same bar, same gap. |
| E4.4 four copy rules | Phase E4 | Same bar, plus its source is the abandoned external reference — see § What E4.4 lost. |

Nothing else moves from lane E. E1's carriers, E2's command and gate, E3.1's
render primitive and E3.2's blocker resolution all landed.

## Why authorship and not ordering is the blocker

The parent's stated Risk-6 mitigation is that the corpus hash commits before any
engine commit. This run did that — `34f7dc400` precedes `5b54933f5`.

```
THE HASH CONTROLS SEQUENCE. IT DOES NOT CONTROL AUTHORSHIP, AND AUTHORSHIP IS
THE BINDING HALF. AN FP RATE MEASURED ON UI THE RULE'S AUTHOR WROTE TO EXERCISE
THE RULE MEASURES THE AUTHOR'S INTENT, NOT THE RULE.
```

So the prohibition is written into
`internal/bench/frontend-power-PREREG.md` § M1 and into
`tests/eval/frontend-corpus/README.md` rather than left to a reader to infer:
**no detector row may be promoted against `tests/eval/frontend-corpus/`.** The
clean population is `internal/bench/corpora/design-slop-clean/`, and a promotion
run uses that one.

## What E4.4 lost, and what survives

E4.4's source is Source A's four copy rules, taken from an external repository
pinned at a SHA. That vendoring path is **abandoned** on the parent (`[-]`), for
two independent reasons:

1. The repository is not in this tree, cannot be fetched under
   `source-confidentiality`, and a `provenance/borrows.jsonl` transformation
   note for code nobody read would be fabricated.
2. The neighbouring decision already went the other way. The fidelity roadmap's
   `b-detector-license-verification` resolved 2026-08-23 as option **(b)** —
   derive independently, own-analysis label, **no external shape taken** — and
   recorded that "nothing in `provenance/borrows.jsonl` is added by this
   decision, and that absence is the decision rather than an omission."

**What survives is A10's actual question**, and it is worth keeping: the prior
council rejection of copy phrase-lists was made *without a number*. That is
still true, and it can still be answered — by four independently derived copy
rules measured on the clean corpus, with an own-analysis label. The four
rules do not have to be someone else's to produce the number.

## Producer and probe — named, not wished

- **Producer:** a maintainer running the promotion protocol against
  `internal/bench/corpora/design-slop-clean/`, one rule per epoch. Not the run
  that authors a rule, and not a run authoring a corpus.
- **Probe — three readings:**
  1. `./scripts-run src/scripts/lint_design_antipattern_parity` — prints the live
     `backed` count on its green path, so a promotion is visible without reading
     the table.
  2. Does the clean corpus carry enough cases for the rule's shape to appear at
     all? A rule that cannot fire on any clean case has an M1 of 0 for the wrong
     reason.
  3. For each promoted row, does `provenance/borrows.jsonl` carry an entry **or**
     does the row carry an explicit own-analysis label? One or the other, never
     neither.
- **Measured on this machine, 2026-08-23 — the control:**
  - § Detector status: **24 backed / 3 floor / 16 judgment-only / 2 deferred, 45
    rows**, confirmed twice — counted from the table and printed by
    `lint_design_antipattern_parity` ("45 entries classified, 24 detector-backed").
    The parent's own restated baseline (21/3/14/2 over 40) had aged; the
    corrected figure is on the parent's § Outcome.
  - Findings on the authored corpus: **0 P0, 0 P1, 2 P2**, `overThreshold: 0`.
    Recorded as a *routing* datum and explicitly **not** as an M1.
  - `provenance/borrows.jsonl` rows added by the parent run: **zero**, and that
    absence is the abandonment of E4.2 rather than an omission.

## Promotion gates

1. **One rule, one epoch, one M1.** A batch promotion has no per-rule number and
   cannot satisfy any of the three verifies.
2. **The clean corpus, never the authored one.** Stated as a gate because it is
   the single mistake that would make every resulting number worthless.
3. **AC-5's arithmetic follows the measured baseline, not the roadmap's.** "At
   least eight formerly judgment-only rows" is counted against **16**, not 14.

## Seed content on promotion

- Start with the four E4.3 structural rows: they are text-decidable, so they need
  no render artefact and are the cheapest way to exercise the protocol.
- E3.3's six need the render manifest. `agent-config ui:render` writes computed
  styles per viewport plus `horizontal_overflow` per viewport, which is the input
  text-overflow and edge-flush need — and it already found a real 320 px overflow
  on the first fixture it was pointed at, so the signal is live rather than
  theoretical.
- For E4.4, derive the four copy rules independently and label them own analysis.
  Do not reach for the external set; that door is closed on two independent
  grounds and reopening it needs the fidelity roadmap's (b) reversed first.
