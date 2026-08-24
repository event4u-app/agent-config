---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-01
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added roadmap file whatever its status, and this addition carries no roadmap of its own to retire: the run archived only status: draft roadmaps, which were never counted and therefore cannot serve as an offset."
estate_growth_exempt: "Charges +1 later_roadmaps and +1 open_blockers. The later_roadmaps parking allowance covers only a roadmap moved from the active top level into later/ in the same change, and this file appears from nowhere, so it takes the claim path; open_blockers has no allowance at all, so the one blocker it records takes the same path. Warranted because the doctrine is sound and its premises verify, but four of its phases rest on an outcome ledger whose capture rate this repository has already measured and resolved HONEST NULL at 0.27 percent -- parking it with that dependency recorded as a blocker keeps the analysis citable instead of discarding 963 lines of verified reasoning, and the blocker is the honest reason it cannot be active."
---
# Road to evidence-calibrated model orchestration

> **Source:** agents/tmp.old/godmod3/road-to-evidence-calibrated-model-orchestration.md

> **Parked on arrival, 2026-08-24. Resume when a post-hook orchestration
> telemetry capture rate has been recorded somewhere citable** — the same
> instrument three other parked roadmaps already name, delivered by
> `road-to-suggestion-block-capture.md` AC-4. Four of the phases below are
> outcome-ledger phases, and this repository has already measured what a
> model-carried capture path yields: **1 of 369 dispatches, 0.27 percent**
> (`docs/CLAIMS.md:276`), resolved HONEST NULL. Building a router on a corpus
> that thin is not a scheduling problem, it is an unfalsifiable one.
>
> **Source anonymisation.** The source document named a third-party red-team
> framework and six external routing products and studies in its frontmatter,
> its prose and its source map. Per `src/rules/source-confidentiality.md`, all
> are referred to here as **Source A** (the red-team framework) and **Sources
> B-G** (the routing research). No third-party name is retained. Source A is
> under a strong copyleft licence carrying a network-use clause, while this
> package is MIT: this roadmap adopts ideas and independently reimplemented
> patterns only, never implementation
> code, prompt bodies or scoring code, and any change to that boundary is its
> own licensing decision.

## Goal

For any council-capable task, this package can produce an auditable answer to:
why this orchestration shape, why these seats were eligible, why this candidate
was preferred over the other eligible candidates, which transport actually
served it, what it cost, how long it took, whether the result satisfied the
task's real verification obligations, and whether escalation happened when the
first choice was insufficient — **without** making model prestige, vendor
marketing, or a self-authored heuristic score the evidence.

## Executive position

The council should **not** become a second model-orchestration system, and this
roadmap does not propose one. The existing council already carries the harder
production foundations: governed transports, cost ceilings, failure-class-gated
CLI-to-API fallback, model-ladder and freshness machinery, blind review,
low-impact fast paths, user-final authority, machine-checked claims, and
benchmark-driven honest-null decisions.

The narrower and more valuable opportunity is to turn that council from a
mostly configuration-driven multi-model mechanism into an **evidence-calibrated
orchestration layer** that can choose how many models to use, which eligible
seats, when to escalate, and when to stay on a cheap or local model — based on
this package's own measured outcomes rather than reputation.

What is deliberately **not** in that design: no always-on proxy, no wide model
race in normal use, no opaque learned router as a first version, no
verbosity-or-formatting quality score, no self-rewriting production policy, and
no new transport layer competing with the existing resolver.

## Context — what is verified in the tree

The source carried **zero `file:line` citations in 963 lines**, which is the
single largest reason it parks rather than ships. Its cited *paths* do all
resolve — the seven entries in its source map exist — but a path is not an
anchor. The load-bearing claims, re-checked at landing:

1. **The council is already an orchestration substrate.**
   `docs/contracts/ai-council-config.md` defines provider members, model
   ladders, quorum, advisors, decision replay, necessity classification, critic
   posture, per-run budgets and transport rules. This roadmap extends that
   surface; it does not fork it.
2. **Low-impact member selection is deterministic, and this is the claim the
   source left uncited.** `src/scripts/ai_council/low_impact.ts:187` states it
   in the module's own contract: "alphabetical by provider name → deterministic,
   easy to test, no hidden cost-rank heuristic to debug" (`:186-188`, alongside
   the `participate_low_impact` precondition). That determinism is what makes
   the low-impact path the safest first integration point for measured routing —
   and it is exactly what a router would replace, so it must be measured before
   it is replaced.
3. **Seat selection already exists.**
   `agents/roadmaps/archive/road-to-council-seat-selection.md` added per-run
   seat mission and constraints, family diversity, frozen seating and pin
   freshness. A router ranks **eligible seats after constraints**; it never
   replaces seat constraints.
4. **Capability tiers already exist** — `lite | medium | high | frontier |
   inherit`, with model-recommendation rules. No second capability taxonomy.
5. **Falsifiability is already doctrine.** `docs/decisions/ADR-124-embedded-engine-doctrine.md`
   permits embedded engines but requires default-off adoption, a pre-registered
   benchmark and an honest-null route — and its first code-graph engine was
   retired after losing to disciplined grep. It also allows deterministic,
   command-scoped engines while keeping resident daemons out of core, so routing
   can begin entirely in-process.
6. **The outcome ledger these phases need does not exist, and its
   model-carried predecessor was measured and nulled.** `docs/CLAIMS.md:276`
   records the pre-registration and the resolution together: the model-carried
   `orchestration_record` step captured "1 of 369 observed dispatches (0.3%)",
   resolved at "0.27% telemetry capture (370 dispatches, 1 recorded line)".
   This is the blocker below.

## The gaps this roadmap would close

- Seat constraints say *who may sit* but not, from measured outcomes, *who
  should sit for this task*.
- The low-impact fast path does not exploit evidence that one eligible model is
  materially better for a task family.
- Cost budgets and model tiers exist, but no single calibrated
  quality/cost/latency frontier computed from this package's own workloads.
- Council necessity, seat selection, model selection and transport resolution
  are separate mechanisms that do not form one explicit decision pipeline.
- No canonical per-candidate **outcome contract** connecting task features to
  selected model and shape to verified result to cost, latency and failure.
- Local OpenAI-compatible inference is not a first-class generic member class.
- No package-specific router benchmark that can answer whether a sophisticated
  router beats a transparent baseline on the jobs actually performed.

## What Source A contributes, and what is rejected

**Adopted as ideas only:** that different models are complementary and that
failures and latency are useful evidence (so: an offline race harness for
calibration, never normal execution); that a request need not always pay for the
strongest model set (reuse existing tiers, do not duplicate names); that task
and context features can drive routing before they drive sampling; that a
"winner" without per-candidate evidence is insufficient; that local
OpenAI-compatible endpoints can join the same comparison surface; that a static
router ages as models change (so: offline recalibration and drift detection
first); and that each stage should be independently testable.

**Rejected, with reasons, rather than silently dropped:**

| Rejected | Why |
|---|---|
| Source A's scalar response score | It rewards response length, Markdown structure, anti-refusal behaviour, directness and lexical relevance. For a coding agent that selects a beautifully structured wrong answer over a terse change that passes tests. Quality here must be grounded in requirements, tests, static analysis, independent review, tool-call validity and completion evidence. |
| Wide parallel model races in production | Useful for benchmark data and rare explicit deep-review modes. In normal use they multiply cost and latency and skip the routing problem instead of solving it. |
| Input-perturbation and guardrail-circumvention machinery | Unrelated to software correctness; creates security, maintainability and policy risk. Not ingested in any form. |
| Post-hoc rewriting of reviewer or verifier output | Removing hedges may be a harmless presentation option, but modifying semantic output after the fact weakens replayability. Raw evidence stays canonical. |
| Source A's strongest privacy wording | Its own later documentation is more cautious than its earlier paper about metadata allowlists. This package should define narrow enumerated schemas and keep raw prompt/response collection opt-in, rather than claiming arbitrary metadata can never identify. |

**External routing research, anonymised.** Source B (workload-specific routing
calibration) shows the basic proposition — route simple queries cheap, reserve
the strong model — but its out-of-distribution result is the warning that
matters: a router trained on one distribution can behave near-randomly until
domain-relevant examples are added. Source C (a 2026 router benchmark over
400k-plus instances, 21 datasets, 33 models and 10 baselines) finds real model
complementarity **and** that several sophisticated routers do not reliably beat
simple baselines under unified evaluation, with diminishing returns from larger
ensembles. Source D (a commercial routing gateway) separates model routing from
provider routing and adds session stickiness and tool-call reliability. Source E
(a small preference-routing model) maps requests to explicit domains and actions
before any learned classifier. Sources F (parallel-ensemble fusion) show quality
gains at explicit latency cost. Source G (a custom-candidate routing vendor)
allows candidates to be arbitrary endpoints or agentic workflows.

**Consequences carried into the phases:** no generic external router becomes the
production source of truth; the first acceptance gate is not "does routing work"
but "does this beat our simplest auditable baseline by enough to justify its
complexity"; four decisions stay distinct (orchestration shape, model/seat
selection, transport endpoint selection, retry/fallback policy) with the
existing resolver owning the last two; deterministic facts are used before any
ML classifier; fusion belongs only on an explicit high-impact path if ever; and
the outcome schema is keyed on a `candidate_id` with model, provider and agent
metadata rather than assuming candidate equals model string.

## Non-goals / hard boundary

- No replacement for the council. No second provider or transport resolver.
- No automatic PR merge, no erosion of user-final authority.
- No default wide fan-out. No scalar quality score based on formatting or length.
- No raw prompt or response telemetry by default.
- No cross-session self-modifying router before a persistence decision.
- No resident daemon or proxy in the initial implementation.
- No trained or opaque router until it beats a pre-registered transparent
  baseline on held-out, package-specific data.
- No import of Source A implementation code, prompt bodies or scoring code.

## Phase 0 — Freeze the experiment before building anything

- [ ] **0.1 Re-pin current reality.** Re-read the council contract,
      `src/scripts/ai_council/low_impact.ts`, the seat-selection
      implementation, the tier vocabulary, cost accounting, the transport
      resolver and ADR-124. Record the commit in the benchmark registration.
      verify: every current-state assertion in this file maps to a live
      `file:line` at the implementation pin — **not merely a live path**, which
      is the defect that parked the source; changed behaviour is reconciled
      before any code.
- [ ] **0.2 Write the routing decision boundary as a contract:** constraints,
      then shape, then eligible-seat ranking, then frozen seating, then existing
      transport resolution, then execution, verification, escalation, outcome.
      State which layer owns each decision; provider and transport fallback stay
      with the existing resolver.
      verify: no config key or function can independently decide the same axis
      in two places without a documented precedence rule.
- [ ] **0.3 Pre-register the benchmark** — corpus, candidates, metrics, baseline
      router, acceptance thresholds, and the honest-null path — before
      collecting any result.
      verify: `check_claims` resolves the entry; the transparent baseline is
      named as a mandatory control arm, per Source C's finding.

**Exit:** contract and pre-registration merged; no router code.

## Phase 1 — Build the router benchmark, not a production router

- [ ] **1.1 Add a candidate-evaluation envelope** — one row per
      `task x candidate`, with a stable schema covering task id and family,
      profile, risk/impact class, repo stack, required capabilities,
      `candidate_id`, model family and id, orchestration shape, transport,
      provider, verification outcomes, independent-review outcome, tool-call
      outcome, duration, tokens and cost where known, failure class, and
      fallback metadata.
      verify: the schema is registered with `schema_version`, `owner` and
      `review_by`; no field can hold free-form prompt or response content.
      **Gated by `b-orchestration-corpus-adequacy`** — the envelope may be
      *defined* without the corpus, but no metric may be *computed* from it
      until the blocker resolves.
- [ ] **1.2 Reproduce current behaviour as a benchmark arm**, not a strawman.
      verify: the current-behaviour arm is re-runnable from the pin and its
      results are archived.

## Phase 2 — Canonical capability and eligibility registry

- [ ] **2.1 One registry of declared model capabilities and eligibility**,
      reusing the existing tier vocabulary rather than inventing a second.
      verify: no new capability taxonomy is introduced; the registry's tiers are
      the shipped enum.
- [ ] **2.2 Freshness and deprecation lifecycle** for model metadata, matching
      the lifecycle already used for council pins.
      verify: a stale pin is detectable and marks dependent evidence stale.

## Phase 3 — Shadow routing inside the existing council

- [ ] **3.1 Rank eligible seats in shadow mode** on the low-impact path first,
      recording what the router *would* have chosen without changing what runs.
      verify: shadow decisions are recorded and provably do not affect
      execution; the deterministic alphabetical selection at
      `low_impact.ts:187` remains the live behaviour.
- [ ] **3.2 The router may never bypass constraints** — family diversity,
      risk and user authority, spend ceilings, failure gates.
      verify: a fixture attempting each bypass is refused, red-green.

## Phase 4 — Confidence-aware escalation instead of broad racing

- [ ] **4.1 Escalate shape by measured input difficulty**, reusing the existing
      confidence-gate, quorum and necessity mechanisms.
      verify: escalation is driven by a recorded feature, never by a
      self-reported confidence string.
- [ ] **4.2 The router may answer "unknown" and widen the path** rather than
      manufacturing confidence to keep cost low.
      verify: an unknown verdict selects the wider governed shape.

## Phase 5 — First-class local OpenAI-compatible candidates

- [ ] **5.1 Add a loopback-only local member class.**
      verify: discovery is localhost-only by default; an arbitrary remote URL is
      refused, and the escape hatch is threat-modelled rather than open.

## Phase 6 — Outcome attribution and drift reporting

- [ ] **6.1 Emit one bounded routing outcome per decision** — structural only;
      raw prompt, response, secrets and arbitrary free-form metadata excluded.
      verify: the event type has no field capable of holding free-form content.
      **Gated by `b-orchestration-corpus-adequacy`.**
- [ ] **6.2 Derive aggregates offline** — success rate by task family and
      candidate, independent-review escape rate, tool-call failure rate, latency
      percentiles, cost distribution, fallback and escalation rates, router
      regret against the observed best candidate on bench tasks, and model
      freshness drift.
      verify: every aggregate names its sample size, and a sample below the
      registered floor reports UNDERPOWERED rather than a figure.
- [ ] **6.3 Privacy modes with truthful semantics** — at minimum `off`,
      `local-structural`, and explicit content-bearing benchmark capture. A
      metadata allowlist is never described as PII-proof.
      verify: the mode names and their guarantees match what the schema can
      actually enforce.
- [ ] **6.4 Drift alarms as reports and gates, never self-rewrites.**
      verify: drift can deactivate a measured preference while leaving declared
      capabilities and user config intact.

## Phase 7 — Optional pairwise ranking experiment

- [ ] **7.1 Use pairwise ranking as an offline evaluation baseline**, not a
      production dependency. Fusion, if ever, is explicit-path only and must
      prove it improves verified correctness over the shipped debate and
      consensus machinery.
      verify: a null is a recorded, acceptable outcome.

## Phase 8 — Adaptive sampling experiment, API surfaces only

- [ ] **8.1 Treat sampling adaptation as transport-capability-gated and
      separate from routing.** Adaptive decoding temperature is **rejected for
      review seats**: a review council wants verdict stability, which argues for
      a low fixed temperature, and the ideal value is model- and task-specific.
      verify: the rejection is registered as falsifiable — a benchmark showing
      adaptive temperature raises council reliability reopens it.

## Phase 9 — CONDITIONAL: challenge the persistence boundary with evidence

> **Demoted to a stated conditional at landing.** Not planned work. This phase
> replays an accumulated outcome corpus, and no such corpus exists: the only
> measured capture rate for orchestration telemetry in this repository is 0.27
> percent (`docs/CLAIMS.md:276`), resolved HONEST NULL.

- [ ] **9.1 CONDITIONAL — only after `b-orchestration-corpus-adequacy` resolves
      with a capture rate above its registered floor.** Replay the accumulated
      corpus to test whether cross-session learned routing is worth crossing the
      state-store boundary. Deleting that state would change behaviour rather
      than only speed, which makes it real cross-session state under ADR-124's
      own test, not a rebuildable cache.
      verify: the blocker is resolved and the corpus meets its registered
      sample-size floor before this step is opened. Absent that, the step stays
      closed and the conditional is the finding.

## Phase 10 — CONDITIONAL: trained router experiment

> **Demoted to a stated conditional at landing**, same reason as Phase 9, plus
> Source C's finding that sophisticated routers often fail to beat simple
> baselines under unified evaluation.

- [ ] **10.1 CONDITIONAL — reopen only if the simple router leaves a material
      gap against the observed best candidate**, measured on this package's own
      benchmark corpus rather than generic preference data. Compare current,
      deterministic rules, one interpretable baseline and one learned router
      under a single harness with the model set fixed; hold out repositories,
      task families and model versions; calibrate abstention so an uncertain
      router widens the shape instead of manufacturing confidence. Ship only on
      complexity-adjusted thresholds — a statistically tiny gain requiring model
      weights, new runtime dependencies and opaque failure modes is a null.
      verify: the blocker is resolved, the baseline arm exists, and the
      out-of-distribution slices are defined before any training run.

## Phase 11 — Rollout and proof

- [ ] **11.1 Roll out by rung** — bench, then shadow, then opt-in low-impact,
      then default low-impact, then broader classes only on fresh evidence.
      verify: each rung's promotion cites its own measurement.
- [ ] **11.2 Kill switch and deterministic fallback.** Any router error, stale
      registry or unsupported environment falls back to current governed
      selection, never to a guess.
      verify: each of the three failure modes is demonstrated falling back.
- [ ] **11.3 Publish machine-checked claims only**, with corpus, model and
      router pins. No "always picks the best model", no generic benchmark
      extrapolation.
      verify: `check_claims` resolves every published figure.
- [ ] **11.4 Reproducibility packet** — model ids and aliases, provider
      surfaces, corpus hashes, router version, config, evaluation logic, dates,
      and an explicit note where a vendor alias is intentionally floating.
      verify: a third party can re-run from the packet alone.
- [ ] **11.5 Re-run on model drift.** A new flagship or a deprecation
      invalidates affected evidence; it is never an automatic reason to reorder
      seats from reputation.
      verify: drift invalidation is mechanical, not editorial.

## Blockers

### blocker: b-orchestration-corpus-adequacy
- **Status:** OPEN
- **Owner:** maintainer
- **Blocks:** Phase 1.1 (metric computation, not schema definition), Phase 6.1,
  and the whole of Phases 9 and 10 — which are recorded as conditionals rather
  than planned work for exactly this reason.
- **What it is:** Phases 1, 6, 9 and 10 are outcome-ledger phases. They need a
  per-decision corpus large enough to support a routing claim, and **no
  sample-size gate exists for one**. The only measured capture rate for
  orchestration telemetry in this repository is **1 of 369 observed dispatches,
  0.27 percent** (`docs/CLAIMS.md:276`), which was pre-registered and then
  resolved **HONEST NULL**. A router calibrated on a corpus that thin would
  produce claims nobody can falsify, which is the failure ADR-124's honest-null
  route exists to prevent.
- **What to do:**
  1. Register a minimum sample size per task family, before any aggregate is
     computed, as part of Phase 0.3.
  2. Obtain a citable post-hook capture rate — the same instrument
     `road-to-suggestion-block-capture.md` AC-4 delivers, and which
     `later/road-to-composite-dispatch-topology.md` and
     `later/road-to-cost-parity-2-state-aware-dispatch.md` already name as their
     own resume condition.
  3. If the capture rate resolves DROP, this roadmap's outcome-ledger phases are
     unsatisfiable by that instrument and the file closes with that recorded —
     a publishable result, not a failure.
- **Resolved when:** a capture-rate figure above the registered floor is
  citable, and Phase 0.3 carries a per-family minimum sample size.
- **Recommendation:** wait on the capture instrument rather than lowering the
  bar. The instrument is already being built for three other parked roadmaps,
  so the cost of waiting is shared and near zero, while the cost of proceeding
  is a router calibrated on a corpus two orders of magnitude too thin to
  falsify. Defining the Phase 1.1 schema meanwhile is free and unblocked.
- **If you do nothing:** this roadmap stays parked, which is the correct
  resting state and costs nothing beyond its `later/` slot. The specific
  hazard of doing nothing *while treating the phases as planned* is that
  Phases 9 and 10 read as scheduled work; they are marked CONDITIONAL above
  precisely so that reading is unavailable.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The outcome corpus never reaches usable size | implementation | Four phases rest on a per-decision ledger, and the measured predecessor captured 0.27 percent; a router calibrated on that is unfalsifiable | `b-orchestration-corpus-adequacy` gates metric computation; Phases 9 and 10 are recorded as conditionals rather than planned work; 6.2 reports UNDERPOWERED below the registered floor instead of a figure | Phase 9 — CONDITIONAL: challenge the persistence boundary with evidence |
| 2 | A second orchestration system grows beside the council | product | The source's first draft would have duplicated tiers, seat logic and transport resolution; the same drift is available at every phase | Non-goals restate it; Phase 0.2 requires one documented precedence pipeline; 2.1 forbids a second capability taxonomy; the existing resolver keeps transport and fallback | Phase 0 — Freeze the experiment before building anything |
| 3 | Complexity ships without beating the simple baseline | product | Source C found sophisticated routers often fail to beat simple baselines under unified evaluation | The transparent baseline is a mandatory control arm at 0.3; 10.1 requires complexity-adjusted thresholds and names a tiny gain as a null | Phase 0 — Freeze the experiment before building anything |
| 4 | Cost falls while quality quietly falls further | product | A router that lowers spend while raising review escapes or failed tool calls is a loss that a cost metric alone would report as a win | Quality is tied to verifiers and evidence, never formatting; 6.2 tracks independent-review escape rate and tool-call failure rate beside cost | Phase 6 — Outcome attribution and drift reporting |
| 5 | Telemetry widens into content capture | product | An outcome ledger is exactly the surface where a free-form field gets added for debugging | 1.1 and 6.1 require a schema with no field capable of holding free-form content; 6.3 forbids describing an allowlist as PII-proof | Phase 1 — Build the router benchmark, not a production router |
| 6 | Local candidate support widens attack surface | implementation | Local endpoint discovery is one config key away from accepting arbitrary remote URLs | 5.1 is loopback-only by default with a threat-modelled escape hatch and a refusal fixture | Phase 5 — First-class local OpenAI-compatible candidates |
| 7 | Copyleft implementation code crosses the licence boundary | implementation | Source A is strong-copyleft with a network-use clause, this package is MIT; an "independently reimplemented pattern" can drift into a port | Non-goals forbid importing implementation, prompt bodies and scoring code; the boundary is restated in the parking block; any change is its own licensing decision | Phase 0 — Freeze the experiment before building anything |

## Acceptance Criteria

- [ ] AC-1 — Current behaviour is a reproducible benchmark arm, not a strawman.
- [ ] AC-2 — A transparent routing baseline exists and has an honest-null path.
- [ ] AC-3 — Seat eligibility and seat ranking are separate and auditable.
- [ ] AC-4 — Orchestration shape, model selection and transport selection have
      one documented precedence pipeline.
- [ ] AC-5 — Low-impact routing cannot weaken high-impact or user-required
      floors.
- [ ] AC-6 — Every production route has a deterministic fallback to current
      governed behaviour.
- [ ] AC-7 — Candidate quality is tied to task verifiers and evidence, never
      formatting or length.
- [ ] AC-8 — Cost, latency, tool-call success, fallback and verified outcome are
      attributable to the selected candidate, and every aggregate names its
      sample size.
- [ ] AC-9 — Session and run stickiness prevent gratuitous model thrashing.
- [ ] AC-10 — Local support is loopback-only by default with a threat-modelled
      escape hatch.
- [ ] AC-11 — No Source A implementation code has entered this package without a
      separate licensing decision.
- [ ] AC-12 — Cross-session learning and learned routing remain off, and their
      phases remain conditional, until `b-orchestration-corpus-adequacy`
      resolves.
- [ ] AC-13 — Every current-state assertion carries a `file:line` anchor, not
      merely a path — the defect that parked the source document.

## Corrections applied at landing (2026-08-24)

Recorded rather than silently fixed, per this repository's convention.

| What | Was | Now | Why |
|---|---|---|---|
| Third-party source names | A red-team framework named in frontmatter (`source_pins.g0dmod3`, repo and commit), in prose throughout, and in a source map; six external routing products and studies named in "External research harvested" | **Source A** and **Sources B-G**; every name, repo path, commit pin and URL removed | `src/rules/source-confidentiality.md` forbids derivation-attribution in tracked text regardless of denylist membership. Checked at landing: **none** of these names appears in `src/scripts/external_sources_denylist.json`, so the `check-no-external-sources` CI gate would **not** have caught them. Manual anonymisation was the only control. |
| `status` | `draft` | `later`, with a parking block and a named resume condition | The doctrine is sound and its premises verify, but four phases rest on a measured HONEST NULL. Parking keeps 963 lines of verified reasoning citable; leaving it active would have scheduled unfalsifiable work. |
| Citation for the determinism claim | No `file:line` anywhere in 963 lines | `src/scripts/ai_council/low_impact.ts:187` (with `:186-188` context), quoted verbatim | This was the roadmap's load-bearing current-state claim and its only uncited one that a router would directly replace. The source map's path form is not an anchor. Note the real path is `src/scripts/ai_council/low_impact.ts` — `find` returns exactly one match and the doubled `ai_council/ai_council/` form does not exist. |
| Phases 9 and 10 | Planned work with unconditional steps | Explicitly **CONDITIONAL**, gated on the new blocker, with the demotion stated in a block quote above each | Both replay an accumulated outcome corpus. `docs/CLAIMS.md:276` records the only measured capture rate for orchestration telemetry — 1 of 369 dispatches, 0.27 percent — pre-registered and resolved HONEST NULL. Listing them as planned would have implied a corpus that does not exist. |
| Phases 1.1 and 6.1 | Ungated | Gated by the blocker for metric *computation*, with schema *definition* still permitted | The schema is cheap and useful now; the metrics are the part that needs the corpus. Splitting them keeps the phase actionable without licensing an unfalsifiable claim. |
| Risk Register | Absent | Added, seven rows, all `product` or `implementation` | `lint_plan_risk_register.ts:288-293` admits only those two values, and `status: later` is **not** draft-exempt (`DRAFT_VALUES` is the single literal `'draft'`), so the file could not have landed green without the section. |
| Blockers | Absent | One `### blocker:` heading, `b-orchestration-corpus-adequacy` | The corpus dependency was the real reason the roadmap cannot be active. Carrying it in prose would have left it untracked. Charged honestly in `estate_growth_exempt` as `+1 open_blockers`, since that metric has no allowance. |
| Frontmatter | No `owner`, no `review_by`, no `Source:` pointer, no estate keys | All added; both estate keys single-line double-quoted | Governance frontmatter is required for a non-draft roadmap; `growthClaims()` in `check_estate_count.ts:473` matches ONE patch line, so a folded `>-` block would record the literal `>-` as the reason. |
| `archive/road-to-target-project-assurance-readiness.md` | Cited in the source map with **no stated relationship** — a dangling reference | Relationship stated: it is archived at `status: ready`, 10 done and 5 cancelled, with an AI-council disposition recorded 2026-08-23. It is **not** a dependency of this roadmap and contributes no constraint; it is retained only as prior art on assurance readiness | The source listed it among its pins without saying why. A citation whose relationship nobody can state is either a dependency in disguise or noise; naming it as prior art resolves that without inventing a link. |
| Executive framing | "BUILD, but as an extension of AI Council and behind evidence gates" | Retained as the executive position, with the build gated behind the blocker | The conclusion is sound; only its schedulability changed. |

**Verified at landing, not inherited:** `src/scripts/ai_council/low_impact.ts:187`
and its `:186-188` context quoted verbatim; the existence of all seven source-map
paths for this package; `docs/CLAIMS.md:276` carrying both the 1-of-369 and the
0.27-percent figures and no other line in that file matching either;
`lint_plan_risk_register.ts:288-293`; `check_estate_count.ts:473`;
`DRAFT_VALUES = new Set(['draft'])`; the archived state and box counts of
`road-to-council-seat-selection.md` and
`road-to-target-project-assurance-readiness.md`; and zero denylist hits for any
of the stripped source names.

**Not re-verified, and flagged rather than presented as checked:** the source's
characterisations of Sources B-G (the external routing research) are inherited.
They are cited as reasoning inputs, and every constraint they justify —
mandatory transparent baseline, four-way decision separation, deterministic
facts before ML, fusion as explicit-path-only — is independently defensible from
this repository's own ADR-124 doctrine, so no phase depends on an external claim
being accurate.
