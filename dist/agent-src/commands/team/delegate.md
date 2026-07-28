---
model_tier: inherit
name: team-delegate
disable-model-invocation: true
argument-hint: "<task>"
pack: meta
tier: 2
visibility: internal
description: Thin wrapper — hand a task to the second model as a native worker via the official plugin (/codex:rescue). The only write-access wrapper; double-gated behind ai_team.allow_delegate.
cluster: team
sub: delegate
suggestion:
  eligible: false
  rationale: "Only write-access wrapper in the family; delegation of write access must be explicitly typed by the user, never suggested."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /team delegate

## Instructions

Thin wrapper: hand a task to the second model as a **native worker** in the
repo. On Claude Code hosts it delegates to the official plugin's
`/codex:rescue`. This is the **only wrapper that delegates write access**,
so it carries a second opt-in on top of the family gate.

### 1. Gate — `ai_team.enabled`

Read `ai_team.enabled` from `.agent-settings.yml`. Missing or `false` →
print the enable pointer from `/team` (master) § "Default-off gate" and
**STOP**.

### 2. Gate — `ai_team.allow_delegate` (second opt-in)

Read `ai_team.allow_delegate`. Missing or `false` (the shipped default) →
refuse with the enable pointer and **STOP**:

> `/team delegate` is disabled (`ai_team.allow_delegate: false`, the
> default). It is the only team-mode wrapper that hands **write access** to
> the second model, so it needs its own opt-in:
>
> ```yaml
> ai_team:
>   enabled: true
>   allow_delegate: true
> ```
>
> Key reference: `docs/contracts/ai-team-config.md`.

Deterministic mirror of gates 1+2: `npx tsx src/scripts/ai_team/team_dispatch.ts
--delegate-gate` exits non-zero (pointer on stderr) unless BOTH flags true — run
it instead of hand-parsing YAML when a shell is available.

### 3. Gate — plugin presence (fail closed)

On a Claude Code host, verify the official plugin is installed. Absent →
print the fail-closed block from `/team` (master) § "Fail-closed contract"
(`agent-config doctor --check team`) and **STOP**. Never reimplement the
worker inline; never silently no-op.

On a non-Claude-Code host: there is **no** delegate fallback — the
worker-via-bundle path is deferred by a recorded internal null. State that
delegation requires the Claude Code plugin and stop.

### 4. Resolve the task

The user invoked `/team delegate <task>`. If the task text is missing, ask
(one question per turn, per `ask-when-uncertain`) for a one-line task
description; do not invent scope.

### 5. Delegate

Invoke the plugin with the task passed through unchanged:

- `/team delegate <task>` → `/codex:rescue <task>`

The Codex worker runs natively in the working tree under the user's
subscription. The call counts into the
`cli_call_budget.max_calls_per_day.openai` quota; on exhaustion surface the
transport's refusal, do not retry.

### 6. Return the result verbatim

Render the plugin's result unchanged. Any edits the worker made are in the
working tree for the user to review — this wrapper never commits, pushes, or
opens a PR on top of them.

## Output format

- The plugin's rescue/delegation result, verbatim.
- Gate failures print exactly one block (enable pointer, allow_delegate
  refusal, or fail-closed block) and stop.

## Do NOT

- Do NOT run when `ai_team.enabled` is false — enable pointer, stop.
- Do NOT run when `ai_team.allow_delegate` is false — refusal block, stop.
  Never treat `enabled: true` alone as delegate authorization.
- Do NOT reimplement the worker inline when the plugin is absent — fail
  closed with the doctor pointer.
- Do NOT commit, push, or open a PR over the worker's edits — review is the
  user's call.
- Do NOT claim a productivity or quality lift; the benchmark verdict is
  pending (see `/team` master § "No-claims note").

## See also

- `/team` — master orchestrator: gates, boundary table vs `/council`.
- `/team review` — the read-only default lens; prefer it unless the user
  explicitly wants the second model to do the work.
- `docs/contracts/ai-team-config.md` — `ai_team.allow_delegate` semantics.
