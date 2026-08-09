# Auto-Orchestration Activation

How automatic subagent dispatch resolves at runtime. Companion to
[`subagent-configuration`](../subagent-configuration.md) (which covers the
model / parallelism keys) and
[`host-capability-manifest`](host-capability-manifest.md) (which decides
whether dispatch is physically possible on the host).

Always-on orchestration (road-to-always-on-orchestration, Phase 1): the layer
carries no per-run on/off setting. `subagents.enabled`, `subagents.auto`, and
`subagents.host_capabilities` were removed from `.agent-settings.yml` — a
fresh install with an empty settings file activates on any capable host.
Activation now reads only two facts: whether the emergency incident switch is
set, and what the host can physically do.

## Settings

| Key | Default | Purpose |
|---|---|---|
| `subagents.downshift` | `true` | Route delegable sub-tasks to the lowest-capable tier (Phase 2). |
| `subagents.quota_arbitrage` | `true` | Prefer a separate-quota-pool model where the host manifest allows it (Phase 2 bonus). |
| `subagents.model_map` | `{}` | Optional per-tier model override for downshift routing. |
| `emergency.orchestration_halt` | `false` | The ONE audited incident switch — see [`settings-classes.md`](../../../../docs/contracts/settings-classes.md) § "The one exception". NOT an activation gate: on-by-default, ceremony-free to arm, requires a non-empty `orchestration_halt_justification` to disarm. |

## Activation decision

For any task, auto-dispatch is attempted **only when all hold**:

```
emergency.orchestration_halt != true
AND host_manifest.subagent_spawn == true
AND the task is classified delegable (see auto-dispatch-classification.md)
```

If any condition fails → **in-session execution**, no subagent. This is the
safe path: an unresolved host capability, an active incident halt, or an
unclassifiable task all degrade silently to single-agent.

## Verdict behaviour

| Task shape | Verdict |
|---|---|
| A matched delegable signal | `dispatch` — surface the chosen mode + per-subtask tiers in one line, never silent |
| No enumerated signal (ambiguous) | `ask` — a verdict to the user, never a speculative spawn |
| Below the size floor, halted, or no host primitive | in-session |

There is no more `off`/`ask`/`on` MODE setting driving this table — the row a
task lands on is a property of the task and the host, not a configuration
choice.

## Resolution order

1. Resolve the emergency halt from settings once per run; cache for the run,
   mirroring [`subagent-configuration § When settings change`](../subagent-configuration.md).
2. Resolve the host-capability manifest once (cached) via
   `probeHostCapabilities` — the committed registry row merged with
   observable environment facts. Per
   [`host-capability-manifest`](host-capability-manifest.md), a settings
   override no longer participates in production resolution.
3. Apply the activation decision above per task.

## Safety floors are never lifted

Auto-dispatch never bypasses a floor. The cross-model judge Iron Law
(`subagent-orchestration`), `verify-before-complete`, the N=3 autonomous
budget, `scope-control`, and `non-destructive-by-default` all apply to
auto-delegated work exactly as they do to in-session work.
`emergency.orchestration_halt: true` disables the layer for the duration of an
incident; it never disables a floor.

## Related

- [`subagent-configuration`](../subagent-configuration.md) — model / parallelism keys.
- [`host-capability-manifest`](host-capability-manifest.md) — the per-host gate.
- [`auto-dispatch-classification`](auto-dispatch-classification.md) — what counts as delegable.
- [`orchestration-telemetry`](orchestration-telemetry.md) — what each dispatch records.
