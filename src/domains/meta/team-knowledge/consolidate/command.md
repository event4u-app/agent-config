---
model_tier: medium
name: team-knowledge-consolidate
pack: meta
tier: 2
visibility: internal
cluster: team-knowledge
sub: consolidate
description: Review pending typed knowledge-observation events and file them into agents/knowledge/ pages as a human-reviewed batch — never writes without approval.
skills: [file-editor]
suggestion:
  eligible: true
  trigger_description: "consolidate knowledge events, review pending observations, file captured knowledge, promote knowledge candidates"
  trigger_context: "pending events have accumulated in agents/knowledge/intake/ and are ready for review"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /team-knowledge consolidate

Turns the gitignored, in-flight typed-observation events
(`convention_detected` / `mistake_made` / `api_shape_learned` /
`context_stale` — see `src/scripts/_lib/knowledge_events.ts`) into
committed `agents/knowledge/` pages. This is the ONLY path from intake
to a tracked page — no skill or rule writes a tracked knowledge page
mid-task (see [`knowledge-pages`](../../../agent-src/templates/contexts/knowledge-pages.md)
§ Storage location).

## Steps

### 1. Generate the report

```bash
./scripts-run src/scripts/consolidate_knowledge_events
```

Aggregates pending events by topic and finds the nearest EXISTING
knowledge page for each aggregate (mechanical similarity only — the
script never decides the triage verdict).

No pending topics → tell the user and stop. Nothing to do.

### 2. Triage each topic

For each aggregate in the report, apply the same taxonomy
[`memory-consolidation`](../../../skills/memory-consolidation/SKILL.md)
uses for engineering-memory facts:

| Triage | Condition | Action |
|---|---|---|
| `NEW` | No nearest page reported | Draft a new page under the appropriate typed dir |
| `EXTEND` | Nearest page reported, covers the topic but misses this detail | Draft an addition to that page |
| `CONFIRM` | Nearest page already states this exactly | Discard this aggregate — no page change |
| `CONFLICT` | Nearest page states the opposite or a stale variant | Draft BOTH positions into that page with `contested: true`, never silently overwrite |

A high similarity score alone does not distinguish `EXTEND` /
`CONFIRM` / `CONFLICT` — read the matched page and the aggregate's
events before deciding.

### 3. Draft and present the batch

For every `NEW` / `EXTEND` / `CONFLICT` aggregate, draft the page
content (following [`knowledge-pages`](../../../agent-src/templates/contexts/knowledge-pages.md) —
`date + what + why` for session entries, ≤ 200 lines per page) and
present the full batch to the user:

```
> Knowledge consolidation — N topic(s) ready for review:
>
> 1. [NEW] <topic> → agents/knowledge/concepts/<slug>.md
> 2. [EXTEND] <topic> → agents/knowledge/procedures/<existing>.md
> 3. [CONFLICT] <topic> → agents/knowledge/concepts/<existing>.md (contested)
>
> 1. Write all — 2. Write selected — 3. Discard all — 4. Edit a draft first
```

**Never write before this confirmation.**

### 4. Write, regenerate, clear

On approval:

1. Write each approved page (respecting the [team-sharing gate](../../../scripts/check_knowledge_sharing.ts) —
   never set `visibility: private` on a page landing here).
2. Regenerate the index: `./scripts-run src/scripts/generate_knowledge_index`.
3. Clear the consumed intake: `./scripts-run src/scripts/consolidate_knowledge_events --commit`
   (all-or-nothing — re-run step 1 first if the user picked "write
   selected" and some topics were discarded, so only genuinely
   consumed events are cleared).

## Rules

- Never invents a page from an aggregate the user did not approve.
- Never resolves a `CONFLICT` verdict automatically — both positions
  land in the page, human resolves later.
- Never writes a page with `visibility: private` (belongs in the
  ADR-100 global store instead).
- Do NOT commit the written pages — that is the user's call, per
  [`commit-policy`](../../../rules/commit-policy.md).

## See also

- [`memory-consolidation`](../../../skills/memory-consolidation/SKILL.md) — the sibling loop for the 5 fixed engineering-memory types; this command is its knowledge-page counterpart.
- [`learning-to-rule-or-skill`](../../../skills/learning-to-rule-or-skill/SKILL.md) — where a page's recurring topic graduates into a skill/rule once it crosses the skill-candidate threshold.
