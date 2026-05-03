# Verification Mechanics

Loaded by [`verify-before-complete`](../../rules/verify-before-complete.md).
Holds the decision logic and lookup tables behind the Iron Law: when
to run which verification command, the per-task-type evidence table,
confidence gating, and the break-glass reduction during live
incidents.

**Size budget:** ≤ 4,000 chars. Tracked under Phase 6 of
`road-to-pr-34-followups`.

## When to run what — timing matters

**Quality tools (PHPStan, Rector, ECS) run ONCE at the very end** — not after every edit.
Do NOT run quality checks between tasks if you have more work to do.
Only run the full quality pipeline when you are about to finish all work in the current conversation.

**Tests: as targeted as possible, as little as necessary.**

- During work: run ONLY the specific test class or test case affected by the change.
  Use `--filter=ClassName` or `--filter=test_name` — NEVER the full suite mid-work.
- Only run tests when you genuinely need to verify behavior (not "just to be safe").
- Full test suite: ONCE at the very end, before quality tools.

**The sequence at the end:**

1. All code changes are done
2. Run tests — targeted first (`--filter`), full suite only if targeted passes
3. Run quality pipeline (PHPStan → Rector → ECS → PHPStan)
4. Fix any issues from step 2-3
5. ONLY THEN claim completion or suggest commit/push/PR

## Minimum verification per task type

| Task | Required evidence |
|---|---|
| Code change | Tests + PHPStan |
| New feature | Tests + PHPStan + smoke test |
| Bug fix | Regression test + full suite |
| Refactoring | Full suite + PHPStan + Rector |
| Config/migration | Relevant tests or command output |
| API endpoint | curl/HTTP response output |
| Documentation only | No verification needed |

**Never accept** as proof: "should work", "looks correct", "logic is sound".
No captured output = not verified.

## Confidence gating

State confidence explicitly before claiming completion on non-trivial work.

- **High** — runtime path read end-to-end, relevant tests inspected or run,
  no hidden side-effects (queues/events/observers) unaccounted for.
- **Medium** — main path verified but one gap remains; list the gap in the
  completion message.
- **Low** — broad implementation NOT allowed; switch to analysis, narrow
  the scope, or ask the user before proceeding.

For high-risk areas (auth, tenancy, migrations, queues, dependencies,
external APIs, data exposure), "high" requires tests AND a cross-layer
read — not inference from a single file.

## Break-glass reduction

During a live production incident the verification gate is **narrowed**,
never skipped. Break-glass requires explicit user invocation (e.g.
`break-glass: true`, "this is a hotfix"). Never enter it unilaterally.

Minimum evidence:

- **Targeted test(s)** covering the exact regression — zero tests is not
  acceptable.
- **Smoke check** of the fixed path (curl, manual trigger, log tail) with
  output captured in the message.
- **Explicit list of skipped validations** and a **follow-up commitment**
  (ticket or PR line) to run them within 24h.

Completion wording: _"hotfix applied, full verification deferred per
break-glass"_ — never _"done"_ or _"verified"_. The normal gate resumes
on the follow-up PR.
