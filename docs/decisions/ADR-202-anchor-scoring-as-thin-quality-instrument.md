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

# ADR-202 — Deterministic anchor-scoring is the thin-projection quality instrument; paired judging stays closed

## Status

**Accepted — instrument selected, no measurement performed.** This record fixes
*how* thin-vs-eager quality will be measured if it is measured again. It does
not re-open Phase H1, does not license a flip, and produces no verdict.

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
   continuity habit dressed as a floor. Two candidate decision rules are
   evaluated against each other and one is pre-registered, with its rationale,
   **before** answers are generated (§ Threshold pre-registration). A run
   started without a pre-registered threshold is void by construction — the
   number could then be chosen after seeing the data, which is the failure the
   two closed judge runs were pre-registered to avoid.
6. **The scorer is falsified before it is trusted.** Determinism removes
   `inconsistency_rate`, the diagnostic that caught run 3's unreliability, so
   the instrument ships with a replacement: known-bad and known-good fixtures
   plus a mutation test over the anchor evaluation, in the **same PR** as the
   runner (§ Scorer falsification). No live run before that suite is green.

## Threshold pre-registration (Decision 5)

Two candidate decision rules. Exactly one is pre-registered — with its rationale
and its δ, if it has one — in this ADR before the first answer is generated.

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
