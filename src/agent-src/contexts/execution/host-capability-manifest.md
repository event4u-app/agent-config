# Host-Capability Manifest

Resolved once per session by the **agent** (not a long-running process) and
cached for the rest of the session. Tells the orchestration layer which
subagent primitives the current host actually exposes, so auto-dispatch never
attempts a primitive the host cannot run.

## Schema

A single JSON object, `schema_version: 1`:

```json
{
  "schema_version": 1,
  "subagent_spawn": false,
  "parallel_spawn": false,
  "status_polling": false,
  "separate_quota_pool": false
}
```

## Resolution

The agent fills the manifest from two inputs, in order:

1. The agent's own knowledge of the **current host** and its documented
   subagent primitives.
2. An **optional** settings override `subagents.host_capabilities` in
   `.agent-settings.yml`. Any field present there wins for that field; any
   field omitted falls back to the safe default below.

The manifest is resolved once and cached — the agent does not re-resolve it
mid-session.

## Safe default — unknown host assumes nothing

```
SAFE DEFAULT = ALL FIELDS false.
AN UNKNOWN HOST IS ASSUMED TO HAVE NO SUBAGENT PRIMITIVE.
A MISSING OR INVALID FIELD IS false, NEVER true.
```

This is a hard rule. When the host is unrecognized, or a field is absent /
malformed in the override, the field resolves to `false`. The orchestration
layer then degrades to in-session execution rather than attempting an
unsupported primitive.

## Fields

| Field | Type | Gates downstream |
|---|---|---|
| `subagent_spawn` | bool | Any delegation at all. `false` → no subagent is ever spawned; everything runs in-session. |
| `parallel_spawn` | bool | Concurrent dispatch of multiple subagents. `false` → delegation is serial, one subagent at a time. |
| `status_polling` | bool | Monitoring running subagents (progress / completion checks). `false` → fire-and-collect only, no mid-run polling. |
| `separate_quota_pool` | bool | Quota-arbitrage bonus (Phase 2) — subagents draw from a distinct quota pool than the session. `false` → assume shared quota. |

A field being `true` is a **precondition**, not a mandate: `parallel_spawn:
true` permits concurrency but the dispatch cap still applies (see
`subagents.max_parallel` in subagent-configuration.md).

## Related

- [`subagent-configuration`](../subagent-configuration.md) — the `subagents.*`
  settings keys and the model / parallelism resolution this manifest sits
  alongside.
- [`orchestration-telemetry`](orchestration-telemetry.md) — records what the
  resolved manifest actually enabled per dispatch.
  Phase-0 substrate belongs to.
