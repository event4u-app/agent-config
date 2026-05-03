---
name: developer-like-execution
description: "Use when implementing, debugging, refactoring, or reviewing code — enforces the think → analyze → verify → execute workflow — even when the user just says 'implement X' without naming it."
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# developer-like-execution

## When to use

- Implementing features
- Fixing bugs
- Refactoring code
- Analyzing unexpected behavior
- Debugging backend or frontend issues
- Creating or refactoring skills, rules, commands, or agent docs
- Working with APIs, frontend, or backend logic

Do NOT use when only explaining concepts or writing pure reference documentation without execution.

## Goal

Act like a real developer: think before acting, analyze before coding, verify before concluding.
Avoid unnecessary trial-and-error. Minimize output, token usage, and irrelevant data.
Develop against expected behavior, ideally test-first.

## Core principles

- Never start coding before understanding the affected system
- Prefer analysis over guessing
- Prefer targeted queries over large output dumps
- Avoid unnecessary loops, retries, and blind experimentation
- Always verify behavior with real execution when possible
- Prefer tests first when expected behavior can be defined
- If requirements are unclear, ask a precise question instead of filling gaps with assumptions

## Tool priority

Use the smallest, most targeted tool that gives the needed evidence.
If a tool is available as MCP server, prefer it over manual alternatives.

### Verification tool mapping

| What changed | Primary tool | MCP alternative |
|---|---|---|
| **Backend/API endpoint** | `curl -s \| jq` | Postman MCP (if configured) |
| **Frontend/UI** | Manual browser check | Playwright MCP (`navigate` + `snapshot`) |
| **Execution flow/debugging** | Print statements, logs | Xdebug MCP (breakpoints, variable inspection) |
| **CLI commands/jobs** | Run command, check exit code | — |
| **Database** | SQL query, migration status | — |
| **External APIs** | `Http::fake()` in tests | Postman MCP for manual checks |

### Xdebug workflow (when available)

If Xdebug is available (as MCP or IDE integration):

1. Set breakpoints at the suspected code path
2. Trigger the request (curl, browser, test)
3. Inspect variables at breakpoint — don't guess values from reading code
4. Step through to verify actual execution flow vs. assumed flow
5. Check: is the data what you expected? Is the branch taken what you expected?

Use Xdebug **before** adding print statements or debug logging.
It's faster and leaves no cleanup work.

### Playwright for frontend verification

When UI changes are involved:

1. Navigate to the affected page
2. Take a snapshot of the rendered state
3. Verify the expected elements are present and interactive
4. Check console/network for errors
5. Compare before/after if refactoring

### Prefer targeted output

- `jq` for JSON: `curl -s /api/users | jq '.[0] | {id, email}'` — never the full response
- `rg`, `grep` for text: specific patterns, not full files
- `head`, `tail`, `cut`, `sort`, `uniq` for narrowing results
- `--filter`, `--json`, `--format` flags on CLI tools — always use them
- Laravel: `route:list --json | jq '.[] | select(.uri | test("users"))'`
- Logs: `rg "request_id=abc123" storage/logs` — never `cat storage/logs/laravel.log`

### Avoid large output by default

Do NOT:

- Dump full JSON if one field is enough
- Load full route lists when filtering one route is enough
- Inspect full log files when one request ID or timestamp can isolate the case
- Re-run broad commands repeatedly without narrowing
- Load full database tables when a WHERE clause is enough

## Procedure

### 1. Understand the task

- Read the request carefully
- Identify expected outcome
- Identify affected system area
- Identify whether the task is implementation, debugging, refactoring, or analysis

### 2. Check whether requirements are complete

Before acting, verify:

- Expected behavior is clear
- Acceptance criteria are clear
- Edge cases are known
- Affected user flow or API contract is known

If important information is missing:

- Stop execution planning
- Output a precise clarification request
- Do NOT silently assume missing requirements

### 3. Analyze BEFORE acting

- Read the affected files
- Trace data flow and execution path
- Compare with requirements, tickets, current behavior, tests, existing patterns
- Identify likely cause and smallest correct change
- **Consult memory — invariants and prior decisions.** Via
  [`memory-access`](../../../docs/guidelines/agent-infra/memory-access.md), call
  `retrieve(types=["domain-invariants", "architecture-decisions"], keys=<touched paths>, limit=3)`.
  A matching `domain-invariant` is a hard constraint — violating it =
  regression, surface the conflict before proceeding. A matching
  `architecture-decision` explains *why* the current shape exists; plan
  around it, do not silently overturn it. Cite matching `id`s in the plan.
  See [`engineering-memory-data-format`](../../../docs/guidelines/agent-infra/engineering-memory-data-format.md)
  for the schema.

### 4. Define expected behavior first

Prefer test-driven or test-first development whenever practical.

Before changing code, define:

- What should happen
- What should not happen
- How success will be verified

Prefer: write or update failing test first → implement against it → run tests again.

If full TDD is not practical: at least write down the expected output before coding.

### 5. Use targeted tools like a real developer

#### Backend examples

```bash
# Laravel route lookup — targeted, not full dump
php artisan route:list --json | jq '.[] | select(.uri == "api/users") | {method, uri, name, action, middleware}'

# Config/debug
php artisan config:show app | grep env

# API inspection — extract only what you need
curl -s http://localhost/api/users | jq '.[0] | {id, email, status}'
curl -s http://localhost/api/users/1 | jq '{id, name, roles: [.roles[].name]}'

# Logs — scoped by request ID, timestamp, or error type
rg "request_id=abc123|OrderFailed" storage/logs
tail -n 200 storage/logs/laravel.log | rg "payment|timeout"

# Database — targeted queries, not full table dumps
php artisan tinker --execute="User::where('email', 'test@example.com')->first(['id','email','status'])"
```

#### Debugging with Xdebug

When available (MCP or IDE), prefer over print/log debugging:

```
1. Set breakpoint at suspected method
2. Trigger request: curl -s http://localhost/api/endpoint
3. Inspect variables at breakpoint
4. Step through execution to verify actual flow
5. Remove breakpoint when done — zero cleanup
```

#### Frontend verification with Playwright

When UI is affected, verify with Playwright (MCP or direct):

- Navigate to affected page
- Snapshot the rendered state
- Check: correct elements visible? Interactions work? Console errors?
- Compare before/after for refactoring

#### General shell filtering

Use `rg` over broad grep, `jq` for JSON, `cut`/`awk`/`sort`/`uniq` to reduce noise.
Never load full output into context when a filter gives you the answer.

### 6. Form a plan

- What will be changed
- What will not be changed
- Which test or verification proves success
- Which tool gives the smallest useful evidence

### 7. Implement

- Apply focused changes only
- Follow existing patterns
- Avoid unrelated rewrites
- Keep changes scoped to the actual problem

### 8. Write or update tests

Tests are mandatory when behavior changes or bugs are fixed.

Prefer: failing test first → implementation → passing test.

Test types: unit (isolated logic), feature/integration (behavior), UI (frontend), regression (bugs).

If a test cannot be added: state exactly why and explain what verification replaces it.

### 9. Verify with real execution (MANDATORY)

Never trust "it should work" — execute and observe.

| What | How | MCP alternative |
|---|---|---|
| Backend/API | `curl -s \| jq`, test endpoint | Postman MCP |
| Frontend/UI | Browser check | Playwright MCP (navigate + snapshot) |
| Execution flow | Logs, print debug | Xdebug MCP (breakpoints, step-through) |
| CLI/Jobs | Run command, check exit code | — |
| Database | Query result, migration status | — |
| Skills/rules | Lint, structure check | — |

If a debugging/testing tool is available as MCP server — **prefer it** over manual alternatives.

### 10. Validate

- Result matches requirement
- Edge cases handled
- Test coverage sufficient
- No unnecessary output, retries, or brute force used
- No important assumption remains hidden

## Output format

1. Task understanding
2. Analysis summary
3. Planned change
4. Test strategy
5. Implemented change
6. Verification result
7. Risks, open questions, or follow-up

## Gotchas

- The model tends to start coding too early → always analyze first
- The model tends to over-fetch data → always reduce output first
- The model tends to brute-force retries → prefer targeted inspection
- The model may skip tests if the fix looks obvious → do not skip them
- The model may fill unclear requirements with assumptions → ask instead

## Do NOT

- Start coding without understanding the affected system
- Guess behavior without verifying
- Load full datasets when partial extraction is enough
- Rely on long trial-and-error loops
- Skip tests when behavior changes
- Skip real verification after changes
- Modify unrelated parts of the system
- Hide requirement gaps behind assumptions
