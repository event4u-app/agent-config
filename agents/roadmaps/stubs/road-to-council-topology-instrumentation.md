---
complexity: structural
review_by: 2027-03-31
---

# Stub: road to council topology instrumentation and its live-run evidence

> **Stub — not active work.** Created 2026-09-01 (drain run 12) by an AI council
> disposition on `road-to-inbox-harvest-2026-08-e-council-topology-evidence`,
> which closed the same day with **incomplete scope and explicit deferrals**.
> Twelve steps are `[~]` there and point here. `[~]` means **DEFERRED —
> planned, carried, and not satisfied.**
>
> **Glyph note — do not "restore" this.** This stub read `[-]` until 2026-09-01.
> In this tree `[-]` means **cancelled — scope dropped, won't happen at all**
> and is additionally owner-reserved; `[~]` means **deferred**
> (`docs/guidelines/agent-infra/roadmap-progress-mechanics.md:218-219`,
> `src/agent-src/scripts/update_roadmap_progress.ts:25`,
> `src/agent-src/templates/roadmaps.md:30`,
> `src/agent-src/contexts/execution/terminal-states.md:41`; owner-reserved at
> `src/agent-src/scripts/archive_completed_roadmaps.ts:396`). The error came from
> transcribing the council's **own** vocabulary — both seats wrote "DEFER `[-]`"
> throughout their responses. The parent roadmap was corrected to `[~]` by an R2
> review before it shipped and carries its own correction note; these stubs were
> not corrected with it.
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
conditions — **the seat's vocabulary, not this tree's**, where that sense is
`[~]` (glyph note above). Every step here failed the first two tests.

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
| 12.3 | `tests/scripts/ai_council/force_topology_prohibitions.test.ts` | 3 of 13 and 1 of 13 RED across two sabotages, byte-identical restore (sha256-pinned) |

**Resumption trigger, per step:** when the population it guards — topology
selection, a force-topology control, a stage-output producer, prompt storage on
a training row — enters an integration branch or a release candidate, verify the
guard still prevents the failure mode and close the step then.

**Claims forbidden while `[~]`:** that the constraint holds for an implemented
feature; that the absent feature is production-safe; that the verify clause
passed; and — the one both seats named twice — **that sabotage sensitivity is
positive runtime validation.** The only permitted claim is that the defensive
test exists and detects the planted violation.

## Group 2 — three steps whose mechanism is unbuilt

- **5.4** *Final synthesis retains unresolved disagreement, the strongest
  minority evidence, and what evidence would resolve it.* **Corrected
  2026-09-03: the templates are not silent, and the remaining gap is one element
  of the three, not all three.** Measured over
  `src/scripts/ai_council/prompts.ts`: element 1, unresolved disagreement, is
  asked for by all four templates — `### Clashes` in `DEFAULT_SYNTHESIS`
  (`:291`, "State both sides with a one-line reviewer-label citation per side"),
  `### Conflicts` in `PR_SYNTHESIS` (`:320`), `### Outliers` in
  `ANALYSIS_SYNTHESIS` (`:356`), and the mandated convergence / divergence
  synthesis in `CREATIVE_SYNTHESIS` (`:380`). Element 2, retaining the strongest
  minority evidence, is asked for by one — `### Outliers`, "Keep them — they are
  signal for a future deeper analysis pass" (`:356-358`). Element 3, what
  evidence would resolve the disagreement, appears in **none**: a grep for that
  clause across the file returns zero, and `### Kill criteria` (`:305`, `:332`,
  `:366`, `:384`) falsifies the *recommendation*, not the disagreement. So 5.4's
  remaining scope is ONE element in four templates. The openai seat refined the
  framing and it is worth keeping: the
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
  on `CouncilRouteRecord` (`:74`), and its only importers anywhere are two test
  files — `tests/scripts/ai_council/replay_route.test.ts` and
  `tests/scripts/ai_council/probe_path_above_council.test.ts`. **Zero production
  importers**, which is the load-bearing half; the count was corrected 2026-09-03
  from "its own test" alone.
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

**Claims forbidden while `[~]`, for the group as a whole.** Consolidated
2026-09-01 from the per-item clauses above and from the three deferral blocks in
the archived parent (`5.4` at
`agents/roadmaps/archive/road-to-inbox-harvest-2026-08-e-council-topology-evidence.md:1638-1643`,
`10.2` at `:2443-2449`, `10.3` at `:2487-2492`), each of which points *here* for
its forbidden claims. Nothing below is new: this section exists because that
pointer previously resolved to no list.

- that any of the three mechanisms is built — all three are **unbuilt**;
- that a verify clause passed, for any of them;
- that adding prose to a template constitutes the mechanism — both seats refused
  to license a prose-only build as *"another indefinitely parked baseline"*;
- that a rate, an attribution, or a synthesis property was **measured** — an
  emitter with no producer for its inputs is a population-of-zero mechanism, and
  a rate computed over today's corpus would have a numerator with no observable
  events, which is the exact `null` step 10.3 forbids;
- that the absence of a signal is evidence the signal is benign.

The only permitted claim is that the gap was located, its cause named in the
tree, and its resumption trigger recorded.

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

**Claims forbidden while `[~]`, for the group as a whole.** Consolidated
2026-09-01 from the per-item clauses above and from the two deferral blocks in
the archived parent (`1B.1` at `:865-883`, `1B.4` at `:978-984`), which point
*here* for their forbidden claims.

- that the second extraction call is eliminated, or that inline parsing is
  proven;
- that the `codex-default` contract miss is a **rate** — n = 2, no matched
  comparator, and 1B.4's arms have not started. Reproduction makes it a stable
  seat-level property; it does not make it a frequency;
- that a passing 1B.1 is statistical evidence for 1B.4;
- that the >= 70 % gate passed, that there is no `unparsed` regression, or that
  finding quality is equivalent;
- **that the unrun gate produced a null.** An unrun gate is neither a pass nor a
  null, and the council forbids recording it as either;
- any compliance figure that omits the pre-registered residual: a member quoting
  another member's well-formed findings array is indistinguishable by shape from
  one emitting its own, so the rate is always reported **with** that residual
  named.

## Floors the council refused to move

1. No `[x]` unless every part of the stated verify clause passed.
2. No indefinite `[ ]` without a scheduled execution path.
3. No conflation of red-proof with real-world conformance.
4. No budget spend without a cost/benefit case.
5. No statistical or regression claim from a single run.
6. No claim that resource scarcity proves anything except the reason for
   deferral.
