---
name: cost-report
tier: 2
description: Capture token cost from the active Claude Code session, append to the local sessions store, and surface the 50/75/90/100% budget alert ladder with cost-profile suggestions.
skills: [file-editor]
suggestion:
  eligible: true
  trigger_description: "check this session's token cost, see budget utilization, surface 50/75/90/100% alert ladder"
  trigger_context: "user wants to know how expensive the active Claude Code session is or whether it crosses a budget threshold"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

<!-- cloud_safe: noop -->

# /cost:report

Records the current Claude Code session's token usage and checks it against
the configured budget. Local-only: writes to
`agents/cost-tracking/sessions.jsonl` (no MCP / external services).

## Steps

### 1. Capture the active session

```bash
node scripts/cost/track.mjs
```

Emits a Markdown summary of the session (model breakdown, per-tier cost,
total USD) and appends a JSON record to
`agents/cost-tracking/sessions.jsonl`.

If `track.mjs` exits 2 with `no Claude Code project dir`, the user is not in
a Claude Code session — surface that and stop.

### 2. Check the budget

```bash
node scripts/cost/budget.mjs check
```

Reads the runtime budget config under `agents/cost-tracking/` (set via step 4
if missing) and the JSONL store, computes utilization, and prints the alert
level.

### 3. Surface the alert ladder

The check output already includes the level. Translate it into a
profile recommendation per the table:

| Level | Utilization | Recommendation |
|---|---|---|
| 🟢 OK | < 50% | within budget — no action |
| 🟡 INFO | ≥ 50% | log notification, no UX disruption |
| 🟠 WARNING | ≥ 75% | suggest [`/set-cost-profile balanced→minimal`](set-cost-profile.md) |
| 🔴 CRITICAL | ≥ 90% | recommend model downgrades, consider [`/set-cost-profile minimal`](set-cost-profile.md) |
| 🛑 HARD_STOP | ≥ 100% | halt non-essential work; review before continuing (`budget.mjs check` exits 1) |

If `level` ≥ WARNING and the current `cost_profile` in `.agent-settings.yml`
is not already `minimal`, add an explicit suggestion sentence:

> Run [`/set-cost-profile`](set-cost-profile.md) to switch from your
> current profile to a leaner one.

### 4. First-run: prompt to set a budget

If `budget.mjs check` reports `no budget configured`, ask the user (one
question per turn — see [`ask-when-uncertain`](../rules/ask-when-uncertain.md)):

> No budget set yet. What monthly USD cap do you want to track against?
> (e.g. 25, 50, 200)

On reply, run:

```bash
node scripts/cost/budget.mjs set <usd>
```

Then re-run step 2.

### 5. Period filter (optional)

If the user asks for spend in a specific window — "this week", "today",
"this month" — re-run with `BUDGET_PERIOD`:

```bash
BUDGET_PERIOD=week node scripts/cost/budget.mjs check
```

Allowed values: `today`, `week`, `month`, `all` (default).

## Rules

- **Local-only.** Never persist cost data to remote stores. The
  JSONL store and the `budget.json` config both live inside `agents/`,
  which is gitignored by default in consumer projects.
- **Don't auto-switch profiles.** This command surfaces a recommendation;
  the user runs [`/set-cost-profile`](set-cost-profile.md) themselves.
  Auto-mutation of `.agent-settings.yml` would breach
  [`commit-policy`](../rules/commit-policy.md) and
  [`scope-control`](../rules/scope-control.md).
- **Honor HARD_STOP.** When `budget.mjs check` exits 1, surface the alert
  prominently and stop the current task — do not keep working through the
  cap silently.

## See also

- [`/set-cost-profile`](set-cost-profile.md) — change `cost_profile` in
  `.agent-settings.yml`.
- [`/agent-status`](agent-status.md) — per-conversation token estimate
  (different scope: in-flight estimate, not historical actuals).
- [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs) — tracker source.
- [`scripts/cost/budget.mjs`](../../scripts/cost/budget.mjs) — budget source.

## Attribution

Forked from
[`ruvnet/ruflo`](https://github.com/ruvnet/ruflo)
`plugins/ruflo-cost-tracker/scripts/{track,budget}.mjs`. The MCP
`memory_store` dependency was replaced with a local JSONL append; the
50/75/90/100% alert ladder and pricing tiers are preserved verbatim.
