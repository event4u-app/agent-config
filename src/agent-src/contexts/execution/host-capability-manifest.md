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

## Observation protocol — what may be written into a registry row

**Added 2026-08-22** (`road-to-host-capability-observations` Phase 1). The
registry held **one** row while **eight** platform keys were declared, so on
seven hosts every field was the safe default — and `false` carried two meanings
at once. This protocol is what makes them distinguishable.

```
A ROW IS WRITTEN FROM AN OBSERVATION IN A REAL SESSION, NEVER FROM THE HOST'S
DOCUMENTATION. A CAPABILITY THAT EXISTS ON PAPER AND NOT IN THE SESSION PRODUCES
A ROUTING DECISION THAT FAILS SILENTLY.
```

**This is a written criterion a human applies, and deliberately not a script.**
A prober that decides for itself what counts as evidence is the inference
`host_capability.ts` already forbids, wearing an executable's authority.

### Per-field criterion — each one transcript-observable

| Field | What counts as an observation |
|---|---|
| `subagent_spawn` | a dispatch record showing a **child leg with its own turn** — a start and a stop that pair, so the child's duration is measurable rather than inferred |
| `parallel_spawn` | **two child legs whose intervals overlap** — concurrently open children at one instant, not two children in sequence |
| `status_polling` | a **completed poll returning a state the parent did not already hold**. A poll that returns what the parent knew is not an observation of polling |
| `separate_quota_pool` | a **child leg continuing across a parent quota condition** — the parent constrained, the child proceeding |
| `worker_respawn` | **one task continuing across a killed and re-spawned worker, same task id.** Never inferred from the fact that spawning and killing both exist separately |

### `agent_teams` is out of scope for a row, by construction

It is resolved **only** by the live environment probe and is never inferred from
a host id — `host_capability.ts` states that in the field's own doc comment, and
records that this repository has observed the flag's documented existence and
never its shape on any host. So: do not add it to a registry row. Observe it, if
at all, through the live probe.

### Observed-absent is not the same row as never-looked

Both render as `false`, and collapsing them is the defect this protocol opens
against — a reader then cannot tell whether a capability was tested.

- **Never looked** — the field is **absent from the row**. It resolves to the
  safe default, and `describeHostCapabilities` reports its source as `default`.
  This is the state that needs no marker, because the absence *is* the record.
- **Observed absent** — the field is present and `false`, and carries a
  `<field>_absent` citation in the same doc comment. Present-and-`false` is the
  marker: it is only reachable by someone who wrote it deliberately, and the
  provenance surface then reports `registry` rather than `default` — which is
  exactly the distinction, readable from `routing:doctor` without opening the
  file.

### The five-part citation — a row without all five is not admissible

1. **the host** — the platform key from `hook_manifest.yaml`;
2. **the host version** at the time of observation;
3. **the transcript or artefact reference** the observation is read from;
4. **the date**;
5. **the expiry** — the date after which the observation stops being admissible.

Worked example, which a later row can be pattern-matched against:

```
// subagent_spawn: OBSERVED — claude (Claude Code, Opus 5 1M session, 2026-08-22,
//   expires 2027-08-22)
//   agents/runtime/state/subagent-ledger/2026-08.jsonl: 445 `subagent_start`
//   records and 420 stops carrying a measured `duration_ms`, i.e. 420 child legs
//   whose start and stop pair. A measurable child duration is the criterion.
```

### Why an expiry, and not just a date

```
A HOST FACT WITHOUT AN EXPIRY IS A CLAIM NOBODY EVER RE-CHECKS.
AN EXPIRED FACT IS TREATED EXACTLY AS AN UNOBSERVED ONE.
```

The date says when it was true. Only the expiry says when someone must look
again — and a fact with no such date is one nobody looks at again, which is how
the same stale host claims survived three correction rounds in this tree. An
observation is about a host version that ships on its own cadence, so its
shelf-life is a property of the observation and belongs beside it.

The expiry is **not** a claim that the capability lapses on that date. It is the
date after which this tree stops treating the observation as current, which is a
statement about the record, never about the host.

The machine-readable twin of this field is `verified.expires` in
`src/scripts/hooks/host_lowering.yaml`, the same discipline applied to hook
lowering: `lint_hook_manifest` refuses an expired row that still carries a
blocking binding and warns on every other lapse, and `host_semantics.ts` reads
an expired row exactly as `verified: null`. A registry row here has no such
gate — the criteria are applied by a human, deliberately (see above), so the
expiry here is a written obligation and its enforcement is the reviewer.

### Pre-state, pinned so the Phase 2 diff reads as an addition

At the commit this protocol landed on, the registry was exactly:

```ts
const HOST_CAPABILITY_REGISTRY = { claude: { subagent_spawn: true, parallel_spawn: true } };
```

One host, two fields. Six fields across seven other hosts resolved to the
all-`false` safe default.

## Related

- [`subagent-configuration`](../subagent-configuration.md) — the `subagents.*`
  settings keys and the model / parallelism resolution this manifest sits
  alongside.
- [`orchestration-telemetry`](orchestration-telemetry.md) — records what the
  resolved manifest actually enabled per dispatch.
  Phase-0 substrate belongs to.
