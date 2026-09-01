---
complexity: structural
review_by: 2027-03-31
---

# Stub: road to council topology instrumentation and its live-run evidence

> **Stub — not active work.** Created 2026-09-01 (drain run 12) by an AI council
> disposition on `road-to-inbox-harvest-2026-08-e-council-topology-evidence`,
> which closed the same day with **incomplete scope and explicit deferrals**.
> Twelve steps are `[-]` there and point here. `[-]` means **DEFERRED, not
> cancelled and not satisfied.**
>
> **Everything already built stays built.** Every test named below is committed
> and runs in CI regardless of the checkbox state — the council was explicit
> that these guards are defensive infrastructure, not blocked work.

## The verdict this stub carries

AI council 2026-09-01, members **anthropic (claude-sonnet-4-5)** and **openai
(codex-default)**, 2 rounds, blind chairman, subscription transport
(`billable=0`, `$0.0000`), quorum `2/2 present, needed 1 — concluded`. Both
seats converged on deferral for every step below and on closing the parent
roadmap around them.

The floor both seats set, in the anthropic seat's words: **"no indefinite `[ ]`
parking — 'mechanism built, waiting for population' is a deferred state, not an
active one."** The openai seat put the same rule as a semantics claim: `[x]`
means the complete verify clause passed, `[ ]` means work is genuinely active
with a committed path, `[-]` means intentionally postponed under stated
conditions. Every step here failed the first two tests.

## Group 1 — seven guarded baselines: built, red-proven, population empty

Each carries a `guarded_baseline` block in the parent with a real sabotage run.
The guard is falsifiable today; the thing it guards does not exist.

| Step | Guard | Red proof |
|---|---|---|
| 7.3 | `tests/scripts/ai_council/probe_path_above_council.test.ts` | 1 of 7 RED, two independent sabotages |
| 10.1 | `tests/scripts/ai_council/replay_route.test.ts` | 5 of 13 RED |
| 10.6 | `tests/scripts/ai_council/early_stop_savings_shape.test.ts` | 4 of 11 RED |
| 11.1 | `tests/scripts/ai_council/routing_training_row.test.ts` | 3 of 13 RED |
| 12.1 | `tests/scripts/ai_council/council_topology_surface.test.ts` | 3 of 11 RED |
| 12.2 | `tests/scripts/ai_council/explain_route.test.ts` | 6 of 15 RED |
| 12.3 | `tests/scripts/ai_council/force_topology_prohibitions.test.ts` | 4 of 11 RED, byte-identical restore |

**Resumption trigger, per step:** when the population it guards — topology
selection, a force-topology control, a stage-output producer, prompt storage on
a training row — enters an integration branch or a release candidate, verify the
guard still prevents the failure mode and close the step then.

**Claims forbidden while `[-]`:** that the constraint holds for an implemented
feature; that the absent feature is production-safe; that the verify clause
passed; and — the one both seats named twice — **that sabotage sensitivity is
positive runtime validation.** The only permitted claim is that the defensive
test exists and detects the planted violation.

## Group 2 — three steps whose mechanism is unbuilt

- **5.4** *Final synthesis retains unresolved disagreement, the strongest
  minority evidence, and what evidence would resolve it.* No synthesis template
  asks for any of the three: `DEFAULT_SYNTHESIS`
  (`src/scripts/ai_council/prompts.ts:284`) and its three siblings are all
  silent. The openai seat refined the framing and it is worth keeping: the
  population here is **not** empty — dissent exists today. What is absent is an
  explicit synthesis contract and a qualifying validation run. Both seats
  refused to license building it as prose-only: *"merely adding prose to four
  templates would create another indefinitely parked baseline"*.
  **Resume when** a representative real-dissent run is scheduled and the
  synthesis output can be structurally checked for all three elements.
  **Do not claim** that synthesis preserves unresolved disagreement, minority
  evidence, or resolution evidence until one output demonstrates all three.
- **10.2** *Attribute each useful correction to the first stage where it
  appeared.* The vocabulary exists with **no producer**: `StageOutput {stage,
  produced, calls}` (`src/scripts/ai_council/replay_route.ts:49-54`) is carried
  on `CouncilRouteRecord` (`:74`), and the module's only importer anywhere is
  its own test.
  **Resume when** production code emits stage records and a real correction
  crosses observable stages. **Do not claim** per-correction attribution or
  operational use of `CouncilRouteRecord`.
- **10.3** *Emit `zero_marginal_value_call_rate`.* The metric does not exist in
  any form — `zero_marginal|marginal_value|marginalValue|zmv` returns zero hits
  across `src/` and `tests/`; the only occurrences in the repository are the
  step and the acceptance criterion naming it.
  **Resume when** "useful change" and "zero marginal value" have stable
  comparison semantics and a real-run budget is reserved. **Do not claim** that
  marginal value is measured, or that the rate exists or is non-null.

## Group 3 — the inline-findings pair, and a reproduced finding

- **1B.1** *Findings schema as a fenced trailing block in the initial analysis
  response, replacing the second extraction call.* The council authorised one
  bounded verification run with `[x]` **only on exact success**. **The run was
  made on 2026-09-01 and it did not close the step.**

  Two seats, analysis lens, `--rounds 1`, `consensus_scoring.enabled: true` and
  `inline_findings: true` via a temporary `AI_COUNCIL_CONFIG`. Per-provider
  counter: **anthropic 10 → 12 (delta 2), openai 10 → 13 (delta 3)**. The
  anthropic seat inlined — `raw_text` retained, reply ending in
  `_[inline findings block extracted: 7 item(s); …]_`, which
  `harvest_inline_findings` writes only after both `parse_findings_outcome` and
  `_isOwnFindingsBlock` pass, so the marker is a parse receipt and not a fence
  sighting — and issued **zero** extraction calls. The `codex-default` seat
  emitted no block, no `raw_text`, and `consensus.extraction_responses` holds
  exactly one entry, `provider=openai`. The closure condition is ZERO extraction
  calls, and one is not zero.

  **What this run adds over the 2026-08-31 attempt is reproduction.** Same
  failure, same seat, a different prompt and a different day: the
  contract-compliance miss by `codex-default` is a stable seat-level property,
  not a one-off. It is still **not a rate** — n = 2, no matched comparator, and
  1B.4's arms have not started.

  **Resume with** one allocated representative analysis run in which **every**
  answering seat carries the block. **Do not claim** that the second extraction
  call is eliminated or that inline parsing is proven. A passing 1B.1 provides
  no statistical evidence for 1B.4.
- **1B.4** *Promotion gate across >= 10 real analysis runs.* Roughly 40-60 calls
  against a 50-per-provider-per-UTC-day cap, and that budget is also the
  council's own decision mechanism — the anthropic seat named this as the harder
  of the two scarcity arguments. **An unrun gate is neither a pass nor a null.**
  **Resume when** capacity is explicitly allocated for >= 10 representative runs
  **and** the parse, `unparsed` and finding-quality comparison methods are
  frozen beforehand. **Do not claim** the >= 70 % rate, absence of an `unparsed`
  regression, finding-quality equivalence, promotion readiness, **or a null
  result.**

## Floors the council refused to move

1. No `[x]` unless every part of the stated verify clause passed.
2. No indefinite `[ ]` without a scheduled execution path.
3. No conflation of red-proof with real-world conformance.
4. No budget spend without a cost/benefit case.
5. No statistical or regression claim from a single run.
6. No claim that resource scarcity proves anything except the reason for
   deferral.
