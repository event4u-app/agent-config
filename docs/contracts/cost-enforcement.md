---
stability: stable
---

# Cost Enforcement Contract

> Status: stable · Owner: `step-11-measurement-governance-parity` · Last reviewed: 2026-05-16

How USD budgets read from `.agent-settings.yml` interact with the
session-cost ledger (`agents/cost-tracking/sessions.jsonl`) and the
budget evaluator (`scripts/cost/budget.mjs`).

## Surface

Two files. Settings file declares the budget; ledger file accumulates
spend. The evaluator joins them and emits a tier.

| File | Role |
|---|---|
| `.agent-settings.yml § cost` | Declarative: budgets per period + enforcement mode. |
| `agents/cost-tracking/sessions.jsonl` | Append-only: per-session cost records (model, tokens, USD). |
| `scripts/cost/budget.mjs` | Evaluator: joins both, emits `{ level, utilization_pct, enforcement, source }`. |
| `scripts/cost/preflight.mjs` | Hard-stop hook: wraps `budget.mjs check` and exits non-zero at HARD_STOP when `enforcement: hard-stop`. |

## Settings schema

```yaml
cost:
  budgets:
    daily: 0     # USD ceiling for rolling 24h. 0 = unbudgeted.
    weekly: 0    # USD ceiling for rolling 7d.  0 = unbudgeted.
    monthly: 0   # USD ceiling for rolling 30d. 0 = unbudgeted.
  enforcement: advisory   # advisory | hard-stop
```

- `0` (or absent) on any period = that period is not enforced. The
  evaluator falls back to a longer-period budget when checking shorter
  periods, never the other way around.
- `enforcement: advisory` is the default. Dashboards surface the
  breach; the agent keeps working.
- `enforcement: hard-stop` is opt-in. `scripts/cost/preflight.mjs`
  exits non-zero at the HARD_STOP tier; wrapping shells / CI / `task`
  bindings must check this before composing a turn.

## Tier ladder (5-stage)

| Utilization | Level | Emoji | Threshold-pct |
|---:|---|:---:|---:|
| `< 50 %` | `OK` | 🟢 | 0 |
| `50–74 %` | `INFO` | 🟡 | 50 |
| `75–89 %` | `WARNING` | 🟠 | 75 |
| `90–99 %` | `CRITICAL` | 🔴 | 90 |
| `≥ 100 %` | `HARD_STOP` | 🛑 | 100 |

The legacy 4-stage draft (`under / 50 / 75 / 90 / 100`) folded `OK`
into `under`. Parity-doc Phase 6 maps both forms verbatim.

## Hook surface

`scripts/cost/preflight.mjs` is the **single** turn-start surface.
It wraps `budget.mjs check` and:

1. Reads `cost.enforcement` from `.agent-settings.yml`.
2. If `advisory` → always exits `0`, prints the tier as advisory text.
3. If `hard-stop` and level is `HARD_STOP` → prints a refusal block
   citing this contract and exits `1`.
4. If no budget is configured at all → exits `0` (fail-open). Never
   blocks unbudgeted work.

The hook does **not** rewrite or block individual tool calls. It is a
process-entry gate, intended to be invoked by:

- `task ci`, `task work:*`, `task roadmap:*` wrappers.
- The `/onboard` boot path (`scripts/install.py`-side guidance only).
- Manual `node scripts/cost/preflight.mjs` for shell wrappers.

## Bypass

User-facing bypass mechanism (documented for the refusal block):

- Raise the budget: edit `.agent-settings.yml § cost.budgets.<period>`.
- Reset the ledger (drops historical spend from the calculation):
  `node scripts/cost/track.mjs reset --confirm`.
- Disable enforcement: set `cost.enforcement: advisory`.

No environment-variable override. Bypass must be an explicit edit so
the change is durable and auditable.

## Default behaviour without a budget

When `cost.budgets.{daily,weekly,monthly}` are all `0`:

- `budget.mjs check` reports cumulative spend, no tier (returns the
  no-budget JSON shape).
- `preflight.mjs` exits `0`. Never blocks.
- `agent-status` panel shows **only** the measured-spend USD figure;
  the tier table is suppressed.

## Source precedence

`budget.mjs` reads budget config in this order:

1. `.agent-settings.yml § cost` (when any value > 0).
2. `agents/cost-tracking/budget.json` (legacy single-period JSON).
3. None → no-budget output shape.

The evaluator output carries `source: 'agent-settings.yml' | 'budget.json'`
so dashboards can show where the figure came from.

## Period mapping

`BUDGET_PERIOD={today|week|month|all}` selects which budget value
applies:

| `BUDGET_PERIOD` | Settings key |
|---|---|
| `today` | `cost.budgets.daily` |
| `week` | `cost.budgets.weekly` |
| `month` | `cost.budgets.monthly` |
| `all` (default) | First non-zero of `monthly → weekly → daily`. |

## Acceptance fixtures

`tests/fixtures/cost/budget/` carries five reference fixtures:
`under-50`, `mid-75`, `high-90`, `at-100`, `over-100`. Each fixture
ships a `sessions.jsonl` slice + an expected JSON output. The fixture
suite is wired to `task test-cost-budget` per `step-11` Phase 2 Step 5.

## See also

- `agents/roadmaps/step-11-ruflo-parity.md` — Measurement & Governance Parity roadmap.
- `docs/contracts/cost-dashboard.md` — companion dashboard contract.
- `scripts/cost/budget.mjs` — evaluator implementation.
- `bench/pricing.yaml` — per-model USD pricing table.
