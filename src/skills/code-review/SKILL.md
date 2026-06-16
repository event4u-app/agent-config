---
model_tier: high
name: code-review
description: "Use when the user says \"review this\", \"check my code\", or wants feedback on changes. Reviews for correctness, quality, security, and coding standards."
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
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

The checks below are stack-agnostic. For framework-specific conventions (PSR-12 + `declare(strict_types=1)`, FormRequest, single-action `__invoke`, API Resources, Pest, Blade escaping, Eloquent N+1) defer to the carve-outs:
- PHP / Laravel → [`laravel`](../laravel/SKILL.md), [`laravel-validation`](../laravel-validation/SKILL.md), [`eloquent`](../eloquent/SKILL.md), [`pest-testing`](../pest-testing/SKILL.md), [`blade-ui`](../blade-ui/SKILL.md), [`php-coder`](../php-coder/SKILL.md)
- Symfony → [`symfony-workflow`](../symfony-workflow/SKILL.md)
- Next.js / TS → [`nextjs-patterns`](../nextjs-patterns/SKILL.md), [`react-shadcn-ui`](../react-shadcn-ui/SKILL.md)

### Code quality

| Check | What to look for |
|---|---|
| **Type discipline** | New code is fully typed in the project's idiom (PHP typed properties + `declare(strict_types=1)`, TS strict, Python type hints, Go / Rust by construction). |
| **Style conformance** | Matches the project's formatter / linter output — no reformatting battles, no out-of-band style. |
| **Naming** | Clear, descriptive names; matches the dominant casing in the surrounding code (camelCase / snake_case / PascalCase per the language's idiom). |
| **Early returns** | No deep nesting. Guard clauses at the top. |
| **Single responsibility** | Each class / module / function does one thing. HTTP handlers stay thin. |
| **No magic** | No reach-through to globals (`app()`, `$_GET`, ambient context). No untyped data shapes leaking out of the I/O boundary. |
| **Doc comments** | Only where the type system is insufficient (generics, complex shapes). No redundant docblocks. |

### Architecture

| Check | What to look for |
|---|---|
| **Layer separation** | Business logic in services / use-cases, not in HTTP handlers. Domain models stay I/O-free. |
| **Handler shape** | New handlers follow the framework's recommended shape (Laravel single-action `__invoke`, Next.js route handler, Express handler-per-route). See the stack carve-out. |
| **Input validation** | Validated at the request boundary via the framework's primitive (Laravel `FormRequest`, Zod / class-validator, Pydantic, struct-tag validators). No ad-hoc inline `if` checks. |
| **Response shaping** | Returns through a transformer / serializer / DTO. Never returns raw ORM entities. |
| **DTOs / value objects** | Structured data between layers, not raw associative arrays / `any` / `dict[str, Any]`. |
| **Dependency injection** | Constructor injection (or framework-idiomatic equivalent). No service-locator calls in business logic. |

### Database & Performance

| Check | What to look for |
|---|---|
| **N+1 queries** | Relationship / association access in loops without eager / batch loading. |
| **Missing indexes** | New columns used in `WHERE` / `JOIN` without a supporting index. |
| **Unbounded queries** | Full-table reads (`Model::all()`, `SELECT *` without `LIMIT`, unpaged list endpoints). |
| **Raw SQL** | Parameterised queries only. No string concatenation with user input. |
| **Migrations** | Reversible. Targets the right connection / schema. Idempotent where the platform supports it. |
| **Money / precision** | Uses an exact-precision type (PHP `decimal` / `Math` helper, TS bigint / decimal lib, Python `Decimal`), never `float`. |

### Security

| Check | What to look for |
|---|---|
| **Authorization** | Authz check at every state-changing endpoint (Laravel Policy, Symfony voter, NestJS guard, framework middleware). No unprotected mutating routes. |
| **Input validation** | All user input validated at the boundary via the framework's primitive. |
| **Mass assignment** | No bulk-binding raw request payloads to ORM entities without an explicit allow-list (`$fillable` / `$guarded` in Laravel, DTO mapping in TS / Python). |
| **Injection** | No raw queries / command lines / template strings with unescaped user input. |
| **Output encoding** | Template output is escaped by default; raw / unescaped output is intentional and reviewed (Blade `{{ }}` vs `{!! !!}`, React `dangerouslySetInnerHTML`, Jinja `\|safe`). |
| **Sensitive data** | No secrets, tokens, or passwords in code, logs, or error responses. |

### Tests

| Check | What to look for |
|---|---|
| **Coverage** | New code paths have tests. Bug fixes have regression tests (RED → GREEN). |
| **Test quality** | Tests verify behaviour, not implementation details. |
| **Framework idiom** | Correct conventions for the project's test framework (Pest / PHPUnit, Jest / Vitest, pytest, `go test`, `cargo test`) — see the stack carve-out for specifics. |
| **Test data** | Provisioned via the project's idiom (seeders, factories, fixtures, builders). |
| **Assertions** | Meaningful assertions. Not just "no exception thrown". |
| **Flaky risks** | Time-dependent tests freeze the clock (`travel()`, `jest.useFakeTimers()`, `freezegun`). No reliance on execution speed. |

## Before creating a PR

1. Run the project's quality pipeline (see the stack carve-out for the exact commands — PHP: `quality-tools`).
2. Run tests via the project's runner (`make test`, `npm test`, `pytest`, `go test ./...`, or the project's wrapper script).
3. Ensure CI passes on the branch.
4. Self-review the diff: `git diff origin/main..HEAD`.

## Receiving feedback

### The response pattern

Constraint: **understand each comment fully before touching code, verify it against codebase reality, and implement one item at a time (test each).** Restate anything ambiguous in your own words — or ask. Push back with technical reasoning when a suggestion is unsound for *this* codebase rather than complying reflexively.

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

Constraint: **clarify anything unclear before implementing, fix one item at a time (test each), and reply in each review thread** — not as a top-level PR comment. Triage first (blocking → simple → complex) so blockers land first; `gh pr view --comments` lists the threads.

```bash
# Reply to a specific review comment thread
gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies \
  -f body="Fixed in latest commit."
```

## Output format

1. Structure every finding by severity (Blocker / Suggestion / Nit) using the block below; never mix severities in one block.
2. Group related findings; skip anything the project's linter or type-checker already catches — focus on logic, architecture, and judgment.
3. End with a one-line verdict (approve / request-changes / comment) and a count of Blockers vs. Suggestions.

When reviewing code, structure feedback by severity:

```
🔴 **Blocker** — must fix before merge
Description of the issue and why it's critical.

🟡 **Suggestion** — should fix, improves quality
Description and suggested improvement.

🟢 **Nit** — optional, minor improvement
Description.
```

Group related findings. Don't repeat what the project's linter / type-checker already catches — focus on
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
- Do NOT nitpick style issues the project's formatter / auto-refactor (ECS, Prettier, Ruff, gofmt) handles automatically.
- Do NOT merge without CI passing and quality checks green.
