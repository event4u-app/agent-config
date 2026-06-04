---
stability: beta
keep-beta-until: 2026-08-15
---

# telegraph telemetry — multiplier contract

> **Status:** suspended (kill-criterion not met in `telegraph-v1`).
> Telemetry surface records `telegraph_delta_tokens = 0` until a v2 bench
> proves a positive multiplier on the load-bearing `vs_terse` arm.

## Constant

| Key | Value | Provenance |
|---|---|---|
| `telegraph_multiplier_version` | `v1` | Tied to `internal/bench/reports/telegraph-v1.{json,md}` |
| `telegraph_multiplier_value` | `0.9155` | `median(terse_control_tokens / condensed_tokens)` over the 10-prompt v1 corpus |
| `telegraph_multiplier_p10` | `0.4506` | 10th percentile (worst-case carve-out-tax prompts) |
| `telegraph_multiplier_p90` | `2.3664` | 90th percentile (pure-prose prompts where telegraph wins) |
| `telegraph_multiplier_active` | `false` | **Suspended** — kill-criterion not met (`vs_terse` median −9.27 %) |

The **active** flag gates whether the multiplier is applied to runtime
telemetry. While `false`, `scripts/telegraph_stats.py` reports
`telegraph_delta_tokens = 0` regardless of `speak_scope` setting.

## How the multiplier is interpreted

`telegraph_estimated_uncondensed_tokens = telegraph_condensed_tokens × M`,
where `M = telegraph_multiplier_value`.

`telegraph_delta_tokens = telegraph_estimated_uncondensed_tokens − telegraph_condensed_tokens`.

- `M > 1.0` → telegraph condenses; `delta` is **positive** (saving).
- `M = 1.0` → break-even; no delta surfaced.
- `M < 1.0` → telegraph costs more than the terse baseline; `delta` is
  **negative**. Surfacing a negative saving is misleading for the
  user (looks like a bug), so the contract is to **suspend the
  multiplier** and record `delta = 0` until a v2 bench lifts `M`
  above `1.0` on the load-bearing arm.

## Why suspended after v1

The `telegraph-v1` bench (`internal/bench/reports/telegraph-v1.md`, 30 calls,
2026-05-16) found:

- Median savings vs raw uncondensed: **+23.51 %** (inflated by the
  carve-out-tax-free pure-prose prompts).
- Median savings vs terse-control: **−9.27 %** (load-bearing).
- Carve-out-heavy prompts (path-list −108 %, mode-marker −123 %)
  drag the median negative.

The terse-control arm is the kill-criterion baseline per
[`condensation-default-kill-criterion.md`](condensation-default-kill-criterion.md).
Until a v2 bench (broader corpus or a re-tuned dialect) lifts the
`vs_terse` median to ≥ 0 %, the multiplier stays suspended.

## How to lift the suspension

1. Run an extended bench against a broader corpus (Phase 3+ work).
2. If `median(savings_vs_terse) ≥ 0` (and ideally ≥ 30 % to flip the
   rule default), recompute `telegraph_multiplier_value`.
3. Update this contract: bump `telegraph_multiplier_version` to `v2`,
   set `telegraph_multiplier_active = true`, cite the new bench file.
4. The change is reversible — drop back to `v1` if a regression
   appears.

## Consumers

- [`scripts/telegraph_stats.py`](../../src/scripts/telegraph_stats.py) — reads
  this constant, computes per-session / per-conversation / lifetime
  deltas from `agents/cost-tracking/sessions.jsonl`.
- [`scripts/cost_summary.py`](../../src/scripts/cost_summary.py) — emits
  the stable JSON contract for inter-tool consumption per
  [`cost-summary-schema.md`](cost-summary-schema.md).
- `agent-status` skill — surfaces the per-session delta in the
  status report under the `[telegraph: …]` widget.

## See also

- [`condensation-default-kill-criterion.md`](condensation-default-kill-criterion.md) — the rule-default-flip gate; this multiplier is gated on the same `vs_terse` arm.
- [`internal/bench/reports/telegraph-v1.md`](../../bench/reports/telegraph-v1.md) — provenance for the `v1` value.
- [`internal/bench/reports/telegraph-v2.md`](../../bench/reports/telegraph-v2.md) — input-side (orthogonal); does NOT feed this multiplier (this multiplier is output-side).
- [`telegraph-speak`](../../.agent-src.uncondensed/rules/telegraph-speak.md) — runtime rule the multiplier measures.
