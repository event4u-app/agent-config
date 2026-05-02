---
description: "Naming conventions for skills, rules, commands, and guidelines"
source: package
---

# Naming Conventions

## Principles

1. **Name = purpose.** Reading the name tells you what it does.
2. **No collisions across layers.** A rule and skill must NOT share the same name.
3. **Consistent prefixes** for related items: `project-analysis-*`, `laravel-*`, `feature-*`.
4. **Consistent suffixes** for similar roles: `-management`, `-integration`, `-config`.
5. **No bare nouns** — `jira` says nothing, `jira-integration` says everything.

## Naming patterns by layer

### Skills

| Pattern | When | Examples |
|---|---|---|
| `{domain}-{activity}` | Activity/workflow skills | `code-refactoring`, `sql-writing`, `pest-testing` |
| `{domain}-{role}` | Domain-specific expertise | `php-coder`, `fe-design`, `api-design` |
| `{domain}-{management}` | CRUD/lifecycle management | `module-management`, `override-management` |
| `{domain}-{integration}` | External tool integration | `jira-integration`, `sentry-integration` |
| `{domain}-{config}` | Configuration/setup | `copilot-config`, `devcontainer` |
| `{framework}-{feature}` | Framework-specific | `laravel-validation`, `laravel-mail` |
| `{scope}-analysis-{variant}` | Analysis skills | `project-analysis-laravel`, `performance-analysis` |
| `{action}-{target}` | Action commands as skills | `bug-analyzer`, `skill-reviewer` |

### Rules

| Pattern | When | Examples |
|---|---|---|
| `{concern}` | Behavioral constraint | `scope-control`, `ask-when-uncertain` |
| `{domain}-{concern}` | Domain-specific rule | `php-coding`, `e2e-testing` |
| `{action}-{target}` | Trigger-based auto rule | `capture-learnings`, `downstream-changes` |

### Commands

| Pattern | When | Examples |
|---|---|---|
| `{verb}-{target}` | Action commands | `create-pr`, `fix-ci`, `commit` |
| `{target}-{verb}` | Target-first grouping | `roadmap-create`, `roadmap-execute` |
| `{scope}-{action}` | Scoped actions | `optimize-agents`, `review-changes` |

### Guidelines

| Pattern | When | Examples |
|---|---|---|
| `{language}/{topic}.md` | Language-specific | `php/general.md`, `php/naming.md` |
| `{domain}/{topic}.md` | Domain-specific | `agent-infra/naming.md`, `e2e/locators.md` |

## Anti-patterns

| Don't | Why | Do instead |
|---|---|---|
| Single bare noun (`jira`, `sql`) | Ambiguous — could be anything | `jira-integration`, `sql-writing` |
| Same name across layers | Routing confusion | `agent-docs` (rule) + `agent-docs-writing` (skill) |
| `-er` suffix for skills | Skills are not agents | `-ing` or `-management` |
| `{dir}/{dir}.md` for guidelines | Redundant | `php/general.md` not `php/php.md` |
| Abbreviations alone (`rtk`, `mcp`) | Meaningless to new users | `rtk-output-filtering`, `mcp` (OK if well-known) |
| Inconsistent prefix grouping | Hard to discover related items | All Laravel skills start with `laravel-*` |

## Linter enforcement

The skill linter (`scripts/skill_linter.py`) warns on:
- **Bare-noun names** — single word without qualifier (e.g., `jira` instead of `jira-integration`)
- **Layer collisions** — same name used for both a rule and a skill
