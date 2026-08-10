---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
---

# Road to cost parity — 2: the dispatch decision gets session state as a recorded input

> The judgment ladder already reads task shape, size estimate, activation and
> session lineage — but nothing tells it how full the orchestrator's context
> is or how many dispatches this session has already paid for. This roadmap
> builds that resolver and records its snapshots, and stops there: the three
> modifier rows the source draft wanted are each forbidden by a standing
> decision, named below rather than attempted.

> **Parked in `later/` (2026-08-10 — AI-council convergence, maintainer pick).**
> Both council members independently recommended deferring this part until a
> blocked roadmap clears. Its own gate is the orchestration claim queue:
> `road-to-orchestration-scope-decision.md` holds the rule that exactly one
> orchestration claim is open at a time and resumes at ≥ 20 real orchestration
> audit lines, of which 1 exists.
> **Resume when EITHER:** (a) the orchestration claim queue is free and the
> ≥ 20-audit-line bar is met, or (b) the maintainer authorizes Phase 1 alone —
> the resolver plus the record-only soak change no verdict by construction and
> are buildable today against substrates that already ship, so they do not
> require the queue; only a later comparison would.

## Goal

Every ladder verdict carries a validated session-state snapshot — dispatch
count, cumulative dispatched-token delta, context fill read from the surface
that already ships, and the measured dispatch floor with its freshness marker
— recorded alongside the verdict for a committed window, with the
`task_size_estimate` field populated from ledger-derived class medians
instead of the constant `0` it holds today. No verdict changes.

## Prerequisites

- [x] The judgment ladder on main — `src/scripts/_lib/judgment_ladder.ts`,
      shipped in PR **#1233** (not #1235, which is the acceptance-verification
      commit; the tree carries the same mislabel and part 0 § 3.2 corrects it).
- [x] `archive/road-to-token-economy-dispatch.md` Phase 1 on main —
      `src/config/dispatch-economy-metrics.json` and
      `src/scripts/dispatch_economy_report.ts` exist and run.
- [x] `agents/runtime/state/context-fill.json` shipped by
      `archive/road-to-token-economy-recycling.md` — the context-fill surface
      this roadmap reads rather than builds.

## Context (verified against the tree 2026-08-10, do not relitigate)

- **The premise "the ladder is shape-only" is false.** `LadderInputs`
  (`judgment_ladder.ts`, around lines 77–108) already carries
  `signals.size_estimate`, `activation`, `agentTeams` and
  `insideSubagentSession`. What is genuinely absent is *session* state:
  dispatch count and cumulative dispatched-token delta for the current
  session. That, and only that, is the gap this roadmap closes.
- **An economy downgrade already exists in cruder form.** `SIZE_FLOOR = 1`
  in `_lib/auto_dispatch.ts` yields `in-session ("task below size floor")`
  and the ladder consumes it. This roadmap improves the *input* to that
  existing gate; it does not add a new one.
- **The byte-based fill proxy was already falsified, and this roadmap cites
  the falsification rather than the conclusion.** The number is Pearson
  r = 0.387 over n = 194, recorded at
  `archive/road-to-token-economy-recycling.md:137` (with a second reference at
  `:382`) as the closing annotation of the step that ran it — so the claim is
  traceable to the measurement, not to a remembered verdict. Consequences the
  resolver inherits: the shipped unit is **parsed tokens**, not bytes; the
  committed threshold is 800,000 in
  `src/config/recycle-threshold-budget.json`; and the live surface is
  `agents/runtime/state/context-fill.json`. Two limitations carry forward and
  must be stated wherever the value is read: the file is written **at the Stop
  slot only**, so a per-prompt read is up to one turn stale; and the threshold
  budget records a `known_limitation` for sessions in a ≤ 200k window.
  Phase 1.1 re-reads the value from that surface at implementation time
  rather than hardcoding any figure quoted here — every number in this
  Context block was measured 2026-08-10 and carries that date, not a
  guarantee.
- **`work_tokens` and `init_tokens` are `null` on 100 % of local audit
  lines.** `dispatch_economy_report` derives the floor from the transcript
  ledger instead — measured on a fresh read: 558 legs over a 14-day window,
  worker median init 251.0k, median init/work ratio 0.20, **reviewer legs 0**,
  `rules_efficiency` no data, `return_channel` 0 lines, ask lines 1. Any
  class median in Phase 2 comes from the ledger, not from those fields.
- **`rung` is not a telemetry field.** `_lib/orchestration_savings.ts`
  aggregates `by_tier` and `by_task_class`. A "per-rung outcome history" does
  not exist and is not assumed here.
- **Per-role floors are structurally unavailable, not time-gated.**
  `_lib/session_role.ts` states that in-process Agent-tool subagents cannot
  be marked, so the dominant path resolves `orchestrator` — which is why
  reviewer legs read 0. A per-role floor is therefore a host limitation to
  record, not a window to wait for.
- **The applicable latency cap is `any_hook_event: 250` ms**, because the
  ladder runs on `user_prompt_submit`, not `pre_tool_use` (150 ms).

## Phase 1 — the state resolver, deterministic reads only

- [ ] 1.1 `dispatch_state.ts` assembles, per invocation: this session's
      dispatch count and cumulative dispatched-token delta from its
      `orchestration_record` lines; the current dispatch-floor estimate with
      an explicit `stale` / `absent` marker when the window is empty; the
      context-fill value read from `context-fill.json` with a `one-turn-stale`
      marker and the ≤ 200k-window limitation propagated; and session spend
      against a cap where one is configured.
      <!-- verify: task test -- --filter=dispatch_state -->
- [ ] 1.2 No model step, no network, `hardenedSpawnEnv` discipline, and a
      benched p95 inside the 250 ms `any_hook_event` budget — this runs on
      every prompt.
      <!-- verify: ./scripts-run src/scripts/check_hook_latency_budget --quiet -->
- [ ] 1.3 The output is one validated, versioned struct. Consumers read the
      struct, never the raw sources, so every later input lands in one place
      with one schema test. **The floor field carries its scope at the API
      boundary**, not in governance prose — `{ value, scope: 'worker', stale }`
      — because a reader of the Goal expects a role-aware floor and must learn
      the worker-only limitation from the type, not from a blocker note three
      hundred lines away. Reviewer legs measure 0; the struct says so.
- [ ] 1.4 Absence is a first-class value throughout: no input ever resolves
      to a default that reads like a measurement. A dead sensor is visibly
      dead.
- [ ] 1.4b **The floor input carries the same n ≥ 20 sample bar as the class
      medians (2.1b), enforced in the resolver rather than assumed.** A median
      over three legs is a number with the shape of a measurement and none of
      its authority; the fresh read showed 558 worker legs but **0 reviewer
      legs**, so the bar is what stops the reviewer column from shipping a
      median of nothing. Below the bar the field resolves `absent` and every
      consumer inerts through the same path as a stale sensor.
      <!-- verify: task test -- --filter=dispatch_state -->
- [ ] 1.4c **Staleness is bounded, not merely labelled.** `context-fill.json`
      is written at the Stop slot, so a per-prompt read is one turn old by
      construction — that is acceptable and marked. What is not acceptable is
      an arbitrarily old value wearing the same marker: a file whose write
      timestamp predates the current session's start resolves `absent`, not
      `one-turn-stale`, because it describes a different session entirely. The
      bound is session identity plus write timestamp, both already present in
      the file.
      <!-- verify: task test -- --filter=dispatch_state -->
- [ ] 1.5 No existing price surface is extended and no new one is created.
      The repo already carries four (`ai_council/_default_prices.ts`,
      `agents/runtime/.agent-prices.md` byte-frozen, `internal/bench/pricing.yaml`,
      `scripts/cost/track.mjs`) and that sync burden is already recorded. A
      fifth is refused here explicitly so a successor does not add it.

**Exit:** the resolver returns a validated struct for every invocation, every field carries a freshness marker, and the benched p95 is inside budget.
**Rollback:** the resolver is a leaf with no consumer; delete the module.

## Phase 2 — populate the estimate field that already exists

- [ ] 2.1 Shape-class medians of observed work volume, derived from the
      transcript ledger `dispatch_economy_report` already reads (never from
      the null `work_tokens` audit field), per task classification, with
      honest-null gates: a class below its sample bar reports `absent`.
- [ ] 2.1b **The sample bar is committed here: n ≥ 20 observations per
      class.** It is not a fresh number — it adopts the ≥ 20-audit-line bar
      `road-to-orchestration-scope-decision.md` already committed
      (`:65`, `:110`) for orchestration claims, because this is the same
      telemetry substrate answering a question of the same kind, and a second
      bar on the same data would be a competing instrument. A class below 20
      reports `absent` and inerts the estimate for that class, leaving today's
      behaviour unchanged there. Recorded consequence: with 558 legs over the
      observed window, some classifications will clear 20 and some will not —
      partial coverage is the expected outcome, not a failure.
- [ ] 2.2 Populate `task_size_estimate` — the field exists and is already a
      ladder gate, and it holds the constant `0` on 100 % of observed lines.
      Filling it from class medians makes the *existing* `SIZE_FLOOR` gate
      meaningful for the first time, which is the cheapest real behaviour
      improvement available in this area.
      <!-- verify: task test -- --filter=judgment_ladder -->
- [ ] 2.3 Estimation error is telemetry from day one: predicted versus
      observed volume per dispatch, so any later margin is calibrated against
      a real error distribution rather than a guess.
- [ ] 2.4 No estimator sub-project. If a cheap-signal estimator is ever
      proposed it must beat these class medians on a pre-registered band or
      die — but that spike is not planned here, and the medians are the
      permanent baseline until it is.

**Exit:** `task_size_estimate` carries a ledger-derived value or an explicit `absent` for every classification, and the error distribution is accruing.
**Rollback:** the field returns to its current constant; the medians are derived data.

## Phase 3 — record-only soak

- [ ] 3.1 Two committed weeks of state snapshots recorded alongside every
      ladder verdict, with **no** verdict modified. This is the shape-only
      baseline any future comparison would need, and committing it before any
      behaviour ships is the pre-registration discipline this repo already
      applies elsewhere.
- [ ] 3.1b **Log the counterfactual, not just the state** — the council's
      single strongest point, and without it this phase is theater. Each
      snapshot records the verdict that shipped **and** the verdict the
      populated estimate *would have* produced, plus which input drove the
      difference. A soak that captures inputs but not the decision they would
      have changed cannot answer the only question it exists to answer, and
      "no verdict modified" is unfalsifiable without it: there is no
      activation commit to timestamp against, so the claim needs the
      counterfactual as its evidence.
      <!-- verify: task test -- --filter=dispatch_state -->
- [ ] 3.1c **Define what "modified" means before the soak, not during it.**
      Two readings differ materially: **narrow** — the verdict recorded in the
      `orchestration_record` line differs; **wide** — the verdict differs *and*
      the final dispatch destination differs (an explicit user override can
      make the two diverge). This roadmap commits to logging **both** and
      reporting them separately, because a flip that a user override absorbed
      is a different fact from a flip that changed what ran.
- [ ] 3.2 Publish what the soak shows as an evidence note appended to the
      part-0 ledger: the distribution of fill at dispatch time, dispatch
      counts per session, and how often each input resolved `stale` or
      `absent`. A resolver whose inputs are mostly absent is a finding worth
      publishing on its own.
- [ ] 3.3 If the soak shows the inputs are usable, the next step is a council
      pass on the locked rows below — not a modifier. The lock questions are
      decisions, and the soak only removes the excuse of missing data.

**Exit:** the soak window is complete and its evidence note is appended to the ledger, including the absence rates.
**Rollback:** n/a — recording only.

## Phase 4 — what this roadmap will not do, and which lock forbids it

Each row below was in the source draft and is dropped with its citation, so a
successor argues against the actual recorded decision rather than re-deriving
this list. The table makes the revisit path machine-readable — a deferral
without a stated reopen condition drifts into a permanent refusal nobody
remembers deciding.

| Component | Lock | Reopen condition | Status |
|---|---|---|---|
| Cost-arbitration downgrade | `budget-routing.md` — work is never blocked to save money | **Live candidate.** The council flagged that a *brake* and a *dispatch-probability weight* may not be the same shape: the contract forbids blocking work, arguably not making a spawn less likely at high fill while the user can still force it. Resolve that reading before any implementation | deferred, revisitable |
| Budget brake | same contract — budget machinery may degrade the savings, never the work | A brake that blocks work stays forbidden regardless of the reading above | deferred |
| Audited model override | `ADR-105` defers LLM classification to a benchmark; `ADR-212` forbids an LLM judge in gate paths | The benchmark `ADR-117` records as non-producible becomes producible, **or** an ADR amendment | deferred, revisitable |
| Subscription quota weights | `cache-economy-refusals.md` — no primary source | A primary source is published | deferred, revisitable |
| Outcome comparison | `docs/CLAIMS.md` — the in-session counterfactual is `resolved-null`, indeterminate on baseline choice | The claim queue frees **and** a baseline method survives its own indeterminacy finding | deferred |

- [ ] 4.1 **No cost-arbitration downgrade row.** Cost-based routing in this
      repo is escalate-only by decision:
      `contexts/execution/auto-dispatch-classification.md` states the
      cheapest-sufficient table never lowers a tier `inferSliceTier` raised,
      and `cost-aware-model-routing-verdict.md` states *"Unknown → inherit,
      never guess down."*
- [ ] 4.2 **No budget brake.** `docs/contracts/budget-routing.md` and
      `contexts/execution/subagent-routing.md` state that work is never
      blocked to save money and that budget machinery may degrade the
      savings, never the work. A dispatch downgrade on a token cap is exactly
      the prohibited shape.
- [ ] 4.3 **No audited model override.** `ADR-105` defers LLM classification
      to a benchmark that `ADR-117` records as non-producible; `ADR-212`
      forbids an LLM judge in gate paths; and
      `contexts/execution/auto-dispatch-classification.md`'s Iron Law
      requires an enumerated signal and never a speculative spawn.
      Separately, `orchestrator-carriers-open-decisions.md` holds an open
      maintainer-owned question about whether the agent's efficiency instinct
      outranks the user's voice — an override is a mechanism for precisely
      that failure, so it waits on that decision, not on a probe.
- [ ] 4.4 **No subscription quota-weight table.**
      `agents/settings/contexts/cache-economy-refusals.md` — *"has no primary
      source … do not reintroduce it without one."* A probe is the legitimate
      path, but only filed as an explicit `decision-revisit-gate`
      re-evaluation first.
- [ ] 4.5 **No baseline-versus-state outcome comparison.**
      `docs/CLAIMS.md` records `orchestration-observed-dispatch-cost` as
      `resolved-null`: the in-session counterfactual is not on disk and
      verdicts flip on the choice of baseline method, which that contract
      defines as indeterminate. A cost-arbitration row would manufacture
      exactly that counterfactual and act on it.
- [ ] 4.6 **No new activation gate.** `road-to-always-on-orchestration.md`
      shipped "no new settings beyond the emergency switch", enforced by
      `lint_no_activation_gates`, and `subagents.auto` was deleted. A
      per-decision downgrade would re-enter that gate through the cost door.

## Blockers

### blocker: orchestration-claim-queue

- **Status:** open
- **Owner:** user
- **Blocks:** any outcome comparison (deliberately not planned — 4.5)
- **What to do:** `road-to-orchestration-scope-decision.md` holds the rule
  that exactly one orchestration claim is open at a time and resumes at ≥ 20
  real orchestration audit lines; the same gate appears in
  `road-to-subagent-value-realization-followup.md`. Only 1 `ask`-route line
  exists, and model-carried capture measured 0.27 % before the hook existed —
  so a comparison would be underpowered by construction even if the queue
  were free.
- **Resolved when:** the audit-line bar is met and the queue holds one claim.

### blocker: per-role-floor-scope-decision

- **Status:** open — **a decision, not a window.** Nothing accrues while this
  sits; no amount of elapsed time or telemetry resolves it, and it must not be
  read as "waiting for data".
- **Owner:** maintainer
- **Blocks:** any per-role element of the resolver's floor input. It does
  **not** block Phase 1 — the resolver ships worker-scoped by default (see
  below), so this gates the *scope claim*, not the work.
- **What to do:** `_lib/session_role.ts` cannot mark in-process Agent-tool
  subagents, so the dominant path resolves `orchestrator` and reviewer legs
  read 0 — which is why the fresh report shows 558 legs and zero reviewer
  legs. That is a host limitation with no agent-side resolution. Pick one and
  record it: **(a)** the resolver's floor field is documented worker-scoped
  and the reviewer column is dropped rather than shipped empty, or **(b)** a
  host marking primitive is pursued as its own work item with its own
  roadmap. Absent an explicit pick, Phase 1 defaults to (a) so the roadmap
  cannot stall on a decision that has a safe default.
- **Resolved when:** the resolver's floor field carries either an explicit
  `scope: worker` declaration (a), or a pointer to the work item pursuing the
  marking primitive (b) — recorded either way, never left implicit.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A populated `task_size_estimate` silently changes verdicts | product | The field is already a ladder gate holding `0`; filling it flips real decisions the moment it lands, which is a behaviour change disguised as data | 2.2 lands behind the Phase 3 record-only soak so the shape-only baseline exists first; class medians gate on sample size and report `absent` below the bar, which preserves today's behaviour for thin classes | Phase 2 |
| 2 | The stale fill value steers a decision | implementation | `context-fill.json` is written at the Stop slot, so a per-prompt read is up to one turn old, and the ≤ 200k-window limitation is recorded upstream | 1.1 propagates both markers into the struct; 1.4 makes absence first-class so no consumer can read a stale value as fresh | Phase 1 |
| 3 | The resolver misses its latency budget on every prompt | implementation | A per-prompt read of several state files is a real cost on the hot path | 1.2 binds the benched p95 to the 250 ms `any_hook_event` cap as a verification, and every read is a local file with no model or network step | Phase 1 |
| 4 | The soak shows the inputs are mostly absent and the roadmap looks failed | product | Reviewer legs already read 0 and `rules_efficiency` has no data; the resolver could be structurally starved | 3.2 makes the absence rate a published result rather than a silent disappointment — a starved resolver is a finding about the telemetry substrate, which is worth knowing before anything is built on it | Phase 3 |
| 5 | The Phase 4 list is read as a permanent refusal | product | Five locks cited in one place invites treating the whole area as closed | Each row cites its lock by path with the specific sentence, so a successor argues against the recorded condition; 3.3 names the council pass as the legitimate route once the data excuse is gone | Phase 4 |
| 6 | A fifth price surface appears anyway | implementation | The draft proposed one and the sync burden across four is already recorded | 1.5 refuses it in the roadmap body rather than in a review comment, so the refusal is greppable | Phase 1 |

## Acceptance criteria

- [ ] `dispatch_state.ts` returns a validated versioned struct with every
      field carrying an explicit freshness marker, and a fixture proves a
      dead sensor resolves `absent` rather than to a default.
- [ ] The benched p95 is recorded against the 250 ms `any_hook_event` budget,
      not the `pre_tool_use` budget.
- [ ] `task_size_estimate` carries a ledger-derived median or an explicit
      `absent` per classification against the committed n ≥ 20 bar, and a
      fixture proves a class at n = 19 reports `absent` and leaves today's
      behaviour unchanged while a class at n = 20 does not.
- [ ] The resolver's floor field carries an explicit scope declaration —
      `scope: worker` or a pointer to the marking-primitive work item — so
      the reviewer column is never shipped silently empty.
- [ ] The two-week record-only soak completed with **zero** verdicts modified
      — verifiable from telemetry timestamps against the activation commit,
      because there is no activation commit.
- [ ] The soak's evidence note is appended to the part-0 ledger and reports
      the per-input absence rate.
- [ ] Every Phase 4 row cites a live lock file or contract that still
      contains the quoted sentence — verifiable by following each path.
- [ ] No new price surface, no new activation gate, and no modifier row
      exists in the tree at the end of this roadmap.

## Provenance

<!-- Source-derived per templates/roadmaps.md rule 19. -->

- Source: maintainer directive 2026-08-10, *"the agent should decide when a
  subagent makes sense — and if it does not get better, drop it"* (external
  LLM ideation), consumed inbox
  `agents/tmp.old/better-subagent-orchestration.txt`; anonymized per
  [`source-confidentiality`](../../../src/rules/source-confidentiality.md).
  Link via `src/scripts/_lib/link_crypto.ts decrypt`:
  ENC1:Lbi3WHnpd3ev5lRuiUUn+k5gOvOKcewkScdjaTgsn73kA1j8QvnyXDJH2Is2M7smNnrhHAAAYHy+FO3kpJcOaQ==
- Gap-table: see
  [`road-to-cost-parity-0-program.md`](../archive/road-to-cost-parity-0-program.md)
  § Context. The directive's own condition — *"if it does not get better,
  drop it"* — is honoured directly: four of the draft's five components are
  dropped in Phase 4 with the lock that forbids each, and the one that
  survives ships behind a record-only soak.
- Council: **anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-08-10, 2 rounds**
  (`--prompt-mode pr`). Convergence is inlined once, in
  [`road-to-cost-parity-0-program.md`](../archive/road-to-cost-parity-0-program.md)
  § Provenance, rather than restated per sibling. What it changed here is marked
  in the phases above; what it recorded and did **not** apply is the
  family-scope question (open parts 0 and 3 now, defer 1 and 2), which is the
  maintainer's decision.
