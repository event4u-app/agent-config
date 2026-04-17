# Installation

## Plugin (recommended for CLI tools)

The package works as a native plugin for **Augment CLI**, **Claude Code**, and **Copilot CLI**.
No file copying needed — the plugin system handles loading and auto-updating.

### Augment CLI

```bash
auggie plugin marketplace add event4u-app/agent-config
auggie plugin install governed-agent-system@event4u-agent-config
```

### Claude Code

```bash
claude plugin marketplace add event4u-app/agent-config
claude plugin install governed-agent-system@event4u-agent-config
```

### Copilot CLI

```bash
copilot plugin marketplace add event4u-app/agent-config
copilot plugin install governed-agent-system@event4u-agent-config
```

### Team auto-setup

To auto-recommend the plugin for your team, add the marketplace to your project settings.
See [`templates/consumer-settings/`](../templates/consumer-settings/) for ready-to-use config templates.

> **Note:** Cursor, Cline, Windsurf, and Augment VSCode/IntelliJ do not support plugins yet.
> Use `install.sh` below.

---

## Composer (PHP projects)

```bash
composer require --dev event4u/agent-config

# One-time setup: adds post-install/update hooks
bash vendor/event4u/agent-config/scripts/setup.sh
```

After setup, `install.sh` runs automatically on every `composer install` / `composer update`.
The setup script is **idempotent** and auto-detects a JSON tool (`php → node → jq → python3`).

## npm (JavaScript/TypeScript projects)

```bash
npm install @event4u/agent-config
```

The `postinstall` hook runs `scripts/install.sh` automatically.

## Git Submodule

```bash
git submodule add git@github.com:event4u-app/agent-config.git .agent-config
bash .agent-config/scripts/install.sh --target .
```

## Manual

```bash
bash path/to/agent-config/scripts/install.sh --target /path/to/your/project
```

> **Note:** `.augment/` content depends on `composer install` / `npm install` having been executed.
> After a fresh clone, run your package manager before expecting agent tools to work.

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
