# event4u/agent-config

**A governed AI development layer** — skills, rules, commands, guidelines, and templates for AI coding agents.

> A governed, observable, self-improving agent configuration system with safe evolution paths.

Observable quality scoring, compression preservation guards, feedback-driven improvement loops,
and safe optimization commands — not just a prompt collection, but a framework that evolves safely at scale.

Works with **Augment Code**, **Claude Code**, **Cursor**, **Cline**, **Windsurf**, and **Gemini CLI**.

## Installation

### Composer (PHP projects)

```bash
composer require --dev event4u/agent-config

# One-time setup: adds post-install/update hooks to your composer.json
bash vendor/event4u/agent-config/scripts/setup.sh
```

After setup, `install.sh` runs automatically on every `composer install` / `composer update`.

The setup script is **idempotent** — safe to run multiple times. It auto-detects a JSON tool (`php → node → jq → python3`).

> **Note:** `.augment/` content (rules, skills, commands) depends on `composer install` / `npm install` having been executed. After a fresh clone, run your package manager before expecting agent tools to work. CI pipelines should install dependencies before any agent-related steps.

### npm (JavaScript/TypeScript projects)

```bash
npm install @event4u/agent-config
```

The `postinstall` hook automatically runs `scripts/install.sh` to sync configuration.

### Git Submodule

```bash
git submodule add git@github.com:event4u-app/agent-config.git .agent-config
bash .agent-config/scripts/install.sh --target .
```

### Manual

```bash
bash path/to/agent-config/scripts/install.sh --target /path/to/your/project
```

Or with environment variable:

```bash
PROJECT_ROOT=/path/to/your/project bash path/to/agent-config/scripts/install.sh
```

## How It Works

The installer performs a **hybrid sync** of the `.augment/` directory:

| Directory | Method | Reason |
|---|---|---|
| `.augment/rules/` | **Copy** | Augment Code cannot load symlinked rules |
| Everything else | **Symlink** | Auto-updates on package update, saves disk |

Additionally:
- Creates tool-specific symlinks (`.claude/rules/`, `.cursor/rules/`, `.clinerules/`)
- Creates skill symlinks (`.claude/skills/`)
- Generates `.windsurfrules` (concatenated rules, stripped frontmatter)
- Creates `GEMINI.md` → `AGENTS.md` symlink
- Manages `.gitignore` entries for symlinked directories

## install.sh Options

```
bash scripts/install.sh [OPTIONS]

Options:
  --source <dir>   Package source directory (default: auto-detect)
  --target <dir>   Target project root (default: $PROJECT_ROOT or cwd)
  --dry-run        Show what would happen without making changes
  --verbose        Show detailed output
  --quiet          Suppress all output except errors
  --help           Show help
```

## What Gets Created

```
your-project/
├── .augment/
│   ├── rules/          ← real copies
│   ├── skills/         ← symlinks → vendor/.../skills/
│   ├── commands/       ← symlinks → vendor/.../commands/
│   ├── guidelines/     ← symlinks → vendor/.../guidelines/
│   └── ...
├── .claude/
│   ├── rules/          ← symlinks → .augment/rules/
│   └── skills/         ← symlinks → .augment/skills/
├── .cursor/
│   └── rules/          ← symlinks → .augment/rules/
├── .clinerules/        ← symlinks → .augment/rules/
├── .windsurfrules      ← generated file
├── GEMINI.md           ← symlink → AGENTS.md
└── AGENTS.md           ← copied (if missing)
```

## Development

### Running Tests

```bash
# All tests
task test

# Install script tests only (bash)
task test-install

# Compress script tests only (Python)
task test-python
```

### Regenerating Tool Directories

After editing files in `.augment.uncompressed/`:

```bash
task sync              # Sync to .augment/
task generate-tools    # Regenerate .claude/, .cursor/, etc.
```

## Supported AI Tools

| Tool | Rules | Skills | How |
|---|---|---|---|
| Augment Code | `.augment/rules/` | `.augment/skills/` | Native (source of truth) |
| Claude Code | `.claude/rules/` | `.claude/skills/` | Symlinks |
| Cursor | `.cursor/rules/` | — | Symlinks |
| Cline | `.clinerules/` | — | Symlinks |
| Windsurf | `.windsurfrules` | — | Concatenated file |
| Gemini CLI | `GEMINI.md` | — | Symlink → AGENTS.md |
