---
name: agent-status
skills: [agent-docs-writing]
description: Show current conversation stats — message count, token costs, task progress, next freshness check.
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Pure status display; no natural-language trigger distinct from idle small-talk."
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
