---
title: Project memory your AI agent consults before it changes code
description: Keep your project's rules, past incidents and business constraints in small reviewed files the agent looks up before planning — no hidden database, nothing written without you.
---

Record something your agent should never get wrong again:

```text
/memory:add
```

## What it does

Project memory is three small YAML files under `agents/memory/` in your repository:

- **domain-invariants** — architectural boundaries and module rules ("billing never imports from orders").
- **incident-learnings** — what went wrong before and the guardrail that prevents it.
- **product-rules** — business constraints that look like bugs but are intended.

Before it plans, `/work` looks up the entries that match the task and carries the short ones into its plan. When a task's check passed, it may propose a new entry as a signal; a signal becomes a memory entry only through `/memory:promote`, which opens a pull request you review.

| Command | Use it to |
|---|---|
| `/memory:add` | Add or update one entry, validated before it is written |
| `/memory:propose` | Record a finding without committing to an entry yet |
| `/memory:promote` | Turn a proposal into an entry, through a pull request |
| `/memory:load` | Load every entry of one type, for an audit or a migration |
| `/memory:mine-session` | Pull candidate learnings out of a past session |

## When to use it

After an incident, after a review comment you never want to repeat or when the agent keeps "fixing" something that is intentional.

## Example

```text
/memory:add
> Which memory type is this entry for?
  2 — incident-learnings
> What happened, and what guardrail prevents it?
  Exports timed out on large tenants; every export over the page size runs as a background job.
```

## What it needs

- A repository: memory files are plain YAML you commit and review like code.
- Nothing else — no database, no service, no API key.

## Limits

- No file, no memory: an empty `agents/memory/` costs nothing and is skipped.
- The agent never writes a memory entry silently; one session alone never mints a lesson.
- Architecture decisions belong in decision records, not in memory.
