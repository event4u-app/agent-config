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

Invariants live in the memory layer; architectural rationale lives in ADRs.
Via [`memory-access`](../../../../docs/guidelines/agent-infra/memory-access.md),
call `retrieve(types=["domain-invariants"], keys=<touched paths>, limit=3)` —
a matching `domain-invariant` is a hard constraint. For *why* the current
shape exists, check the ADR index `docs/decisions/INDEX.md`. Cite the `id` /
ADR number if a match influences the plan.

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
- Max 2 retries for the same approach — then stop and rethink. The 2
  retries plus the initial attempt ARE the three attempts of
  `autonomous-execution`'s N=3 stop: the 3rd consecutive failure on the
  same target escalates to stop-and-ask, then to `context-hygiene`'s
  fresh-session recommendation — one ladder, not competing budgets
  ([`autonomy-mechanics § Retry-budget escalation ladder`](../../execution/autonomy-mechanics.md)).

## Open files are context, not intent

The editor may report that the user has a file open. Background
context only — does NOT mean the user's message is about that file.

- The user's message determines intent — not which file is open.
- A user can have `README.md` open and type `/condense` — intent is
  to condense, not to discuss the README.
- A user can have `UserController.php` open and ask "how do tests
  work?" — intent is testing, not the controller.
- Treat the open file as relevant only when the user's message
  explicitly references it (e.g. "fix this file", "what does this
  do?", "update the open file").

## Goal-driven execution — vague ask → verifiable goal

Before executing a multi-step task, transform it into criteria a tool can
check. Strong criteria let the loop run independently; weak criteria ("make it
work") guarantee rework.

| Vague ask | Verifiable goal |
|---|---|
| "Add validation" | Write tests for the invalid inputs, then make them pass |
| "Fix the bug" | Write a test that reproduces it (fails), then make it pass |
| "Refactor X" | Tests green before AND after; diff shows no behavior change |
| "Make it faster" | Name the metric + target (p95 < 200ms); measure before/after |
| "Clean this up" | Clarification trigger — no checkable success state exists yet |

For multi-step tasks, state the plan with a verify per step:

```
1. [step] → verify: [check]
2. [step] → verify: [check]
3. [step] → verify: [check]
```

A step without a `verify:` is not a step — it is an assumption. A task whose
success cannot be checked is a clarification trigger, not an execution
trigger (route to `ask-when-uncertain`).

Wrong/right demos:
[`simplicity-and-goal-demos`](../../../../../docs/guidelines/agent-infra/simplicity-and-goal-demos.md).
