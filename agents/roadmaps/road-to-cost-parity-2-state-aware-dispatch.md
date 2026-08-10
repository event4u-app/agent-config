---
complexity: lightweight
status: ready
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
- **The byte-based fill proxy was already falsified** — Pearson r = 0.387
  over n = 194, recorded in `archive/road-to-token-economy-recycling.md`.
  The shipped unit is parsed tokens, the committed threshold is 800,000
  (`src/config/recycle-threshold-budget.json`), and the live surface is
  `agents/runtime/state/context-fill.json`. Two limitations carry forward
  and must be stated wherever the value is read: the file is written **at the
  Stop slot only**, so a per-prompt read is up to one turn stale; and the
  threshold budget records a `known_limitation` for sessions in a ≤ 200k
  window.
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
      with one schema test.
- [ ] 1.4 Absence is a first-class value throughout: no input ever resolves
      to a default that reads like a measurement. A dead sensor is visibly
      dead.
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
this list.

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

### blocker: per-role-floor-host-limitation

- **Status:** open
- **Owner:** maintainer
- **Blocks:** any per-role element of the resolver's floor input
- **What to do:** this is a recorded host limitation, not a window.
  `_lib/session_role.ts` cannot mark in-process Agent-tool subagents, so the
  dominant path resolves `orchestrator` and reviewer legs read 0. Either the
  host gains a marking primitive, or the resolver ships worker-role-only and
  says so. Decide which, and record it — do not wait for data that cannot
  arrive.
- **Resolved when:** the resolver's floor field documents either a working
  per-role source or an explicit worker-only scope.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A populated `task_size_estimate` silently changes verdicts | product | The field is already a ladder gate holding `0`; filling it flips real decisions the moment it lands, which is a behaviour change disguised as data | 2.2 lands behind the Phase 3 record-only soak so the shape-only baseline exists first; class medians gate on sample size and report `absent` below the bar, which preserves today's behaviour for thin classes | Phase 2 |
| 2 | The stale fill value steers a decision | implementation | `context-fill.json` is written at the Stop slot, so a per-prompt read is up to one turn old, and the ≤ 200k-window limitation is recorded upstream | 1.1 propagates both markers into the struct; 1.4 makes absence first-class so no consumer can read a stale value as fresh | Phase 1 |
| 3 | The resolver misses its latency budget on every prompt | implementation | A per-prompt read of several state files is a real cost on the hot path | 1.2 binds the benched p95 to the 250 ms `any_hook_event` cap as a verification, and every read is a local file with no model or network step | Phase 1 |
| 4 | The soak shows the inputs are mostly absent and the roadmap looks failed | process | Reviewer legs already read 0 and `rules_efficiency` has no data; the resolver could be structurally starved | 3.2 makes the absence rate a published result rather than a silent disappointment — a starved resolver is a finding about the telemetry substrate, which is worth knowing before anything is built on it | Phase 3 |
| 5 | The Phase 4 list is read as a permanent refusal | process | Five locks cited in one place invites treating the whole area as closed | Each row cites its lock by path with the specific sentence, so a successor argues against the recorded condition; 3.3 names the council pass as the legitimate route once the data excuse is gone | Phase 4 |
| 6 | A fifth price surface appears anyway | implementation | The draft proposed one and the sync burden across four is already recorded | 1.5 refuses it in the roadmap body rather than in a review comment, so the refusal is greppable | Phase 1 |

## Acceptance criteria

- [ ] `dispatch_state.ts` returns a validated versioned struct with every
      field carrying an explicit freshness marker, and a fixture proves a
      dead sensor resolves `absent` rather than to a default.
- [ ] The benched p95 is recorded against the 250 ms `any_hook_event` budget,
      not the `pre_tool_use` budget.
- [ ] `task_size_estimate` carries a ledger-derived median or an explicit
      `absent` per classification, and a fixture proves a below-sample-bar
      class reports `absent` and leaves today's behaviour unchanged.
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
  [`source-confidentiality`](../../src/rules/source-confidentiality.md).
  Link via `src/scripts/_lib/link_crypto.ts decrypt`:
  ENC1:Lbi3WHnpd3ev5lRuiUUn+k5gOvOKcewkScdjaTgsn73kA1j8QvnyXDJH2Is2M7smNnrhHAAAYHy+FO3kpJcOaQ==
- Gap-table: see
  [`road-to-cost-parity-0-program.md`](road-to-cost-parity-0-program.md)
  § Context. The directive's own condition — *"if it does not get better,
  drop it"* — is honoured directly: four of the draft's five components are
  dropped in Phase 4 with the lock that forbids each, and the one that
  survives ships behind a record-only soak.
- Council: **not run.** Phase 3.3 routes the locked rows to a council pass
  once the soak removes the missing-data excuse, rather than recording a
  convergence that did not happen.
