# Agent Config — Governed Agent System

A **policy-driven execution system** for AI agents that enforces quality, consistency, and developer-like behavior.

> Not just a collection of prompts — a governed skill framework with runtime execution, tooling, observability, and feedback.

<p align="center">
  <strong>93 Skills</strong> · <strong>31 Rules</strong> · <strong>51 Commands</strong> · <strong>34 Guidelines</strong> · <strong>8 AI Tools</strong>
</p>

---

## What's inside

| Layer | Count | What it does |
|---|---|---|
| **Rules** | 31 | Always-active behavior constraints |
| **Skills** | 93 | On-demand expertise (Laravel, testing, Docker, security, ...) |
| **Commands** | 51 | Slash-command workflows (`/commit`, `/create-pr`, `/fix-ci`, ...) |
| **Guidelines** | 34 | Coding guidelines by language and domain |
| **Runtime** | — | Execution pipeline, dispatcher, handlers, safety controls |
| **Tools** | — | GitHub + Jira adapters with structured responses |
| **Observability** | — | Metrics, events, feedback, lifecycle reports |

---

## Installation

### Quick start — Plugin install (recommended)

```bash
# Augment CLI
auggie plugin marketplace add event4u-app/agent-config
auggie plugin install governed-agent-system@event4u-agent-config

# Claude Code
claude plugin marketplace add event4u-app/agent-config
claude plugin install governed-agent-system@event4u-agent-config

# Copilot CLI
copilot plugin marketplace add event4u-app/agent-config
copilot plugin install governed-agent-system@event4u-agent-config
```

### Package manager install

```bash
# PHP (Composer)
composer require --dev event4u/agent-config
bash vendor/event4u/agent-config/scripts/setup.sh

# JavaScript (npm)
npm install @event4u/agent-config
```

→ Full details: [**docs/installation.md**](docs/installation.md)

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

## Architecture

```
.augment.uncompressed/       ← Source of truth (verbose)
    ↓ /compress
.augment/                    ← Compressed (token-efficient)
    ↓ Plugin / install.sh
Agent tools                  ← Rules, skills, commands loaded
```

→ Full details: [**docs/architecture.md**](docs/architecture.md)

---

## Core Principles

- **Analyze before implementing** — no guessing
- **Verify with real execution** — no "should work"
- **Challenge to improve, never to refuse** — agents are thought partners
- **Strict by design** — quality over flexibility
- **Data collection ≠ context injection** — zero token overhead by default

---

## Documentation

| Document | Content |
|---|---|
| [**Installation**](docs/installation.md) | Plugin setup, Composer/npm, Git submodule, install.sh details |
| [**Architecture**](docs/architecture.md) | System layers, content pipeline, what's inside, tool support |
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
