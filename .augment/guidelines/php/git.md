# Git & Version Control Guidelines

> Project-specific Git conventions. Branch naming, commit messages, PR workflow.

**Related Skills:** `git-workflow`, `conventional-commits-writing`
**Related Rules:** `commit-conventions.md`

## Branch Naming

`{type}/{ticket-id}/{short-description}` — kebab-case, include Jira ID when exists.

Types: `feat/`, `fix/`, `hotfix/`, `chore/`, `docs/`, `test/`

## Commit Messages

See `commit-conventions` rule for base format. Key type selection:

- `feat` — new capability. `fix` — bug/regression. `refactor` — structure only, NO behavior change.
- `docs` — docs only. `test` — tests only. `ci` — CI/workflows. `chore` — maintenance/cleanup.
- `perf` — performance. `build` — build tooling. `style` — formatting only.

**Scope:** Jira ID or area name (`api`, `auth`, `skills`). Only add when it improves clarity.

**Description:** Intent, not implementation. Imperative mood. Max 72 chars. No generic filler.

**Breaking:** `!` after type/scope or `BREAKING CHANGE:` footer.

**Splitting:** Mixed concerns → split commits. Don't hide unrelated changes in one.

**Squash merge titles:** Conventional Commit format, describe net effect, not every internal commit.

### Anti-patterns

- `update stuff` / `fix bug` / `changes`
- `refactor` for bug fixes, `chore` for behavior changes
- Multiple unrelated concerns in one commit

### Decision checklist

1. Behavior changed? → `feat` or `fix`
2. Structure only? → `refactor`
3. Only docs/tests/CI? → `docs`/`test`/`ci`
4. Scope useful or noise?
5. Multiple commits hiding in one?

### Examples

```
feat(DEV-1234): add absence type filter to working time report
fix(import): handle null values in equipment JSON
refactor(skills): merge duplicate analysis skills
ci(lint): add skill-lint workflow
docs(roadmap): add phase 3 implementation plan
```

## Pull Requests

- PR title: Conventional Commit format — `feat(DEV-1234): short description`
- Fill PR template, link Jira ticket, ensure quality gates pass

