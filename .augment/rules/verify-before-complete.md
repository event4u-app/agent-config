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

## Common verification commands

### Laravel projects (inside Docker container)
```bash
php artisan test                     # Tests
vendor/bin/phpstan analyse                # Static analysis (or: php artisan quality:phpstan)
vendor/bin/rector process                 # Rector (or: php artisan quality:rector --fix)
vendor/bin/ecs check --fix                # Code style (or: php artisan quality:ecs --fix)
```

### Frontend projects
```bash
npm test          # or: bun test
npm run build     # or: bun run build
npm run lint      # or: bun run lint
npx tsc --noEmit  # TypeScript check
```

For tool-specific commands → see the `quality-workflow` rule.

## Minimum verification per task type

| Task | Required evidence |
|---|---|
| Code change | Tests + PHPStan (command output with exit code) |
| New feature | Tests + PHPStan + manual smoke test |
| Bug fix | Regression test + full test suite |
| Refactoring | Full test suite + PHPStan + Rector |
| Config change | Relevant tests or verification command output |
| API endpoint | curl/HTTP response output |
| UI change | Screenshot or browser verification |
| Migration | Migration run + rollback test |
| Documentation only | No verification needed |

**Never accept** these as proof:
- "It should work"
- "Looks correct"
- "I've done similar before"
- "The logic is sound"

If you can't produce captured output, it's not verified.
