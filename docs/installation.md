# Installation

**Principle:** Project-installed by default, plugin-enhanced when available.
No Task, no Make, no build tools required for installation.

## Per-IDE setup — quick index

Pick your editor, follow the linked page, done. Each page lists its
own one-liner, verification, and troubleshooting. The mechanisms
section below this index is reference material for advanced installs
(Composer, npm, manual, plugin marketplaces).

| Surface | One-liner | Per-IDE page |
|---|---|---|
| **Claude Code** | `npx @event4u/create-agent-config init --tools=claude-code` | [`per-ide/claude-code.md`](setup/per-ide/claude-code.md) |
| **Claude Desktop** | (uses `~/.claude/skills/` from Claude Code global install) | [`per-ide/claude-desktop.md`](setup/per-ide/claude-desktop.md) |
| **Cursor** | `npx @event4u/create-agent-config init --tools=cursor` | [`per-ide/cursor.md`](setup/per-ide/cursor.md) |
| **Windsurf** | `npx @event4u/create-agent-config init --tools=windsurf` | [`per-ide/windsurf.md`](setup/per-ide/windsurf.md) |
| **Cline** | `npx @event4u/create-agent-config init --tools=cline` | [`per-ide/cline.md`](setup/per-ide/cline.md) |
| **Aider** | `npx @event4u/create-agent-config init --tools=aider` | [`per-ide/aider.md`](setup/per-ide/aider.md) |
| **Codex CLI** | `npx @event4u/create-agent-config init --tools=codex` | [`per-ide/codex.md`](setup/per-ide/codex.md) |
| **Gemini CLI** | `npx @event4u/create-agent-config init --tools=gemini` | [`per-ide/gemini-cli.md`](setup/per-ide/gemini-cli.md) |
| **GitHub Copilot** | `npx @event4u/create-agent-config init --tools=copilot` | [`per-ide/copilot.md`](setup/per-ide/copilot.md) |
| **All surfaces** | `npx @event4u/create-agent-config init` (default) | (each page above applies) |

Combine surfaces by comma-separating: `--tools=claude-code,cursor,windsurf`.

> Looking for **global** (cross-project) install? Each per-IDE page
> documents its own `npx @event4u/agent-config global --tools=<ide>`
> command.

---

## Mechanisms reference

The rest of this page documents the underlying install mechanisms
(Composer, npm, manual clone, plugin marketplaces). Most users want
the per-IDE index above.


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

> **All paths on this page are still supported.** The labels
> (`advanced` / `experimental` / `staged`) describe how prominent the
> path is in our recommendation order, not its support status.
> Composer + npm are the default; everything else stays shipped and
> tested. Nothing on this page is being removed in 1.15.0 — the
> reorder simply marks which paths get the most maintenance attention
> and which we keep as fallbacks. See R9 in
> [`agents/roadmaps/archive/road-to-post-pr29-optimize.md`](../agents/roadmaps/archive/road-to-post-pr29-optimize.md)
> for the rationale.

| Label | Meaning | Examples |
|---|---|---|
| (no label) | Primary path — first-class, fully supported | Composer, npm, Augment / Claude Code / Copilot CLI plugins |
| `advanced` | Supported fallback — works, expects familiarity with the toolchain | Git submodule, manual clone, VS Code Git URL |
| `experimental` | Shipped but evolving — interface may shift between minor releases | Claude.ai Web Skills UI |
| `staged` | Shipped, narrow surface area — kept for users who already use the platform | Linear AI workspace guidance |

---

## Quickstart — one-liner entrypoints

Try `@event4u/agent-config` in any directory in under 30 seconds, without
`composer require` or `git clone` first. Both entrypoints are thin
wrappers around `scripts/install` — same payload, same flags, no extra
state.

### `npx` (Node ≥ 18)

```bash
# Pick tools interactively (TTY checkbox prompt)
npx @event4u/create-agent-config init

# Pick tools explicitly, non-interactive
npx @event4u/create-agent-config init --tools=claude-code,cursor --yes

# Install everything (the default — backward-compatible)
npx @event4u/create-agent-config init --tools=all --yes

# Test a specific git ref (branch, tag, sha) instead of the latest npm tag
npx @event4u/create-agent-config init --ref=main --yes
```

The `@event4u/create-agent-config` package is a thin wrapper: it
downloads the latest `@event4u/agent-config` tarball into a temp
directory, runs `bash scripts/install --target <cwd> ...`, and cleans
up after itself. The project-local payload package
(`@event4u/agent-config`) is unchanged.

### `curl | bash` (no Node required)

```bash
# Defaults (interactive picker if your terminal is a TTY, else --tools=all)
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash

# Explicit tools, non-interactive (same flags as scripts/install)
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh \
  | bash -s -- --tools=claude-code,cursor --yes

# Install from a specific git ref
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh \
  | bash -s -- --ref=v1.39.0 --tools=cursor --yes
```

Requires `bash`, `tar`, `curl` (or `wget`), and Python ≥ 3.10 on the
host. Mirrors the agent-os `setup.sh` pattern.

### Interactive `--tools` picker

When `scripts/install` runs without an explicit `--tools` flag in an
interactive terminal (stdin + stdout both TTYs, `--yes` not passed), it
prompts for a comma-separated tool selection. In CI / piped invocations
the picker is skipped and the backward-compatible `all` default is
used. Pass `--yes` (or `-y`) to force non-interactive mode anywhere.

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

> Both cloud channels remain shipped and tested. The labels reflect
> recommendation prominence, not support status — see the label table
> at the top of this page.

### Claude.ai Web (Skills UI) — `experimental`

> `experimental` — shipped, still tested, but the upload surface and
> bundle format may shift between minor releases as Claude.ai's Skills
> UI evolves. Pin to a release tag if you depend on a specific bundle
> shape.

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

### Linear AI (Codegen, Charlie, …) — `staged`

> `staged` — shipped, narrow surface area, kept primarily for users
> already operating inside Linear. Iteration cadence is slower than
> the project- and plugin-installed paths; major changes land first
> on Composer + npm and propagate to the Linear digest in a follow-up.

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
   [`docs/contracts/linear-ai-three-layers.md`](contracts/linear-ai-three-layers.md)
   for the split rationale and
   [`docs/contracts/linear-ai-rules-inclusion.md`](contracts/linear-ai-rules-inclusion.md)
   for which rules go where.

---

## Alternative install methods — `advanced`

> `advanced` — supported fallbacks for users comfortable driving the
> orchestrator directly. They share the same `scripts/install` entry
> point as Composer and npm; the only difference is how the package
> source ends up on disk. Pick these when you cannot use Composer or
> npm (e.g. a polyglot repo without either, or a CI runner that
> already vendors the package via submodule).

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
  --global          Ship kernel rules + curated skills to user-scope dirs
  --uninstall       With --global: remove the event4u/ namespace dir
  --help, -h        Show this help
```

The underlying stages keep their own CLI surfaces:
`bash scripts/install.sh --help` and `python3 scripts/install.py --help`.

---

## Global user-level install (`--global`)

`--global` ships a curated subset of kernel rules + top-N skills into
**per-tool user-scope directories**, so the agent has them in every
project on the machine without a per-project install.

```bash
# Default: every supported surface, namespaced under event4u/.
bash scripts/install --global

# Scope to specific surfaces (mirrors the project install --tools flag).
bash scripts/install --global --tools=claude-code,cursor

# Remove only what we put there — never touches user files.
bash scripts/install --global --uninstall
```

| Surface       | Target directory                                                |
| ------------- | --------------------------------------------------------------- |
| Claude Code   | `~/.claude/rules/event4u/`, `~/.claude/skills/event4u/`         |
| Cursor        | `~/.cursor/rules/imported/event4u/{rules,skills}/`              |
| Windsurf      | `~/.codeium/windsurf/global_workflows/event4u/{rules,skills}/`  |
| Fallback      | `~/.config/agent-config/{rules,skills}/event4u/`                |

The fallback path is always written so an editor we don't yet know
about can still pick the files up.

**Curation source:** `templates/global-install-manifest.yml`. Edit
post-install to grow or shrink the global set; re-run `--global` to
re-project. `--uninstall` only removes the `event4u/` namespace —
user-added rules / skills under sibling paths stay untouched.

**When to use:** running multiple unrelated projects where a per-project
install is overkill, or wiring up a new editor (Claude Desktop, Cursor)
that benefits from a baseline set of skills out of the box.

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
