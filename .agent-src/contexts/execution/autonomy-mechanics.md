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

## Blocking — STILL ASK regardless of `personal.autonomy`

Beyond the Hard Floor, the autonomy setting also never overrides:

- **Vague-request triggers** in
  [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) —
  ambiguous requirements stay ambiguous; pick-one-and-pray is wrong.
- **Architectural / structural choices** the codebase doesn't already
  settle (multi-stack picks, library introductions).
- **Security-sensitive paths** — see
  [`security-sensitive-stop`](../../rules/security-sensitive-stop.md).
- **Scope expansion** beyond the stated task — see
  [`scope-control`](../../rules/scope-control.md).
- **Remote-state operations** — push, merge, rebase, force-push,
  branch create/delete/switch, PR create/close/retarget, tag/release.
  Permission-gated by
  [`scope-control`](../../rules/scope-control.md); the prod-trunk
  and deploy-tied subset is governed by
  [`non-destructive-by-default`](../../rules/non-destructive-by-default.md).
- **Destructive ops** — see
  [`non-destructive-by-default`](../../rules/non-destructive-by-default.md)
  for the full taxonomy (whimsical bulk deletions, content
  destruction, commits containing bulk deletions or infra changes).

In doubt whether something is trivial or blocking → it is blocking.
Ask.

## Commit policy summary

Committing is governed by the canonical
[`commit-policy`](../../rules/commit-policy.md) rule, which applies
regardless of `personal.autonomy`:

- NEVER commit unless user said so this turn, a commit command was
  invoked, a standing instruction is active, or the roadmap
  authorizes it.
- NEVER ask about committing. The user invokes a command or says so.
- In autonomous mode, the **only** permitted commit-related question
  is the one-shot pre-scan ask at the start of roadmap execution.

Push, merge, rebase, branch creation, PR operations, and tags
remain permission-gated by
[`scope-control § git-operations`](../../rules/scope-control.md#git-operations--permission-gated).
