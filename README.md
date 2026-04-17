# Agent Config — Governed Agent System

Teach your AI agents Laravel, PHP, testing, Git workflows, and **90+ more skills** — with quality guardrails built in.

> Your agent learns to write Laravel code, run tests, create PRs, fix CI — and follows your team's coding standards while doing it.

<p align="center">
  <strong>93 Skills</strong> · <strong>31 Rules</strong> · <strong>51 Commands</strong> · <strong>34 Guidelines</strong> · <strong>8 AI Tools</strong>
</p>

---

## Installation

### For teams (recommended)

Install once in the project — available to everyone who works on it:

```bash
# PHP
composer require --dev event4u/agent-config

# JavaScript/TypeScript
npm install --save-dev @event4u/agent-config
```

Then generate project bridge files (optional but recommended):

```bash
php vendor/bin/install.php                    # minimal profile (default)
php vendor/bin/install.php --profile=balanced  # for teams
```

No Task, no Make, no build tools required. The package makes rules, skills, and commands
available project-locally for all supported AI tools.

### For individual use (optional)

Install directly in your agent for global, cross-project use:

| Tool | Install |
|---|---|
| **Augment CLI** | `auggie plugin install agent-config@event4u` |
| **Claude Code** | `claude plugin install agent-config@event4u` |
| **Copilot CLI** | `copilot plugin install agent-config@event4u` |

→ [All install options & project bridge setup](docs/installation.md)

**Open your agent and try these 3 prompts:**

1. `"Refactor this function"` → watch: agent analyzes first
2. `"Add caching to this"` → watch: agent asks instead of guessing
3. `"Implement this feature"` → watch: agent respects your codebase

→ [Full getting started guide](docs/getting-started.md)

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

### Project-installed (Composer / npm)

Every developer gets the same behavior. No per-user setup needed.

| Tool | Rules | Skills | Commands | How it works |
|---|---|---|---|---|
| **Augment VSCode/IntelliJ** | ✅ | ✅ | ✅ | Reads `.augment/` from project |
| **Claude Code** | ✅ | ✅ | ✅ | Reads `.claude/` (skills + commands as skills) |
| **Cursor** | ✅ | — | ☑️ | Reads `.cursor/rules/` + commands via AGENTS.md |
| **Cline** | ✅ | — | ☑️ | Reads `.clinerules/` + commands via AGENTS.md |
| **Windsurf** | ✅ | — | ☑️ | Reads `.windsurfrules` + commands via AGENTS.md |
| **Gemini CLI** | ✅ | — | ☑️ | Reads `GEMINI.md` (includes commands reference) |
| **GitHub Copilot** | ✅ | — | ☑️ | Reads `.github/copilot-instructions.md` (includes commands) |

✅ = native support &nbsp; ☑️ = via documentation (AGENTS.md)

### Plugin-installed (optional, for global use)

Works across all your projects. Auto-updates via marketplace.

| Tool | Rules | Skills | Commands | Install |
|---|---|---|---|---|
| **Augment CLI** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#augment-cli) |
| **Claude Code** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#claude-code) |
| **Copilot CLI** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#copilot-cli) |

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
| [**Getting Started**](docs/getting-started.md) | First run, 3-test experience, profiles, next steps |
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
