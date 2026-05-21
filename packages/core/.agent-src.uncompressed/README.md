# Agent Infrastructure

> **⚠️ DO NOT edit files in `.agent-src/` or `.augment/` directly.**
> The source of truth is `.agent-src.uncompressed/`. Edit there, then run `task sync`.
> See `.agent-src.uncompressed/commands/compress.md` for the full workflow.

This directory contains the shared agent infrastructure: skills, commands, rules, guidelines,
templates, and contexts that power the AI coding assistant across all projects.

In the package repo, this content lives in `.agent-src/` (shipped). Consumer projects install
it as `.augment/` (local projection).

## Directory Structure

```
├── commands/       # Slash commands — executable workflows (/fix-pr-comments, /agent-handoff, ...)
├── contexts/       # Background context documents for the agent
├── guidelines/     # Coding guidelines by language (reference material)
├── rules/          # Always-active behavior rules (auto-loaded every conversation)
├── skills/         # On-demand expertise (matched by topic)
└── templates/      # File templates for roadmaps, features, skills, etc.
```

## How It Works

| Layer | Always active? | Purpose |
|---|---|---|
| **Rules** | ✅ Yes | Behavior constraints — loaded every conversation |
| **Skills** | 🔄 On demand | Expertise — matched when the topic is relevant |
| **Commands** | ⚡ On trigger | Workflows — triggered by `/command-name` |
| **Guidelines** | 📖 Reference | Coding conventions — read when writing code |
| **Templates** | 📄 Blueprints | File structure templates for new documents |
| **Contexts** | 🧠 Background | System-level context about the infrastructure |

For full details see [augment-infrastructure.md](contexts/augment-infrastructure.md).

## Quick Reference

### Most-used commands

| Command | Purpose |
|---|---|
| `/agent-handoff` | Generate context summary for a fresh chat |
| `/fix-pr-comments` | Fix all open PR review comments |
| `/quality-fix` | Run PHPStan + Rector and fix errors |
| `/create-pr` | Create a GitHub PR with description |
| `/bug-investigate` | Investigate a bug from Jira/Sentry |
| `/tests-create` | Write tests for current changes |

### Key rules

| Rule | What it enforces |
|---|---|
| `verify-before-complete` | Must run tests/PHPStan before claiming "done" |
| `scope-control` | Don't commit/push without permission, no unasked changes |
| `token-efficiency` | Redirect output, don't narrate, trust ECS/Rector |
| `downstream-changes` | After every edit, update ALL callers, tests, imports |
| `php-coding` | Strict types, getters/setters, observers |

## Project-Level Overrides

Projects can override shared skills, rules, and commands via `agents/overrides/`.
See [override-system.md](contexts/override-system.md) for details.

