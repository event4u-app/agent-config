# Installation

**Principle:** Project-installed by default, plugin-enhanced when available.
No Task, no Make, no build tools required for installation.

| Mode | Best for | Scope |
|---|---|---|
| **Project-installed** (recommended) | Teams, shared standards | Repository-wide |
| **Plugin-installed** | Individual users, global use | User-wide |

---

## Project-installed mode (recommended for teams)

Install once in the project — available to everyone working on it.
The package is versioned with the project. Settings are committed once.

### Composer (PHP projects)

```bash
composer require --dev event4u/agent-config
```

The `postinstall` hook runs `scripts/install.sh` automatically via `setup.sh`.

Then generate the project bridge files:

```bash
php vendor/bin/install.php
```

Or with a specific profile:

```bash
php vendor/bin/install.php --profile=balanced
```

### npm (JavaScript/TypeScript projects)

```bash
npm install --save-dev @event4u/agent-config
```

The `postinstall` hook runs `scripts/install.sh` automatically.

### Generate bridge files (PHP installer)

The PHP installer creates `.agent-settings` and tool-specific bridge files:

```bash
php vendor/bin/install.php                        # defaults to profile=minimal
php vendor/bin/install.php --profile=balanced      # specific profile
php vendor/bin/install.php --force                 # overwrite existing files
php vendor/bin/install.php --skip-bridges          # only create .agent-settings
```

This creates:
- `.agent-settings` — profile configuration
- `.vscode/settings.json` — VS Code/Copilot plugin discovery
- `.augment/settings.json` — Augment plugin activation
- `.github/plugin/marketplace.json` — Copilot CLI marketplace

No Task, no Make, no build tools required. Just PHP (which you already have).

### What happens after install

`install.sh` creates project-local content for all supported tools:
- `.augment/rules/`, `.augment/skills/`, `.augment/commands/` — for Augment
- `.cursor/rules/` — for Cursor
- `.clinerules/` — for Cline
- `.windsurfrules` — for Windsurf
- `.claude/rules/`, `.claude/skills/` — for Claude Code
- `AGENTS.md`, `GEMINI.md` — for Copilot and Gemini CLI
- `.github/copilot-instructions.md` — for GitHub Copilot

This means: **every developer who opens the project gets the same agent behavior,
regardless of which AI tool they use.** No per-developer plugin installation needed.

### What the team commits

After initial setup, commit these files:

```
.agent-settings                    ← shared profile (e.g., profile=minimal)
.augment/                          ← rules, skills, commands (symlinks)
.cursor/rules/                     ← Cursor rules (symlinks)
.claude/                           ← Claude rules, skills (symlinks)
AGENTS.md                          ← Copilot/Gemini instructions
.github/copilot-instructions.md   ← GitHub Copilot instructions
```

New team members: run `composer install` (or `npm install`) → open editor → done.

---

## Plugin-installed mode (optional, for individual use)

Install directly in your agent for global, cross-project use.
This is additional to project-installed mode, not a replacement.

### Augment CLI

```bash
auggie plugin install governed-agent-system@event4u-agent-config
```

### Claude Code

```bash
claude plugin install governed-agent-system@event4u-agent-config
```

### Copilot CLI

```bash
copilot plugin install governed-agent-system@event4u-agent-config
```

### When to use plugin mode

- You want agent-config behavior in ALL projects (not just one)
- You want auto-updates via marketplace
- You want plugin-specific features (hooks, MCP servers)

### Team auto-setup for plugins

To auto-recommend the plugin for your team, add the marketplace to project settings.
See [`templates/consumer-settings/`](../templates/consumer-settings/) for ready-to-use config templates per tool.

For marketplace registration (required once before `plugin install`):

```bash
# Augment CLI
auggie plugin marketplace add event4u-app/agent-config

# Claude Code
claude plugin marketplace add event4u-app/agent-config

# Copilot CLI
copilot plugin marketplace add event4u-app/agent-config
```

---

## Alternative install methods

These are fallbacks when the recommended paths above don't work.

### Git Submodule

```bash
git submodule add git@github.com:event4u-app/agent-config.git .agent-config
bash .agent-config/scripts/install.sh --target .
```

### Manual

```bash
bash path/to/agent-config/scripts/install.sh --target /path/to/your/project
```

### Install from Git URL (VS Code / Copilot)

VS Code can install plugins directly from a Git repository URL.
Point it to `https://github.com/event4u-app/agent-config`.

> **Note:** `.augment/` content depends on the package manager having been executed.
> After a fresh clone, run `composer install` or `npm install` first.

---

## After installation: choose a profile

The system works immediately with sensible defaults. Optionally, create `.agent-settings`
to choose a profile:

```ini
profile=minimal
```

| Profile | What's active | For whom |
|---|---|---|
| `minimal` (default) | Rules + Skills only, zero overhead | New users, solo devs |
| `balanced` | + Runtime, limited observability | Most teams |
| `full` | + Tool audit, lifecycle reports | Platform teams |
| `enterprise` | + Strict governance, max reporting | Large teams |

No profile configured = `minimal` behavior. → [Full profile details](customization.md)

---

## First test

After installation, try these 3 prompts with your agent:

1. `"Refactor this function"` → agent should analyze first, not jump into code
2. `"Add caching to this"` → agent should ask clarifying questions
3. `"Implement this feature"` → agent should respect your existing codebase

If the agent behaves differently than before — it's working.

**Optional:** Run `task first-run` for a guided walkthrough (requires [Task](https://taskfile.dev/)).

→ [Full getting started guide](getting-started.md)

---

## How install.sh works

### Hybrid sync strategy

| Directory | Method | Reason |
|---|---|---|
| `.augment/rules/` | **Copy** | Augment Code cannot load symlinked rules |
| Everything else | **Symlink** | Auto-updates on package update, saves disk |

### What gets created

```
your-project/
├── .augment/
│   ├── rules/          ← copies (Augment Code requirement)
│   ├── skills/         ← symlinks → package
│   ├── commands/       ← symlinks → package
│   ├── guidelines/     ← symlinks → package
│   ├── templates/      ← symlinks → package
│   └── contexts/       ← symlinks → package
├── .claude/
│   ├── rules/          ← symlinks → .augment/rules/
│   └── skills/         ← symlinks → .augment/skills/
├── .cursor/rules/      ← symlinks → .augment/rules/
├── .clinerules/        ← symlinks → .augment/rules/
├── .windsurfrules      ← generated (concatenated rules)
├── GEMINI.md           ← symlink → AGENTS.md
└── AGENTS.md           ← project-specific (copied if missing)
```

### CLI options

```
bash scripts/install.sh [OPTIONS]

Options:
  --source <dir>   Package source directory (default: auto-detect)
  --target <dir>   Target project root (default: $PROJECT_ROOT or cwd)
  --dry-run        Show what would happen without making changes
  --verbose        Show detailed output
  --quiet          Suppress all output except errors
```
