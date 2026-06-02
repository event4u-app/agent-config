---
model_tier: medium
name: agents:user-accept
tier: 2
cluster: agents
sub: user
description: Apply a buffered observation to .agent-user.md after explicit user confirmation; bumps last_updated and drops the applied observations from the buffer.
suggestion:
  eligible: false
  rationale: "Mutates .agent-user.md — only run from /agents user review or explicit user invocation."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user accept

Apply a buffered observation from
[`.agent-user.observations.jsonl`](../../../../../../docs/contracts/agent-user-schema.md#observation-buffer)
to `.agent-user.md` after explicit confirmation.

Use when:

- `/agents user review` surfaced an observation worth applying.
- The user invoked `/agents user accept <field>` directly.

Never runs autonomously — always asks before writing.

## Steps

### 1. Preconditions

```bash
ls .agent-user.md 2>/dev/null
ls .agent-user.observations.jsonl 2>/dev/null
```

Either missing → print "Run `/agents user init` and accumulate
observations first." and stop.

### 2. Resolve target field

| Invocation | Resolved field |
|---|---|
| Handed off from `/agents user review` option 1 | The most-frequent field |
| `/agents user accept <field>` | `<field>` (must match the schema enum) |
| `/agents user accept` with no arg | Print the field list, ask which |

Invalid field → print the schema enum and stop.

### 3. Compute proposed change

For the resolved field:

1. Read every matching observation from the buffer.
2. Pick the **latest** `suggest` value (most recent `ts` wins).
3. Read the current value from `.agent-user.md`.
4. If they match, print "No change — current value already matches
   the latest observation." and skip to step 6.

### 4. Confirm

```
Apply this change to .agent-user.md?

  field   : {field}
  current : "{current_value}"
  proposed: "{proposed_value}"
  source  : {n} observations between {oldest_ts} and {newest_ts}
  evidence: {latest_evidence, truncated to 200 chars}

> 1. Apply
> 2. Skip — keep current value, drop these observations from the buffer
> 3. Cancel — leave .agent-user.md and buffer untouched
```

One question per turn. Wait for the user's number.

### 5. Write

On `1. Apply`:

1. Rewrite the targeted field in `.agent-user.md` frontmatter.
   Preserve every other field byte-for-byte (use a YAML round-trip
   loader that keeps formatting).
2. Bump `last_updated` to today (ISO `YYYY-MM-DD`).
3. Validate the result: schema present, ≤100 lines, privacy floor
   clean. Any violation → roll back and print the error.
4. Drop **all** applied observations for that field from the buffer
   (rewrite the JSONL minus matching lines).

On `2. Skip`: leave `.agent-user.md` untouched but still drop the
observations for that field from the buffer.

On `3. Cancel`: stop without any write.

### 6. Confirm

```
✅  .agent-user.md updated ({field}: "{old}" → "{new}", last_updated: YYYY-MM-DD).
   Buffer: {n} observations removed, {m} remaining.
```

Do NOT commit. Do NOT auto-chain to a second field.

## Rules

- One field per invocation. The user runs `/agents user accept` again
  for the next field.
- Never write without explicit confirmation in step 4.
- Never bypass the privacy-floor scan, even if the buffer writer
  already redacted.
- Mirror the user's language for prompts per
  [`language-and-tone`](../../../../.agent-src/rules/language-and-tone.md).

## See also

- Schema + buffer contract: [`agent-user-schema § Observation buffer`](../../../../../../docs/contracts/agent-user-schema.md#observation-buffer).
- Parent: [`/agents user`](../user.md).
- Sibling: [`/agents user review`](review.md), [`/agents user update`](update.md).
