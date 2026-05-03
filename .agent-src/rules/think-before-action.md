---
type: "auto"
description: "Before coding, modifying, or debugging — analyze first, verify with real tools, never guess or trial-and-error"
alwaysApply: false
source: package
---

# think-before-action

- Always analyze before coding or modifying anything
- Never guess behavior — verify using code, data, or tools
- Prefer targeted inspection over brute-force trial-and-error
- Use efficient tooling (e.g. jq, debugger, logs) instead of loading full data
- Always verify results after changes (API calls, UI tests, etc.)
- When behavior can be defined, prefer test-first or test-driven work
- If requirements are unclear, ask a precise clarification question instead of making hidden assumptions
- Refactors must preserve behavior, validation, examples, and anti-failure guidance unless there is an explicit reason to change them
- Do NOT modify code you do not fully understand — read it first, trace the flow, then change it
- Multiple valid frameworks/patterns already in the codebase (Tailwind + Flux, multiple form libs, competing state stores) → do NOT pick one silently, ask. See [`no blind implementation`](../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md#2-no-blind-implementation)

## The Developer Workflow

Work like a real developer. Follow this order strictly:

1. **Understand** — Read task, ticket, acceptance criteria. Unclear? Ask, don't assume.
2. **Analyze** — Read affected code, trace data flow, compare with requirements.
3. **Plan** — What to change, what NOT to change, how to verify.
4. **Implement** — Focused changes. Follow existing patterns. No unrelated rewrites.
5. **Verify** — Run tests, hit endpoint, check UI. Real execution, not "should work".

Skipping steps 1-3 = #1 cause of wrong implementations and wasted retries.

## Consult memory before editing

Before writing code for the touched paths, call
[`memory-access`](../../docs/guidelines/agent-infra/memory-access.md):

```python
from scripts.memory_lookup import retrieve
priors = retrieve(
    types=["architecture-decisions", "domain-invariants"],
    keys=<touched paths>,
    limit=3,
)
```

A matching `architecture-decision` explains *why* the current shape
exists; a matching `domain-invariant` is a hard constraint you cannot
violate. Cite the `id` if a match influences the plan. No match → no
overhead; proceed.

## Verify with real tools

| What changed | How to verify |
|---|---|
| **Backend/API** | `curl`, Postman (or Postman MCP), test endpoint |
| **Frontend/UI** | Playwright MCP or browser — rendered state, interactions |
| **Logic/flow** | Xdebug (or Xdebug MCP) — trace execution, inspect variables |
| **CLI/Jobs** | Run command, check side effects, exit code |
| **Database** | Query result, check migrations |

If debugging/testing tool available as MCP server — prefer it.

If verification not possible: state what is missing and how change should be tested.

## Reduce output — targeted tools over full dumps

Never load full datasets into context. Extract what you need:

- `jq` for JSON: `curl -s /api/users | jq '.[0] | {id, email}'`
- `rg` / `grep` for text — specific patterns, not full files
- `head`, `tail`, `cut`, `sort`, `uniq` to narrow results
- `--filter`, `--json`, `--format` flags on CLI tools
- Logs: filter by request ID, timestamp, error type — not full files

## No blind retries

- Fail? **Read the error**, analyze cause, then fix
- Do NOT retry same approach hoping for different result
- Do NOT loop trial-and-error when one inspection reveals the cause
- Max 2 retries same approach — then stop and rethink

## Open files are context, not intent

The editor may report an open file. This is **background context only** — NOT the user's intent.

- **User's message determines intent** — not which file is open.
- User has `README.md` open + types `/compress` → intent is compress, not README.
- User has `UserController.php` open + asks "how do tests work?" → intent is testing, not the controller.
- Only treat open file as relevant when the user explicitly references it ("fix this file", "what does this do?").

If analysis is skipped → results are unreliable.
