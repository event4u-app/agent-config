# Installation

**Principle:** Install natively, onboard optionally, explain later.
No Task, no Make, no build tools required for installation.

---

## Recommended: one command per tool

Each tool has **one recommended install path**. Pick yours:

### Augment CLI (plugin)

```bash
auggie plugin install governed-agent-system@event4u-agent-config
```

### Claude Code (plugin)

```bash
claude plugin install governed-agent-system@event4u-agent-config
```

### Copilot CLI (plugin)

```bash
copilot plugin install governed-agent-system@event4u-agent-config
```

### Composer (PHP projects)

```bash
composer require --dev event4u/agent-config
```

The `postinstall` hook runs `scripts/install.sh` automatically via `setup.sh`.
For first-time setup: `bash vendor/event4u/agent-config/scripts/setup.sh`

### npm (JavaScript/TypeScript projects)

```bash
npm install @event4u/agent-config
```

The `postinstall` hook runs `scripts/install.sh` automatically.

### Cursor / Cline / Windsurf / Gemini CLI / Augment VSCode

These tools don't support plugins yet. Use Composer or npm above —
`install.sh` creates the correct symlinks and configs for all of them.

---

## Team auto-setup

To auto-recommend the plugin for your team, add the marketplace to your project settings.
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
