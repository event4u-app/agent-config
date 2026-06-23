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
  "wall_clock_ms": 0,
  "outcome": "DONE",
  "verify_mode": "deterministic"
}
```

## Field semantics

| Field | Type | Meaning |
|---|---|---|
| `task_size_estimate` | int | Pre-dispatch estimate of the task's size (the orchestrator's sizing heuristic). Counts only, no body. |
| `spawn_count` | int | Number of subagents dispatched for this task. `0` → handled in-session. |
| `tiers` | string[] | Model tiers dispatched to, one entry per spawn class (e.g. `["sonnet","opus"]`). Tier names only, no prompts. |
| `token_delta` | int | Net token cost of the dispatch versus the in-session baseline. Counts only. |
| `wall_clock_ms` | int | Wall-clock duration of the dispatch, milliseconds. |
| `outcome` | enum | One of `DONE` · `DONE_WITH_CONCERNS` · `NEEDS_CONTEXT` · `BLOCKED` · `killed`. |
| `verify_mode` | enum | How the dispatch's output was verified: `deterministic` · `judge` · `none`. |

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

## Related

- [`audit-log-v1`](../../../../docs/contracts/audit-log-v1.md) — the frozen
  JSONL contract this object rides on; the `orchestration` field is optional
  and additive, schema_version unchanged.
- [`host-capability-manifest`](host-capability-manifest.md) — the manifest that
  decides whether a dispatch is even attempted; `spawn_count` and `tiers`
  reflect what it enabled.
  Phase-0 instrumentation belongs to.
