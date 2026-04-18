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

After installing the package, run the bridge installer to create
`.agent-settings`, `.vscode/settings.json`, `.augment/settings.json`, and the
tool-specific glue:

```bash
# PHP / Composer projects — explicit step (Composer does not auto-run it):
php vendor/bin/install.php
# or directly (any environment):
python3 vendor/event4u/agent-config/scripts/install.py

# npm projects run the installer automatically via postinstall.
# To re-run or override the default profile:
python3 node_modules/@event4u/agent-config/scripts/install.py --profile=balanced
```

**To install the package:** no Task, no Make, no build tools required — only
**Python 3** (stdlib only, pre-installed on macOS 12.3+ and all major Linux
distros). The package makes rules, skills, and commands available
project-locally for all supported AI tools. Task is required for
*contributors* who want to rebuild the compressed content locally — see
[CONTRIBUTING.md](CONTRIBUTING.md).

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

## What your agent is asked to do

The package ships rules and skills that guide the agent toward these
behaviors. The agent still decides in the moment, so the table is a
description of intent — not a guarantee of output.

| Default behavior | With agent-config (the agent is instructed to) |
|---|---|
| Guess and edit blindly | Analyze code before changing it — no blind edits |
| Drift from project conventions | Follow the project's PHP/Laravel coding standards |
| Skip or invent tests | Write Pest tests following the project's conventions |
| Write generic commit messages | Use Conventional Commits with scope and Jira links |
| Skip quality checks | Run PHPStan, Rector, ECS and fix reported errors |
| Open PRs without context | Produce structured PR descriptions from Jira tickets |
| Claim "done" without proof | Verify with real execution before claiming "done" |

---

## You don't need everything

Start with **Rules + Skills**. Everything else is optional.

| Mode | What's active | Token overhead |
|---|---|---|
| **Minimal** (default) | Rules, Skills, Commands | Zero |
| **Balanced** | + Runtime scaffolding, local data collection (experimental) | Low |
| **Full** | + Reports, suggestions in chat, CI summaries (experimental) | Moderate |

Nothing runs automatically without your control. [Configure modes →](docs/customization.md)

> **Experimental modules:** the runtime, tool-adapter, and observability
> layers are scaffold implementations — structure, data model, and tests
> exist, but most operations are no-ops by design. The `minimal` profile
> (which 99% of users should pick) is unaffected.

---

## Who this is for

The content is **built for PHP / Laravel teams** and is where the package
is most useful out of the box. Skills, rules, and quality-tool integration
assume a Laravel-style repository (Pest, PHPStan, Rector, ECS, Artisan,
Composer workflows). You can install it on any project, but:

| Stack | Fit |
|---|---|
| **Laravel / modern PHP** | ✅ Primary audience — most skills apply directly |
| **Other PHP frameworks** (Symfony, Zend/Laminas) | ☑️ Deep-analysis skills apply; framework-specific ones do not |
| **JavaScript / TypeScript / Next.js / Node** | ☑️ General skills + governance apply; PHP-specific skills are noise |
| **Other stacks** | ⚠️ Cherry-pick rules/commands; expect to disable a lot |

A language-agnostic core is on the roadmap but not yet extracted. If you
adopt the package outside the primary audience, please open an issue so we
can prioritize the right skills for extraction.

---

## Featured Skills

| Skill | What your agent learns |
|---|---|
| [`laravel`](.agent-src/skills/laravel/SKILL.md) | Write Laravel code following framework conventions and project architecture |
| [`pest-testing`](.agent-src/skills/pest-testing/SKILL.md) | Write Pest tests with clear intent, good coverage, and project conventions |
| [`eloquent`](.agent-src/skills/eloquent/SKILL.md) | Eloquent models, relationships, scopes, eager loading, type safety |
| [`create-pr`](.agent-src/commands/create-pr.md) | Create GitHub PRs with structured descriptions from Jira tickets |
| [`commit`](.agent-src/commands/commit.md) | Stage and commit changes following Conventional Commits |
| [`fix-ci`](.agent-src/commands/fix-ci.md) | Fetch CI errors from GitHub Actions and fix them |
| [`fix-pr-comments`](.agent-src/commands/fix-pr-comments.md) | Fix and reply to all open review comments on a PR |
| [`quality-fix`](.agent-src/commands/quality-fix.md) | Run PHPStan/Rector/ECS and fix all errors |
| [`bug-analyzer`](.agent-src/skills/bug-analyzer/SKILL.md) | Root cause analysis from Sentry errors or Jira tickets |
| [`improve-before-implement`](.agent-src/rules/improve-before-implement.md) | Challenge weak requirements before coding |
| [`docker`](.agent-src/skills/docker/SKILL.md) | Dockerfile, docker-compose, container management |
| [`security`](.agent-src/skills/security/SKILL.md) | Auth, policies, CSRF, rate limiting, secure coding |
| [`api-design`](.agent-src/skills/api-design/SKILL.md) | REST conventions, versioning, deprecation |
| [`database`](.agent-src/skills/database/SKILL.md) | MariaDB optimization, indexing, query performance |

→ [Browse all skills](docs/skills-catalog.md) · [llms.txt](llms.txt)

---

## Featured Commands

| Command | What it does |
|---|---|
| [`/commit`](.agent-src/commands/commit.md) | Stage and commit with Conventional Commits |
| [`/create-pr`](.agent-src/commands/create-pr.md) | Create PR with Jira-linked description |
| [`/fix-ci`](.agent-src/commands/fix-ci.md) | Fetch and fix GitHub Actions failures |
| [`/fix-pr-comments`](.agent-src/commands/fix-pr-comments.md) | Fix and reply to review comments |
| [`/quality-fix`](.agent-src/commands/quality-fix.md) | Run and fix all quality checks |
| [`/review-changes`](.agent-src/commands/review-changes.md) | Self-review before creating a PR |
| [`/jira-ticket`](.agent-src/commands/jira-ticket.md) | Read ticket from branch, implement feature |
| [`/compress`](.agent-src/commands/compress.md) | Compress skills for token efficiency |

→ [Browse all 51 commands](.agent-src/commands/)

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

✅ = native support &nbsp; — = not available &nbsp; ☑️ = text reference only
(commands are listed in `AGENTS.md`, but the tool cannot invoke them as
native slash-commands)

> **What this means in practice:** Augment Code and Claude Code get the full
> package (rules + 93 skills + 51 native commands). Cursor, Cline, Windsurf,
> Gemini CLI, and GitHub Copilot only get the **rules** natively; skills and
> commands are available to them as documentation the agent can read, not as
> first-class features.

### Plugin-installed (optional, for global use)

Works across all your projects. Auto-updates via marketplace.

| Tool | Rules | Skills | Commands | Install |
|---|---|---|---|---|
| **Augment CLI** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#augment-cli) |
| **Claude Code** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#claude-code) |
| **Copilot CLI** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#copilot-cli) |

Skills use a `SKILL.md` format with YAML frontmatter that is compatible with
the [Agent Skills](https://agentskills.io) community spec and with Claude
Code's Agent Skills specification.

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

Edit in `.agent-src.uncompressed/`, compress, verify:

```bash
task sync          # Sync non-.md files
task ci            # Run all CI checks
task test          # Run all tests
task lint-skills   # Lint skills, rules, commands
```

→ Full commands and project structure: [**docs/development.md**](docs/development.md)

## Requirements

**To install the package into a consumer project:**

- **Python 3.10+** — canonical installer is `scripts/install.py`.
  Pre-installed on macOS 12.3+ and all major Linux distros.
- **Bash** — thin wrappers (`scripts/install.sh`, `scripts/postinstall.sh`)
  around the Python installer. Available on macOS, Linux, and WSL.
- **Composer or npm** — to pull the package itself.

**Platform support:**

| Platform | Status |
|---|---|
| macOS 12.3+ | ✅ Supported |
| Linux (modern distros) | ✅ Supported |
| Windows (WSL2) | ✅ Supported |
| Windows (Git Bash) | ⚠️ Works; symlinks need Developer Mode |
| Windows (native PowerShell/cmd) | ❌ Not supported |

**For contributors only** (rebuilding `.augment/` locally):

- [Task](https://taskfile.dev/) — runs the CI pipeline (`task ci`).
- No runtime dependencies — the package ships static markdown files.

## License

[MIT](LICENSE) — you can use, fork, and redistribute this freely.
