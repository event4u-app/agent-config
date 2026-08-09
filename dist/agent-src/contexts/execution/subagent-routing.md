# Subagent Routing (Phase 2 — downshift + quota arbitrage)

How a delegated sub-task's model is chosen. The orchestrator stays on the
session / high tier and routes each sub-task to the **lowest-capable** tier it
declares (cost + speed via model downshift). Quota arbitrage is an optional
bonus layered on top. Vendor-neutral throughout — no `.md` here names a
provider's model or billing rule.

## Inputs

- The sub-task's declared `model_tier` (`lite | medium | high | inherit`,
  per [`model-recommendations`](../model-recommendations.md)).
- `subagents.downshift`, `subagents.quota_arbitrage`, `subagents.model_map`
  (see [`auto-orchestration-activation`](auto-orchestration-activation.md)).
- The host-capability manifest's `separate_quota_pool`
  ([`host-capability-manifest`](host-capability-manifest.md)).

## Policy

```
ORCHESTRATOR STAYS ON THE SESSION / HIGH TIER.
A SUB-TASK RUNS ON THE LOWEST-CAPABLE TIER IT DECLARES (downshift on).
QUOTA ARBITRAGE IS A BONUS, NEVER LOAD-BEARING — REMOVE IT AND ROUTING IS
THE SAME MINUS THE QUOTA WIN.
```

1. **Downshift off** (`downshift: false`) → every sub-task runs on the session
   tier. No routing change.
2. **Downshift on** → a sub-task runs on its declared tier; an `inherit` task
   runs on the session tier. The tier resolves to a model alias via
   `model_map`; an empty entry means "use the tier's runtime default" — never a
   baked-in provider model name.
3. **Quota arbitrage** → prefer the **separate** quota pool for the sub-task
   **only when** `subagents.quota_arbitrage == true` **and**
   `manifest.separate_quota_pool == true`. Otherwise the shared pool is used and
   the tier/model choice is unchanged. This is the only place the
   "Sonnet-has-its-own-allowance" idea lives, and it lives as a runtime-detected
   flag, never as portable prose.
4. **Budget routing** (design:
   [`budget-routing` contract](../../../../docs/contracts/budget-routing.md)) →
   AFTER the tier resolves per 1–3, the budget relation via `pickTier`
   (`src/scripts/_lib/tier_budget_routing.ts`) would apply: cheapest
   classifier-adequate tier WITH available budget; that tier exhausted or
   cooling → next tier up with budget; all unavailable → session model +
   surfaced one-line notice. Work is never blocked to save money. Before
   the dispatch is created, acquire the atomic reserve
   (`acquireBudgetPermit`; check state via `node src/scripts/cost/budget.mjs
   tier <t>`); a 429/quota error trips `tripCooldown` for that tier and
   falls back per the relation — never a retry loop.
   `subagents.budget_routing` was removed as a settings key (always-on
   orchestration, road-to-always-on-orchestration Phase 1: no per-layer
   on/off switch survives) — `pickTier` has NO production caller today, so
   this point documents the DESIGNED relation, not a currently wired one;
   wiring it is a later phase of that roadmap (council-side
   `cli_call_budget`/`cost_budget` are the caps that replace the settings
   gate). Every budget-routed dispatch, once wired, would emit one
   `orchestration_record` line (tier + provenance-tagged token delta) so
   realized savings are measured, not asserted.

**Cache trade-off (road-to-cache-economy Phase 4).** A tier downshift changes
the sub-task's model, and the prompt cache is keyed by `(model, prefix)` — so
a downshifted leg forfeits its model-scoped cache reads AND splits a cohort's
shared prefix into two caches (downshifted legs vs. session-tier legs). The
per-call model saving and the forfeited cache-read saving pull in opposite
directions; which wins is a measured question, not a default this policy
resolves — see
[`docs/contracts/ai-council-config.md`](../../../../docs/contracts/ai-council-config.md)
§ `model_downgrade` for the analogous downgrade/cache coupling this suite
already ships on the council side.

## Why vendor-neutral

A separate-quota-pool is a billing quirk of one host at one time. Encoding it
as `manifest.separate_quota_pool` (resolved per host) keeps the package
portable: hosts without it route identically, just without the bonus. No skill,
rule, or context asserts "model X is free".

## Reference implementation

[`src/scripts/_lib/subagent_routing.ts`](../../../../src/scripts/_lib/subagent_routing.ts)
(`resolveSubagentRouting`), covered by
[`tests/scripts/_lib_subagent_routing.test.ts`](../../../../tests/scripts/_lib_subagent_routing.test.ts).
Budget layer: [`src/scripts/_lib/tier_budget_routing.ts`](../../../../src/scripts/_lib/tier_budget_routing.ts)
(`pickTier`, `acquireBudgetPermit`, cool-downs), covered by
[`tests/scripts/tier_budget_routing.test.ts`](../../../../tests/scripts/tier_budget_routing.test.ts);
live state: `agent-config routing:doctor` (orchestration section).

## Related

- [`subagent-configuration`](../subagent-configuration.md) — implementer/judge model + parallelism.
- [`auto-orchestration-activation`](auto-orchestration-activation.md) — the enable/auto gate that runs first.
- [`host-capability-manifest`](host-capability-manifest.md) — source of `separate_quota_pool`.
