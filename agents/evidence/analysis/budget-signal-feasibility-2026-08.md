# Budget-signal feasibility probe — 2026-08-03

Phase 7 of road-to-tested-routing. Question: which budget/quota signals can
the budget-routing decision (`docs/contracts/budget-routing.md`) RELIABLY
read per host? The implementation may consume only signals this probe
verified; everything else is deferred, not assumed.

## Verified readable (v1 floor)

| Signal | Source | Verification |
|---|---|---|
| Package-own spend ledger | `agents/cost-tracking/sessions.jsonl` (written by `src/scripts/cost/track.mjs`; evaluated by `budget.mjs`) | Present in-tree; JSONL append contract; readable without network |
| Declared ceilings | `cost.budgets.{daily,weekly,monthly}` + new `per_tier.*` in `.agent-settings.yml` | Settings cascade via `load_agent_settings` (tested) |
| Council spend ledger | `~/.event4u/agent-config/council-spend.jsonl` | Present on this machine; council CLI writes it |
| Live 429/quota errors | The dispatching call's own error surface | Observable at dispatch time by construction — powers the tier cool-down, needs no external API |

## Checked and NOT reliably readable (deferred)

| Signal | Finding |
|---|---|
| Claude Code subscription quota (remaining plan usage) | No documented programmatic surface reachable from hooks/CLI; the host UI's usage view is not exposed to the package. Inferring from overage side effects would be guesswork — forbidden by the design note. |
| Anthropic API rate-limit/billing headers | Real on direct API calls (council CLI could read them), but subagent dispatches run through the HOST's transport — headers never reach this package. Usable only for the package's OWN direct calls (council); not generalizable to delegation routing. |
| Other-vendor billing surfaces | Same shape: per-vendor, not reachable from the delegation path. |

## Consequence (matches the council Q3 verdict)

v1 budget state = declared per-tier ceilings − ledger-summed tier spend −
active reserves, plus 429-driven cool-downs. Host-quota integration is a
separate future probe with its own report; nothing in v1 pretends to know
the user's subscription state. Landscape note (2026-08-03 audits): no
surveyed external suite ships credit-aware tier selection either; the
closest mechanism (a global pre-spawn budget fuse + quota circuit breaker)
is mirrored by the permit + cool-down requirements.
