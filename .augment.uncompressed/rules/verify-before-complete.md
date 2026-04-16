---
type: "always"
description: "Verify before completion — run tests and quality tools before claiming done"
alwaysApply: true
source: package
---

# Verify Before Completion

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command **in this message**, you cannot claim it passes.

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

## The Gate

Before claiming ANY work is complete:

1. **IDENTIFY** — What command proves this claim? (tests, PHPStan, build, etc.)
2. **RUN** — Execute the full command (fresh, complete, not cached)
3. **READ** — Full output, check exit code, count failures
4. **VERIFY** — Does the output actually confirm the claim?
5. **ONLY THEN** — Make the claim

Skip any step = the claim is unverified.

## When this applies

- About to claim **all work is done** (not after individual edits)
- About to say "done" or "complete"
- Before suggesting to commit, push, or create a PR
- Any statement implying all work is finished

## Red flags — STOP immediately

- Using "should pass", "probably works", "seems fine"
- Expressing satisfaction before running verification
- About to commit/push without running tests + quality
- Trusting a previous run from earlier in the conversation
- Relying on partial verification (ran tests but not PHPStan)
- ANY wording implying success without fresh evidence

## Verification commands

For specific commands → see `quality-workflow` rule.

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
