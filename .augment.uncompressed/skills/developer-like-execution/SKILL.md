---
name: developer-like-execution
description: "Use when implementing, debugging, refactoring, or reviewing code, skills, rules, or configs. Enforces think → analyze → verify → execute workflow."
source: package
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

### Prefer targeted output

- `jq` for JSON extraction
- `grep`, `rg`, `awk`, `sed` for targeted text filtering
- `head`, `tail`, `cut`, `sort`, `uniq` for narrowing results
- `curl` for API calls
- `artisan` / framework CLIs with filtering
- Debugger (e.g. Xdebug) when flow tracing is needed
- Playwright for frontend verification
- Logs only when targeted and scoped

### Avoid large output by default

Do NOT:

- Dump full JSON if one field is enough
- Load full route lists when filtering one route is enough
- Inspect full log files when one request id or timestamp can isolate the case
- Re-run broad commands repeatedly without narrowing

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
php artisan route:list | grep "users.index"

# Config/debug
php artisan config:show app | grep env

# API inspection
curl -s http://localhost/api/users | jq '.[0] | {id, email, status}'

# Logs — scoped
rg "request_id=abc123|OrderFailed" storage/logs
tail -n 200 storage/logs/laravel.log | rg "payment|timeout"
```

#### Frontend examples

Use Playwright or browser-level checks when UI is affected:
rendered state, interaction result, errors in console/network.

#### General shell filtering

Use `rg` over broad grep, `jq` for JSON, `cut`/`awk`/`sort`/`uniq` to reduce noise.

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

- Backend/API: `curl`, Postman, response shape and behavior
- Frontend: Playwright, user-visible behavior
- CLI/jobs: command execution, side effects, exit code
- Skills/rules/agent docs: lint, structure, trigger verification

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
