# Agent Config — Governed Agent System

Teach your AI agents Laravel, PHP, testing, Git workflows, and **90+ more skills** — with quality guardrails built in.

> Your agent learns to write Laravel code, run tests, create PRs, fix CI — and follows your team's coding standards while doing it.

<p align="center">
  <strong>93 Skills</strong> · <strong>31 Rules</strong> · <strong>51 Commands</strong> · <strong>34 Guidelines</strong> · <strong>8 AI Tools</strong>
</p>

---

## Installation

```bash
# Composer (PHP)
composer require --dev event4u/agent-config
bash vendor/event4u/agent-config/scripts/setup.sh

# npm (JavaScript/TypeScript)
npm install @event4u/agent-config
```

Done. Your agent now follows your team's standards. [More install options →](docs/installation.md)

---

## How it works

| Without agent-config | With agent-config |
|---|---|
| Agent guesses and edits blindly | Analyzes code before changing it |
| Inconsistent code style | Follows your PHP/Laravel coding standards |
| Generic commit messages | Conventional Commits with scope and Jira links |
| No quality checks | Runs PHPStan, Rector, ECS — fixes errors automatically |
| PRs without context | Structured PR descriptions from Jira tickets |
| No verification | Verifies with real execution before claiming "done" |

---

## You don't need everything

Start with **Rules + Skills**. Everything else is optional.

| Mode | What's active | Token overhead |
|---|---|---|
| **Minimal** (default) | Rules, Skills, Commands | Zero |
| **Balanced** | + Runtime, limited observability | Low |
| **Full** | + Feedback, lifecycle, metrics | Moderate |

Nothing runs automatically without your control. [Configure modes →](docs/customization.md)

---

## Featured Skills

| Skill | What your agent learns |
|---|---|
| `laravel` | Write Laravel code following framework conventions and project architecture |
| `pest-testing` | Write Pest tests with clear intent, good coverage, and project conventions |
| `eloquent` | Eloquent models, relationships, scopes, eager loading, type safety |
| `create-pr` | Create GitHub PRs with structured descriptions from Jira tickets |
| `commit` | Stage and commit changes following Conventional Commits |
| `fix-ci` | Fetch CI errors from GitHub Actions and fix them |
| `fix-pr-comments` | Fix and reply to all open review comments on a PR |
| `quality-fix` | Run PHPStan/Rector/ECS and fix all errors |
| `bug-analyzer` | Root cause analysis from Sentry errors or Jira tickets |
| `improve-before-implement` | Challenge weak requirements before coding |
| `docker` | Dockerfile, docker-compose, container management |
| `security` | Auth, policies, CSRF, rate limiting, secure coding |
| `api-design` | REST conventions, versioning, deprecation |
| `database` | MariaDB optimization, indexing, query performance |

→ [Browse all 93 skills](.augment/skills/)

---

## Featured Commands

| Command | What it does |
|---|---|
| `/commit` | Stage and commit with Conventional Commits |
| `/create-pr` | Create PR with Jira-linked description |
| `/fix-ci` | Fetch and fix GitHub Actions failures |
| `/fix-pr-comments` | Fix and reply to review comments |
| `/quality-fix` | Run and fix all quality checks |
| `/review-changes` | Self-review before creating a PR |
| `/jira-ticket` | Read ticket from branch, implement feature |
| `/compress` | Compress skills for token efficiency |

→ [Browse all 51 commands](.augment/commands/)

---

## Supported Tools

| Tool | Rules | Skills | Commands | Plugin | Method |
|---|---|---|---|---|---|
| **Augment CLI** | ✅ | ✅ | ✅ | ✅ | Plugin (recommended) |
| **Claude Code** | ✅ | ✅ | ✅ | ✅ | Plugin (recommended) |
| **Copilot CLI** | ✅ | ✅ | ✅ | ✅ | Plugin (recommended) |
| **Augment VSCode/IntelliJ** | ✅ | ✅ | ✅ | — | install.sh |
| **Cursor** | ✅ | — | — | — | install.sh |
| **Cline** | ✅ | — | — | — | install.sh |
| **Windsurf** | ✅ | — | — | — | install.sh |
| **Gemini CLI** | ✅ | — | — | — | install.sh |

Skills follow the [Agent Skills open standard](https://agentskills.io).

---

## Core Principles

- **Analyze before implementing** — no guessing, no blind edits
- **Verify with real execution** — no "should work"
- **Challenge to improve** — agents are thought partners, not yes-machines
- **Strict by design** — quality over flexibility
- **Zero overhead by default** — data collection ≠ context injection

---

## Documentation

| Document | Content |
|---|---|
| [**Installation**](docs/installation.md) | Plugin setup, Composer/npm, Git submodule, install.sh details |
| [**Architecture**](docs/architecture.md) | System layers, content pipeline, tool support matrix |
| [**Development**](docs/development.md) | Prerequisites, editing workflow, all `task` commands, project structure |
| [**Customization**](docs/customization.md) | Overrides, AGENTS.md, agent settings, cost profiles |
| [**Quality & CI**](docs/quality.md) | Linting, CI pipeline, compression system, observability |

---

## Development

Edit in `.augment.uncompressed/`, compress, verify:

```bash
task sync          # Sync non-.md files
task ci            # Run all CI checks
task test          # Run all tests
task lint-skills   # Lint skills, rules, commands
```

→ Full commands and project structure: [**docs/development.md**](docs/development.md)

## Requirements

- **Bash** (install scripts)
- **Python 3.10+** (linter, compression tools)
- [Task](https://taskfile.dev/) (development only)

No runtime dependencies — static configuration files only.
