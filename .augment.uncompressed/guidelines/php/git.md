# Git & Version Control Guidelines

> Project-specific Git conventions. Branch naming, commit messages, PR workflow.

**Related Skills:** `git-workflow`, `conventional-commits-writing`
**Related Rules:** `commit-conventions.md`

## Branch Naming

```
{type}/{ticket-id}/{short-description}
```

| Type | When |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `hotfix/` | Urgent production fix |
| `chore/` | Maintenance, refactoring, tooling |
| `docs/` | Documentation changes |
| `test/` | Test additions/changes |

### Examples

```
feat/DEV-1234/user-notification-preferences
fix/DEV-5678/null-pointer-in-import
chore/refactor-agent-setup
hotfix/DEV-999/critical-payment-bug
```

### Rules

- Always include the Jira ticket ID when one exists
- Use kebab-case for the description part
- Keep branch names short but descriptive

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
See `commit-conventions` rule for the base format and type table.

### Type selection rules

**`feat`** — a new capability is added; user or system can do something new.

**`fix`** — existing behavior was wrong; bug, regression, or broken edge case corrected.

**`refactor`** — structure changes, readability/maintainability improves, behavior unchanged.
Do NOT use `refactor` if behavior changes — use `feat` or `fix` instead.

**`docs`** — only documentation changes, no runtime or behavior change.

**`test`** — only tests added/updated, no production behavior changes.

**`ci`** — GitHub Actions, pipelines, CI checks, automation workflows, release jobs.

**`chore`** — maintenance, repo housekeeping, dependency bumps, non-functional cleanup
that is not better classified as `build`, `ci`, or `docs`.

**`perf`** — measurable performance improvement.

**`build`** — build tooling, packaging, Docker changes.

**`style`** — formatting only, no logic change (e.g. ECS/Rector auto-fixes).

### Scope guidance

Use a scope when it adds clarity. Good scopes:

- Jira ticket ID: `DEV-1234`
- Module/area: `api`, `auth`, `skills`, `rules`, `ci`, `frontend`, `linter`

Do not add a scope if it adds no value. `fix(core): fix typo` → just `fix: fix typo`.

### Description rules

- Describe **intent**, not implementation detail
- Describe **what changed**, not every low-level step
- Avoid generic wording: `update stuff`, `fix issue`, `changes`

Good: `fix(routes): preserve middleware order for api endpoints`
Bad: `fix: fix things`

### Breaking changes

Use `!` after type/scope or `BREAKING CHANGE:` in footer:

```
feat(api)!: rename invoice status values
refactor(auth)!: remove legacy session flow
```

### Commit splitting

If a change contains multiple unrelated concerns, split into multiple commits.

Bad: `refactor: cleanup skills and fix ci and update docs`

Better:
```
refactor(skills): remove duplicate routing helpers
ci(lint): add skill-lint workflow
docs(readme): document new lint tasks
```

### Squash merge titles

- Use Conventional Commit format
- Summarize the **net effect** of the PR
- Do not copy vague branch names
- Do not include issue noise if it hurts readability

### Examples by area

```bash
# Features
feat(DEV-2133): send email to customer when product is shipped

# Bug fixes
fix(import): handle null values in equipment JSON

# Refactoring
refactor: extract user sync logic into dedicated service

# Skills / Rules / Agent config
refactor(skills): merge duplicate analysis skills
feat(rules): add analysis routing quality gate
fix(skills): restore concrete validation in skill reviewer

# CI / Tooling
ci(lint): add skill linter workflow
feat(linter): detect pointer-only skills

# Docs
docs(roadmap): add phase 3 implementation plan
docs(readme): clarify source-of-truth workflow
```

### Decision checklist

Before writing the commit message:

1. Did behavior change? → `feat` or `fix`
2. Was it only structure/cleanup? → `refactor`
3. Was it only docs, tests, or CI? → `docs`, `test`, `ci`
4. Is the scope useful or just noise?
5. Is this actually multiple commits hiding in one?

### Anti-patterns

- `update stuff` / `fix bug` / `changes` / `refactor everything`
- Using `chore` for meaningful behavior changes
- Using `refactor` for bug fixes
- Using one commit for multiple unrelated concerns
- Vague squash merge titles that don't describe the net effect

## Pull Requests

- PR title follows commit message format: `feat(DEV-1234): short description`
- Fill in the PR template (checklist, description, testing notes)
- Link the Jira ticket in the PR description
- Ensure all quality gates pass before requesting review

