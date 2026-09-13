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
| `emergency.orchestration_halt` | `false` | The ONE audited incident switch — see [`settings-classes.md`](../../docs/contracts/settings-classes.md) § "The one exception". NOT an activation gate: on-by-default, ceremony-free to arm, requires a non-empty `orchestration_halt_justification` to disarm. |

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
(`subagent-orchestration`), `verify-before-complete`, the fix-loop bound of
`autonomous-execution`, `scope-control`, and `non-destructive-by-default` all
apply to auto-delegated work exactly as they do to in-session work.
`emergency.orchestration_halt: true` disables the layer for the duration of an
incident; it never disables a floor.

## Carriers — how the delegation obligation reaches a session

Migrated out of `delegation-policy` on 2026-09-13 under the P4 pattern: the rule
keeps the obligation, this page carries how it travels and what stays
model-carried. The rule was re-sending all of it on every session and every
spawn, and the standing-payload ceiling is measured per spawn.

No host runs the tier-2 rule router, so that rule's triggers alone never load it.
The obligation travels on three carriers instead:

1. the always-loaded **AGENTS.md line** (delegate-by-default + end-review);
2. the **`delegation-nudge`** concern on `user_prompt_submit` — runs
   `classifyTask` on cheap prompt signals and injects a one-line verdict ONLY
   when the classifier says `do-in-parallel` / `do-in-steps`, silence otherwise.
   Delivery on `user_prompt_submit` is end-to-end verified;
3. the **`end-review-nudge`** concern on `stop` — ONE `review_skipped` telemetry
   line per mutating no-review session, verified. Its advisory line reaches the
   dispatcher output, but host-side forwarding of stop-slot context to the model
   is unverified, so the model-facing end-review carrier is the AGENTS.md line
   plus this telemetry.

The capability gate itself resolves from the committed host registry merged with
a live environment probe in `src/scripts/_lib/host_capability.ts`
(`probeHostCapabilities`) — capability is a fact about the host, never a settings
override.

**Never read a `false` capability as a host limitation without checking where it
came from.** The registry holds one row, so on every other host all six fields are
the all-false safe default — which records that *nobody answered*, not that the
host cannot spawn. `agent-config routing:doctor [--platform <host>]` prints the
value **and** its provenance per field (`registry` = a committed observation this
repo made once · `live-probe` = established in this process · `default` = no
answer). Run it before concluding delegation is unavailable here; the same-shaped
wrong guess about the council is the incident
[`council-availability`](../../rules/council-availability.md) exists for.

What stays model-carried, honestly: the decomposition itself, the per-return
verification, and every dispatch on hosts without hook slots. The nudges are
advisory by design — whether they change behavior is measured by the telemetry,
not assumed.

## Related

- [`subagent-configuration`](../subagent-configuration.md) — model / parallelism keys.
- [`host-capability-manifest`](host-capability-manifest.md) — the per-host gate.
- [`auto-dispatch-classification`](auto-dispatch-classification.md) — what counts as delegable.
- [`orchestration-telemetry`](orchestration-telemetry.md) — what each dispatch records.
