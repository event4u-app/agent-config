# Context: Skills and Commands

> How skills and commands relate to each other, when to use which, and how they form workflows.

**Type:** Infrastructure
**Created:** 2026-03-20
**Last Updated:** 2026-03-25

## Overview

**Skills** define *how* an agent behaves in a domain (knowledge + rules).
**Commands** define *what* an agent does step-by-step (interactive workflows).
Commands reference skills to know which expertise to apply during execution.

## Relationship Model

```
Command (workflow)
  ├── uses Skill A (expertise)
  ├── uses Skill B (expertise)
  ├── reads Rule X (constraint)
  ├── reads Guideline Y (convention)
  └── creates file from Template Z (structure)
```

## Workflow Chains

Commands often chain together. Here are the main workflows:

### Feature Development

```
/feature-explore → /feature-plan → /feature-roadmap → /roadmap-execute
     ↓                  ↓                ↓                    ↓
  Brainstorm        Structure         Phases/Steps        Implement
```

**Skills used:** `feature-planning`, `agent-docs-writing`, `roadmap-manager`

### Bug Investigation & Fix

```
/bug-investigate → /bug-fix
       ↓               ↓
  Root cause        Implement + verify
```

**Skills used:** `bug-analyzer`, `php-coder`, `refactorer`, `pest-testing`

### Module Work

```
/module-explore → /context-create → /feature-plan (if needed)
       ↓                ↓
  Understand        Document
```

**Skills used:** `module-management`, `context-create`, `feature-planning`

### Quality & PR

```
/quality-fix → /review-changes → /create-pr → /fix-pr-comments
      ↓              ↓                ↓              ↓
  PHPStan/Rector  Self-review     Open PR       Address feedback
```

**Skills used:** `refactorer`, `code-review`, `git-workflow`

### Agent Infrastructure

```
/agents-prepare → /agents-audit → /agents-cleanup
       ↓                ↓                ↓
  Scaffold dirs    Find issues      Fix issues
```

```
```

**Skills used:** `agents-audit`, `agent-docs-writing`

## Skill Categories

### Always Relevant (loaded for most tasks)

| Skill | Why |
|---|---|
| `php-coder` | Core PHP coding behavior |
| `laravel` | Framework conventions |
| `agent-docs-writing` | Documentation awareness |

### Domain-Specific (loaded when working in that area)

| Area | Skills |
|---|---|
| API endpoints | `api-endpoint`, `api-design`, `api-versioning`, `api-testing`, `openapi`, `laravel-validation` |
| Database | `eloquent`, `database`, `migration-creator`, `multi-tenancy`, `sql-writing` |
| Background jobs | `jobs-events`, `laravel-horizon`, `laravel-scheduling`, `performance` |
| Email/Notifications | `laravel-mail`, `laravel-notifications` |
| Middleware/Auth | `laravel-middleware`, `security` |
| Feature flags | `laravel-pennant` |
| Monitoring | `laravel-pulse`, `logging-monitoring`, `grafana`, `sentry-integration` |
| Real-time | `laravel-reverb`, `websocket` |
| Testing | `pest-testing`, `test-generator`, `playwright-testing` |
| Frontend | `livewire`, `flux`, `blade-ui`, `tailwind`, `vue`, `react`, `fe-design` |
| Infrastructure | `docker`, `aws-infrastructure`, `terraform`, `terragrunt`, `cloudflare-workers`, `traefik` |

### Meta-Skills (about the agent system itself)

| Skill | Purpose |
|---|---|
| `agent-docs-writing` | Documentation hierarchy and reading order |
| `agents-audit` | Agent docs quality and cleanup |
| `commands` | Slash command handling |
| `context-create` | Context document creation and maintenance |
| `copilot-config` | GitHub Copilot behavior management |
| `copilot-agents-optimizer` | AGENTS.md and copilot-instructions optimization |
| `feature-planning` | Feature plan structure and workflow |
| `file-editor` | Auto-open files in user's IDE |
| `guidelines` | Coding guideline management |
| `module-management` | Module system understanding |
| `naming` | Consistent naming conventions |
| `override-management` | Override system for project customization |
| `project-analyzer` | Full project analysis orchestration |
| `project-docs` | Project-specific documentation mapping |
| `roadmap-manager` | Roadmap structure and execution |
| `sequential-thinking` | Structured problem-solving |
| `skill-reviewer` | Skill quality auditing (5 Killers checklist) |

## Command Reference by Trigger

| User says... | Command |
|---|---|
| "I want to build feature X" | `/feature-explore` or `/feature-plan` |
| "There's a bug in..." | `/bug-investigate` |
| "Fix this issue" | `/bug-fix` |
| "Create a PR" | `/create-pr` |
| "CI is failing" | `/fix-ci` |
| "Run quality checks" | `/quality-fix` |
| "What's the status of this module?" | `/module-explore` |
| "Document this area" | `/context-create` |
| "Where was I?" | `/agent-handoff` (start fresh chat with context) |
| "Clean up agent docs" | `/agents-audit` |
| "I need to customize a skill" | `/override-create` |
| "Test a local package" | `/package-test` |
| "Remove local package link" | `/package-reset` |

## Related

- **Context:** `augment-infrastructure.md` — directory structure overview
- **Context:** `override-system.md` — how to customize skills/commands
- **Context:** `documentation-hierarchy.md` — where docs live

