# {{project_name}}

<!--
  AGENTS.md — entry point for AI coding agents working on this project.

  This file was installed by `event4u/agent-config` as a starting template.
  Fill in the placeholders below (or run `/copilot-agents-init` to do it
  interactively) and then delete this HTML comment.

  Keep it short. Detailed conventions belong in `.augment/` (read-only from
  the shared package) or in `agents/overrides/` (project-specific).
-->

{{project_description}}

## Agent Infrastructure

| Layer | Location | Purpose |
|---|---|---|
| **Shared package** | `.augment/` | Skills, rules, commands, guidelines, templates — read-only |
| **Project overrides** | `agents/overrides/` | Customizations of shared resources |
| **Project docs** | `agents/` | Architecture, features, roadmaps, sessions, contexts |
| **Agent settings** | `.agent-settings` | Project-specific config consumed by skills |

### Key References

| What | Where |
|---|---|
| Behavior rules (always active) | `.augment/rules/` |
| Coding guidelines | `.augment/guidelines/` |
| Skills (on-demand expertise) | `.augment/skills/` |
| Commands (workflows) | `.augment/commands/` |
| Copilot instructions | `.github/copilot-instructions.md` |

### Multi-Agent Support

| Tool | Rules | Skills | How |
|---|---|---|---|
| **Augment Code** | `.augment/rules/` | `.augment/skills/` | Native (source) |
| **Claude Code** | `.claude/rules/` | `.claude/skills/` | Symlinks + Agent Skills standard |
| **Cursor** | `.cursor/rules/` | — | Symlinks |
| **Cline** | `.clinerules/` | — | Symlinks |
| **Windsurf** | `.windsurfrules` | — | Concatenated file |
| **Gemini CLI** | `GEMINI.md` | — | Symlink → AGENTS.md |

Regenerate: `task generate-tools` · Clean: `task clean-tools`
(Requires the `task` binary; see https://taskfile.dev if missing.)

---

## Tech Stack

<!-- Replace with your actual stack. Examples:
  - Framework: Laravel 11 (PHP ^8.2) / Next.js 15 / Rails 7 / Django 5
  - Database: PostgreSQL / MySQL / MariaDB / SQLite
  - Queue: Redis / RabbitMQ / SQS
  - Testing: Pest / PHPUnit / Jest / Vitest / pytest
  - Code style / linters: ECS / PHPStan / Ruff / ESLint
-->

- **Language:** {{primary_language}}
- **Framework:** {{framework}}
- **Database:** {{database}}
- **Testing:** {{test_framework}}
- **Code style:** {{code_style_tool}}

---

## Development Setup

<!-- Replace with your project's actual setup commands. Examples:
  - `make start` / `make console` / `make test`
  - `docker compose up` / `docker compose exec app bash`
  - `npm run dev` / `npm test`
  - `php artisan serve` / `php artisan test`
-->

```bash
{{dev_start_command}}
{{dev_test_command}}
```

### Environment files

| File | Purpose |
|---|---|
| `.env` | Main environment |
| `.env.local` | Local overrides |
| `.env.testing` | Testing environment |

---

## Project Structure

<!-- Document your directory conventions:
  - Where new features go
  - Module/component boundaries
  - Namespace conventions
-->

{{project_structure_notes}}

---

## Testing

<!-- Document:
  - Test framework and its quirks
  - How to run all tests / targeted tests
  - Test data strategy (seeders, factories, fixtures)
  - Performance-critical tests or suites
-->

{{testing_notes}}

---

## Quality Tools

<!-- Document:
  - Which linters/formatters run
  - Whether they auto-fix or report only
  - CI enforcement level
-->

{{quality_tools_notes}}

---

## Additional Documentation

| Document | Topic |
|---|---|
| `.github/copilot-instructions.md` | Coding standards for GitHub Copilot (self-contained) |
| `agents/` | Project-specific architecture docs and roadmaps |
| `.augment/contexts/` | Shared cross-cutting concepts from the package |
| `.agent-settings` | Project-specific agent configuration |
