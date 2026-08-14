---
model_tier: inherit
name: team-status
disable-model-invocation: true
pack: meta
visibility: internal
description: Thin wrapper — plugin job status via /codex:status plus a quota block (shared openai counter vs team + council ceilings). Gated on codex CLI/auth availability; fails closed without the plugin.
cluster: team
sub: status
suggestion:
  eligible: false
  rationale: "Read-only state query; users invoke it explicitly when they want job or quota status — suggesting it adds noise."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /team status

## Instructions

Thin wrapper: team-mode status. On Claude Code hosts it delegates to the
official plugin's `/codex:status` and appends **our** quota block —
the one piece of state the plugin does not know about.

### 1. Gate — `/team` availability

Run the availability check from `/team` (master) § "Availability gate":
codex CLI + auth, and `emergency.orchestration_halt`. Either check fails →
print the matching block and **STOP**.

### 2. Gate — plugin presence (fail closed)

On a Claude Code host, verify the official plugin is installed. Absent →
print the fail-closed block from `/team` (master) § "Fail-closed contract"
(`agent-config doctor --check team`) and **STOP** — never a silent no-op.

On a non-Claude-Code host: state that plugin job status requires the Claude
Code plugin, then still print the quota block (Step 4) — the quota counter
is ours and host-independent.

### 3. Delegate

Invoke the plugin:

- `/team status` → `/codex:status`

Render its job/status output verbatim.

### 4. Append the quota block — two ceilings, one counter

Team mode and the council share **one** daily counter but enforce **two
independent ceilings** against it. The status output must show all three
live numbers and say which path — if any — is currently blocked:

1. **Counter** — today's openai CLI-call count from the shared counter
   state at `~/.event4u/agent-config/cli-calls.json` (daily UTC reset —
   the same file the council's CLI transport maintains). `0` when the
   file or today's entry is absent.
2. **Team ceiling** — `ai_team.max_calls_per_day` from
   `.agent-settings.yml` (`unset` when absent).
3. **Council ceiling** — `cli_call_budget.max_calls_per_day.openai` from
   the council config (`unset` when absent).

Render:

```
Quota: <N> openai CLI calls today (UTC) — one shared counter
  team ceiling (ai_team.max_calls_per_day):                <T or "unset"> → <OPEN | BLOCKED>
  council ceiling (cli_call_budget.max_calls_per_day.openai): <C or "unset"> → <OPEN | BLOCKED>
```

- A path is `BLOCKED` when the counter has reached its ceiling
  (`N >= ceiling`); an `unset` ceiling is `OPEN`.
- The two paths block **independently** — always name WHICH path is
  blocked, never a bare "quota exhausted".
- One counter, one subscription — never introduce a parallel team-only
  counting file.

**Worked example.** Council ceiling 100, team ceiling 50, counter at 45:
both paths are open. Five team calls later the shared counter reads 50 —
team calls are now `BLOCKED` (50 >= 50) while council CLI calls continue
until the counter reaches 100. Whichever path fires a call, the same
counter moves; each surface only enforces its own ceiling against that
shared count.

### 5. Review-gate ledger lines (when present)

When the council events ledger contains review-gate lines of the form
`team.gate: BLOCK n/N`, render them verbatim after the quota block — they
record how often the plugin's Stop-hook Review Gate blocked, out of N gate
evaluations. Absent lines are not an error: print nothing (the review-gate
envelope is a later team-mode phase; this step is read-only forward
compatibility).

## Output format

- The plugin's status output, verbatim.
- Exactly one trailing `Quota:` block in the format above (counter + both
  ceilings + per-path OPEN/BLOCKED verdict).
- Any `team.gate: BLOCK n/N` ledger lines, verbatim, after the quota
  block — only when present.
- Gate failures print exactly one block (availability/halt block or
  fail-closed block) and stop.

## Do NOT

- Do NOT run when `/team` is unavailable (codex CLI/auth missing) or
  halted — matching block, stop.
- Do NOT fabricate a count when the counter file is unreadable — print
  `Quota: unavailable (<reason>)` instead of a guessed number.
- Do NOT write to `cli-calls.json` — the transport owns the counter; this
  wrapper is read-only.
- Do NOT reimplement job tracking inline when the plugin is absent — fail
  closed with the doctor pointer (the quota block alone is still printed on
  non-Claude-Code hosts, per Step 2).

## See also

- `/team` — master orchestrator: gates, boundary table vs `/council`.
- `docs/contracts/ai-team-config.md` — `ai_team.max_calls_per_day`.
- `ai-council` skill — the shared CLI transport that maintains the counter.
