<!-- evidence-type: analysis -->

# Delivery-set pre-registration — loss ceiling, token target, set compatibility

Registered 2026-08-31 · owner: maintainer ·
`road-to-governed-harness-evolution` step **6.4**
("Pre-register the loss ceiling, and measure set compatibility").

**Written before the measurement module exists.** The step's `verify:` clause is
*"the ceiling is committed before the run, and the corpus contains at least one
jointly-wrong pair"*. The first half is an ordering claim, so it is discharged
by the git history: this file is committed in a commit that adds no measurement
module and runs nothing.

## What is being decided

A narrowed delivery — hand the model the top-k skills for a prompt instead of
the whole catalogue — trades recall for context. The trade is only legible if
the acceptable loss is named **first**. A ceiling picked after seeing the recall
curve is a description of the curve.

## The two numbers, fixed now

```
RECALL-LOSS CEILING   20.0 pp against the full-catalogue arm
TOKEN TARGET          500 tokens of delivered skill description per prompt
```

**Recall-loss ceiling — 20.0 pp.** The full-catalogue arm delivers every skill,
so its recall is 1.0 by construction and the loss is exactly `1 − recall@k`. The
ceiling therefore reads: **recall@5 ≥ 80.0 %** of train positives. It is a
stated default rather than a derived optimum, and it is deliberately set where
the outcome is genuinely uncertain: the only comparable number this tree has
published is `agents/evidence/metrics/skill-ranker-baseline.json`, whose
incumbent `keyword-v1` scores `top3: 0.769` over a 26-prompt labelled corpus —
a different corpus, a different k, and too small to predict this one.

**Token target — 500 tokens.** The delivered set's summed description cost, at
4 characters per token, averaged over prompts. Also a stated default.
*Revisit-if:* the measured mean at k = 5 exceeds it by more than 2×, in which
case k moves **before** the next run and never during one.

**k = 5**, the same constant the 5.1 pre-registration fixes, so the two
measurements are commensurable and neither can be re-tuned against the other.

**Corpus.** Train partition only, by the frozen rule in
`agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`. The 18 holdout
`evals/triggers.json` files are sealed and are not read.

## The metric set — every field the step names, defined before the run

| Metric | Definition |
|---|---|
| `precision_at_k` | over all (case, delivered skill) pairs: the fraction where the corpus records `trigger: true` for that skill on that prompt. Only pairs the corpus can adjudicate are counted; a delivered skill with no case for that prompt is `unadjudicated` and is reported separately rather than scored as either. |
| `recall_at_k` | positives whose owning skill is in the delivered set, over all positives |
| `false_activation_at_k` | negatives whose owning skill is in the delivered set, over all negatives |
| `context_cost_tokens` | mean summed `name + description` length of the delivered set, divided by 4 |
| `benefit_unconditional` | `recall_at_k` — the benefit counted over every positive, including those where the skill never activates |
| `benefit_conditional_on_activation` | among **activations** (delivered, adjudicable pairs), the fraction that were wanted. The two differ exactly where delivery fails: an undelivered positive costs the unconditional figure and is invisible to the conditional one, which is why reporting only one of them is the failure this row exists to stop. |
| `jointly_wrong_pairs` | see below |

**`unadjudicated` is a first-class outcome, not a rounding error.** The corpus
labels one skill per prompt; the delivered set holds five. Four of those five
usually have no case for that prompt, and scoring them as false positives would
manufacture a precision figure out of the corpus's silence. They are counted and
reported as `unadjudicated`, and `precision_at_k` states its own denominator.

## Set compatibility — the part that is not a per-artefact metric

```
THE QUESTION IS WHICH SET TO DELIVER TOGETHER, NOT ONLY WHICH ARTEFACT IS CLOSEST.
TWO INDIVIDUALLY PLAUSIBLE SKILLS CAN BE JOINTLY WRONG.
A METRIC THAT SCORES EACH DELIVERY ALONE CANNOT SEE THAT.
```

**Definition, fixed before the run.** A **jointly-wrong pair** for prompt *p* is
an unordered pair of distinct skills `{A, B}` such that:

1. both are in the delivered top-k for *p*; **and**
2. the corpus adjudicates *both* on *p* — that is, *p* appears in A's corpus and
   in B's corpus; **and**
3. both records are `trigger: false`.

Condition 2 is what makes the pair *observable*: only a prompt carried by two
corpora can be jointly adjudicated, and this corpus has 15 such prompts. It is
also the honest bound on the metric — the count is a **lower** bound on joint
wrongness, never an estimate of it, because a pair whose members do not share a
prompt cannot be evaluated at all.

**Reported alongside:** `jointly_wrong_pairs` (count and the pairs), and
`shared_prompts` (the denominator that makes them observable). The step's verify
asks for **at least one** jointly-wrong pair in the corpus, and the run reports
the count rather than asserting it.

## The bar

The ceiling is a **reporting** bar, not a gate on closing 6.4. Step 6.4's
`verify:` asks that the ceiling be committed before the run and that the corpus
carry a jointly-wrong pair; it does not ask that the ceiling be met. So:

- ceiling met → the narrowed delivery is admissible at k = 5 on this corpus;
- ceiling breached → **reported as breached, with the recall curve over k**, and
  no narrowed delivery is promoted. A breach is a finding, not a failure of the
  run.

**No promotion claim is made from this run.** Per
`internal/bench/council-topology-promotion-stats-PREREG.md`, a statement that
changes what the suite does by default carries a trial count and a band. This
run is a deterministic census over one corpus; it is published as an
observation, and anything that would change delivery by default needs the band
that prereg requires.
