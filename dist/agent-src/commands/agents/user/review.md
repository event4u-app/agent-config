---
model_tier: high
name: agents-user-review
pack: meta
tier: 2
visibility: internal
cluster: agents
sub: user
skills: [agents]
description: List buffered observations from .agent-user.observations.jsonl with numbered options to inspect or accept individually.
suggestion:
  eligible: true
  trigger_description: "review user observations, see what the agent learned about me, list buffered persona updates"
  trigger_context: "user wants to see what the agent has buffered about their preferences before applying changes"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user review

List the buffered observations in `.agent-user.observations.jsonl`
and let the user choose which to inspect or accept.

Use when:

- You want to see what the agent has learned about your preferences.
- You suspect `.agent-user.md` is out of date and want a curated
  diff before editing.
- You want to dismiss observations the agent collected.

Read-only by itself — actual changes go through
[`/agents user accept`](accept.md) or
[`/agents user update`](update.md).

## Steps

### 1. Locate buffer

```bash
ls .agent-user.observations.jsonl 2>/dev/null
```

| State | Action |
|---|---|
| Missing or empty | Print "No buffered observations. The agent has not learned anything new." and stop |
| Present | Proceed |

### 2. Parse + group

Read every line as JSON. Drop malformed lines silently (one-line
warning at the end with the count). Group by `field`:

```
.agent-user.observations.jsonl — {n} observations across {k} fields

  1. style.pace          ({n}× since {oldest_ts})
     latest suggest: "rapid" — evidence: user said 'mach kürzer' 3× this session
  2. identity.nickname   ({n}× since {oldest_ts})
     latest suggest: "Matze" — evidence: user signed last 3 messages "— Matze"
  3. language            ({n}× since {oldest_ts})
     latest suggest: "de" — evidence: last 12 messages in German, .agent-user.md says "en"
```

Sort by frequency (most observations first), then by recency.

### 3. Ask

```
> 1. Accept the most-frequent suggestion ({field} → {value})
> 2. Inspect a specific field
> 3. Clear the buffer (discard all)
> 4. Cancel
```

| Choice | Action |
|---|---|
| 1 | Hand off to [`/agents user accept`](accept.md) with the chosen field |
| 2 | Print every observation for that field with evidence + ts, then re-ask |
| 3 | Truncate `.agent-user.observations.jsonl` to zero bytes; print confirmation |
| 4 | Stop without changes |

One question per turn. Wait for the user's number.

### 4. Privacy-floor verify

Before printing any observation's `evidence` text, scan it for the
[exclusions list](../../../../../../docs/contracts/agent-user-schema.md#explicit-exclusions).
Match → replace the offending substring with `[redacted]` in the
rendered output.

The buffer writer is expected to redact on write, but treat this as
defense in depth — the user must never see leaked third-party PII or
credentials from a downstream agent's bad write.

### 5. Stop

Do NOT commit. Do NOT auto-chain past one user-selected action per
turn.

## Rules

- Read-only on `.agent-user.md`. Only `accept` writes to the persona
  file.
- Buffer is the only mutable artefact (truncate via option 3).
- Mirror the user's language for prompts per
  [`language-and-tone`](../../../../dist/agent-src/rules/language-and-tone.md).

## See also

- Schema + buffer contract: [`agent-user-schema § Observation buffer`](../../../../../../docs/contracts/agent-user-schema.md#observation-buffer).
- Parent: [`/agents user`](../user.md).
- Sibling: [`/agents user accept`](accept.md), [`/agents user update`](update.md).
