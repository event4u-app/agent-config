# Budget Routing — cheapest adequate tier WITH available budget

Status: v1, accepted with road-to-tested-routing Phase 7 (design locked by
AI council, claude-sonnet-4-5 + gpt-4o, 2026-08-03).

> **Amendment (road-to-always-on-orchestration Phase 1).** The
> `subagents.budget_routing` settings key named throughout this contract was
> DELETED — always-on orchestration carries no per-layer on/off setting.
> `pickTier` (the decision layer this contract specifies) has no production
> caller today, so every mention below documents the DESIGNED relation, not
> a currently wired one; wiring it is a later phase of that roadmap, and the
> council-side `cli_call_budget`/`cost_budget` caps are the ones that replace
> the settings-gated ask/auto/off switch this page still describes.

## The relation (binding)

A delegable request routes to the **cheapest tier the classifier marks
adequate AND that has available budget**. The relation is total:

1. Cheap tier adequate + cheap budget available → cheap tier.
2. Cheap adequate but cheap budget exhausted/cooling + a stronger tier has
   budget → the next tier up with budget (work is NEVER blocked to save
   money — a user whose cheap budget is gone but whose strong budget is
   live gets the strong tier, not a refusal).
3. All tier budgets exhausted, or budget signals unreadable → the session
   model, plus a surfaced one-line notice (fail-open; budget machinery can
   degrade the SAVINGS, never the WORK).
4. A request the classifier does NOT mark cheap-adequate is never
   downshifted, regardless of budget (quality floor;
   `inferSliceTier` / `classifyTask` own adequacy).

Mechanism boundary: the session model is never switched silently — routing
happens as DELEGATION to a subagent with a model override, governed by the
existing delegation layer (`delegation-policy`, `subagents.*`). The user's
`/model` choice is untouched.

## Settings surface (council Q1/Q2 verdicts)

- `cost.budgets.per_tier.{cheap,medium,strong}` — USD ceilings, **null
  default** (null = no separate tier cap; the global daily/weekly/monthly
  ceilings still apply). v1 window: **rolling 24h** (`budget.mjs tier <t>`
  sums ledger entries + pending reserves inside that window). One budget system, one ledger, one enforcement
  knob — deliberately NOT a parallel `routing.budgets` section.
- `subagents.budget_routing: ask | auto | off` — shipped default **`ask`**
  (first budget-motivated downshift of a session asks once; `auto` applies
  the relation silently; `off` = today's behavior). Namespaced under the
  delegation subsystem; deliberately NOT an overload of
  `subagents.downshift` (quality knob ≠ resource gate — a user setting an
  explicit tier ceiling must never find a second knob that ignores it).
  A future default flip to `auto` follows the ADR-117 pattern: telemetry
  first, demotion gate retained. Dissent recorded: one council member
  preferred consolidation into `downshift: auto|on|off`.

## Mechanism requirements (binding)

- **Pre-dispatch permit** — the budget answer is acquired BEFORE the
  dispatch exists; no spend-then-check.
- **Atomic reserve with a FULL lifecycle** (external review 2026-08-03):
  `acquire → expire (TTL) / settle → compact-on-write`. The permit is a
  single locked transaction (lock → sum LIVE reserves → write). A reserve
  is race protection, not spend accounting: it counts only within the
  shared TTL (`src/config/budget-routing.json`, `reserve_ttl_ms`, default
  10 min) — real spend is the ledger's job, so a completed dispatch is
  never double-counted. BOTH readers (`acquireBudgetPermit` and
  `budget.mjs tier`) load the TTL from that one config file; a duplicated
  window literal is the two-truths defect the review flagged. Every write
  under the lock compacts the file to live entries (bounded size), and a
  lock file older than `lock_break_ms` (default 30 s) is a crash leftover
  that gets broken with one retry. `settlePermit` optionally releases a
  reserve the moment real cost lands; the TTL is the backstop that keeps
  settling optional, never load-bearing. Check-then-spend races two
  concurrent requests past the ceiling (council finding) — pinned by the
  pre-registered acceptance criteria AC1–AC5 in
  `tests/scripts/tier_budget_routing.test.ts`.
- **Tier cool-down on quota errors** — a 429/quota error from a tier trips
  a cool-down for that tier (default 60 min; pause, never retry-loop) with
  automatic fallback to the next tier per the relation.
- **Telemetry per routed request** — one `orchestration_record` line
  (tier, budget_state, provenance-tagged token delta) so realized savings
  are measured, not asserted.
- **Rollback** — `subagents.budget_routing: off` is a single settings flip
  restoring today's behavior end-to-end.

## Signal floor (council Q3 verdict)

v1 reads ONLY: the package-own ledger
(`agents/cost-tracking/sessions.jsonl` + reserve entries), the declared
`cost.budgets.per_tier` ceilings, and live 429/quota errors. Host quota
surfaces and API billing headers are explicitly deferred — see the probe
report `agents/evidence/analysis/budget-signal-feasibility-2026-08.md`;
integrating an unverified signal is forbidden.

## Owners

- Decision lib: `src/scripts/_lib/tier_budget_routing.ts` (`pickTier`,
  `acquireBudgetPermit`, cool-down state) — deterministic, fully tested
  (`tests/scripts/tier_budget_routing.test.ts`).
- Per-tier ledger summation: `src/scripts/cost/budget.mjs`.
- Live visibility: `agent-config routing:doctor` (orchestration section
  reports the switch, per-tier budget state, ledger freshness).
- Agent-side flow: the delegation layer consults `pickTier` output before
  a model-override dispatch (see `subagents.budget_routing` in the
  settings template + the subagent-routing context).
