---
model_tier: medium
name: knowledge-cross-repo
pack: product-discovery
tier: 2
cluster: knowledge
sub: cross-repo
description: Targeted, read-only retrieval over opted-in linked-project siblings (ADR-032 Option A). Pulls a shared type / API contract / config without bulk-including sibling files.
skills: [file-editor]
suggestion:
  eligible: true
  trigger_description: "what does the frontend expect, find the shared type in the other repo, check the sibling repo's API contract, /knowledge:cross-repo <query>"
  trigger_context: "user needs context that lives in an attached sibling repo without copying its files in"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /knowledge cross-repo

Targeted, **read-only** retrieval across the IDE-attached sibling repos the user
has opted into (`linked_projects[].include: true`). Returns a bounded set of
matches — a shared type, an API contract the frontend consumes, a config the
sibling owns — **without bulk-including** any sibling file. Implements
[`cross-repo-retrieval`](../../../docs/contracts/cross-repo-retrieval.md) and
stays inside [ADR-032](../../../docs/decisions/ADR-032-linked-projects-scope.md)
Option A.

## Prerequisites

- Python 3.10+ on the host.
- At least one sibling opted in (`agent-config linked-projects:list` shows them).
  No opted-in sibling → the command is inert with a clear message.

## Steps

### 1. Parse the query

`/knowledge cross-repo "<query>" [--path-scope <glob>]`. The query is one
concept (≥ 1 term > 2 chars). A `--path-scope` glob narrows the search and is
**required** for `large`-flagged siblings.

### 2. Run the retrieval

```bash
python3 scripts/cross_repo_retrieve.py "<query>" [--path-scope <glob>] [--max-chunks 8]
```

The script reads opted-in siblings only, runs a targeted path-glob + content
grep (never a full walk), redacts secrets/PII from every chunk, and returns the
retrieval envelope.

### 3. Present matches

Render the table: `source_repo · path · freshness · why`. Each row names the
source sibling, the path inside it, the last-commit/mtime freshness stamp, and
why it matched. Use the chunks as *context*, never as files to copy wholesale.

### 4. Honour the scope guards

- A `large` sibling without `--path-scope` is skipped with a note — re-run with
  a scope. Do not remove the guard.
- A sibling not `include: true` is never read.

## Rules

- **Read-only.** Never write to a sibling. Out-of-root writes still pass the
  host permission gate; this surface writes nothing.
- **Opt-in only, targeted only.** No full-tree sweep; no implicit inclusion.
- **Secrets never cross repos** — the chunk redactor runs before any text is shown.
- **One concept per invocation.** Do not chain.
