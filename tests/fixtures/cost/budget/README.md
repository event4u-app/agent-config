# Cost-budget fixture suite

Reference fixtures for `scripts/cost/budget.mjs` and
`scripts/cost/preflight.mjs`. Each subdirectory carries:

| File | Role |
|---|---|
| `sessions.jsonl` | Input ledger fed to `budget.mjs` via `BUDGET_STORE`. |
| `settings.yml` | Input settings fed via `AGENT_SETTINGS`. Declares `cost.budgets` + `cost.enforcement`. |
| `expected.json` | Canonical JSON output of `BUDGET_QUIET=1 budget.mjs check` for this fixture. |
| `expected_exit` | Expected exit code of `preflight.mjs` for this fixture (single line, integer). |

## Fixtures

| Name | Budget | Spend | Util | Tier | Enforcement | Preflight exit |
|---|---:|---:|---:|---|---|---:|
| `under-50` | 100 | 20 | 20% | `OK` | advisory | 0 |
| `mid-75` | 100 | 77 | 77% | `WARNING` | advisory | 0 |
| `high-90` | 100 | 92 | 92% | `CRITICAL` | advisory | 0 |
| `at-100` | 100 | 100 | 100% | `HARD_STOP` | hard-stop | 1 |
| `over-100` | 100 | 150 | 150% | `HARD_STOP` | hard-stop | 1 |

## Running

```bash
task test-cost-budget
# or directly:
node tests/cost/budget-fixtures.mjs
```

The runner asserts `budget.mjs check` JSON output matches `expected.json`
byte-by-key, and that `preflight.mjs` exit code matches `expected_exit`.
Drift fails the test with a per-fixture diff.

## Scope

These fixtures exercise the **evaluator and the preflight hook only**.
They do not validate dashboards, `agent-status` rendering, or the
`task cost:*` wrappers — those are separately covered by command
contracts and (eventually) Phase 3 smoke contracts.
