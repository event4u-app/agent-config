# Host-Capability Manifest

Resolved once per session (via `probeHostCapabilities`, not a long-running
process) and cached for the rest of the session. Tells the orchestration
layer which subagent primitives the current host actually exposes, so
auto-dispatch never attempts a primitive the host cannot run.

## Schema

A single JSON object, `schema_version: 1`:

```json
{
  "schema_version": 1,
  "subagent_spawn": false,
  "parallel_spawn": false,
  "status_polling": false,
  "separate_quota_pool": false,
  "agent_teams": false,
  "worker_respawn": false
}
```

## Resolution

`probeHostCapabilities(hostId)` (`src/scripts/_lib/host_capability.ts`) fills
the manifest from OBSERVABLE FACTS ONLY — capability is a fact about the
host, never a configuration decision (always-on orchestration, Phase 1):

1. The committed `HOST_CAPABILITY_REGISTRY` row for the detected host — the
   agent's own knowledge of documented subagent primitives.
2. A live environment probe merged on top: `agent_teams` resolves `true`
   when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set in the process
   environment — the one host fact this repo can observe about Claude
   Code's experimental multi-instance Agent Teams feature.
3. `SAFE_DEFAULT` (all `false`) for an unrecognized host or an unset probe.

`resolveHostCapabilities(hostId, override?)` still accepts an optional
whole-object override for tests and back-compat callers, but no production
caller passes a settings-derived override into it any more — the former
`subagents.host_capabilities` settings key was removed. A leftover key in a
consumer's `.agent-settings.yml` is ignored.

The manifest is resolved once and cached — the agent does not re-resolve it
mid-session.

## Safe default — unknown host assumes nothing

```
SAFE DEFAULT = ALL FIELDS false.
AN UNKNOWN HOST IS ASSUMED TO HAVE NO SUBAGENT PRIMITIVE.
A MISSING OR INVALID FIELD IS false, NEVER true.
```

This is a hard rule. When the host is unrecognized, or a probed fact is
absent, the field resolves to `false`. The orchestration layer then degrades
to in-session execution rather than attempting an unsupported primitive.

## Fields

| Field | Type | Gates downstream |
|---|---|---|
| `subagent_spawn` | bool | Any delegation at all. `false` → no subagent is ever spawned; everything runs in-session. |
| `parallel_spawn` | bool | Concurrent dispatch of multiple subagents. `false` → delegation is serial, one subagent at a time. |
| `status_polling` | bool | Monitoring running subagents (progress / completion checks). `false` → fire-and-collect only, no mid-run polling. |
| `separate_quota_pool` | bool | Quota-arbitrage bonus (Phase 2) — subagents draw from a distinct quota pool than the session. `false` → assume shared quota. |
| `agent_teams` | bool | Claude Code's experimental multi-instance Agent Teams primitive (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`). `false` → the [judgment ladder](auto-dispatch-classification.md#judgment-ladder-phase-2--road-to-always-on-orchestration)'s rung 3 (team) degrades to parallel subagents, recorded as `degraded_from: 3`. |
| `worker_respawn` | bool | The host can kill a running worker and spawn a fresh one that continues the SAME task mid-flight. `false` on every host today, deliberately — set `true` only once OBSERVED, never by inference from spawning and killing existing separately. `false` → degrade to stop-loss behaviour, loudly. |

A field being `true` is a **precondition**, not a mandate: `parallel_spawn:
true` permits concurrency but the dispatch cap still applies (see
`subagents.max_parallel` in subagent-configuration.md).

## Provenance — "probe" is a misnomer for five of the six fields

```
NEVER READ A false FIELD AS "THIS HOST CANNOT DO IT".
A REGISTRY ROW IS A COMMITTED OBSERVATION, NOT A LIVE CHECK.
A default FIELD MEANS NOBODY ANSWERED — RENDERED AS false BECAUSE THAT IS THE
SAFE DEGRADATION, NOT BECAUSE ANYTHING WAS MEASURED.
```

The six booleans look alike and are not. `HOST_CAPABILITY_REGISTRY` holds
exactly one row today, so on every other host **all six** fields are the safe
default — and `agent_teams` is the only field any live check touches. The name
`probeHostCapabilities` says "detected" about values that were mostly asserted
at authoring time.

`describeHostCapabilities(hostId)` returns the same manifest plus a
`sources` map naming, per field, which of the three answered:

| Source | Means | Re-checked at run time |
|---|---|---|
| `registry` | this repo observed the capability on this host once and committed it to the table | no |
| `live-probe` | established in THIS process, from the environment | yes |
| `default` | nothing answered; `SAFE_DEFAULT` applied | n/a |

`agent-config routing:doctor [--platform <host>]` prints it. Read the
provenance before treating a `false` as a host limitation: on an unrecognized
host every field is `default`, which is an absence of knowledge and not a
measurement.

## Related

- [`subagent-configuration`](../subagent-configuration.md) — the `subagents.*`
  settings keys and the model / parallelism resolution this manifest sits
  alongside.
- [`orchestration-telemetry`](orchestration-telemetry.md) — records what the
  resolved manifest actually enabled per dispatch.
  Phase-0 substrate belongs to.
