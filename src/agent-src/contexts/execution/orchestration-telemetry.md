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
  "verdict_changed_outcome": null
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

**No hook or daemon required.** The agent writes directly via its file-write
tool — the same mechanism used for any other agent-written artifact. This is the
no-runtime-compatible capture path (decided 2026-06-30, maintainer decision;
see `road-to-subagent-value-realization.md § Council notes`).

**`token_delta` sourcing priority:**
1. Host-reported: read `usage.output_tokens` (and `usage.input_tokens` if
   available) from the response metadata of each subagent call. Use the sum
   minus the estimated single-agent baseline. Set `token_delta_provenance:
   "measured"`.
2. Self-estimate fallback: if host usage metadata is unavailable, estimate from
   response length (chars / 4 ≈ tokens). Set `token_delta_provenance:
   "estimated"`. This estimate is lossy; measured is always preferred.

## Related

- [`audit-log-v1`](../../../../docs/contracts/audit-log-v1.md) — the frozen
  JSONL contract this object rides on; the `orchestration` field is optional
  and additive, schema_version unchanged.
- [`host-capability-manifest`](host-capability-manifest.md) — the manifest that
  decides whether a dispatch is even attempted; `spawn_count` and `tiers`
  reflect what it enabled.
