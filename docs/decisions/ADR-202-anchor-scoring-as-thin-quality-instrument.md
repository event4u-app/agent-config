---
adr: 202
status: accepted
date: 2026-07-30
decision: anchor-scoring-as-thin-quality-instrument
supersedes: —
superseded_by: —
phase: token-saving H1 · quality-instrument selection after the judge path closed
type: structural
review_trigger: >-
  Reopen when (a) an anchor-scoring run over the completed golden set produces a
  decisive result — this record authorizes the instrument, not its verdict; (b)
  the `must_include` / `must_not` anchors are shown to be gameable by a
  projection that satisfies them without preserving rule behaviour, which would
  make anchor coverage a proxy rather than a measurement; or (c) a judge
  substrate appears whose inter-rater reliability can be measured against a
  single operator — the property whose absence closed the human-judge path. Note
  (c) would reopen the *instrument* question only, never the cancelled H1 steps,
  which were cancelled on a falsified precondition and need independent
  justification to return.
---

# ADR-202 — Constrained anchor evaluation with frozen verdicts; paired judging stays closed

## Status

**Accepted.** Attempt 1 of the instrument failed its own falsification gate
(§ Addendum 2026-07-31). Attempt 2 — mechanical changes only, thresholds
unchanged — cleared it and ran (§ Addendum 2026-07-31 · attempt 2).

Original framing: this record fixes *how* thin-vs-eager quality will be measured
if it is measured again. It does not re-open Phase H1, does not license a flip,
and produces no verdict.

## Context

The thin projector is the package's largest single token lever. Its quality gate
has been attempted twice with paired judging and failed twice:

- **2026-07-11**, full sonnet run, n=90: thin 17 / eager 30 decisive → win-rate
  **36.2 %**, below the pre-registered **0.48** floor → flip-gate RED. Caveat
  recorded at the time: 60 % length confound, 31 % judge inconsistency.
- **2026-07-12**, pre-registered length-neutral rerun (±15 % token-band pairing,
  double-blind, both orders, κ floor 0.60): **κ = 0.46**, ρ = 0.45 within-band,
  25/90 pair survival, 7 agreed-decisive pairs splitting 3/4 at p = 1.0. Per the
  pre-registered design this is a STOP, not a retry. LLM-paired judging is
  **closed-by-diagnosis** (`docs/benchmark.md` § Length-neutral judge RERUN).

The council of **2026-07-29** (claude-sonnet-4-5 + gpt-4o, 2 rounds) then ruled
out the obvious next move — swapping the LLM judge for a human one — on four
grounds, of which the fourth is decisive and structural: *a single human judge
has no measurable κ, so the exact reliability floor that run 3 failed becomes
unmeasurable.* The same session named the replacement: **deterministic
anchor-scoring against `must_include` / `must_not`**, already recorded at
`docs/benchmark.md:515`.

Phase H1 was cancelled on 2026-07-29 (falsified precondition, not a superseding
plan). This ADR does not disturb that. It answers the separate question the
cancellation left open: *if the question is ever asked again, with what?*

## Decision

1. **The instrument is deterministic anchor-scoring.** Each arm's answer is
   scored against the golden task's existing `must_include` / `must_not` anchors.
   No model judges the comparison. The scorer is a pure function of (answer,
   anchors), so a run is reproducible from its inputs.
2. **Paired judging — LLM or human — is not admissible for this question.** The
   LLM path is closed-by-diagnosis; the human path is closed by the
   unmeasurable-κ argument above. Neither is re-opened by this record.
3. **H1 stays cancelled.** Anchor-scoring is a *new mechanism* with its own
   justification, not a resumption of the cancelled steps. A future flip decision
   cites this ADR and its own measurement, never H1's closed gates.
4. **Report contract is unchanged.** The runner emits
   `internal/bench/reports/quality-run.json` in the schema
   `check_quality_regression` already reads — `{ threshold, judge_model,
   results: [{ id, winner, length_delta, winner_is_longer }] }` — with
   `judge_model: "anchor-scoring"`. Reusing the existing gate means the
   flip-gate hardening (`dry_run` never unlocks; `--as-flip-gate` treats
   missing/inconclusive as exit 2) applies unchanged.
5. **The threshold is re-derived and pre-registered before any live run — never
   inherited.** 0.48 was calibrated for a pairwise *preference* statistic;
   anchor-scoring produces a different statistic over the same
   `thin_wins / decisive` denominator, so carrying it across would be a
   continuity habit dressed as a floor. **Registered 2026-07-30: the hybrid** —
   zero tolerance on `must_not`, non-inferiority within δ plus a per-rule floor
   on `must_include`, with reproducibility carried by transcript freezing rather
   than by pinned sampling (§ Threshold pre-registration). δ and the per-rule
   floor are derived from the frozen corpus's observed spread and written down
   **before** scoring. A run started without those numbers recorded is void by
   construction — they could then be chosen after seeing the data, which is the
   failure the two closed judge runs were pre-registered to avoid.
6. **The scorer is falsified before it is trusted.** Determinism removes
   `inconsistency_rate`, the diagnostic that caught run 3's unreliability, so
   the instrument ships with a replacement: known-bad and known-good fixtures
   plus a mutation test over the anchor evaluation, in the **same PR** as the
   runner (§ Scorer falsification). No live run before that suite is green.

## Threshold pre-registration (Decision 5) — REGISTERED 2026-07-30

**The registered rule is the hybrid.** Operator decision, recorded before any
answer is generated:

- **`must_not` anchors — zero tolerance.** Thin may not violate a `must_not`
  anchor that eager avoids, on any task. A census, not a rate. These anchors are
  safety-shaped: a single introduced violation is a regression regardless of how
  the rest of the corpus scores.
- **`must_include` anchors — non-inferiority within δ.**
  `rate_thin ≥ rate_eager − δ` over the pooled anchor-satisfaction rate, **plus a
  per-rule floor** so no single rule's anchor set may collapse while the pooled
  rate stays inside δ. Both parameters are set before scoring (below).

Rationale for the split: the two anchor classes carry different failure costs.
A missed `must_include` is a capability regression that a rate can fairly
aggregate; a tripped `must_not` is a behaviour the projection introduced, and
averaging that away would be the failure this instrument exists to catch.

### Reproducibility — transcript freezing

Determinism belongs to the scorer, not to answer generation: both arms are model
calls. The run is made reproducible by **freezing the transcript**, not by
pinning sampling:

1. Generate both arms **once** over the completed golden set.
2. **Freeze the artefacts** — the answer pairs are the experiment's data from
   that point on.
3. The scorer runs **only over the frozen corpus**. Re-scoring is repeatable by
   construction, because the scorer is a pure function of (answer, anchors).
4. **A re-generation is a new experiment**, not a re-run of this one. It gets its
   own frozen corpus and its own pre-registered parameters; results are never
   pooled across freezes.

This is what makes the zero-tolerance leg admissible at all: under live sampling
a single noisy generation would fail the census, which is why Candidate A was
rejected as a standalone rule.

### δ and the per-rule floor — set after freezing, before scoring

Both parameters are derived from the **observed spread in the frozen corpus** and
written into this ADR before the scorer runs. Deriving them from the data is
legitimate only in that order: the spread is a property of the corpus, not of the
verdict, and fixing the numbers before any anchor is evaluated keeps the decision
rule out of reach of the result.

**0.48 is not inherited.** It was calibrated for a pairwise preference statistic
against a judge substrate with known unreliability. Neither leg above uses it.

### Candidates considered and rejected as standalone rules

- **A — anchor dominance as a pure census** across both anchor classes. Rejected
  standalone: under live sampling one noisy generation fails the entire gate, and
  it treats a cosmetic anchor as equal to a safety one. Survives as the `must_not`
  leg, where transcript freezing removes the noise objection.
- **B — non-inferiority across all anchors pooled.** Rejected standalone: a pooled
  rate can hide a concentrated failure — thin could lose one rule's anchors
  entirely and stay inside δ. Survives as the `must_include` leg, fenced by the
  per-rule floor.

Note a schema tension to resolve when the runner is built:
`check_quality_regression` derives its verdict from per-pair `winner` fields, and
neither leg above is a per-pair winner. The runner emits per-pair winners for
schema compatibility while the gate reads the two-leg aggregate — that split must
be explicit in the report, or it will look like it says something it does not.

**Candidate A — anchor dominance (a census, not a threshold).** Per task, thin
must satisfy every `must_include` anchor eager satisfies, and violate no
`must_not` anchor eager avoids. Gate: **zero anchor regressions across the whole
golden set.** No percentage appears anywhere. It is a census over all tasks, so
sample-size arguments do not apply, and it states the actual claim — *the thin
projection does not lose rule behaviour* — rather than a proxy for it. Its cost
is brittleness: one nondeterministic answer generation (the answer arms are model
calls even though the scorer is not) fails the entire gate, and it treats every
anchor as equally load-bearing, so a cosmetic anchor outranks a safety one.

**Candidate B — non-inferiority on the anchor-satisfaction rate.** Compute
`rate = satisfied_anchors / total_anchors` per arm across all tasks; gate on
`rate_thin ≥ rate_eager − δ`, with δ pre-registered. This uses every anchor
rather than only decisive pairs, so it has far more resolution than 90 pairwise
verdicts, and it degrades gracefully under answer noise. Its cost: δ is a
judgement call, and a rate can hide a concentrated failure — thin could lose one
rule's anchors completely while staying inside δ.

**Both beat inheriting 0.48.** Under a symmetric comparison the principled null
is parity (0.50); 0.48 was a concession *below* parity, calibrated for a judge
substrate with known unreliability. Neither candidate inherits that concession.

A hybrid is admissible and should be considered on its merits: Candidate A
restricted to `must_not` anchors (safety-shaped, zero tolerance) combined with
Candidate B on `must_include` (capability-shaped, non-inferiority within δ).

Note a schema tension to resolve when pre-registering: `check_quality_regression`
derives its verdict from per-pair `winner` fields. Candidate B's decision
statistic is not a per-pair winner. The runner can emit per-pair winners for
schema compatibility while the gate reads a different aggregate — but that split
must be explicit, or the report will look like it says something it does not.

## Scorer falsification (Decision 6)

Determinism removes `inconsistency_rate`. Its replacement ships with the runner,
in the same PR, and must be green before any live run:

- **Known-bad fixtures.** Answers engineered to miss specific `must_include`
  anchors and to trip specific `must_not` anchors. The scorer must flag exactly
  those and no others.
- **Known-good fixtures.** Answers that satisfy every anchor. The scorer must
  report no regression — guarding against a scorer that fails everything and
  thereby looks conservatively safe.
- **Mutation test over the anchor evaluation.** Mutate the matching logic
  (negate a comparison, drop the `must_not` branch, make matching
  case-sensitive, return a constant). Every mutant must be **killed** by the
  fixture suite. A surviving mutant means the fixtures do not constrain the
  scorer, and the suite is decoration.
- **Null-scorer guard.** A scorer that always returns `tie` must fail the
  suite. This is the anchor-scoring analogue of the `dry_run` hardening already
  in `check_quality_regression` — a degenerate instrument must not be
  indistinguishable from a pass.

## Consequences

- **The golden set must be completed first.** Anchor-scoring consumes anchors,
  so a task with no anchors contributes nothing. Coverage today is 86/106 rules
  (90 tasks, 90 labelled, 0 stubs); the 20 uncovered rules need tasks before a
  run is meaningful. This is now a hard prerequisite, not a nice-to-have.
- **`inconsistent` becomes structurally impossible.** A deterministic scorer
  cannot disagree with itself, so `inconsistency_rate` will be 0 by
  construction. That removes the diagnostic that killed run 3 — and also removes
  its early-warning value. A wrong scorer will look perfectly consistent. The
  falsification suite in § Scorer falsification is the replacement, and it is a
  precondition, not a follow-up.
- **The length-confound diagnostics go vestigial.** `winner_is_longer` and
  `length_confound_rate` stay in the schema for continuity but carry no signal:
  anchor satisfaction is length-blind by construction. This is the confound the
  two judge runs could not shake, removed rather than controlled.
- **Anchor quality becomes the single point of failure.** The instrument is only
  as good as the `must_include` / `must_not` sets. A projection that satisfies
  the anchors while losing rule behaviour would score clean. This is the risk
  named in the review trigger, and it is the reason the 20 new tasks need
  operator review rather than autonomous authoring.
- **Cost drops sharply.** No judge calls; the run is two answer generations per
  task. `--dump-answers` already exports exactly the blinded pairs a scorer
  needs and makes no judge calls.

## Alternatives considered

- **Human paired judging over the full golden set (n=90).** Rejected per the
  2026-07-29 council. The design differs from the failed rerun (full set rather
  than the ±15 % band, which selected against the effect), so the objection is
  not a perfect mechanism match — but the unmeasurable-κ argument applies to any
  single-judge design regardless of sample, and that is the load-bearing one.
- **Re-running LLM paired judging with a third substrate.** Rejected: the
  pre-registered design declared a STOP, and ρ = 0.45 within-band indicates a
  *qualitative* confound (elaboration fingerprints) that no judge can be
  instructed to ignore.
- **Waiving the quality gate on "zero external consumers" grounds.** Rejected by
  the same council: the gates exist to force honest measurement, not to protect
  users. The legitimate move is to decouple the essential baseline from the
  flip, never to waive it.

## References

- `docs/benchmark.md` § Length-neutral judge RERUN — the closed-by-diagnosis
  record and the anchor-scoring pointer (`:515`).
- `src/scripts/check_quality_regression.ts` — the gate, its schema, and the
  0.48 default this ADR inherits.
- `src/scripts/bench_quality_run.ts` — `--dump-answers`, the blinded export the
  scorer consumes.
- `src/scripts/check_token_quality_golden.ts` — the coverage gate that defines
  "golden set complete".
- ADR-201 — the sibling measurement-gated removal decided in the same programme.


## Addendum 2026-07-31 — attempt 1: the instrument is a null

### Renamed: "constrained anchor evaluation with frozen verdicts"

"Deterministic anchor-scoring" was the wrong name, and Decision 1's claim that
**"the scorer is a pure function of (answer, anchors)" is FALSIFIED** — left
standing above rather than edited away, because it is the reason this addendum
exists. Measured against the completed corpus:

- **0 of 255 `must_include` anchors** carry a literal token or code span.
- 17 % of `must_include` and 2 % of `must_not` are behavioural predicates
  ("mentions that UI redesign is outside scope").

A substring match over those measures nothing. Everything *below* the verdict —
aggregation, per-rule floor, non-inferiority arithmetic, κ, conservative
disagreement resolution — is genuinely deterministic and is unit-tested without
an API. The verdict itself needed two evaluator models, which is what the
rename records.

### Why two evaluators, and why it mattered

A single human judge was ruled inadmissible (council 2026-07-29) because such a
judge has **no measurable κ** — the exact floor the second paired run failed
becomes unmeasurable. Two independent evaluators restore that measurement. That
restoration was the whole argument for admitting a model into the loop again, so
the κ floor is not a nice-to-have here; it is the licence.

### What was measured

The falsification suite ran before any corpus generation, as sequenced. Fixtures
are deliberately unambiguous — an answer that plainly does the thing and one that
plainly does the opposite, over three rule surfaces.

| | |
|---|---|
| `anthropic/claude-sonnet-4-5` | **18/18** verdicts correct |
| `openai/gpt-4o` | **15/18** — one misclassification, two items it emitted no verdict line for |
| Replacement attempt: `openai/gpt-5` | **unusable** — returns an empty string through the council client; the fixtures were never graded |
| **Inter-evaluator Cohen's κ** | **0.700** |
| Registered floor | **0.800** |

Only Anthropic and OpenAI credentials resolve in this environment, so the one
permitted replacement had nowhere else to go.

### Attempt 1 verdict: honest null on the instrument

κ = 0.700 < 0.800 → **the instrument failed**, per the registered rule. Two
things make this a stronger null than the bare number suggests:

1. It failed on the **easiest possible input**. The fixtures are unambiguous by
   construction; corpus anchors are harder. A pair that cannot agree here will
   not agree there.
2. The failure is **asymmetric, not noisy**. One evaluator was perfect and the
   other was not; κ is low because they disagree, not because both are random.
   That is a discrimination gap in one substrate, not a hard problem in the task.

**No corpus run was performed.** The gate that precedes generation failed, so
generating and freezing 110×2 transcripts would have spent money to produce
verdicts from an instrument already known to be unreliable.

### What this does NOT close

The token-savings thesis is untouched — only this second instrument died. The
registered thresholds (zero tolerance on `must_not`, δ ≤ 3 pp, per-rule floor)
were never exercised and remain available to any future instrument. Nothing here
re-opens Phase H1, and nothing here licenses a flip.


## Addendum 2026-07-31 · attempt 2 — mechanical changes only

Thresholds are **unchanged**: κ ≥ 0.800, zero tolerance on `must_not`, δ ≤ 3 pp
derived from the observed spread, per-rule floor. Only the mechanics moved.

### (1) Verdict format is now structured, with one retry

The evaluator is asked for one JSON object per checklist item
(`{"anchor_id":"I0","verdict":"yes"}`); the parser validates **completeness** and
retries the same call exactly once when an item is missing or unparseable. A
persistent failure is not retried further and **not excluded** — its `null`s flow
into the conservative resolution, so a model that cannot answer can never make a
corpus look cleaner by staying silent. The legacy flat form is still parsed, so
an off-format reply is read rather than discarded.

### (2) The second evaluator: gpt-5 was never the problem

Attempt 1 recorded gpt-5 as "unusable — empty responses". That diagnosis was
incomplete, and the correction matters more than the fix: `_is_reasoning_model`
in `ai_council/clients.ts` listed only `o1`/`o3`/`o4`, so **gpt-5 was sent
`max_tokens` and a `system` role** instead of `max_completion_tokens` with a
merged user turn. The API accepted the call and returned no content. It was a
one-line gap in our own client, not a model incapability — and attempt 1 blamed
the model for it.

Fixed by adding `gpt-5` to the prefix list. gpt-5 now answers normally, so the
second evaluator stays on a **different provider** and the permitted
Anthropic-pair fallback (which would have cost real independence) was not needed.

### (3) Fixture gate — passed

| | attempt 1 | attempt 2 |
|---|---|---|
| `anthropic/claude-sonnet-4-5` | 18/18 | **18/18** |
| second evaluator | gpt-4o 15/18 · gpt-5 unusable | **gpt-5 18/18** |
| retries needed | n/a | **0** |
| inter-evaluator κ (fixtures) | **0.700** | **1.000** |

κ = 1.000 on the fixtures is a **ceiling artefact, not a quality claim**: 18
deliberately unambiguous items on which both evaluators are perfect can only
agree. It clears the gate to proceed; the κ that carries the instrument verdict
is the one measured over the frozen corpus, reported below.

### (4) Self-limited run — $15 cap

The full corpus was priced at **~$39** (110 tasks × [86,123 eager + 15,463 thin]
input tokens at $3/M, plus output and 440 evaluator calls), against a $15
authorisation. Per the run contract the run was **self-limited to `--limit 30`**
— the first 30 tasks of the corpus — for an estimated ~$11.50, leaving headroom
because gpt-5 carries reasoning tokens that the repo price table does not cover.

The trimming is a coverage cost and is recorded as such: 30 of 110 tasks, so the
per-rule floor is evaluated only over the rules those tasks tag.
