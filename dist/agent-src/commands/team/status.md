---
model_tier: inherit
name: team-status
disable-model-invocation: true
pack: product-reasoning
tier: 2
visibility: internal
description: Thin wrapper — plugin job status via /codex:status plus a ledger line with today's cli_call_budget openai count. Gated on ai_team.enabled; fails closed when the plugin is absent.
cluster: team
sub: status
suggestion:
  eligible: false
  rationale: "Read-only state query; users invoke it explicitly when they want job or quota status — suggesting it adds noise."
workspaces:
  - agent-config-maintainer
packs:
  - product-reasoning
---

# /team status

## Instructions

Thin wrapper: team-mode status. On Claude Code hosts it delegates to the
official plugin's `/codex:status` and appends **our** quota ledger line —
the one piece of state the plugin does not know about.

### 1. Gate — `ai_team.enabled`

Read `ai_team.enabled` from `.agent-settings.yml`. Missing or `false` →
print the enable pointer from `/team` (master) § "Default-off gate" and
**STOP**.

### 2. Gate — plugin presence (fail closed)

On a Claude Code host, verify the official plugin is installed. Absent →
print the fail-closed block from `/team` (master) § "Fail-closed contract"
(`agent-config doctor --check team`) and **STOP** — never a silent no-op.

On a non-Claude-Code host: state that plugin job status requires the Claude
Code plugin, then still print the ledger line (Step 4) — the quota counter
is ours and host-independent.

### 3. Delegate

Invoke the plugin:

- `/team status` → `/codex:status`

Render its job/status output verbatim.

### 4. Append the quota ledger line

Read today's openai CLI-call count from the shared counter state at
`~/.event4u/agent-config/cli-calls.json` (daily UTC reset — the same file
the council's CLI transport maintains for
`cli_call_budget.max_calls_per_day.openai`). Append one line:

```
Ledger: <N> openai CLI calls today (UTC) · cap: <max_calls_per_day or "unset">
```

- `<N>` = today's openai count from the counter file; `0` when the file or
  today's entry is absent.
- `<cap>` = `ai_team.max_calls_per_day` when set; fall back to
  `cli_call_budget.max_calls_per_day.openai`; `unset` when neither exists.
- One counter, one subscription — never introduce a parallel team-only
  counting file.

## Output format

- The plugin's status output, verbatim.
- Exactly one trailing `Ledger:` line in the format above.
- Gate failures print exactly one block (enable pointer or fail-closed
  block) and stop.

## Do NOT

- Do NOT run when `ai_team.enabled` is false — enable pointer, stop.
- Do NOT fabricate a count when the counter file is unreadable — print
  `Ledger: unavailable (<reason>)` instead of a guessed number.
- Do NOT write to `cli-calls.json` — the transport owns the counter; this
  wrapper is read-only.
- Do NOT reimplement job tracking inline when the plugin is absent — fail
  closed with the doctor pointer (the ledger line alone is still printed on
  non-Claude-Code hosts, per Step 2).

## See also

- `/team` — master orchestrator: gates, boundary table vs `/council`.
- `docs/contracts/ai-team-config.md` — `ai_team.max_calls_per_day`.
- `ai-council` skill — the shared CLI transport that maintains the counter.
