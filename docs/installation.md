# Installation

**Principle:** Project-installed by default, plugin-enhanced when available.
No Task, no Make, no build tools required for installation.

> **Primary installer:** `scripts/install` — a small bash orchestrator that
> runs the two real installer stages in order:
>
> 1. `scripts/install.sh` — payload sync (copy rules, symlink skills and
>    commands, create tool-specific directories).
> 2. `scripts/install.py` — bridge files (`.agent-settings.yml`, VSCode /
>    Augment / Copilot JSON descriptors).
>
> `bin/install.php` and `scripts/postinstall.sh` are thin wrappers that
> delegate to `scripts/install`. Both underlying stages remain callable
> directly for advanced use; see their `--help`.
>
> Python 3.10+ is required for bridges. If it is missing, the orchestrator
> prints a warning and continues with the payload sync only.

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
php vendor/bin/install.php
```

Composer does **not** run a post-install hook for this package — the
installer is an explicit step. `bin/install.php` is a thin wrapper that
calls `scripts/install` (the bash orchestrator). To pick a non-default
profile:

```bash
php vendor/bin/install.php --profile=balanced
```

The `--profile` flag controls the initial `cost_profile` value written
to `.agent-settings.yml`.

### npm (JavaScript/TypeScript projects)

```bash
npm install --save-dev @event4u/agent-config
```

npm runs `scripts/postinstall.sh` automatically, which invokes
`scripts/install` — the same orchestrator every other entry point uses.

If your setup disables install scripts (`npm config set ignore-scripts
true` or similar), nothing happens and the command prints no warning.
Re-run the installer manually in that case:

```bash
bash node_modules/@event4u/agent-config/scripts/install
```

### Installer orchestrator (`scripts/install`)

The orchestrator chains payload sync and bridge generation:

```bash
bash scripts/install                  # defaults to cost_profile=minimal
bash scripts/install --profile=balanced
bash scripts/install --force          # overwrite existing bridges
bash scripts/install --skip-bridges   # payload only
bash scripts/install --skip-sync      # bridges only
bash scripts/install --dry-run        # show payload sync plan, skip bridges
```

PHP users can use the Composer wrapper, which forwards all flags:

```bash
php vendor/bin/install.php --profile=balanced
```

Under the hood:

- `scripts/install.sh` — payload sync (callable directly for sync-only runs).
- `scripts/install.py` — bridge files (callable directly for bridge-only runs).

A full run creates:

- `.agent-settings.yml` — profile configuration (YAML)
- `.vscode/settings.json` — VS Code / Copilot plugin discovery
- `.augment/settings.json` — Augment plugin activation
- `.github/plugin/marketplace.json` — Copilot CLI marketplace
- `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`, `GEMINI.md`
- `AGENTS.md`, `.github/copilot-instructions.md` (only if missing)

No Task, no Make, no build tools required. **Python 3** (standard library only)
is required for bridges — it is pre-installed on macOS 12.3+ and virtually
every Linux distribution. If Python 3 is missing, the orchestrator warns,
runs the payload sync anyway, and asks you to re-run `scripts/install`
after installing Python.

### What happens after install

`scripts/install` creates project-local content for all supported tools:
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
.agent-settings.yml                ← shared profile (e.g., cost_profile: minimal)
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
auggie plugin install agent-config@event4u-agent-config
```

### Claude Code

Two equivalent paths — pick whichever surface you're already in:

```bash
# From your shell (CLI)
claude plugin install agent-config@event4u-agent-config
```

```text
# From inside Claude Code (slash command)
/plugin marketplace add event4u-app/agent-config
/plugin install agent-config@event4u-agent-config
```

The slash-command path is the canonical Claude Code Plugin Marketplace
flow ([reference](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)).
It pulls the repo via git-clone and reads the skills directly from
`.claude/skills/` — no separate ZIP download.

### Copilot CLI

```bash
copilot plugin install agent-config@event4u-agent-config
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
auggie marketplace add event4u-app/agent-config

# Claude Code
claude marketplace add event4u-app/agent-config

# Copilot CLI
copilot marketplace add event4u-app/agent-config
```

---

## Cloud / Hosted agent installation

For agents running outside your local machine — Claude.ai Web Skills
and Linear AI — the package's local installer cannot run. Instead,
the package ships pre-built artefacts you upload or paste into the
hosted platform's own configuration surface.

These channels are **additional** to project- and plugin-installed
modes; use them when the agent loop runs on the platform's servers,
not on your machine.

### Claude.ai Web (Skills UI)

Claude.ai Web supports Skills via manual ZIP upload through the Skills
UI. The package builds one ZIP per cloud-eligible skill.

1. **Build the bundles**

   ```bash
   task build-cloud-bundles-all
   ```

   Output: `dist/cloud/<skill>.zip` per eligible skill. Skills marked
   `cloud_safe: noop` (filesystem-bound, e.g. `chat-history`,
   `file-editor`) are bundled with a stripped no-op variant; T3-H
   skills (hard filesystem dependencies) are excluded by default.
   See [`scripts/audit_cloud_compatibility.py`](../scripts/audit_cloud_compatibility.py)
   for per-skill tier and [`scripts/build_cloud_bundle.py`](../scripts/build_cloud_bundle.py)
   for the gating logic.

2. **Upload to Claude.ai**

   - Open Claude.ai → Skills → Upload Skill
   - Select one bundle from `dist/cloud/`
   - Repeat per skill you want available

3. **Verify** — open a fresh Claude.ai conversation and confirm the
   skill appears in the Skills picker.

### Linear AI (Codegen, Charlie, …)

Linear AI agents read free-form guidance from Linear's workspace
settings; there is no plugin or upload mechanism. The package ships
a pre-built digest split into three layers, paste each layer into
the matching Linear field.

1. **Build the digest**

   ```bash
   task build-linear-digest
   ```

   Output:
   - `dist/linear/workspace.md` — universal coding posture (T1 rules)
   - `dist/linear/team.md` — framework-specific guidance (Laravel, …)
   - `dist/linear/personal.md` — stub for individual overrides

2. **Paste into Linear**

   - Open Linear → Settings → Agents → Additional guidance
   - Paste `workspace.md` into the workspace-level field
   - Paste `team.md` into your team's field (if framework-specific)
   - Leave `personal.md` empty unless you have personal overrides

3. **Per-layer rationale** — see
   [`agents/contexts/linear-ai-three-layers.md`](../agents/contexts/linear-ai-three-layers.md)
   for the split rationale and
   [`agents/contexts/linear-ai-rules-inclusion.md`](../agents/contexts/linear-ai-rules-inclusion.md)
   for which rules go where.

---

## Alternative install methods

These are fallbacks when the recommended paths above don't work.

### Git Submodule

```bash
git submodule add git@github.com:event4u-app/agent-config.git .agent-config
bash .agent-config/scripts/install --target .
```

### Manual

```bash
bash path/to/agent-config/scripts/install --target /path/to/your/project
```

### Install from Git URL (VS Code / Copilot)

VS Code can install plugins directly from a Git repository URL.
Point it to `https://github.com/event4u-app/agent-config`.

> **Note:** `.augment/` content depends on the package manager having been executed.
> After a fresh clone, run `composer install` or `npm install` first.

---

## After installation: choose a profile

The system works immediately with sensible defaults. Optionally, create `.agent-settings.yml`
to choose a profile:

```yaml
cost_profile: minimal
```

| Profile | What's active | For whom |
|---|---|---|
| `minimal` (default) | Rules + Skills only, zero overhead | New users, solo devs |
| `balanced` | + Runtime dispatcher + shell handler | Most teams |
| `full` | + Tool adapters (GitHub, Jira) | Platform teams |

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

## How the installer works

### Two-stage pipeline

`scripts/install` runs these stages in order:

| Stage | Script | Output |
|---|---|---|
| 1. Payload sync | `scripts/install.sh` | `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`, `GEMINI.md` |
| 2. Bridges     | `scripts/install.py` | `.agent-settings.yml`, `.vscode/settings.json`, `.augment/settings.json`, `.github/plugin/marketplace.json` |

Either stage can be skipped (`--skip-sync`, `--skip-bridges`) or invoked
directly. Stage 2 is gracefully skipped when Python 3 is unavailable.

### Hybrid sync strategy (stage 1)

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
bash scripts/install [OPTIONS]

Options:
  --source <dir>    Package source directory (default: auto-detect)
  --target <dir>    Target project root (default: $PROJECT_ROOT or cwd)
  --profile <name>  Cost profile for bridges (minimal|balanced|full)
  --force           Overwrite existing bridge files
  --dry-run         Show payload sync plan; skip bridges
  --verbose         Detailed payload sync output
  --quiet           Suppress non-error output
  --skip-sync       Skip payload sync (install.sh)
  --skip-bridges    Skip bridge files (install.py)
  --help, -h        Show this help
```

The underlying stages keep their own CLI surfaces:
`bash scripts/install.sh --help` and `python3 scripts/install.py --help`.

---

## Updating

When a new version of the package is published:

```bash
composer update event4u/agent-config
php vendor/bin/install.php          # refresh bridges + symlinks
```

Or for npm projects:

```bash
npm update @event4u/agent-config
bash node_modules/@event4u/agent-config/scripts/install
```

The installer is idempotent — re-running it after an update refreshes
the symlinks and regenerates derived files (`.windsurfrules`,
`.github/copilot-instructions.md`). It does **not** overwrite
`AGENTS.md` or anything in `agents/overrides/`.

---

## Windows

Native Windows is not a first-class target. Use one of the following:

- **WSL2** (recommended): clone and install inside a WSL distribution.
- **Git Bash**: works for installation but symlinks require Windows
  Developer Mode or admin privileges. Re-run the installer after each
  update to refresh file copies if symlinks aren't available.
- **PowerShell / cmd**: not supported.

If you need full native Windows support, please open an issue — we
cannot validate changes without access to a Windows setup.

---

## Uninstalling

There is no dedicated uninstall command yet. To remove the package:

```bash
# 1. Remove the dependency
composer remove event4u/agent-config
# or
npm uninstall @event4u/agent-config

# 2. Remove generated project-local content
rm -rf .augment .claude .cursor .clinerules .windsurfrules GEMINI.md
rm -f .agent-settings .agent-settings.yml .agent-settings.backup.key-value
rm -f .github/copilot-instructions.md
```

Remove the `# event4u/agent-config` block from `.gitignore` manually.
Keep `AGENTS.md` if you customized it — it is yours, not the package's.

See also: [docs/troubleshooting.md](troubleshooting.md).

---

← [Back to README](../README.md)
