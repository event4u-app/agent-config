---
stability: beta
keep-beta-until: 2026-11-24
---

# Budget Routing — ARCHIVED, migration record

**Status: RETIRED 2026-08-16. This page is a migration record, not a live
contract. Nothing below is implemented.** AC1–AC5 are formally retired: they
were pre-registered against a mechanism with no production caller and no
possible measurement basis, so they could never fire — and an acceptance
criterion that cannot fire reads as coverage that does not exist.

Previously: v1, accepted with road-to-tested-routing Phase 7 (design locked by
AI council, claude-sonnet-4-5 + gpt-4o, 2026-08-03).

## Why it was retired

Reversed by a converged AI-council verdict — anthropic (claude-sonnet-4-5) and
openai, **2 of 2**, 2026-08-16, neither reporting a premise correction. The
question, the six verified facts and both answers are recorded in
`road-to-inbox-harvest-2026-08-d-top-band-model-economy.md` § blocker
`picktier-wire-or-archive`.

The reversal rests on a changed mechanism rather than a changed preference,
which is the case `decision-revisit-gate` anticipates. `pickTier` required a
`routing_switch` input whose sole source — the `subagents.budget_routing`
settings key — was **deliberately deleted** by always-on orchestration. Wiring
it would have meant inventing a replacement for a category removed on purpose,
not completing an integration. Alongside that: zero production callers, and
`session_tier` non-null in **0 of 327** orchestration records, so the saving the
layer existed to produce could not be measured even in principle.

One correction the council made to the amendment this page used to carry: the
council-side `cli_call_budget` / `cost_budget` caps do **not** replace the
deleted switch. They gate total council spend; the switch gated per-tier
selection. Complementary mechanisms — the old wording was wrong.

## What was removed, and what stayed

Removed from `src/scripts/_lib/tier_budget_routing.ts`: `pickTier`, its input
and decision types, `BudgetRoutingSwitch`, `TierBudgetState`,
`acquireBudgetPermit`, `settlePermit`, `tripCooldown`, `reserveTtlMs`,
`RESERVE_FILE`, `DEFAULT_COOLDOWN_MS` and the reserve/lock machinery. The
pre-registered suites in `tests/scripts/tier_budget_routing.test.ts` went with
them. `src/config/budget-routing.json` was deleted — it existed only to keep the
two reserve readers on one TTL, and both are gone. `src/scripts/cost/budget.mjs`
(`tier` subcommand) lost its `reserved_usd` term for the same reason: that store
had exactly one writer, `acquireBudgetPermit`, so the figure was provably always
zero and indistinguishable from "nothing is reserved".

Kept: `TIER_ORDER` and `readCooldowns`, which have a live consumer in
`routing_doctor.ts`. That is monitoring, not routing, and it never depended on
the decision layer.

## Revisit-if

Both members attached a condition, and the union is the bar. Reopen when an
authoritative per-request tier-selection signal exists **with a named production
dispatch point**, AND orchestration telemetry carries both the chosen and the
realized tier so a saving can actually be computed. anthropic additionally
accepts a new selection source arriving organically from unrelated work, or
`session_tier` populated in >10 % of records over 30+ consecutive sessions.

Everything below is the retired v1 design, kept verbatim as the record of what
was decided on 2026-08-03 and what any future implementation would be
reversing.

---

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
