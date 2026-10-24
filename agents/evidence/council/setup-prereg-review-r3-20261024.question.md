<!-- evidence-type: analysis -->

# Review before freezing, round 3 — the Phase 5 pre-registration of `road-to-a-setup-that-decides-itself`

Repository `event4u/agent-config`. Round 2 (`setup-prereg-review-r2-20261024.question.md`, beside this file): one seat `freeze`, one `revise` on one point — rule 2's denominator was ambiguous (all positives vs the non-critical subset) and its count was not recorded.

Counting it settled more than the wording. The non-critical subset is **239** positives (338 minus 99 whose labelled rule is critical). At n = 239 the one-sided 95 % Clopper–Pearson bound with zero regressions is 1.25 %, so D2's 1 % candidate margin cannot be established by this corpus at all; reaching ≤ 1 % needs n ≥ 299. That is D2's own recorded revisit condition ("the council at 5.1 finds the corpus too small to power the margin").

Revision: rule 2 now defines n exactly (non-critical positives only, critical ones in neither numerator nor denominator), records 239, and freezes the stricter rule the corpus can support — non-inferior iff ZERO non-critical positives regress — with the bound reported beside it and the result stating that the 1 % margin was not established. Rule 3 states no statistical bound decides anything. Absent sources are stated to contribute nothing.

Review the full revised draft on the same terms: anything that could be decided after seeing data, or an internal inconsistency. Also say whether replacing D2's unpowered 1 % margin with zero tolerance is acceptable as a council-decidable revision of D2, or must go to the owner.

End with exactly one line: `VERDICT: freeze` or `VERDICT: revise — <the one change that blocks freezing>`.

## The revised draft

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

From `src/config/layer-form-comparison-corpus.json`, **read at the commit this file is frozen at** —
that commit is recorded with the hash in step 5.1, and the run checks the corpus out from it. Any
case added, removed or relabelled after it requires a new pre-registration (counts at drafting,
2026-10-24: routing matrix 593 = 338 positives + 255 near-misses / train 1,307 / obligation 31). Absent sources (`conformance`, `host-graded`) are reported absent and contribute nothing to the decision.

| Source | Outcome per case | Regression |
|---|---|---|
| obligation class | the rule's full body is present in the installed layer | any case not present |
| routing matrix, positives | the labelled rule's obligation text reaches the session: standing full body, or delivered in full or as its law section on that prompt (with its `open_files`, if any) | reaches in today, not in computed |
| routing matrix, near-misses | secondary only: labelled rule delivered on that prompt | never a regression; counted as false fires |
| trigger-corpus train slice | the labelled skill is in the shortlist | any difference between arms — a negative control, zero tolerance (rule 1): the rule-layer form must not move skill routing |

The sealed holdout is never opened (`loadTrainCases`).

## Decision rule (frozen semantics of D2)

1. **Critical — zero tolerance, exhaustive, outside rules 2–3.** One obligation-class regression; one
   routing-matrix positive regression whose labelled rule is in the consequence class or the
   `safety-floor` tier; or one train-slice difference — each blocks enablement until fixed and re-run
   under this same file. These are exhaustive checks, not samples: no bound, no power rule, and no
   aggregate can offset them, and zero observed is a pass however small the class.
2. **Non-critical matrix positives — zero observed regressions, reported with their bound.** Let
   n be exactly the number of routing-matrix positives left after removing every rule-1 critical
   positive; critical positives are never in rule 2's numerator or denominator. At the drafting
   commit n = **239** (338 positives, 99 critical). D2's candidate margin — at most one regressed case
   per hundred, valid only with a powered pre-registration — CANNOT be powered by this corpus: with
   zero regressions the one-sided 95 % Clopper–Pearson upper bound at n = 239 is 1.25 %, and reaching
   ≤ 1 % needs n ≥ 299. This is D2's own revisit condition ("the council at 5.1 finds the corpus too
   small to power the margin"), and the frozen rule is the stricter one the corpus can support:
   **non-inferior iff zero non-critical positives regress.** The upper bound is computed and reported
   beside it, and the result statement says the 1 % margin was not established.
3. **No statistical bound decides anything.** Rules 1 and 2 are both counts against zero; the bound in
   rule 2 is reported, never compared. Should n at the frozen commit differ from 239, the same rule
   applies unchanged.
4. **Uncertain means stay full** (D2): a source that is uncertain, an arm that could not be built, or
   a run that fails rule 5 keeps every consumer on the full layer.
5. **Repeated runs.** Three runs at the same commit. The pipeline is deterministic; any per-case
   disagreement between runs voids the ENTIRE result — all sources, all hosts, that commit — as an
   instrument fault, rather than averaging it.
6. **Evaluator independence.** The scorer reads only the corpus, the two installed trees and the
   delivered payload text, and compares bytes. It does not import `layer_form_decision.ts`,
   `layerPromotion.ts` or the projection code under test. The result file and the scorer's diff are
   reviewed by a council seat that did not write them, per `evaluator-independence`.
7. **Reported:** per source and per host — n, regressions, the rule-2 upper bound, the verdict; the critical
   list (empty or not); the near-miss false-fire count; the absent sources by name.

## Guards (each must hold; a failing guard blocks like a critical case)

- `session_start` latency: `bench_hook_latency --via-cli` (its fixed n = 50 per event), three
  invocations per arm in one job, alternating arms; the statistic is the median of the three
  `session_start` p95 readings. The computed arm passes iff that median is ≤
  `budgets_ms.any_hook_event.p95_ci` of `src/config/hook-latency-budget.json` at the frozen commit AND
  ≤ 1.10 × the today arm's median. A bench invocation that errors is repeated once; a second error
  fails the guard. No reading is dropped as an outlier.
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
