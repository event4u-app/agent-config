# Agent Config — Governed Agent System

Teach your AI agents Laravel, PHP, testing, Git workflows, and **90+ more skills** — with quality guardrails built in.

> Your agent learns to write Laravel code, run tests, create PRs, fix CI — and follows your team's coding standards while doing it.

<p align="center">
  <strong>93 Skills</strong> · <strong>31 Rules</strong> · <strong>51 Commands</strong> · <strong>34 Guidelines</strong> · <strong>8 AI Tools</strong>
</p>

---

## Quickstart

Two minutes from `composer require` to a better-behaved agent.

### For teams (recommended)

Install once in the project — available to everyone who works on it:

```bash
# PHP
composer require --dev event4u/agent-config

# JavaScript/TypeScript
npm install --save-dev @event4u/agent-config
```

Bridge files (`.agent-settings`, `.vscode/settings.json`, `.augment/settings.json`, …)
are generated automatically by the post-install hook. To re-run or pick a profile:

```bash
python3 scripts/install.py --profile=balanced   # any environment
php vendor/bin/install.php --profile=balanced   # PHP wrapper (Composer)
```

No Task, no Make, no build tools required — only **Python 3** (stdlib only, pre-installed
on macOS 12.3+ and all major Linux distros). The package makes rules, skills, and commands
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

## What your agent learns

| Without agent-config | With agent-config |
|---|---|
| Guesses and edits blindly | Analyzes code before changing it — no blind edits |
| Inconsistent code style | Follows your PHP/Laravel coding standards |
| Skips or invents tests | Writes Pest tests following your project conventions |
| Generic commit messages | Conventional Commits with scope and Jira links |
| No quality checks | Runs PHPStan, Rector, ECS — fixes errors automatically |
| PRs without context | Structured PR descriptions from Jira tickets |
| Claims "done" without proof | Verifies with real execution before claiming "done" |

---

## You don't need everything

Start with **Rules + Skills**. Everything else is optional.

| Mode | What's active | Token overhead |
|---|---|---|
| **Minimal** (default) | Rules, Skills, Commands | Zero |
| **Balanced** | + Runtime execution, local data collection | Low |
| **Full** | + Reports, suggestions in chat, CI summaries | Moderate |

Nothing runs automatically without your control. [Configure modes →](docs/customization.md)

---

## Featured Skills

| Skill | What your agent learns |
|---|---|
| [`laravel`](.augment/skills/laravel/SKILL.md) | Write Laravel code following framework conventions and project architecture |
| [`pest-testing`](.augment/skills/pest-testing/SKILL.md) | Write Pest tests with clear intent, good coverage, and project conventions |
| [`eloquent`](.augment/skills/eloquent/SKILL.md) | Eloquent models, relationships, scopes, eager loading, type safety |
| [`create-pr`](.augment/commands/create-pr.md) | Create GitHub PRs with structured descriptions from Jira tickets |
| [`commit`](.augment/commands/commit.md) | Stage and commit changes following Conventional Commits |
| [`fix-ci`](.augment/commands/fix-ci.md) | Fetch CI errors from GitHub Actions and fix them |
| [`fix-pr-comments`](.augment/commands/fix-pr-comments.md) | Fix and reply to all open review comments on a PR |
| [`quality-fix`](.augment/commands/quality-fix.md) | Run PHPStan/Rector/ECS and fix all errors |
| [`bug-analyzer`](.augment/skills/bug-analyzer/SKILL.md) | Root cause analysis from Sentry errors or Jira tickets |
| [`improve-before-implement`](.augment/rules/improve-before-implement.md) | Challenge weak requirements before coding |
| [`docker`](.augment/skills/docker/SKILL.md) | Dockerfile, docker-compose, container management |
| [`security`](.augment/skills/security/SKILL.md) | Auth, policies, CSRF, rate limiting, secure coding |
| [`api-design`](.augment/skills/api-design/SKILL.md) | REST conventions, versioning, deprecation |
| [`database`](.augment/skills/database/SKILL.md) | MariaDB optimization, indexing, query performance |

→ [Browse all skills](docs/skills-catalog.md) · [llms.txt](llms.txt)

---

## Featured Commands

| Command | What it does |
|---|---|
| [`/commit`](.augment/commands/commit.md) | Stage and commit with Conventional Commits |
| [`/create-pr`](.augment/commands/create-pr.md) | Create PR with Jira-linked description |
| [`/fix-ci`](.augment/commands/fix-ci.md) | Fetch and fix GitHub Actions failures |
| [`/fix-pr-comments`](.augment/commands/fix-pr-comments.md) | Fix and reply to review comments |
| [`/quality-fix`](.augment/commands/quality-fix.md) | Run and fix all quality checks |
| [`/review-changes`](.augment/commands/review-changes.md) | Self-review before creating a PR |
| [`/jira-ticket`](.augment/commands/jira-ticket.md) | Read ticket from branch, implement feature |
| [`/compress`](.augment/commands/compress.md) | Compress skills for token efficiency |

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
- **Zero overhead by default** — nothing runs until you ask for it

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
