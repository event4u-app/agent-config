<!-- evidence-type: analysis -->

# Review before freezing — the Phase 5 pre-registration of `road-to-a-setup-that-decides-itself`

Repository `event4u/agent-config`. Step 5.1's verify line: "the pre-registration is hashed before the first run and reviewed by the council before it is frozen." Below is the full draft. A council round earlier on 2026-10-24 chose (2/2, council-decidable) to pre-register now with the three present corpus sources, and asked that the draft fix exact statistical semantics (integer cutoff, denominator, per-source rather than pooled bounds, repeated-run aggregation, flaky outcomes, a prospective power criterion) and state that it measures corpus non-regression, not host equivalence. No computed-arm data exists; none can until another roadmap observes the first host's effect row.

Review the draft as a pre-registration: is anything underspecified enough that it could be decided after seeing data? Is any rule internally inconsistent, or inconsistent with the roadmap text quoted in it?

## What to answer

1. Findings, each with the section it is in, or "none".
2. Whether the draft may be frozen as written.

End with exactly one line: `VERDICT: freeze` or `VERDICT: revise — <the one change that blocks freezing>`.

## The draft

<!-- evidence-type: analysis -->

# Pre-registration — Phase 5 of road-to-a-setup-that-decides-itself

**Status:** DRAFT for council review. Frozen by recording this file's sha-256 in step 5.1 of the
roadmap after the review; any later edit voids the freeze and needs a new review and a new hash.
**Written before any computed-arm data exists.** Step 5.2 cannot run until the first host's effect
row in `src/config/host-injection-effect.json` reads `observed-true` (owned by
`road-to-delivery-on-hook-hosts`); until then no machine can produce a `thinned` decision.
**Basis:** council 2/2, 2026-10-24, option (a), council-decidable —
`agents/evidence/council/setup-prereg-primary-endpoint-20261024.md`.

## What this measures, and what it does not

It measures **corpus non-regression**: whether a labelled obligation that reaches a session with
today's full rule layer still reaches it with the computed (thinned) layer. It does **not** validate
real-host behavioural equivalence — no host-graded case set exists. Every result statement carries
that sentence. Step 5.3 must weigh it.

## Arms

Per thinnable host (`claude-code`, `cursor`, `cline`), at one commit:

- **Today:** the installed layer of step 0.1's fixture (`agents/evidence/analysis/setup-layer-baseline.md`,
  reader `layer_baseline_report`) — every rule full.
- **Computed:** the same install with the layer the decision function returns `thinned` for, built by
  the shipped thin pass (`thinInstalledRuleLayer`, with `ruleForm` keeping the consequence class and
  the `safety-floor` tier whole), plus delivery by the shipped `rule-inject` concern
  (`buildInjection`, shipped `CAP_BYTES`).

A host whose computed decision is not `thinned` contributes no computed arm and is reported as such.

## Sources, outcome per case, regression

From `src/config/layer-form-comparison-corpus.json`, at the commit of the run (counts at drafting,
2026-10-24: routing matrix 593 = 338 positives + 255 near-misses / train 1,307 / obligation 31). Absent sources (`conformance`, `host-graded`) are reported absent.

| Source | Outcome per case | Regression |
|---|---|---|
| obligation class | the rule's full body is present in the installed layer | any case not present |
| routing matrix, positives | the labelled rule's obligation text reaches the session: standing full body, or delivered in full or as its law section on that prompt (with its `open_files`, if any) | reaches in today, not in computed |
| routing matrix, near-misses | secondary only: labelled rule delivered on that prompt | never a regression; counted as false fires |
| trigger-corpus train slice | the labelled skill is in the shortlist | any difference between arms (a negative control: the rule-layer form must not move skill routing) |

The sealed holdout is never opened (`loadTrainCases`).

## Decision rule (frozen semantics of D2)

1. **Critical — zero tolerance.** One obligation-class regression, or one routing-matrix positive
   regression whose labelled rule is in the consequence class or the `safety-floor` tier, blocks
   enablement until fixed and re-run under this same file. No aggregate can offset it.
2. **Per source, never pooled.** For each source with a regression definition, compute the one-sided
   95 % Clopper–Pearson upper bound of the regression proportion. Non-inferior iff that bound is
   ≤ 1 %. At drafting counts (338 matrix positives, 1,307 train cases) this admits **0** regressions in the
   matrix positives and at most **6** in the train cases; the counts at the run decide, recomputed by the same formula.
   The routing matrix is evaluated over positives only; its denominator is the positive count at the
   run.
3. **Power.** With zero observed regressions the bound falls below 1 % only from n ≥ 299 cases. A
   source below 299 cases cannot establish non-inferiority and reads **uncertain**.
4. **Uncertain means stay full** (D2): a source that is uncertain, an arm that could not be built, or
   a run that fails rule 5 keeps every consumer on the full layer.
5. **Repeated runs.** Three runs at the same commit. The pipeline is deterministic; any per-case
   disagreement between runs voids the result as an instrument fault rather than averaging it.
6. **Evaluator independence.** The scorer reads only the corpus, the two installed trees and the
   delivered payload text, and compares bytes. It does not import `layer_form_decision.ts`,
   `layerPromotion.ts` or the projection code under test. The result file and the scorer's diff are
   reviewed by a council seat that did not write them, per `evaluator-independence`.
7. **Reported:** per source and per host — n, regressions, the upper bound, the verdict; the critical
   list (empty or not); the near-miss false-fire count; the absent sources by name.

## Guards (each must hold; a failing guard blocks like a critical case)

- `session_start` p95 via `bench_hook_latency --via-cli`, computed arm installed, is within
  `budgets_ms.any_hook_event.p95_ci` of `src/config/hook-latency-budget.json` and not more than 10 %
  above the today arm measured in the same job.
- No session on a thinned layer without either an arrival record or the carrier roadmap's visible
  line — asserted over the fault matrix below.

## Fault matrix (each a fixture with a stated expectation)

| Fault | Expected |
|---|---|
| dispatcher absent | shell branch prints its line, restores the full layer, demotes |
| stripped `PATH` | carrier probe `not-reached`; no promotion |
| hook stdout hidden | no arrival record → decision `no-arrival-record`, stays full |
| host restart mid-promotion | `promoting` lock with a dead owner → next session restores (`promotion-interrupted`) |
| two simultaneous sessions | one promotes, the other `promotion-in-progress`; no interleaved writes |
| stale heartbeat / old record | arrival records before the promotion boundary never demote |
| nested subagent session | an arrival record with no `session_start` load is `unknown` and never evidence |

## Secondary — never a reason to enable

Standing characters at session start per arm; whether the host's instruction-size warning appears.

## What reopens this file

A committed host-graded case set (graded by what a host did, with fixed prompts and adjudicated
expectations) — it then becomes the primary and this file is re-registered — or a conformance set
whose rows carry a prompt and an expectation.
