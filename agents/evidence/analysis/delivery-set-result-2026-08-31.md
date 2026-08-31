<!-- evidence-type: analysis -->

# Delivery sets — the ceiling is breached, and 79 % of the cut is a coin flip

Measured 2026-08-31 · `road-to-governed-harness-evolution` step **6.4** ·
pre-registered in `agents/evidence/analysis/delivery-set-preregistration-2026-08-31.md`
(commit `fe8749458`, which adds no measurement module and runs nothing).

Reproduce: `./scripts-run src/scripts/measure_delivery_sets`.
Machine record: `agents/evidence/analysis/delivery-set-measurement-2026-08-31.json`.

Arm: the shipped `description` index. 82 train corpora, 764 distinct prompts,
387 positives / 388 negatives, 299-skill catalogue, k = 5. The 18 sealed
holdout corpora were not read.

## The metric set the step asked for

| Metric | Value | Bar |
|---|---|---|
| precision@5 | **82.51 %** over 303 adjudicated deliveries | — |
| recall@5 | **64.60 %** | — |
| recall loss vs full catalogue | **35.40 pp** | ceiling 20.0 pp — **BREACHED** |
| false activation@5 | **13.66 %** | — |
| context cost | **235.6 tokens/prompt** | target 500 — **MET** |
| benefit, unconditional | **64.60 %** | — |
| benefit, conditional on activation | **82.51 %** | — |
| unadjudicated deliveries | 3 326 of 3 629 | reported, never scored |

Recall curve: @1 44.70 % · @3 57.11 % · @5 64.60 % · @10 73.64 % · @20 80.62 %.

**The ceiling is breached at every k the curve covers.** 80.0 % recall is not
reached at k = 20, so no narrowing under 20 clears a 20.0 pp loss ceiling on this
corpus. The token target is met with room — 235.6 against 500 — which locates
the problem: the delivered set is cheap and is not the thing that is failing.

**A breach is a finding, not a failed run.** The pre-registration says so
explicitly, and no narrowed delivery is promoted from this.

## Precision and benefit-given-activation are one quantity under two names

The pre-registration defined `precision_at_k` and
`benefit_conditional_on_activation` separately, and implementing them showed
they are the same computation: the fraction of adjudicated deliveries that were
wanted. This is a defect in the pre-registration, found by implementing it.
Both are reported, at the same value, rather than one being silently dropped.

The pair that does differ is the one the prereg`s own gloss names:
`benefit_unconditional` (64.60 %, counts undelivered positives as zero benefit)
against `benefit_conditional_on_activation` (82.51 %, blind to them). The 17.9 pp
gap is exactly the delivery failure, and reporting only the conditional figure
would have hidden it.

## Set compatibility — 7 in the corpus, 0 delivered together

**7 jointly-wrong pairs exist in the train corpus**, over 10 shared prompts:

| Pair | Prompt |
|---|---|
| `experiment-loop` + `verify-repair-loop` | is this diff clean — naming, structure, conventions? |
| `experiment-loop` + `verify-repair-loop` | review my changes before I open the PR |
| `analysis-skill-router` + `forensics-report` | run a security audit on the auth module |
| `agent-security-review` + `ai-code-blindspots` | threat-model this new payments endpoint before I build it |
| `agent-security-review` + `security-audit` | (same prompt) |
| `ai-code-blindspots` + `security-audit` | (same prompt) |
| `evaluate-llm-feature` + `prompt-engineering-patterns` | what chunk size and embedding model should I use for my RAG pipeline? |

**None of the seven is delivered together at any k ≤ 20.** That reads like good
news and mostly is not — see the next section.

**The pre-registration narrowed a corpus property into a delivery property, and
that is corrected by reporting both rather than by rewriting the definition.**
The step`s verify asks whether *the corpus* contains a jointly-wrong pair; the
prereg`s definition added a third condition, "both members delivered in the
top-k", which makes the count 0 and answers a different question. Both figures
are now reported: `jointly_wrong_pairs_in_corpus` (7) and
`jointly_wrong_pairs_delivered_at_k` (0), with the smallest k at which each pair
would be jointly delivered.

**The count is a lower bound and never an estimate.** A pair is observable only
where two corpora adjudicate the *same* prompt, because the corpus labels one
skill per prompt. A wrong pair whose members share no prompt cannot be seen from
this corpus at all.

## The finding that bounds every number above

```
78.80 % OF PROMPTS HAVE THEIR TOP-5 CUT DECIDED BY THE ALPHABETICAL TIE-BREAK.
score(rank 5) === score(rank 6). THE BOUNDARY IS NAME ORDER, NOT RELEVANCE.
```

The scorer produces heavy ties. For *"threat-model this new payments endpoint
before I build it"* the top six all score 23 — `ai-code-blindspots`,
`customer-research`, `forecasting`, `source-discovery`, `spreadsheet-authoring`,
`threat-modeling` — and the next twenty all score 12. Which five are delivered
is then decided by `a` < `b`.

So the 0-delivered-pairs result is **not** evidence that the ranker discriminates
between incompatible skills. It is mostly evidence that at the boundary it does
not rank at all, and the alphabet happened not to co-select any of the seven.
Reading it as a compatibility success would be the strongest available
misreading of this run, which is why it is stated here first.

This is the same "recalls but does not rank" pathology
`src/scripts/measure_lexical_ranking.ts:10-16` names for the memory store,
observed here on the skill catalogue for the first time.

## What this does NOT establish

- It is not a promotion claim. Per
  `internal/bench/council-topology-promotion-stats-PREREG.md`, a change to what
  the suite does by default carries a trial count and a band; this is a
  deterministic census over one corpus, published as an observation.
- It says nothing about the sealed holdout, which stays unspent.
- The absolute figures are properties of the lexical proxy, not of a real
  session — the same Gap A bound the 5.1 result carries, and for the same
  reason: step 5.2 parks the live harness.
