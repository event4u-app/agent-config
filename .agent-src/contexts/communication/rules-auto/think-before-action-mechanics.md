# Think Before Action — mechanics

Workflow tables, verification matrix, and failure modes for the
[`think-before-action`](../../../rules/think-before-action.md) rule.
The rule body holds the obligation surface (analyze before coding,
verify with real tools, no blind retries). This file is the lookup
material agents pull when the rule fires.

## The Developer Workflow — five-step order

Work like a developer, not a text generator. Skipping steps 1–3 is the
#1 cause of wrong implementations and wasted retries.

1. **Understand** — Read the task, ticket, acceptance criteria. Unclear
   → ask, don't assume.
2. **Analyze** — Read affected code, trace data flow, compare with
   requirements and existing patterns.
3. **Plan** — Decide what to change, what NOT to change, and how to
   verify success.
4. **Implement** — Focused changes. Follow existing patterns. No
   unrelated rewrites.
5. **Verify** — Run tests, hit the endpoint, check the UI. Real
   execution, never "should work".

## Minimum read set — read before you write

Before editing code, read the minimum set that defines its behavior:

1. **Symbol under edit** — full method/function body, not just the
   planned line.
2. **Direct callers** — one level up (`grep -rn "<symbol>"` + open
   the matches).
3. **Tests** — if a test file exists, it encodes the contract.
4. **One layer of related abstractions** — interface, parent class,
   or trait (one hop, not the full hierarchy).
5. **Data changes** — the migration that created the column + any
   seeder/factory that references it.

Stop expanding once you can explain, in your own words, what the
symbol does, who calls it, and what breaks if you change its
behavior. Cannot → read more.

## Consult memory before editing

Prior decisions and invariants live in the memory layer. Via
[`memory-access`](../../../../../docs/guidelines/agent-infra/memory-access.md),
call `retrieve(types=["architecture-decisions", "domain-invariants"], keys=<touched paths>, limit=3)`.
A matching `architecture-decision` explains *why* the current shape
exists; a matching `domain-invariant` is a hard constraint. Cite the
`id` if a match influences the plan.

## Verify with real tools

| What changed | How to verify |
|---|---|
| **Backend/API** | `curl`, Postman (or Postman MCP if available), test endpoint |
| **Frontend/UI** | Playwright MCP or browser — check rendered state, interactions |
| **Logic/flow** | Xdebug (or Xdebug MCP if available) — trace execution, inspect variables |
| **CLI/Jobs** | Run the command, check side effects, verify exit code |
| **Database** | Query the result, check migrations ran correctly |

If a debugging/testing tool is available as MCP server — prefer it
over manual alternatives. Verification not possible (no endpoint, no
UI, no test) → state what is missing and explain how the change
should be tested.

## Reduce output — targeted tools over full dumps

Never load full datasets into context. Extract what you need:

- `jq` for JSON: `curl -s /api/users | jq '.[0] | {id, email}'` — not the full response
- `rg` / `grep` for text: search specific patterns, not full files
- `head`, `tail`, `cut`, `sort`, `uniq` for narrowing results
- `--filter`, `--json`, `--format` flags on CLI tools — use them
- Laravel: `route:list --json | jq` over raw `route:list` dump
- Logs: filter by request ID, timestamp, or error type — not full log files

## No blind retries

- Failure → **read the error**, analyze the cause, then fix it.
- Do NOT retry the same approach hoping for a different result.
- Do NOT loop through trial-and-error when one targeted inspection
  would reveal the cause.
- Max 2 retries for the same approach — then stop and rethink.

## Open files are context, not intent

The editor may report that the user has a file open. Background
context only — does NOT mean the user's message is about that file.

- The user's message determines intent — not which file is open.
- A user can have `README.md` open and type `/compress` — intent is
  to compress, not to discuss the README.
- A user can have `UserController.php` open and ask "how do tests
  work?" — intent is testing, not the controller.
- Treat the open file as relevant only when the user's message
  explicitly references it (e.g. "fix this file", "what does this
  do?", "update the open file").
