# Context: Augment Infrastructure

> The complete `.augment/` directory structure — what it contains, how it's organized, and how agents use it.

**Type:** Infrastructure
**Created:** 2026-03-20
**Last Updated:** 2026-03-25

## Overview

The `.augment/` directory is a **shared Composer package** (read-only at project level) that provides
the agent infrastructure for all projects. It contains reusable skills, rules, commands,
guidelines, templates, and contexts that define how AI agents behave across the entire organization.

Projects customize this shared behavior through `agents/overrides/` — never by editing `.augment/` directly.

## Directory Structure

```
.augment/
├── rules/           ← Always-active behavior rules (auto-loaded by Augment)
├── skills/          ← Reusable skill definitions (loaded on-demand by topic)
├── commands/        ← Slash commands (interactive workflows)
├── guidelines/      ← Coding guidelines organized by language
│   └── php/         ← PHP-specific guidelines and patterns
│       └── patterns/
├── templates/       ← Document templates (features, roadmaps, contexts, overrides)
│   └── overrides/   ← Templates for creating override files
└── contexts/        ← Shared context documents about the .augment/ system itself
```

## Component Types

### Rules (`.augment/rules/`)

**Always active.** Loaded automatically for every conversation.
Define hard constraints: coding standards, Docker usage, language preferences, scope control.

**Always-active:**

| Rule | Purpose |
|---|---|
| `php-coding.md` | PHP coding standards (strict types, Math helper, comparisons) |
| `token-efficiency.md` | Redirect tool output to files, read only summaries, minimal output |
| `verify-before-complete.md` | Run verification before claiming completion |
| `user-interaction.md` | Numbered options, progress indicators |
| `model-recommendation.md` | Detect model, suggest switch for task type (opus/sonnet/gpt) |
| `language-and-tone.md` | German "Du", English code comments, icon spacing |
| `ask-when-uncertain.md` | When in doubt, ask the user — never guess or assume |
| `scope-control.md` | Stay within scope, no commit/push without permission |
| `guidelines.md` | Check coding guidelines before writing code |
| `commands.md` | Execute slash commands immediately — no questions, no opinions |

**Auto-loaded by topic:**

| Rule | Purpose |
|---|---|
| `quality-workflow.md` | PHP (PHPStan → Rector → PHPStan) and JS/TS pipelines |
| `downstream-changes.md` | After every edit, find and update ALL callers, tests, imports |
| `docs-sync.md` | Keep docs in sync when skills/rules change |
| `context-hygiene.md` | 3-failure rule, state dumps |
| `architecture.md` | Architecture principles, file placement |
| `docker-commands.md` | All PHP commands run inside Docker containers |
| `commit-conventions.md` | Conventional Commits format |
| `dev-efficiency.md` | Running CLI commands with verbose output — git, tests, linters, docker, build tools |
| `e2e-testing.md` | Playwright E2E tests — locators, assertions, Page Objects, CI |
| `lang-files.md` | Laravel lang files, both de/ and en/ always in sync |
| `rtk.md` | Using rtk for token-efficient CLI output filtering |
| `agent-docs.md` | When to read/create/update documentation |
| `augment-portability.md` | Everything in `.augment/` must be project-agnostic |

### Skills (`.augment/skills/`)

**On-demand.** Loaded when the agent needs specific expertise.
Each skill is a directory with a `SKILL.md` file defining behavior, patterns, and rules.

Skills organized by domain:

| Category | Skills |
|---|---|
| **PHP/Laravel** | `php`, `coder`, `laravel`, `eloquent`, `laravel-validation`, `php-service`, `dto-creator`, `artisan-commands`, `laravel-horizon`, `laravel-mail`, `laravel-middleware`, `laravel-notifications`, `laravel-pennant`, `laravel-pulse`, `laravel-reverb`, `laravel-scheduling` |
| **API** | `api-endpoint`, `api-design`, `api-versioning`, `api-testing`, `openapi` |
| **Analysis** | `analysis-autonomous-mode`, `universal-project-analysis`, `project-analysis-laravel`, `bug-analyzer`, `security-audit`, `performance-analysis` |
| **Testing** | `pest-testing`, `test-generator`, `test-performance`, `php-debugging`, `playwright-testing` |
| **Frontend** | `javascript`, `typescript`, `vue`, `react`, `nextjs`, `nuxt`, `tailwind`, `livewire`, `flux`, `blade-ui`, `fe-design` |
| **Infrastructure** | `docker`, `aws-infrastructure`, `terraform`, `terragrunt`, `devcontainer`, `github-ci`, `cloudflare-workers`, `traefik` |
| **Data** | `database`, `migration-creator`, `multi-tenancy`, `performance`, `sql` |
| **Jobs/Events** | `jobs-events`, `logging-monitoring`, `grafana`, `websocket` |
| **Packages** | `composer`, `composer-packages`, `npm`, `npm-packages` |
| **Design** | `dashboard-design`, `design-review`, `fe-design` |
| **Agent System** | `agent-docs`, `agents-audit`, `context`, `commands`, `copilot`, `copilot-agents-optimizer`, `feature-planning`, `file-editor`, `guidelines`, `mcp`, `override`, `project-docs`, `roadmap-manager`, `module`, `naming`, `project-analyzer`, `sequential-thinking`, `skill-reviewer` |
| **Workflow** | `git-workflow`, `merge-conflicts`, `code-review`, `refactorer`, `bug-analyzer`, `security`, `adversarial-review`, `dependency-upgrade`, `quality-tools` |
| **Other** | `graphql`, `jira`, `mobile`, `sentry`, `wordpress`, `microservices`, `technical-specification` |

### Commands (`.augment/commands/`)

**Interactive workflows.** Triggered by the user or other commands.
Each command is a `.md` file with a step-by-step flow.

Commands organized by workflow:

| Category | Commands |
|---|---|
| **Features** | `feature-dev`, `feature-plan`, `feature-explore`, `feature-refactor`, `feature-roadmap` |
| **Bugs** | `bug-investigate`, `bug-fix` |
| **Contexts** | `context-create`, `context-refactor` |
| **Modules** | `module-create`, `module-explore` |
| **Roadmaps** | `roadmap-create`, `roadmap-execute` |
| **Quality** | `quality-fix`, `review-changes`, `prepare-for-review`, `update-form-request-messages`, `fix-seeder` |
| **CI/PR** | `fix-ci`, `create-pr`, `create-pr-description`, `fix-pr-comments`, `fix-pr-bot-comments`, `fix-pr-developer-comments` |
| **Testing** | `tests-create`, `tests-execute` |
| **E2E** | `e2e-plan`, `e2e-heal` |
| **Agents** | `agents-prepare`, `agents-audit`, `agents-cleanup`, `copilot-agents-optimize`, `agent-handoff`, `agent-status`, `optimize-agents`, `optimize-augmentignore`, `optimize-skills`, `optimize-rtk-filters` |
| **Overrides** | `override-create`, `override-manage` |
| **Config** | `config-agent-settings`, `commit` |
| **Project** | `project-analyze`, `project-health`, `jira-ticket` |

### Guidelines (`.augment/guidelines/`)

**Coding conventions** organized by language/domain. PHP and E2E testing.

```
guidelines/php/
├── php.md              ← General PHP conventions
├── controllers.md      ← Single-action controllers, OpenAPI
├── eloquent.md         ← Getter/setter pattern, casts
├── validations.md      ← FormRequest conventions
├── resources.md        ← API Resource versioning (v1/v2)
├── jobs.md             ← Queue jobs, Horizon tags
├── git.md              ← Branch naming, commit messages
├── patterns.md         ← Pattern index (links to patterns/)
└── patterns/           ← 9 design pattern guides
    ├── service-layer.md
    ├── repositories.md
    ├── dtos.md
    ├── dependency-injection.md
    ├── strategy.md
    ├── factory.md
    ├── policies.md
    ├── events.md
    └── pipelines.md
guidelines/e2e/
└── playwright.md        ← Playwright E2E best practices
```

Each guideline has a consistent header with **Related Skills**, **Related Rules**, and **Related Guidelines**.

### Templates (`.augment/templates/`)

**Document structure definitions** for features, roadmaps, contexts, and overrides.

| Template | Creates files in |
|---|---|
| `features.md` | `agents/features/` or module `agents/features/` |
| `roadmaps.md` | `agents/roadmaps/` or module `agents/roadmaps/` |
| `contexts.md` | `agents/contexts/` or module `agents/contexts/` |
| `overrides/rule.md` | `agents/overrides/rules/` |
| `overrides/skill.md` | `agents/overrides/skills/` |
| `overrides/command.md` | `agents/overrides/commands/` |
| `overrides/guideline.md` | `agents/overrides/guidelines/` |
| `overrides/template.md` | `agents/overrides/templates/` |

### Contexts (`.augment/contexts/`)

**Shared context documents** about the `.augment/` system itself.
These help agents understand the infrastructure they operate in.

Unlike project contexts (`agents/contexts/`), these are part of the shared package
and describe the agent system, not the project's business domain.

## Key Principles

1. **`.augment/` is read-only** — it's a shared resource across all projects
2. **Project customization via `agents/overrides/`** — extend or replace shared behavior
3. **Rules are always active**, skills are on-demand, commands are user-triggered
4. **Guidelines have cross-references** — each links to related skills and rules
5. **Templates are the single source of truth** for document structure
6. **All content in English** — code comments, documentation, agent files

