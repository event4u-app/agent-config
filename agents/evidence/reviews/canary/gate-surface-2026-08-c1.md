# Gate-surface canary ledger — gate-surface-2026-08-02

Produced by `./scripts-run src/scripts/check_gate_coverage --canary`. Governed by
[`adversarial-review-protocol`](../../../../docs/contracts/adversarial-review-protocol.md)
§ 6 — biannual cadence, rotating class, sealed record, never ships.

## Coverage (stated, not implied)

- Gate scripts in `src/scripts/`: **211**
- Listed in `src/config/gate-coverage.yml`: **8**
- Carrying a canary recipe: **5**
- RED (caught the plant): **5** · GREEN (dead): **0**

Every gate outside the recipe count is UNPROVEN by this experiment. That is a
gap, not a pass.

## Per-gate ledger

| Gate | Class | Verdict | Exit | Detail |
|---|---|---|---:|---|
| `check_condensation` | — | ⚠️ NO_RECIPE | — | no canary recipe declared — this gate is UNPROVEN, not proven working |
| `check_augment_description_cap` | oversized-artifact | ✅ RED | 1 | caught the planted oversized-artifact defect (exit 1) |
| `lint_load_context` | dead-target | ✅ RED | 1 | caught the planted dead-target defect (exit 1) |
| `skill_linter` | malformed-frontmatter | ✅ RED | 2 | caught the planted malformed-frontmatter defect (exit 2) |
| `check_no_roadmap_refs` | stale-reference | ✅ RED | 1 | caught the planted stale-reference defect (exit 1) |
| `check_context_paths` | orphan-artifact | ✅ RED | 1 | caught the planted orphan-artifact defect (exit 1) |
| `check_ci_local_parity` | — | ⚠️ NO_RECIPE | — | no canary recipe declared — this gate is UNPROVEN, not proven working |
| `check_site_links` | — | ⚠️ NO_RECIPE | — | no canary recipe declared — this gate is UNPROVEN, not proven working |

## Cross-check against the scan-scope census

| Gate | Kind | Detail |
|---|---|---|
| `check_no_roadmap_refs` | **census_stale** | the canary made it fail, so it reads a live corpus, but the census records no units — re-run the census; its row is stale |
