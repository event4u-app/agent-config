# Autonomy Mechanics — Settings and Platform Behavior

Loaded by the [`autonomous-execution`](../../rules/autonomous-execution.md)
rule when settings semantics or platform-specific defaults are
relevant. Detection logic lives in [`autonomy-detection.md`](autonomy-detection.md).

## `personal.autonomy` setting

| Value | Behavior |
|---|---|
| `on` | Suppress trivial questions. Act on the obvious next step. Still ask on blocking / critical decisions, and ALWAYS ask on Hard-Floor triggers. |
| `off` | Ask trivial questions too. Use this if you want the agent to check in on each workflow step. |
| `auto` (default) | Same as `off` by default. Flips to `on` for the rest of the conversation as soon as the user expresses the intent "stop asking, just work". See [detection logic](autonomy-detection.md) — match by **intent**, not exact string. The flip never lifts the Hard Floor. |

The value is read once on the first turn (per
[`layered-settings`](../../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules))
and cached. Missing key → treat as `on`.

## Cloud platforms — settings degrade to `on`

Setting reads degrade gracefully on cloud platforms (no
`.agent-settings.yml` available). Treat as `personal.autonomy: on` —
the user had to deliberately ship a custom skill bundle to a cloud
agent and is unlikely to want trivial-question friction.

The Hard Floor still applies on every surface, including cloud. There
is no "cloud override" for production-branch merges, deploys, pushes,
prod data/infra, or whimsical bulk deletions — see
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md#cloud-behavior).
