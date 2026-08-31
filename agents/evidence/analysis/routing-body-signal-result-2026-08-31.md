<!-- evidence-type: analysis -->

# Routing body signal — the measurement, and why the answer is not `null`

Measured 2026-08-31 · `road-to-governed-harness-evolution` step **5.1** ·
pre-registered in `agents/evidence/analysis/routing-signal-preregistration-2026-08-31.md`
(commit `fe8749458`, which adds no measurement module and runs nothing).

Reproduce: `./scripts-run src/scripts/measure_routing_signal`.
Machine record: `agents/evidence/analysis/routing-body-signal-verdict.json`.

## The verdict

```
VERDICT: harmful
THE PRIMARY BAR WAS CLEARED. THE GUARD WAS BREACHED BY MORE.
INDEXING THE BODY BUYS 5.7 pp OF RECALL AND PAYS 7.2 pp OF FALSE ACTIVATION.
```

| Arm | recall@5 | false activation@5 |
|---|---|---|
| `description` (shipped) | 64.60 % | 13.66 % |
| `description+body` | 70.28 % | 20.88 % |
| **delta** | **+5.68 pp** (bar +5.0) | **+7.22 pp** (guard +2.0) |

Discordant positive pairs: 62 gained, 40 lost. McNemar exact two-sided
**p = 0.0371**. Power floor (≥ 10 discordant) cleared with 102.

Corpus: 82 train corpora, 775 cases, 387 positives / 388 negatives, ranked
against a 299-skill catalogue. The 18 sealed holdout corpora were not read.

## The pre-registered order is what produced this answer

The primary bar was **met**: +5.68 pp of recall at p < 0.05. A pre-registration
that had named only a recall bar would have returned `signal` on these numbers
and licensed step 6.5 to index the body.

The pre-registration named a guard **and** an evaluation order — power, then
guard, then primary — and the guard is what fires. `tests/scripts/routing_signal_measurement.test.ts`
pins exactly that combination, and a sabotage that moves the primary check ahead
of the guard turns the verdict into `signal` and reds two tests.

This is the case the two-sided bar existed for, and it is worth stating plainly:
had the bar been one-sided, this run would have shipped a change that makes
routing worse while reporting an improvement.

## The prediction was half right, and the wrong half is the interesting one

The pre-registration committed to a mechanism: `scoreSkill` computes
`overlap = |taskTerms ∩ skillTerms| / |taskTerms|`, dividing by the **task's**
term count. Adding body tokens can only grow `skillTerms`, so every skill's
score is monotone non-decreasing under the body arm, and the prediction was that
the guard would break.

It did. What the prediction did not anticipate is that **40 positives were
lost**. Monotone scores do not imply monotone ranks: a positive already inside
the top-5 is pushed out when its competitors gain more from their bodies than it
gains from its own. So the body arm is not a pure recall trade — it reorders,
and 39 % of its discordant movement is in the wrong direction. That is a
stronger reason not to index the body than the guard breach alone, and it was
found by the run rather than reasoned to.

## Gap A is `null`, and it bounds this result

`proxy_to_real_fidelity` is carried as its own required field in the verdict
record, with `status: unmeasured-by-construction`.

The reason is structural, not budgetary. `src/scripts/description_route_check.ts:18-30`
states that asking a model which units it would load is not the host's selection
procedure, and that the gap is *"unquantified rather than small"*. Quantifying
it needs real sessions; step 5.2 keeps the live-floors park intact for this
whole roadmap and a scan enforces it. So the honest field value is `null` with
the reason attached.

**What that costs this result, said in one line:** the ranking measured here is
a proxy for production routing whose fidelity to production routing is unknown.
The internal comparison between the two arms is sound — both arms run through
the same proxy, so the proxy's error is common to them — but the absolute
figures (64.6 %, 70.3 %) are properties of the proxy and are not claims about a
real session.

## Two corrections made during the run, recorded rather than smoothed over

**The loader dropped two corpora silently.** The first implementation understood
only the modern `queries[]` shape and reported **80** train corpora where the
frozen partition says 82. The two lost files — `brand-asset-generation` and
`estimate-ticket` — are the legacy `should_trigger` / `should_not_trigger` pair
that step 2.3 grandfathered. This was a defect in the reader, not a scoping
decision, and it was fixed by reading both shapes rather than by narrowing the
pre-registered corpus. The verdict is unchanged in both directions: at 80
corpora the run read +5.57 / +7.41 pp and `harmful`; at 82 it reads +5.68 /
+7.22 pp and `harmful`. `legacy_shaped_corpora` is now a reported field so the
count is explainable from the record.

**A block comment ended early.** `/** … src/skills/*/SKILL.md … */` closes at
the `*/` inside the glob. `tsc --noEmit` accepted the file and the runtime
transform did not. Noted because the same trap will catch the next author who
writes a skills glob into a doc comment.

## What this does NOT establish

- It does not say the body is useless to a **reader**. It says body tokens,
  folded into this lexical scorer, degrade this ranking on this corpus.
- It does not generalise to a different retrieval mechanism. A scorer that
  normalised by the skill's own term count, or a BM25 core with length
  normalisation, is a different measurement and this result does not predict it.
- It does not touch the holdout. Every number here is train-partition only, and
  a later run against the sealed set is a separate, still-unspent measurement.
