---
stability: beta
keep-beta-until: 2026-08-15
---

# caveman telemetry — multiplier contract

> **Status:** suspended (kill-criterion not met in `caveman-v1`).
> Telemetry surface records `caveman_delta_tokens = 0` until a v2 bench
> proves a positive multiplier on the load-bearing `vs_terse` arm.

## Constant

| Key | Value | Provenance |
|---|---|---|
| `caveman_multiplier_version` | `v1` | Tied to `bench/reports/caveman-v1.{json,md}` |
| `caveman_multiplier_value` | `0.9155` | `median(terse_control_tokens / compressed_tokens)` over the 10-prompt v1 corpus |
| `caveman_multiplier_p10` | `0.4506` | 10th percentile (worst-case carve-out-tax prompts) |
| `caveman_multiplier_p90` | `2.3664` | 90th percentile (pure-prose prompts where caveman wins) |
| `caveman_multiplier_active` | `false` | **Suspended** — kill-criterion not met (`vs_terse` median −9.27 %) |

The **active** flag gates whether the multiplier is applied to runtime
telemetry. While `false`, `scripts/caveman_stats.py` reports
`caveman_delta_tokens = 0` regardless of `speak_scope` setting.

## How the multiplier is interpreted

`caveman_estimated_uncompressed_tokens = caveman_compressed_tokens × M`,
where `M = caveman_multiplier_value`.

`caveman_delta_tokens = caveman_estimated_uncompressed_tokens − caveman_compressed_tokens`.

- `M > 1.0` → caveman compresses; `delta` is **positive** (saving).
- `M = 1.0` → break-even; no delta surfaced.
- `M < 1.0` → caveman costs more than the terse baseline; `delta` is
  **negative**. Surfacing a negative saving is misleading for the
  user (looks like a bug), so the contract is to **suspend the
  multiplier** and record `delta = 0` until a v2 bench lifts `M`
  above `1.0` on the load-bearing arm.

## Why suspended after v1

The `caveman-v1` bench (`bench/reports/caveman-v1.md`, 30 calls,
2026-05-16) found:

- Median savings vs raw uncompressed: **+23.51 %** (inflated by the
  carve-out-tax-free pure-prose prompts).
- Median savings vs terse-control: **−9.27 %** (load-bearing).
- Carve-out-heavy prompts (path-list −108 %, mode-marker −123 %)
  drag the median negative.

The terse-control arm is the kill-criterion baseline per
[`compression-default-kill-criterion.md`](compression-default-kill-criterion.md).
Until a v2 bench (broader corpus or a re-tuned dialect) lifts the
`vs_terse` median to ≥ 0 %, the multiplier stays suspended.

## How to lift the suspension

1. Run an extended bench against a broader corpus (Phase 3+ work).
2. If `median(savings_vs_terse) ≥ 0` (and ideally ≥ 30 % to flip the
   rule default), recompute `caveman_multiplier_value`.
3. Update this contract: bump `caveman_multiplier_version` to `v2`,
   set `caveman_multiplier_active = true`, cite the new bench file.
4. The change is reversible — drop back to `v1` if a regression
   appears.

## Consumers

- [`scripts/caveman_stats.py`](../../scripts/caveman_stats.py) — reads
  this constant, computes per-session / per-conversation / lifetime
  deltas from `agents/cost-tracking/sessions.jsonl`.
- [`scripts/cost_summary.py`](../../scripts/cost_summary.py) — emits
  the stable JSON contract for inter-tool consumption per
  [`cost-summary-schema.md`](cost-summary-schema.md).
- `agent-status` skill — surfaces the per-session delta in the
  status report under the `[caveman: …]` widget.

## See also

- [`compression-default-kill-criterion.md`](compression-default-kill-criterion.md) — the rule-default-flip gate; this multiplier is gated on the same `vs_terse` arm.
- [`bench/reports/caveman-v1.md`](../../bench/reports/caveman-v1.md) — provenance for the `v1` value.
- [`bench/reports/caveman-v2.md`](../../bench/reports/caveman-v2.md) — input-side (orthogonal); does NOT feed this multiplier (this multiplier is output-side).
- [`caveman-speak`](../../.agent-src.uncompressed/rules/caveman-speak.md) — runtime rule the multiplier measures.
