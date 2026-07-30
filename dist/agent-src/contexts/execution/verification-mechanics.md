# Verification Mechanics

Loaded by [`verify-before-complete`](../../rules/verify-before-complete.md).
Holds the decision logic and lookup tables behind the Iron Law: when
to run which verification command, the per-task-type evidence table,
confidence gating, and the break-glass reduction during live
incidents.

**Size budget:** ≤ 4,000 chars. Tracked under Phase 6 of
`road-to-pr-34-followups`.

## Gate zero — `quality.local_auto_run` (default `false`)

`false`/missing → **never run the full quality pipeline or full test
suites proactively — never ask**; remote CI is the gate. Run one ONLY on:
(1) explicit ask this turn, (2) concrete CI failure — run exactly that
check, (3) new-gate carve-out (a NEW gate/test this change adds, run once).
Completion wording: *"quality gates delegated to remote CI"* — never a pass
claim for tools that did not run. Narrow probes stay allowed (one `--filter`
test, `curl`); a type-check + lint **scoped to the changed files** is
REQUIRED before a source push/PR — NOT the full pipeline. Everything below
applies when `true`.

## When to run what — timing matters (`local_auto_run: true`)

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

## Migrated from `verify-before-complete` (kernel-budget relief, 2026-07-30)

### Examples

Wrong/right/why demos (hedged claims, trusting earlier runs,
partial-verification creep): [`verify-before-complete-demos`](../../../../docs/guidelines/agent-infra/verify-before-complete-demos.md).
Outcome baseline:
[`tests/golden/outcomes/verify_before_complete.json`](../../../../tests/golden/outcomes/verify_before_complete.json).
