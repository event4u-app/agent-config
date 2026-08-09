---
model_tier: inherit
name: team-adversarial
disable-model-invocation: true
argument-hint: "<focus>"
pack: meta
tier: 2
visibility: internal
skills: [adversarial-review]
description: Thin wrapper — adversarial cross-model review on a named focus via the official plugin (/codex:adversarial-review). Escalation rung above the single-model adversarial-review skill.
cluster: team
sub: adversarial
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /team adversarial

## Instructions

Thin wrapper: adversarial cross-model review on a named focus. Same
Attack-Defend-Revise frame as the `adversarial-review` skill, different
attacker — a second strong model with repo access instead of the host model
critiquing itself. Use it as the **escalation rung**: single-model
self-review found nothing, or the stakes are high.

### 1. Gate — `/team` availability

Run the availability check from `/team` (master) § "Availability gate":
codex CLI + auth, and `emergency.orchestration_halt`. Either check fails →
print the matching block and **STOP**.

### 2. Gate — plugin presence (fail closed)

On a Claude Code host, verify the official plugin is installed. Absent →
print the fail-closed block from `/team` (master) § "Fail-closed contract"
(`agent-config doctor --check team`) and **STOP**. Never reimplement the
adversarial review inline; never silently no-op.

On a non-Claude-Code host: state that the cross-model adversarial path
currently requires the Claude Code plugin, offer the single-model
`adversarial-review` skill as the available rung, and stop.

### 3. Resolve the focus

The user invoked `/team adversarial <focus>` — e.g. `security`,
`error handling`, `the tenant-scope change in UserService`. If no focus was
supplied, ask (one question per turn, per `ask-when-uncertain`):

> What should the adversarial review attack?
>
> 1. A named surface (e.g. security, error handling, concurrency)
> 2. A specific file / change (name it)
> 3. Cancel

### 4. Delegate

Invoke the plugin with the focus passed through unchanged:

- `/team adversarial <focus>` → `/codex:adversarial-review <focus>`

### 5. Return the findings verbatim

Render the plugin's findings unchanged — do not soften, dedupe, or re-rank.
The call counts into the `cli_call_budget.max_calls_per_day.openai` quota;
on quota exhaustion surface the transport's refusal, do not retry.

## Output format

- The plugin's adversarial findings, verbatim.
- Gate failures print exactly one block (availability/halt block or
  fail-closed block) and stop.

## Do NOT

- Do NOT run when `/team` is unavailable (codex CLI/auth missing) or
  halted — matching block, stop.
- Do NOT reimplement the adversarial pass inline when the plugin is absent —
  fail closed with the doctor pointer.
- Do NOT skip the free first rung reflexively — the single-model
  `adversarial-review` skill costs nothing; escalate when it finds nothing
  or the stakes justify a second model.
- Do NOT edit files, commit, push, or open a PR — read-only.
- Do NOT claim a defect-finding lift; the benchmark verdict is pending (see
  `/team` master § "No-claims note").

## See also

- `adversarial-review` skill — the single-model Attack-Defend-Revise frame
  this escalates.
- `/team review` — the non-adversarial cross-model review.
- `/team` — master orchestrator: gates, boundary table vs `/council`.
