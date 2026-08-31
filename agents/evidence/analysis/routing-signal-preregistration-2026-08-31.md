<!-- evidence-type: analysis -->

# Routing-signal pre-registration — two gaps, named separately

Registered 2026-08-31 · owner: maintainer ·
`road-to-governed-harness-evolution` step **5.1**
("Measure the description-vs-body signal, honest null permitted").

**This record is written before the measurement code exists, and that is the
point.** Its step's `verify:` clause is an ordering clause — *"the
pre-registration lands before the first measurement commit and names both gaps
separately"* — so a threshold chosen after seeing a number is not a threshold.
The ordering is checkable in the git history rather than asserted here: this
file is committed in a commit that adds no measurement module and runs nothing.

## The two gaps are different questions, and the step exists because they were conflated

```
GAP A IS ABOUT THE INSTRUMENT. GAP B IS ABOUT THE INDEX.
A IS NOT EVIDENCE ABOUT B, AND B IS NOT EVIDENCE ABOUT A.
NEITHER IS CLOSED BY MEASURING THE OTHER.
```

### Gap A — proxy-to-real-session fidelity

`src/scripts/description_route_check.ts:18-30` states it verbatim: asking a
model *"which units would you load given this catalogue"* is **not the host's
selection procedure**, so a green run there is evidence that the description
signal did not regress and is *"NEVER evidence that production routing works …
until that measurement exists the gap is unquantified rather than small"*.

This gap bounds the external validity of every routing conclusion in this
roadmap, including Gap B's. It is therefore carried as **its own named field**
in the verdict file rather than folded into a caveat sentence.

**Its status in this roadmap is fixed in advance, and it is not "we ran out of
time".** Step 5.2 keeps the live-floors park intact — *"no step in this roadmap
invokes a live routing harness"* — and that constraint is enforced by a scan
(`tests/scripts/governed_harness_no_live_harness.test.ts`). A fidelity
measurement requires real sessions. So Gap A is **unmeasurable by construction
inside this roadmap**, and the pre-registered reporting rule is:

| Field | Pre-registered value |
|---|---|
| `proxy_to_real_fidelity.value` | `null` |
| `proxy_to_real_fidelity.status` | `unmeasured-by-construction` |
| `proxy_to_real_fidelity.reason` | the 5.2 park, cited |

A run that emitted a number here would have violated 5.2 to get it. Recording
`null` with the reason is the honest outcome and is pre-registered as the
**expected** one — not as a fallback discovered afterwards.

### Gap B — does the skill BODY carry routing signal the description does not?

The production ranker is `src/shared/skillRanking.ts`. Its `RankableSkill`
interface documents the exclusion in one line: *"Deliberately not the body — see
`rankSkills`"*, and `skillTerms` indexes `name + description` (plus
`triggerText` only on request). Nothing in this tree has ever measured what that
exclusion costs.

## The measurement, fixed before it runs

**Instrument.** `scoreSkill` / `skillTerms` from `src/shared/skillRanking.ts`,
unchanged. The body arm adds body tokens to the indexed term set and changes
nothing else. Two arms, one scorer, one corpus — an arm that used a second
scorer would be measuring the scorer.

| Arm | Indexed terms |
|---|---|
| `description` | `name + description` — today's production condition |
| `description+body` | `name + description + SKILL.md body` |

**Catalogue.** Every `src/skills/*/SKILL.md`. Ranking is over the whole
catalogue, because a routing decision is a comparison against everything else.

**Corpus.** The `src/skills/*/evals/triggers.json` cases, **train partition
only**. The partition is the frozen one in
`agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`:
`holdout iff sha256(<skill-directory-name>)[0] < 51`. The 18 holdout corpora are
sealed and this measurement does not open them; the measuring module refuses
them rather than filtering them afterwards, and a test asserts the refusal.

**The seal covers the corpus files, not the catalogue.** A holdout skill's
`SKILL.md` is still ranked against — it is part of the catalogue every prompt
competes in, and removing it would measure a catalogue that does not exist. What
is never read is a holdout `evals/triggers.json`. Stating the boundary here is
cheaper than leaving a reader to infer which artefact the seal names.

**k = 5.** A stated default, not a derived optimum, fixed here so it cannot be
tuned to a result. *Revisit-if:* a delivered set of five is shown to be outside
the token target of the 6.4 pre-registration, in which case k moves **before**
the next run, never during one.

**Case polarity.** `trigger: true` is a positive (the owning skill must be
delivered); `trigger: false` is a negative (it must not). The three-class
vocabulary of step 2.3 (`exemplar` / `near-miss` / `counterexample`) is
reported as a breakdown where present, but the decision rule runs on polarity,
because 876 of the 931 cases carry no class field and a rule keyed on the class
would run on 6 % of the corpus.

## The bar — pre-registered, two-sided

```
RECALL IS THE PRIMARY. FALSE ACTIVATION IS A GUARD, NOT A TIEBREAK.
AN IMPROVEMENT THAT BREACHES THE GUARD IS `harmful`, NOT `signal`.
AN HONEST NULL IS A LEGITIMATE OUTCOME AND CLOSES THE STEP.
```

| Quantity | Definition | Bar |
|---|---|---|
| ΔRecall@5 | (positives whose owning skill is in the top-5 under `description+body`) − (same under `description`), as a percentage of positives | **≥ +5.0 pp** |
| significance | McNemar exact two-sided binomial over the discordant positive cases | **p < 0.05** |
| ΔFalseActivation@5 | (negatives whose owning skill is in the top-5 under `description+body`) − (same under `description`), as a percentage of negatives | **≤ +2.0 pp** |
| power | discordant pairs on the primary | **≥ 10** |

**Verdict function, evaluated in this order:**

1. discordant pairs < 10 → `underpowered`
2. guard breached (ΔFalseActivation@5 > +2.0 pp) → `harmful`
3. ΔRecall@5 ≥ +5.0 pp and p < 0.05 → `signal`
4. otherwise → `null`

`underpowered` and `harmful` are **not** `signal`. Only `signal` licenses
step 6.5 to index the body.

**Why McNemar and not a rerun band.** The estimator is deterministic — the same
tree gives the same ranking every time — so a rerun band would be identically
zero and would measure nothing. The variance that exists is **sampling variance
over cases**, and the paired discordant-pair test is the form that addresses it.
This is the same reasoning `internal/bench/council-topology-promotion-stats-PREREG.md`
applies when it permits an explicit variance band in place of a confidence
interval "where the metric supports one"; it is recorded here rather than
inherited silently, because the two runs measure different kinds of object.

## The prediction, committed in advance

A pre-registration that predicts nothing cannot be embarrassed by the result.
The prediction:

**The guard will be breached, and the verdict will not be `signal`.**

The mechanism is arithmetic rather than intuition. `scoreSkill` computes
`overlap = |taskTerms ∩ skillTerms| / |taskTerms|` — the denominator is the
**task's** term count, not the skill's. Adding body tokens can only grow
`skillTerms`, so every skill's score is **monotone non-decreasing** under the
body arm. Recall therefore cannot fall and false activation cannot fall either;
only their ratio is open. Since a SKILL.md body is one to two orders of
magnitude longer than its description, the body arm should raise scores across
the whole catalogue and compress the ranking rather than sharpen it.

If that prediction is right, the honest outcome is `null` or `harmful`, and
either closes step 5.1 without licensing 6.5. If it is wrong, the bar above is
what says so.

## What this pre-registration does NOT buy

- It does not fix **6.4's** loss ceiling or token target. Those are a separate
  pre-registration, committed in the same commit as this one and binding on a
  different run.
- It does not establish that the ranking proxy predicts production routing.
  That is Gap A, and Gap A is `null` by construction here.
- It does not say the body is useless **to a reader**. It measures one question:
  whether body tokens, folded into this lexical scorer, improve this ranking on
  this corpus. A different retrieval mechanism is a different measurement.
