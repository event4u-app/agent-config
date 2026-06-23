# Auto-Orchestration Activation

How the `subagents.*` keys in `.agent-settings.yml` resolve into automatic
subagent dispatch at runtime. Companion to
[`subagent-configuration`](../subagent-configuration.md) (which covers the
model / parallelism keys) and
[`host-capability-manifest`](host-capability-manifest.md) (which decides
whether dispatch is physically possible on the host).

## Settings

| Key | Default | Purpose |
|---|---|---|
| `subagents.enabled` | `true` | Global master switch. `false` = the whole layer is off — the canonical kill-switch. No auto-dispatch, no routing, everything runs in-session. |
| `subagents.auto` | `ask` | Auto-dispatch mode: `off` \| `ask` \| `on`. |
| `subagents.downshift` | `true` | Route delegable sub-tasks to the lowest-capable tier (Phase 2). |
| `subagents.quota_arbitrage` | `true` | Prefer a separate-quota-pool model where the host manifest allows it (Phase 2 bonus). |
| `subagents.model_map` | `{}` | Optional per-tier model override for downshift routing. |
| `subagents.host_capabilities` | `{}` | Optional override of the host-capability manifest. |

## Activation decision

For any task, auto-dispatch is attempted **only when all hold**:

```
subagents.enabled == true
AND subagents.auto != off
AND host_manifest.subagent_spawn == true
AND the task is classified delegable (see auto-dispatch-classification.md)
```

If any condition fails → **in-session execution**, no subagent. This is the
safe path: a missing/false manifest field, a disabled switch, or an
unclassifiable task all degrade silently to single-agent.

## `auto` mode behaviour

| Mode | When task is delegable | When not delegable |
|---|---|---|
| `off` | never dispatch (explicit command only) | in-session |
| `ask` | ask once, then dispatch on yes (per `user-interaction`) | in-session |
| `on` | dispatch; surface the chosen mode in one line | in-session |

Under `ask` and `on`, the chosen `subagent-orchestration` mode and the
per-subtask tiers are surfaced before/at dispatch — never silent.

## Resolution order

1. Read `subagents.*` once per run; cache for the run (no re-read mid-loop),
   mirroring [`subagent-configuration § When settings change`](../subagent-configuration.md).
2. Resolve the host-capability manifest once (cached) per
   [`host-capability-manifest`](host-capability-manifest.md).
3. Apply the activation decision above per task.

## Safety floors are never lifted

Auto-dispatch never bypasses a floor. The cross-model judge Iron Law
(`subagent-orchestration`), `verify-before-complete`, the N=3 autonomous
budget, `scope-control`, and `non-destructive-by-default` all apply to
auto-delegated work exactly as they do to in-session work. `enabled: false`
disables the layer; it never disables a floor.

## Related

- [`subagent-configuration`](../subagent-configuration.md) — model / parallelism keys.
- [`host-capability-manifest`](host-capability-manifest.md) — the per-host gate.
- [`auto-dispatch-classification`](auto-dispatch-classification.md) — what counts as delegable.
- [`orchestration-telemetry`](orchestration-telemetry.md) — what each dispatch records.
