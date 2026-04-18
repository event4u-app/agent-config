---
name: code-review
description: "Use when the user says "review this", "check my code", or wants feedback on changes. Reviews for correctness, quality, security, and coding standards."
source: package
---

# code-review

## When to use

Use this skill when:
- Reviewing a PR (own or someone else's)
- Self-reviewing local changes before creating a PR
- Responding to review feedback on your PR
- The user asks to "review", "check", or "look at" code changes

## Procedure: Review code

### Mindset

- **Be thorough but pragmatic** — catch real bugs, not style nitpicks that tools handle.
- **Understand intent first** — read the PR description, linked ticket, and commit messages before looking at code.
- **Check the full picture** — a change in a service may require changes in tests, migrations, docs.
- **Assume good intent** — suggest improvements, don't criticize.

### Review order

1. **Understand the goal** — what is this change trying to achieve?
2. **Architecture** — does the approach make sense? Right layer? Right pattern?
3. **Correctness** — does it actually work? Edge cases? Error handling?
4. **Quality** — types, naming, readability, DRY, SOLID?
5. **Security** — input validation, authorization, injection?
6. **Performance** — N+1 queries, missing indexes, unbounded queries?
7. **Tests** — are new paths covered? Are existing tests still valid?
8. **Conventions** — does it follow project standards?

## Review checklist

### Code quality

| Check | What to look for |
|---|---|
| **Strict types** | `declare(strict_types=1)` in new files, typed properties/params/returns |
| **PSR-12** | Coding style, line length ≤120, trailing commas, Yoda comparisons |
| **Naming** | Clear, descriptive names. `camelCase` vars, `snake_case` array keys, `UPPER_SNAKE` constants |
| **Early returns** | No deep nesting. Guard clauses at the top. |
| **Single responsibility** | Each class/method does one thing. Controllers are thin. |
| **No magic** | No magic properties on models (use getters/setters). No `$request->input()` without FormRequest. |
| **PHPDoc** | Only where type hints are insufficient (generics, complex arrays). No redundant docblocks. |

### Architecture

| Check | What to look for |
|---|---|
| **Layer separation** | Business logic in services, not controllers. Models have no business logic. |
| **Single-action controllers** | New controllers use `__invoke()`. No multi-action controllers. |
| **FormRequest** | Every controller has a dedicated FormRequest. No inline `$request->validate()`. |
| **API Resources** | Controllers return Resources, never raw models or `response()->json()`. |
| **DTOs** | Structured data transfer between layers, not raw arrays. |
| **Dependency injection** | Constructor injection, no `new Service()` or `app()` calls in business logic. |

### Database & Performance

| Check | What to look for |
|---|---|
| **N+1 queries** | Relationship access in loops without eager loading |
| **Missing indexes** | New columns used in WHERE/JOIN without index |
| **Unbounded queries** | `Model::all()` or queries without pagination/limit |
| **Raw SQL** | Parameterized queries only. No string concatenation with user input. |
| **Migrations** | Reversible (has `down()`). Correct connection. Correct table prefix. |
| **Money** | Uses `decimal` or `Math` helper, never `float` |

### Security

| Check | What to look for |
|---|---|
| **Authorization** | Policy check in FormRequest or middleware. No unprotected endpoints. |
| **Input validation** | All user input validated via FormRequest rules. |
| **Mass assignment** | No `$model->fill($request->all())` without `$fillable`/`$guarded`. |
| **SQL injection** | No raw queries with unescaped user input. |
| **XSS** | Blade output escaped (`{{ }}` not `{!! !!}`) unless intentional. |
| **Sensitive data** | No secrets, tokens, or passwords in code or logs. |

### Tests

| Check | What to look for |
|---|---|
| **Coverage** | New code paths have tests. Bug fixes have regression tests. |
| **Test quality** | Tests verify behavior, not implementation details. |
| **Pest syntax** | Correct Pest conventions. No `readonly`/`final` on test classes. |
| **Seeders** | Test data via seeders (or factories where allowed). |
| **Assertions** | Meaningful assertions. Not just "no exception thrown". |
| **Flaky risks** | Time-dependent tests use `travel()`. No reliance on execution speed. |

## Before creating a PR

1. Run quality pipeline: PHPStan → Rector → ECS → PHPStan (see `quality-tools` skill for commands)
2. Run tests: `make test` (or project equivalent)
3. Ensure CI passes on the branch.
4. Self-review the diff: `git diff origin/main..HEAD`

## Receiving feedback

### The response pattern

When receiving code review feedback, follow this sequence:

1. **READ** — Complete feedback without reacting.
2. **UNDERSTAND** — Restate the requirement in your own words (or ask if unclear).
3. **VERIFY** — Check the suggestion against codebase reality.
4. **EVALUATE** — Is it technically sound for THIS codebase?
5. **RESPOND** — Technical acknowledgment or reasoned pushback.
6. **IMPLEMENT** — One item at a time, test each.

If **any item is unclear**, STOP — do not implement anything yet. Items may be related;
partial understanding leads to wrong implementation.

### No performative agreement

- **Do NOT** reply with "Great point!", "You're absolutely right!", "Excellent catch!" or similar.
- **Instead:** Just fix it. "Fixed." or "Updated — [brief description of what changed]."
- Actions speak louder than words — the code itself shows you heard the feedback.

### Source-specific handling

**Internal team feedback** (trusted colleagues):
- Implement after understanding — no need for deep skepticism.
- Still ask if scope is unclear.
- Skip to action or technical acknowledgment.

**External / Copilot / bot feedback** (less context):
- Check: Technically correct for THIS codebase?
- Check: Does it break existing functionality?
- Check: Is there a reason for the current implementation?
- Check: Does the reviewer understand the full context?
- **YAGNI check:** If the reviewer suggests "implementing properly", grep the codebase
  for actual usage. If unused → suggest removing (YAGNI).
- If it conflicts with existing architectural decisions → discuss with the team first.

### When to push back

Push back when:
- Suggestion breaks existing functionality.
- Reviewer lacks full context.
- Violates YAGNI (unused feature).
- Technically incorrect for this stack.
- Legacy/compatibility reasons exist.
- Conflicts with architectural decisions.

How: Use technical reasoning, not defensiveness. Reference working tests/code.

### Addressing PR comments systematically

When working through review comments on a PR:

1. **List** all comments and review threads (`gh pr view --comments`).
2. **Categorize**: blocking → simple fixes → complex fixes.
3. **Clarify** anything unclear BEFORE implementing.
4. **Fix** one at a time, test each.
5. **Reply in the thread** — not as a top-level PR comment.

```bash
# Reply to a specific review comment thread
gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies \
  -f body="Fixed in latest commit."
```

## Output format

When reviewing code, structure feedback by severity:

```
🔴 **Blocker** — must fix before merge
Description of the issue and why it's critical.

🟡 **Suggestion** — should fix, improves quality
Description and suggested improvement.

🟢 **Nit** — optional, minor improvement
Description.
```

Group related findings. Don't repeat what linters/PHPStan already catch — focus on
logic, architecture, and things tools can't detect.

## Adversarial review

Before creating a PR or presenting code changes, run the **`adversarial-review`** skill.
Focus on the "Code changes / Refactoring" attack questions.

## Auto-trigger keywords

- code review
- PR review
- pull request
- review checklist
- review feedback
- review changes
- check my code

## Gotcha

- Don't rewrite code that works and is tested just because you'd write it differently.
- The model tends to suggest changes that are out of scope — stay focused on the PR's intent.
- "I would prefer X" is not a valid review comment unless X prevents a bug or violates a rule.
- Always check if the PR has tests — missing tests is always worth flagging.

## Do NOT

- Do NOT approve without actually reading the code.
- Do NOT agree with review comments without verifying them against the codebase.
- Do NOT use performative language when responding to feedback ("Great point!", "Excellent catch!").
- Do NOT nitpick style issues that ECS/Rector handle automatically.
- Do NOT merge without CI passing and quality checks green.
