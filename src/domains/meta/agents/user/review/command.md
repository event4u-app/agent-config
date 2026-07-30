---
model_tier: high
name: agents-user-review
pack: meta
tier: 2
visibility: internal
cluster: agents
sub: user
skills: [agents]
description: List buffered observations from the project-local and global observation buffers with numbered options to inspect or accept individually.
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user review

List the buffered observations across BOTH observation buffers —
project-local `.agent-user.observations.jsonl` and the global
`~/.event4u/agent-config/user/observations.jsonl` (ADR-138,
road-to-global-user-memory Phase 2) — and let the user choose which to
inspect or accept.

Use when:

- You want to see what the agent has learned about your preferences.
- You suspect `.agent-user.md` (or the global `profile.md`) is out of
  date and want a curated diff before editing.
- You want to dismiss observations the agent collected.

Read-only by itself — actual changes go through
[`/agents user accept`](accept.md) or
[`/agents user update`](update.md).

## Steps

### 1. Locate buffers

```bash
ls .agent-user.observations.jsonl 2>/dev/null
```

Resolve the global buffer's path via `user_global_observations.
resolveGlobalObservationsPath()` — it honours the config-home override
env var and the legacy fallback root exactly like every other global
artefact, so never hard-code either path here.

| State (either buffer) | Action |
|---|---|
| Both missing or empty | Print "No buffered observations. The agent has not learned anything new." and stop |
| At least one present | Proceed with whichever buffer(s) exist |

### 2. Parse + group

Read every line as JSON from BOTH buffers via
[`user_global_observations.readGlobalObservations`](../../../../src/scripts/_lib/user_global_observations.ts)
for the global one, and the equivalent tolerant parse for the
project-local file. Drop malformed lines silently (one-line warning at
the end with the combined count; `readGlobalObservations` already
reports `droppedMalformed` / `droppedUnknownField`). Group by `field`
ACROSS both buffers, tagging each observation with its layer:

```
Buffered observations — {n} across {k} fields ({p} project-local, {g} global)

  1. style.pace          ({n}× since {oldest_ts})
     latest suggest: "rapid" [global] — evidence: user said 'mach kürzer' 3× this session
  2. identity.nickname   ({n}× since {oldest_ts})
     latest suggest: "Matze" [project] — evidence: user signed last 3 messages "— Matze"
  3. language            ({n}× since {oldest_ts})
     latest suggest: "de" [global] — evidence: last 12 messages in German, profile says "en"
```

Sort by frequency (most observations first, combined across both
layers), then by recency. When the SAME field has observations in both
layers, list the most-recent one first and note both counts.

### 2a. Promotion candidates (road-to-global-user-memory Phase 3)

Separately from the field grouping above, call
[`findPromotionCandidates`](../../../../../src/scripts/_lib/user_global_observations.ts)
over the global buffer's entries. Any observation with `seen_count ≥ 3`
(`PROMOTION_SEEN_COUNT_THRESHOLD`) is project-attributed, human-confirmed
recurring evidence across that many DIFFERENT projects — surface it as
its own block, ahead of the field list:

```
Promotion candidates — seen in 3+ projects:

  1. "always use pnpm instead of npm for installs" — seen in 3 projects (acme-web, acme-api, acme-mobile)
```

This is candidacy only, never a promotion — crossing the threshold makes
`/agents user accept` able to offer promoting it, nothing more (see
[`agent-user-schema.md § Project attribution`](../../../../docs/contracts/agent-user-schema.md#project-attribution-road-to-global-user-memory-phase-3)).

### 3. Ask

```
> 1. Accept the most-frequent suggestion ({field} [{layer}] → {value})
> 2. Inspect a specific field
> 3. Clear a buffer (project-local, global, or both)
> 4. Promote a candidate from step 2a (only shown when ≥ 1 exists)
> 5. Cancel
```

| Choice | Action |
|---|---|
| 1 | Hand off to [`/agents user accept`](accept.md) with the chosen field AND layer |
| 2 | Print every observation for that field (both layers) with evidence + ts, then re-ask |
| 3 | Ask which buffer(s) to truncate, then truncate the chosen file(s) to zero bytes; print confirmation |
| 4 | Hand off to [`/agents user accept`](accept.md) with the chosen promotion candidate — `accept` collects the mandatory `promotion_reason` before writing anything |
| 5 | Stop without changes |

One question per turn. Wait for the user's number.

### 4. Privacy-floor verify

Before printing any observation's `evidence` text, scan it for the
[exclusions list](../../../../docs/contracts/agent-user-schema.md#explicit-exclusions).
Match → replace the offending substring with `[redacted]` in the
rendered output.

The buffer writer is expected to redact on write, but treat this as
defense in depth — the user must never see leaked third-party PII or
credentials from a downstream agent's bad write.

### 5. Stop

Do NOT commit. Do NOT auto-chain past one user-selected action per
turn.

## Rules

- Read-only on `.agent-user.md` AND the global `profile.md`. Only
  `accept` writes to either persona file.
- Both buffers are the only mutable artefacts (truncate via option 3).
- Mirror the user's language for prompts per
  [`language-and-tone`](../../../../dist/agent-src/rules/language-and-tone.md).

## See also

- Schema + buffer contract: [`agent-user-schema § Observation buffer`](../../../../docs/contracts/agent-user-schema.md#observation-buffer).
- Global buffer implementation: [`user_global_observations.ts`](../../../../src/scripts/_lib/user_global_observations.ts).
- Parent: [`/agents user`](../user.md).
- Sibling: [`/agents user accept`](accept.md), [`/agents user update`](update.md).
