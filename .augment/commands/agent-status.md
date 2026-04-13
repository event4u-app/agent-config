---
skills: [agent-docs]
description: Show current conversation stats — message count, token costs, task progress, next freshness check.
---

# /agent-status

Dashboard of conversation health and token costs.

## Steps

### 1. Count messages

Count responses (estimate, each ≈ 1 user message).

### 2. Count tasks

`view_tasklist` → count total, completed, in-progress, not started.

### 3. Estimate token costs

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

- Estimates only — no real token counts
- Markdown tables, no ASCII box art
- Bold history cost as biggest variable
- Always show savings
