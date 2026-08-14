---
model_tier: inherit
name: team-review
disable-model-invocation: true
argument-hint: "[--background]"
pack: meta
visibility: internal
description: Thin wrapper — cross-model review of the current diff via the official plugin (/codex:review). Gated on /team availability (codex CLI + auth); fails closed when the plugin is absent.
cluster: team
sub: review
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /team review

## Instructions

Thin wrapper: cross-model review of the current change. On Claude Code hosts
it delegates verbatim to the official plugin's `/codex:review` — this wrapper
owns only the governance gates around it.

### 1. Gate — `/team` availability

Run the availability check from `/team` (master) § "Availability gate":
codex CLI + auth, and `emergency.orchestration_halt`. Either check fails →
print the matching block and **STOP**. No plugin probe, no partial run.

### 2. Gate — plugin presence (fail closed)

On a Claude Code host, verify the official plugin is installed (its
`/codex:*` commands are available). Absent → print the fail-closed block
from `/team` (master) § "Fail-closed contract" — the remediation path is
`agent-config doctor --check team` — and **STOP**. Never reimplement the
review inline; never silently no-op.

On a non-Claude-Code host: the repo-diff-bundle fallback is a later phase.
State that team review currently requires the Claude Code plugin, point to
`agent-config doctor --check team`, and stop.

### 3. Delegate

Invoke the plugin:

- `/team review` → `/codex:review`
- `/team review --background` → `/codex:review --background`

Pass the flag through unchanged. Scope resolution (what counts as "the
diff") is the plugin's job — do not pre-compute or filter the diff here.

### 4. Return the review verbatim

Render the plugin's review output unchanged. Do not summarize, re-rank, or
soften findings. The call counts into the
`cli_call_budget.max_calls_per_day.openai` quota (one subscription, one
counter); if the quota is exhausted the transport refuses — surface that
refusal, do not retry.

## Output format

- The plugin's review, verbatim.
- Nothing else on success; gate failures print exactly one block
  (availability/halt block or fail-closed block) and stop.

## Do NOT

- Do NOT run when `/team` is unavailable (codex CLI/auth missing) or
  halted — matching block, stop.
- Do NOT reimplement the review inline when the plugin is absent — fail
  closed with the doctor pointer.
- Do NOT edit files, commit, push, or open a PR — this wrapper is read-only.
- Do NOT claim a review-quality lift; the benchmark verdict is pending (see
  `/team` master § "No-claims note").

## See also

- `/team` — master orchestrator: gates, boundary table vs `/council`.
- `/team adversarial` — focused adversarial variant.
- `adversarial-review` skill — single-model self-review, the free first rung.
