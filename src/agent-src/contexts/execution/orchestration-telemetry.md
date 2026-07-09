# Orchestration Telemetry

Per-dispatch orchestration metrics, recorded for every auto-dispatch the
orchestration layer performs. These ride as an **optional** `orchestration`
sub-object on the existing audit-log-v1 JSONL line — additive and
non-breaking. A line without an `orchestration` object is still a valid
audit-log-v1 line; readers that do not understand the field ignore it (per the
v1 forward-compat rule on unknown fields).

## Shape

```json
{
  "task_size_estimate": 0,
  "spawn_count": 0,
  "tiers": [],
  "token_delta": 0,
  "token_delta_provenance": "estimated",
  "wall_clock_ms": 0,
  "outcome": "DONE",
  "verify_mode": "deterministic",
  "verdict_changed_outcome": null,
  "task_class": null,
  "tier_chosen": null,
  "tier_source": null,
  "dispatch_tokens": null,
  "session_tier": null,
  "escalated_from": null,
  "verify_result_by_tier": null
}
```

## Field semantics

| Field | Type | Meaning |
|---|---|---|
| `task_size_estimate` | int | Pre-dispatch estimate of the task's size (the orchestrator's sizing heuristic). Counts only, no body. |
| `spawn_count` | int | Number of subagents dispatched for this task. `0` → handled in-session. |
| `tiers` | string[] | Model tiers dispatched to, one entry per spawn class (e.g. `["sonnet","opus"]`). Tier names only, no prompts. |
| `token_delta` | int | Net token cost of the dispatch versus the in-session baseline. Positive = orchestration cost more; negative = saved tokens. Counts only. |
| `token_delta_provenance` | enum | `"measured"` when sourced from host-reported `usage` metadata (preferred); `"estimated"` when self-estimated from response length (mark always when host usage is unavailable). |
| `wall_clock_ms` | int | Wall-clock duration of the dispatch, milliseconds. |
| `outcome` | enum | One of `DONE` · `DONE_WITH_CONCERNS` · `NEEDS_CONTEXT` · `BLOCKED` · `killed`. |
| `verify_mode` | enum | How the dispatch's output was verified: `deterministic` · `judge` · `none`. |
| `verdict_changed_outcome` | bool \| null | **A3 extension (ADR-109 Track A).** For a review/verdict subagent (e.g. `production-validator`): did the subagent's verdict actually change the outcome versus the in-session baseline? `true` = it caught a real issue the baseline missed or flipped a false `READY`→`NOT READY`; `false` = same outcome as baseline (no lift); `null` = not a verdict dispatch / not measured. **Negative-control tasks (a clean single-file task) MUST record `false`** — a subagent that reports `true` on a control is producing spurious findings and fails Gate A. This is an additive field on THIS object, not a second schema. Counts/boolean only, no bodies. |
| `task_class` | string \| null | **Routing extension (road-to-cost-aware-model-routing Phase 0).** Category id of the dispatched slice (e.g. `read-only-fanout`, `mechanical-edit`, `implementation`, `review-synthesis`). Enum-style id only, never free-form task text. `null` = pre-extension line / unclassified. |
| `tier_chosen` | string \| null | Tier the slice was dispatched on (`lite` \| `medium` \| `high`). `null` = pre-extension line. |
| `tier_source` | enum \| null | Where `tier_chosen` came from: `static` (frontmatter/category pin) · `inferred` (deterministic per-slice inference) · `inherit` (session tier — no downshift decision). Lets the evidence gate score inferred routing separately from static pinning. |
| `escalated_from` | string \| null | When the slice was re-dispatched after a verification failure: the tier of the FAILED attempt (e.g. `lite` when a lite return failed verify and the slice re-ran on `medium`). `null` = no escalation. |
| `verify_result_by_tier` | object \| null | Map of tier → verification result for every attempt of this slice (e.g. `{"lite":"fail","medium":"pass"}`). Values: `pass` \| `fail` \| `skipped`. Feeds the per-tier verify-pass-rate tripwire. Enums only, no verdict bodies. |
| `dispatch_tokens` | int \| null | **Cost-% extension.** Absolute tokens the dispatched slice consumed (measured subagent usage). Feeds the MODELED cost-% in `orchestration_savings_report`, which needs an absolute base the token-count delta lacks. `null` = not recorded. Counts only. |
| `session_tier` | string \| null | **Cost-% extension.** The orchestrator's OWN tier — the baseline the downshift cost-% measures `tier_chosen` against (a `high`→`lite` downshift is a rate win the token count can't see). `null` = not recorded. |

These routing + cost fields are additive and optional — a line without them is
still a valid orchestration line; readers ignore unknown fields per the v1
forward-compat rule.

## Privacy floor

Counts and ids only — **no bodies**. This preserves the audit-log-v1 privacy
floor: no prompts, no conversation snippets, no subagent output, no secrets.
`tiers` carries tier names, never model prompts or completions.

## Example line

One JSON object per line, UTF-8, no trailing whitespace. The `orchestration`
object is an additive extension on an otherwise standard audit-log-v1 line:

```json
{"schema_version":1,"id":"01HXY...","ts":"2026-06-23T12:34:56Z","work_id":"PROJ-7-2026-06-23T12-30-00Z","phase":"implement","outcome":"success","confidence_band":"high","risk_class":"low","memory":{"asks":2,"hits":1},"verify":{"claims":1,"first_try_passes":1},"rules_applied":["verify-before-complete"],"persona":"backend","input_kind":"orchestration","type":"phase","orchestration":{"task_size_estimate":3,"spawn_count":2,"tiers":["sonnet","opus"],"token_delta":4200,"wall_clock_ms":18500,"outcome":"DONE","verify_mode":"deterministic"}}
```

## Emit procedure (how the orchestrating agent writes telemetry)

After every auto-dispatched orchestration run, the orchestrating agent writes one
telemetry line to `agents/runtime/state/audit/YYYY-MM.jsonl` (the existing
audit-log-v1 path, where `YYYY-MM` is the current UTC month). The line is a
standard audit-log-v1 object with `input_kind: "orchestration"` and an
`orchestration` sub-object carrying this shape.

**No hook or daemon required.** The agent writes the line directly — the
no-runtime-compatible capture path (decided 2026-06-30, maintainer decision;
see `road-to-subagent-value-realization.md § Council notes`). Do NOT
hand-author the JSON: run the recorder, which validates the inputs and builds a
conformant audit-log-v1 line from the counts you already have:

```bash
./scripts-run src/scripts/orchestration_record --spawn-count <n> \
  --token-delta <±n> --provenance measured|estimated \
  [--tier-chosen lite|medium|high] [--tier-source static|inferred|inherit] \
  [--task-class <id>] [--tiers a,b] [--dispatch-outcome DONE|BLOCKED|…]
```

A capture **hook** is the wrong tool here: the PostToolUse payload carries no
subagent token usage — only the orchestrator sees it (via the run result) — and
a hook would reverse the 2026-06-30 no-hook decision. Reader:
`src/scripts/orchestration_savings_report.ts`.

**`token_delta` sourcing priority:**
1. Host-reported: read `usage.output_tokens` (and `usage.input_tokens` if
   available) from the response metadata of each subagent call. Use the sum
   minus the estimated single-agent baseline. Set `token_delta_provenance:
   "measured"`.
2. Self-estimate fallback: if host usage metadata is unavailable, estimate from
   response length (chars / 4 ≈ tokens). Set `token_delta_provenance:
   "estimated"`. This estimate is lossy; measured is always preferred.

## Savings report

Aggregate the accumulated telemetry into a token-savings report:

```bash
./scripts-run src/scripts/orchestration_savings_report [--dir <path>] [--format text|json]
```

It sums `token_delta` across dispatches (negative = net saved) and splits by
provenance (measured vs estimated), `tier_chosen`, and `task_class`. It reports
**ABSOLUTE net tokens saved, never a percentage**: the telemetry records net
delta, not the absolute in-session baseline, so a "% of session saved" is not
derivable from this data. A percentage would require an additive
absolute-baseline field on this object (deferred follow-up). Reader:
[`src/scripts/_lib/orchestration_savings.ts`](../../../../src/scripts/_lib/orchestration_savings.ts).

## Related

- [`audit-log-v1`](../../../../docs/contracts/audit-log-v1.md) — the frozen
  JSONL contract this object rides on; the `orchestration` field is optional
  and additive, schema_version unchanged.
- [`host-capability-manifest`](host-capability-manifest.md) — the manifest that
  decides whether a dispatch is even attempted; `spawn_count` and `tiers`
  reflect what it enabled.
