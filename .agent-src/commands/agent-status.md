---
model_tier: medium
name: agent-status
tier: 0
skills: [agent-docs-writing]
description: Show current conversation stats — message count, token costs, task progress, next freshness check.
suggestion:
  eligible: false
  rationale: "Pure status display; no natural-language trigger distinct from idle small-talk."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agent-status

Displays a dashboard of the current conversation's health and token costs.

## Steps

### 1. Count messages

Count your own responses in this conversation (each response ≈ 1 user message).
This is an estimate — you cannot access exact counts.

### 2. Count tasks

Run `view_tasklist` and count:
- Total tasks
- Completed tasks
- In-progress tasks
- Not started tasks

### 3. Estimate token costs

Calculate based on these estimates:

| Component | How to estimate | Tokens |
|---|---|---|
| **Conversation history** | responses × ~1,500 | variable |
| **AGENTS.md** | always loaded | ~1,800 |
| **Skill descriptions** | always loaded | ~4,100 |
| **Matched rules** | count rules triggered this request × ~800 avg | variable |
| **Matched skills** | count skills triggered this request × ~1,500 avg | variable |
| **Platform overhead** | system prompt, tool schemas | ~15,000 |

### 3a. Read session cost ledger (measured, not estimated)

Run `node scripts/cost/track.mjs` (silent — `TRACK_QUIET=1`) and parse
the last record from `agents/cost-tracking/sessions.jsonl`. If the file
does not exist (tracker never run for this project), skip this step and
note `cost ledger: not initialised` in the dashboard.

Extract from latest record:

- `total_usd` — dollars spent in current session
- `by_model[]` — per-tier (haiku / sonnet / opus) input / output / cache split
- `budget.tier` — `under` / `50` / `75` / `90` / `100` (from `node scripts/cost/budget.mjs check`)

Pricing source: [`internal/bench/pricing.yaml`](../../bench/pricing.yaml). Reader
implementation: [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs).

### 3b. Read telegraph delta + per-conversation cost lens

Run two read-only Python helpers (stdlib-only, no-op safe if JSONL missing):

- `python3 scripts/telegraph_stats.py --format json` — per-session +
  per-conversation + lifetime telegraph delta. Honors suspended
  multiplier (see [`docs/contracts/telegraph-telemetry.md`](../docs/contracts/telegraph-telemetry.md)) — delta reads `0` while suspended; display version + ACTIVE/SUSPENDED state regardless.
- `python3 scripts/cost_by_conversation.py --format json` — per-conversation
  total cost + model breakdown for current conversation, sourced
  from same `agents/cost-tracking/sessions.jsonl` ledger.

Surface in dashboard as one line:
`[telegraph: {lifetime.delta_tokens:+,} tok lifetime · {current_conv.delta_tokens:+,} this conv · multiplier v{multiplier_version} {ACTIVE|SUSPENDED}] · [conv cost: ${current_conv.total_cost_usd:.4f}]`.

If both JSONLs missing or empty, omit line silently.

### 4. Calculate freshness thresholds

- **Message threshold**: Next multiple of 25 ≥ current count
- **Task threshold**: Next multiple of 15 ≥ completed count
- **Which comes first?**

### 5. Display dashboard

Use Markdown tables and headings — NOT ASCII box art (breaks in non-monospace chat UIs).

**📊 Agent Status**

| | |
|---|---|
| 💬 Messages | ~{N} responses |
| 📋 Tasks | {done}/{total} done ({in_progress} in progress, {not_started} open) |
| 🌿 Branch | `{branch}` |

**💰 Estimated tokens PER REQUEST**

| Component | Tokens |
|---|---|
| Platform overhead | ~15,000 |
| AGENTS.md + Skills | ~5,900 |
| **Conversation history** | **~{N×1500}** ← biggest cost |
| Matched rules (~{n}) | ~{n×800} |
| Matched skills (~{n}) | ~{n×1500} |
| **Total input** | **~{sum}** |

**💵 Session cost (measured)**

If ledger exists, render:

| | |
|---|---|
| 💵 Session total | ${total_usd} |
| Haiku / Sonnet / Opus | ${haiku} / ${sonnet} / ${opus} |
| 🎯 Budget tier | {emoji} {tier} ({utilization_pct}% of cap) |

Tier-emoji map: `under` / `50` → ✅ · `75` → ⚠️ · `90` → ⚠️⚠️ · `100` → ❌.
If ledger does not exist, render `Session cost: not initialised — run \`task cost:track\` to start measuring`.

**⚡ Freshness**

| | |
|---|---|
| Next check at | {next_msg} messages or {next_task} completed tasks |
| Fresh chat saves | ~{N×1500} tokens/request |

If history cost exceeds ~50,000: add a ⚠️ recommendation to start a fresh chat.

## Rules

- **Estimates only** — no access to real token counts, make that clear.
- **Markdown tables** — never use ASCII box art, it breaks in chat UIs.
- **History cost is the key insight** — bold it as the biggest variable cost.
- **Always show the savings** — "Fresh chat saves X tokens/request" drives the point home.
