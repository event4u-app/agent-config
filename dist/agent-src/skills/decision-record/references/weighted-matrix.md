# Weighted-matrix mode — full procedure

Quantitative variant of the `decision-record` trade-off matrix. Loaded from
[`SKILL.md § Weighted-matrix mode`](../SKILL.md) when the gate fires; this
file carries the elicitation detail, anchor discipline, sensitivity math and
a worked example. The score is a **structured argument, not a verdict**.

## Gate — when the mode fires (all four, else stay qualitative)

1. **≥ 3 options.** Two options rarely need weights — the qualitative matrix
   or a plain decision is faster and less pseudo-precise.
2. **No single dominant criterion.** If one criterion decides it (a hard
   budget cap, a regulatory constraint), the matrix is theatre — decide on
   the constraint.
3. **Costly / hard to reverse.** Reversible decisions get a one-line "just
   decide" redirect; the mode's overhead is only worth a one-way door.
4. **Commensurable criteria.** When options conflict on *values* (privacy vs
   revenue, safety vs speed-to-market), numbers hide the conflict instead of
   resolving it — route to `stakeholder-tradeoff` first.

## Elicitation — user first, always

1. User states the decision in one sentence and names the options.
2. **User lists criteria and assigns weights 1-10 BEFORE any scoring.** Do
   not propose criteria first: an AI-proposed list anchors the user onto the
   AI's frame (anchoring evidence — the council overruled AI-first
   elicitation on exactly this ground, 2026-07-19). Prompt shape: *"Which
   criteria matter for this decision, and how much does each weigh, 1-10?"*
3. After the user's list is locked, the AI may append missed criteria — each
   explicitly labeled `(AI-suggested)`, each weighted by the user, never by
   the AI.
4. **Criteria hygiene:** cap the list at 4-8. Merge near-synonyms
   ("maintainability" + "ease of change" = one criterion) — two names for
   one concern double-counts its weight. Check independence: if scoring one
   criterion forces another's score, merge or drop.

## Scoring — fixed anchors, never relative

Score every option 1-10 per criterion against a **fixed anchor line the
matrix declares up front**:

```
Criterion: Operational cost (weight 8)
  1  = needs a dedicated on-call rotation
  10 = fully managed, zero routine operations
```

Never score relative-to-best-in-set ("this one is the cheapest → 10") — a
new option would silently re-scale every row. Anchors make scores
re-checkable and the matrix extensible.

## Sensitivity block — the load-bearing gate

Compute weighted sums, then ALWAYS report, in this order:

1. **Close-call margin.** Winner's sum vs runner-up as a percentage of the
   winner. **< 10 % → "no clear winner — the matrix says the options are
   equivalent; decide on unquantified factors."** Never present a < 10 %
   margin as a verdict.
2. **Weight-flip threshold.** The smallest single weight change that flips
   the winner (*"raise Operational cost from 6 to 8 and Option B wins"*). A
   one-step flip is a fragile result — say so.
3. **±1-score flip test.** Does any single score changed by ±1 flip the
   winner? User-guessed scores carry at least ±1 of noise; a winner inside
   that noise band is reported as fragile, never as "the rational choice".

Rationale: user-guessed scores × user-guessed weights is pseudo-precision
unless the fragility is surfaced — the sensitivity block, not the
argue-against step, is what keeps the mode honest (council dissent encoded
2026-07-19).

## Argue against the winner — delegated, scoped

After the sums, delegate to `adversarial-review` — the `premortem`
delegation pattern, never an inline reimplementation:

> Attack the top-scoring option. Use the losing options' strongest criteria
> as the attack surface: what did the weights hide, what breaks first, which
> anchor was scored generously?

Fold the attack summary into the output. If the attack finds a criterion the
matrix missed, re-run elicitation step 3 — do not silently patch the score.

## Output contract (appended to the standard payload)

```
Weighted matrix (weights 1-10, scores 1-10 vs fixed anchors):
  | Criterion (weight) | <opt 1> | <opt 2> | <opt 3> |
  | ...                |         |         |         |
  Weighted sums:  <opt 1>: NN · <opt 2>: NN · <opt 3>: NN

Sensitivity:
  margin: NN %  (< 10 % → no clear winner)
  weight-flip: <smallest change that flips> | none within ±2
  ±1-score flip: yes → fragile | no

Attack summary (adversarial-review, scoped to the winner):
  <2-4 bullets>

Intuition caveat: the matrix complements intuition — resistance to the
result signals a wrong weight or unquantified information; surface it,
don't ignore it.

The score is a structured argument, not a verdict.
```

Then hand off to `adr-create` exactly as the qualitative flow does.

## Worked example (compressed)

Decision: pick a queue backend (4 options, no dominant criterion, one-way
door — gate passes). User criteria/weights: Operational cost 8, Ecosystem
maturity 6, Throughput headroom 5, Migration effort 4; AI appends
`Vendor lock-in (AI-suggested)`, user weights it 3. Anchors declared per
criterion; scores land; sums: A 178 · B 171 · C 149 · D 122. Margin 3.9 % →
**no clear winner** — report equivalence, surface that A vs B differ mainly
on lock-in (unquantified confidence), delegate the attack on A, let the
user decide on the surfaced residual. The matrix did its job by *refusing*
to hand down a verdict.
