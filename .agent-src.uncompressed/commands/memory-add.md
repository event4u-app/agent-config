---
name: memory-add
description: Interactively add a validated entry to an engineering-memory file (domain-invariants, architecture-decisions, incident-learnings, product-rules)
skills: [file-editor]
disable-model-invocation: true
---

# /memory-add

Creates or updates a single entry in one of the four engineering-memory
YAML files under `agents/memory/` in the consumer project. The entry
is validated against the schema in
[`engineering-memory-data-format`](../guidelines/agent-infra/engineering-memory-data-format.md)
before the file is written.

Absence of these files is legal — this command is the entry point for
the first write and for every subsequent addition.

## Prerequisites

- Consumer project has an `agents/` directory (package installed).
- `scripts/check_memory.py` is available (shipped with the package).
- User can name a concrete pattern — see the "when to reject" section.

## Steps

### 1. Pick the memory type

```
> Which memory type is this entry for?
>
> 1. domain-invariants  — architectural boundaries, module rules
> 2. architecture-decisions — ADR-style decisions with alternatives
> 3. incident-learnings — post-mortem patterns with guardrails
> 4. product-rules — intentional business constraints
```

If the user cannot pick one confidently, stop and ask what the entry
**describes**. Never guess the type — a misfiled entry is worse than
no entry.

### 2. Check it does not already exist

Read the target file (single-file layout: `agents/memory/<type>.yml`;
sharded layout: `agents/memory/<type>/*.yml`). For each existing
`id:`, compare against the proposed pattern:

- Same `scope:` path + same rule text → **update** existing entry
  (bump `last_validated`, append evidence to `source:`).
- Overlapping `scope:` but different rule → surface the conflict and
  ask which entry supersedes which.
- No overlap → proceed as new entry.

### 3. Collect the required fields

All four types share the frontmatter in
[`engineering-memory-data-format`](../guidelines/agent-infra/engineering-memory-data-format.md#shared-frontmatter-fields).
Collect in this order, one numbered question at a time:

1. `id` — kebab-case slug, unique within the type.
2. `status` — `active` · `deprecated` · `archived` (default: `active`).
3. `confidence` — `low` · `medium` · `high`.
4. `source` — at least one URL, PR, incident, or ADR reference.
5. `owner` — team slug.
6. `last_validated` — today's ISO date (default).
7. `review_after_days` — integer; suggest 90 for ADRs, 180 for
   invariants, 365 for product rules.

Then the type-specific fields (see the example templates under
`.augment/templates/agents/memory/`).

### 4. Show the draft

Render the proposed YAML block to the user and ask for confirmation:

```
> About to add to agents/memory/<type>.yml:
>
> <yaml block>
>
> 1. Write it — run the gate
> 2. Edit a field — ask which one
> 3. Cancel — discard draft
```

### 5. Write and gate

On confirmation:

- Append the entry to the chosen layout (single-file: append under
  `entries:`; sharded: write `agents/memory/<type>/<hash>.yml`).
- Run `python3 scripts/check_memory.py --path agents/memory`.
- On non-zero exit: show the error, **revert** the write, return to
  step 3 or 4 depending on the failure.
- On zero exit: report the entry `id` and path, remind the user to
  commit.

### 6. Cross-link

If the entry has a `references:` block pointing to a skill, rule, or
ADR file, run `python3 scripts/check_references.py` to verify the
link resolves. Broken link → block and ask the user to fix.

## When to reject

- Vague frustration ("we should be more careful about X") — not a
  pattern. Ask for a concrete rule or ADR instead.
- One-off anecdote with no `trigger_conditions:` or `scope:` — not
  generalizable.
- Duplicate of an existing entry (step 2) — update instead.
- Missing `source:` — an entry without evidence cannot be reviewed.

## Output format

```
✅  Added <type>/<id> (confidence: <high|medium|low>)
   Path: agents/memory/<type>.yml (or agents/memory/<type>/<hash>.yml)
   Gate: scripts/check_memory.py → PASS
   Next: commit and link from the relevant skill/command.
```

## See also

- [`engineering-memory-data-format`](../guidelines/agent-infra/engineering-memory-data-format.md)
  — full schema
- [`capture-learnings`](../rules/capture-learnings.md) — when a
  learning is better captured as an `incident-learnings` entry vs a
  rule/skill proposal
- [`road-to-engineering-memory.md`](../../agents/roadmaps/road-to-engineering-memory.md)
  — Phase 3 writer ergonomics
