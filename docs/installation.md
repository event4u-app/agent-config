# Installation

**Principle:** Global-first install (cross-project, in `~/.claude/`,
`~/.cursor/`, …), opt-in project export when a team wants the config
committed to a repo. No Task, no Make, no build tools required.

> **v2.1+** — the installer detects intent. Running `npx
> @event4u/agent-config init` in `~/` or any directory without a
> project manifest defaults to **global**. Running it inside a project
> (`package.json` / `composer.json` / `pyproject.toml` / etc.) defaults
> to **project**. Pass `--scope=global` or `--scope=project` to override
> detection. See `--scope` in the CLI help for the full matrix.

A global install records itself in `~/.event4u/agent-config/installed.lock`
(schema_version, agent_config_version, installed_at, tools[]; the legacy
`~/.config/agent-config/installed.lock` is read as a fallback). `npx
@event4u/agent-config update` keeps that manifest in lockstep
with the project pin in `.agent-settings.yml`. A version-mismatched
re-run of `init --scope=global` is refused with exit code 1 until you
`update` or pass `--force`.

To commit a specific tool's config into a project repo, use:

```bash
agent-config export --tool=<id> --output=<path>
```

(Idempotent; `--force` overrides drift. `--list` enumerates supported
tool ids. See [`docs/contracts/command-clusters.md`](contracts/command-clusters.md)
for the export contract.)

## Per-IDE setup — quick index

Pick your editor, follow the linked page, done. Each page lists its
own one-liner, verification, and troubleshooting. The mechanisms
section below this index is reference material for advanced installs
(Composer, npm, manual, plugin marketplaces).

| Surface | One-liner | Per-IDE page |
|---|---|---|
| **Claude Code** | `npx @event4u/agent-config init --tools=claude-code` | [`per-ide/claude-code.md`](setup/per-ide/claude-code.md) |
| **Claude Desktop** | (uses `~/.claude/skills/` from Claude Code global install) | [`per-ide/claude-desktop.md`](setup/per-ide/claude-desktop.md) |
| **Cursor** | `npx @event4u/agent-config init --tools=cursor` | [`per-ide/cursor.md`](setup/per-ide/cursor.md) |
| **Windsurf** | `npx @event4u/agent-config init --tools=windsurf` | [`per-ide/windsurf.md`](setup/per-ide/windsurf.md) |
| **Cline** | `npx @event4u/agent-config init --tools=cline` | [`per-ide/cline.md`](setup/per-ide/cline.md) |
| **Aider** | `npx @event4u/agent-config init --tools=aider` | [`per-ide/aider.md`](setup/per-ide/aider.md) |
| **Codex CLI** | `npx @event4u/agent-config init --tools=codex` | [`per-ide/codex.md`](setup/per-ide/codex.md) |
| **Gemini CLI** | `npx @event4u/agent-config init --tools=gemini` | [`per-ide/gemini-cli.md`](setup/per-ide/gemini-cli.md) |
| **GitHub Copilot** | `npx @event4u/agent-config init --tools=copilot` | [`per-ide/copilot.md`](setup/per-ide/copilot.md) |
| **Augment Code** | `npx @event4u/agent-config init --tools=augment` | [`per-ide/augment.md`](setup/per-ide/augment.md) |
| **Roo Code** | `npx @event4u/agent-config init --tools=roocode` | [`per-ide/roocode.md`](setup/per-ide/roocode.md) |
| **Kilo Code** | `npx @event4u/agent-config init --tools=kilocode` | [`per-ide/kilocode.md`](setup/per-ide/kilocode.md) |
| **Continue.dev** | `npx @event4u/agent-config init --tools=continue` | [`per-ide/continue.md`](setup/per-ide/continue.md) |
| **Kiro** | `npx @event4u/agent-config init --tools=kiro` | [`per-ide/kiro.md`](setup/per-ide/kiro.md) |
| **Zed** | `npx @event4u/agent-config init --tools=zed` | [`per-ide/zed.md`](setup/per-ide/zed.md) |
| **JetBrains AI** | `npx @event4u/agent-config init --tools=jetbrains --global` | [`per-ide/jetbrains.md`](setup/per-ide/jetbrains.md) |
| **Qoder** | `npx @event4u/agent-config init --tools=qoder --global` | [`per-ide/qoder.md`](setup/per-ide/qoder.md) |
| **OpenCode** | `npx @event4u/agent-config init --tools=opencode --global` | [`per-ide/opencode.md`](setup/per-ide/opencode.md) |
| **Trae** | `npx @event4u/agent-config init --tools=trae --global` | [`per-ide/trae.md`](setup/per-ide/trae.md) |
| **Antigravity** | `npx @event4u/agent-config init --tools=antigravity --global` | [`per-ide/antigravity.md`](setup/per-ide/antigravity.md) |
| **CodeBuddy** | `npx @event4u/agent-config init --tools=codebuddy --global` | [`per-ide/codebuddy.md`](setup/per-ide/codebuddy.md) |
| **Droid (Factory)** | `npx @event4u/agent-config init --tools=droid --global` | [`per-ide/droid.md`](setup/per-ide/droid.md) |
| **Warp** | `npx @event4u/agent-config init --tools=warp --global` | [`per-ide/warp.md`](setup/per-ide/warp.md) |
| **All surfaces** | `npx @event4u/agent-config init` (default) | (each page above applies) |

Combine surfaces by comma-separating: `--tools=claude-code,cursor,windsurf`.

> Looking for **global** (cross-project) install? Each per-IDE page
> documents its own `npx @event4u/agent-config global --tools=<ide>`
> command.

---

## Upgrading from v1

v2 is a breaking change: the local-install scheme (Composer
`require-dev`, npm `devDependency`, the `--global` symlink namespace
under `~/.claude/`, `~/.cursor/`, `~/.codeium/windsurf/`,
`~/.config/agent-config/`) is **retired**. v2 is npx-only — the
runtime is resolved per invocation, pinned by
`agent_config_version` in `.agent-settings.yml`.

One command does the cutover, idempotently:

```bash
./agent-config migrate              # remove legacy install signals
./agent-config migrate --dry-run    # detect only, no writes
```

What `migrate` cleans up:

| What | Action |
|---|---|
| `package.json` → `devDependencies.@event4u/agent-config` | Removed (lockfile updated on next `npm install`). |
| `composer.json` → `require*.event4u/agent-config` | Removed (lockfile updated on next `composer update`). |
| Symlinks `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` pointing into `vendor/` or `node_modules/` | Deleted. User-owned links are preserved with a warning. |
| `.agent-settings.yml` | Written fresh if missing, with `agent_config_version` pinned. |
| `.gitignore` agent-config block | Refreshed. |

After `migrate` runs, you can drop the now-unreferenced
`node_modules/@event4u/agent-config/` and `vendor/event4u/agent-config/`
directories with `npm prune` and `composer update` respectively.

Full contract sketch + the retired `--global` namespace teardown:
[`docs/migration/v1-to-v2.md`](migration/v1-to-v2.md).

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
> `npx @event4u/agent-config init` and `setup.sh` (curl-based)
> are thin wrappers that delegate to `scripts/install`. Both underlying
> stages remain callable directly for advanced use; see their `--help`.
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
adding it as a dev dependency or cloning the repo first. Both
entrypoints are thin wrappers around `scripts/install` — same payload,
same flags, no extra state.

### `npx` (Node ≥ 18)

```bash
# Pick tools interactively (TTY checkbox prompt)
npx @event4u/agent-config init

# Pick tools explicitly, non-interactive
npx @event4u/agent-config init --tools=claude-code,cursor --yes

# Install everything (the default — backward-compatible)
npx @event4u/agent-config init --tools=all --yes

# Test a specific git ref (branch, tag, sha) instead of the latest npm tag
npx @event4u/agent-config init --ref=main --yes
```

`npx @event4u/agent-config init` fetches the latest tarball, runs
`bash scripts/install --target <cwd> …`, and the install script handles
its own cleanup. The same package exposes every other `agent-config`
subcommand (`sync`, `validate`, `mcp:render`, `roadmap:progress`, …) —
see `npx @event4u/agent-config help`.

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

### npx (recommended for any project)

```bash
npx @event4u/agent-config init --tools=claude-code,cursor
```

`npx` fetches the latest `@event4u/agent-config` tarball and runs
`scripts/install` with the selected tools. Nothing is added to
`package.json`.

### Global CLI (one install per machine)

```bash
npm install -g @event4u/agent-config
agent-config --help
```

The global install puts `agent-config` on `$PATH` so the project
wrapper (`./agent-config`) can fall through to it when no
`node_modules/@event4u/agent-config/` exists.

### Global CLI + per-project settings (minimal flow)

For teams that want to keep the runtime global (one install per
machine) but still version a per-project `.agent-settings.yml` and a
project-local `agents/` folder, use the `--minimal` init:

```bash
# 1. Install the runtime once per machine
npm install -g @event4u/agent-config

# 2. Inside the project, write only the per-project shell
agent-config init --minimal
# or, without a global install:
npx @event4u/agent-config init --minimal
```

`--minimal` writes exactly three files into the project root:

- `.agent-settings.yml` — per-project cost profile, member config,
  feature flags. Committed.
- `agents/.gitkeep` — placeholder so the directory is committed
  before the first roadmap, decision, or council session lands.
- `./agent-config` — bash wrapper that pins
  `AGENT_CONFIG_PROJECT_ROOT` to the project root and forwards every
  subcommand to the globally installed CLI. Committed.

Nothing else — no `.augment/`, no `.claude/`, no `.cursor/`, no
`AGENTS.md`. The shipped tool payload stays in the user's home (or
the npx cache) and is shared across every project on the machine.

#### Decision table — `--minimal` vs full `init`

| Pick `--minimal` when | Pick full `init` when |
|---|---|
| Runtime is already installed globally (`npm i -g`). | First-time setup on a fresh machine. |
| Team wants one source of truth for skills / rules / commands across every repo (shared via the global install). | Team wants per-repo skills / rules / commands committed alongside the code. |
| `agents/` content (roadmaps, decisions) is the only per-project state worth committing. | `AGENTS.md`, `GEMINI.md`, or `.github/copilot-instructions.md` need project-specific overrides. |
| The repo runs in CI and you do not want to vendor the full payload. | The repo cannot rely on a global install (air-gapped, sandboxed CI without npm). |
| Migrating an existing project from the legacy `.git`-anchored install. | Starting a new project that has never seen `agent-config`. |

Nested-install guard: `init --minimal` refuses to run when an
ancestor already contains an anchor (`.git`, an `agents/` directory
with a marker, or another `.agent-settings.yml`). This prevents
shadow installs inside an existing project. Override with explicit
`--target <dir>` if the nesting is intentional.

`--minimal` does **not** pin `agent_config_version` — the project
follows whichever version the global CLI was installed at. Pin
explicitly by adding `agent_config_version: <semver>` to
`.agent-settings.yml` when you want a reproducible runtime.

### Installer orchestrator (`scripts/install`)

The orchestrator chains payload sync and bridge generation:

```bash
bash scripts/install                  # defaults to cost_profile=balanced
bash scripts/install --profile=minimal
bash scripts/install --force          # overwrite existing bridges
bash scripts/install --skip-bridges   # payload only
bash scripts/install --skip-sync      # bridges only
bash scripts/install --dry-run        # show payload sync plan, skip bridges
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
.agent-settings.yml                ← shared profile (e.g., cost_profile: balanced)
agents/installed-tools.lock        ← AI bill of materials (ADR-008, Phase 3)
.augment/                          ← rules, skills, commands (symlinks)
.cursor/rules/                     ← Cursor rules (symlinks)
.claude/                           ← Claude rules, skills (symlinks)
AGENTS.md                          ← Copilot/Gemini instructions
.github/copilot-instructions.md   ← GitHub Copilot instructions
```

`agents/installed-tools.lock` lists every AI tool the project expects,
its scope (`global` or `project`), and its bridge marker path. Written
by `init`, replayed by `sync`, checked by `validate`. Schema and
workflow: [`docs/guidelines/agent-infra/installed-tools-manifest.md`](guidelines/agent-infra/installed-tools-manifest.md).

### Team onboarding — clone → sync → done

New team members get every AI bridge online with a single command:

```bash
git clone <repo>
cd <repo>
npx @event4u/agent-config sync
```

`sync` reads `agents/installed-tools.lock` and re-runs the installer
for every tool whose bridge marker is missing locally. Idempotent —
re-running after every clone is safe. Tools with markers already in
place are skipped.

Pair it with a CI gate to catch drift in PRs:

```bash
npx @event4u/agent-config validate
```

`validate` is read-only. Exit 1 on any of: marker missing, scope
divergence (manifest says `project` but marker only exists at the
global anchor, or vice versa), version drift (manifest's
`agent_config_version` ≠ installed package). Full drift catalog and
fix table: [`installed-tools-manifest.md § Drift detection`](guidelines/agent-infra/installed-tools-manifest.md#drift-detection-ci-gate).

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
cost_profile: balanced
```

| Profile | What's active | For whom |
|---|---|---|
| `minimal` | Kernel only — Iron-Law floor, zero router | Token-constrained agents |
| `balanced` | + Runtime dispatcher + shell handler | Most teams |
| `full` | + Tool adapters (GitHub, Jira) | Platform teams |

No profile configured = `balanced` behavior (default). Rationale:
[`docs/contracts/cost-profile-defaults.md`](contracts/cost-profile-defaults.md).
→ [Full profile details](customization.md)

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

## Global user-level install — retired

The previous `--global` symlink scheme (kernel rules + curated skills
copied into `~/.claude/`, `~/.cursor/`, `~/.codeium/windsurf/`, and
`~/.config/agent-config/` under an `event4u/` namespace) has been
**retired** under the npx-only distribution model. Run
`npx @event4u/agent-config init` per project instead; the
`agent_config_version` pin in `.agent-settings.yml` keeps every
invocation reproducible. See [`migration/v1-to-v2.md`](migration/v1-to-v2.md)
for the upgrade path.

---

## Updating

When a new version of the package is published:

```bash
# npx (one-shot, recommended) — always uses the latest tarball
npx @event4u/agent-config init --tools=claude-code,cursor

# Global CLI
npm install -g @event4u/agent-config@latest
agent-config --help
```

The installer is idempotent — re-running it after an update refreshes
the symlinks and regenerates derived files (`.windsurfrules`,
`.github/copilot-instructions.md`). It does **not** overwrite
`AGENTS.md` or anything in `agents/overrides/`.

---

## AI Council local state

The AI Council ([`docs/contracts/ai-council-config.md`](contracts/ai-council-config.md))
writes two local-only files outside the repo contract:

- `~/.event4u/agent-config/cli-calls.json` — per-day call counter for
  `mode: cli` members. Daily UTC reset. Inspect with
  `agent-config council quota`; clear today's counter for one provider
  with `agent-config council quota --reset <provider> --confirm`.
- `agents/council-events.log` — JSONL audit trail. One line per
  necessity-gate decision and per quota block. Gitignored by the
  installer (managed `.gitignore` block); never committed.
  `original_ask` is hashed `sha256[:12]` before write — the raw prompt
  is never persisted.

Both are opt-in by construction: the quota counter only fires when a
provider has `cli_call_budget.max_calls_per_day.<provider>` set, and
the events log is purely additive (deletable at any time).

### Kill-switches

Per-feature environment overrides for ephemeral worktrees, CI runners,
or sandbox testing:

- `AGENT_CONFIG_NO_EVENTS_LOG=1` — disables every write to
  `agents/council-events.log` in-process. Quota counter and council
  output stay untouched.
- `AGENT_CONFIG_LEGACY_ANCHOR=1` — reverts project-root discovery to
  the pre-step-7 `.git`-only walk. See [Migration — Step 7 anchor
  discovery](#migration--step-7-anchor-discovery) below for the
  precedence rules and when to use this.
- `AGENT_CONFIG_PROJECT_ROOT=<abs-path>` — pins the resolved project
  root, skipping the anchor walk entirely. Set automatically by the
  `./agent-config` wrapper; set manually in CI when the working
  directory is not a descendant of the project root.

---

## Migration — Step 7 anchor discovery

Before Step 7, the CLI located the project root by walking up for a
`.git` directory only. Step 7 widens the anchor set so non-git
projects (sparse checkouts, monorepo sub-trees, `agent-config`-only
worktrees) resolve correctly and so subdirectory invocations stop
falling back to `cwd`.

### Anchor precedence (D3 — cascade-conflict decision)

Walk up from CWD. The first ancestor containing a **boundary
anchor** wins:

1. `.git` (file or directory).
2. `agents/` directory containing **any** of `roadmaps/`,
   `.ai-council.yml`, or `roadmaps-progress.md` — bare `agents/`
   does **not** anchor (D1).

If no boundary anchor exists in any ancestor, the **outermost**
(closest-to-fs-root) `.agent-settings.yml` becomes the root. This
preserves the layered-settings cascade — see
[`agents/council-sessions/step-7-d3-cascade-conflict-decision.md`](../agents/council-sessions/step-7-d3-cascade-conflict-decision.md)
for the rationale.

When a single ancestor carries multiple anchors, the **diagnostic
anchor name** reported by `agent-config doctor` follows the D3
tie-break order (`.agent-settings.yml` > `agents/` > `.git`). The
resolved path is identical either way.

### Resolution precedence (which root wins)

In order, first match wins (Step 8 adds the `--root` flag at the top):

1. Global `--root <dir>` flag (Step 8) — escape hatch for monorepos.
2. Explicit `--project <dir>` / `--target <dir>` on the CLI.
3. `AGENT_CONFIG_PROJECT_ROOT=<abs-path>` env var.
4. Anchor walk from CWD (rules above).
5. Fallback to CWD.

The `./agent-config` wrapper sets step 3 to its own directory, so
subcommands invoked from a subdirectory still target the right root
even after `os.chdir`.

### Project-root override — `--root` (Step 8)

The global `--root <dir>` flag pins discovery to a specific directory.
It is parsed by the bash dispatcher **before** any subcommand and beats
every other channel, including the wrapper-pinned env var:

```bash
# Run doctor against a sibling project from anywhere
agent-config --root /work/projects/site-a doctor --context

# Equivalent — long-form `=` syntax
agent-config --root=/work/projects/site-a doctor --context
```

**Fail-loud validation.** Invalid paths exit with code `2` instead of
silently falling back to CWD:

```text
❌  agent-config: --root points to a path that does not exist: /nope
```

The same validation applies to `--project` and
`AGENT_CONFIG_PROJECT_ROOT` — every explicit override is checked.

**Wrapper coupling.** When the project-local `./agent-config` wrapper
runs, it pins `AGENT_CONFIG_PROJECT_ROOT` to its own directory. The
`--root` flag explicitly overrides that pin (the wrapper logs a stderr
hint when this happens), so monorepo sub-trees can target one another
without unpinning the wrapper.

### Monorepo semantics

Monorepos with multiple `agent-config` consumers (e.g. one package per
sub-tree) work out of the box because the anchor walk stops at the
**nearest** boundary anchor (`agents/<markers>` or `.git`). From inside
`packages/site-a/`, discovery resolves to `packages/site-a/`, not the
monorepo root.

When you need to invoke a sibling package's CLI from anywhere, use
`--root`:

```bash
# From the monorepo root, target site-b
agent-config --root packages/site-b validate

# From inside site-a, run a sync against site-b
agent-config --root ../site-b sync
```

`--root` is the recommended channel — explicit, fail-loud, and visible
in `doctor --context` output. Setting `AGENT_CONFIG_PROJECT_ROOT`
manually still works but is less discoverable.

### Diagnostics — `doctor --trace-root` and `--context`

Two read-only diagnostic flags surface how discovery resolved the
project root:

```bash
# Show every ancestor probed + winning anchor
agent-config doctor --trace-root

# Show effective root, origin, install mode, settings layers, wrapper
agent-config doctor --context
```

Sample `--trace-root` output:

```text
  📍  start: /work/projects/site-a/src
  📍  origin: agents-dir
  trace:
    · [boundary] /work/projects/site-a/src  (no .git, no agents/)
    ✅ [boundary] /work/projects/site-a → agents-dir  (agents/ has roadmaps/)
  📍  resolved root: /work/projects/site-a (anchor: agents-dir)
```

Sample `--context` output:

```text
  📍  project_root: /work/projects/site-a  (origin: agents-dir)
  📦  install_mode: full  (source: marker-file)
  …
```

Both flags accept `--json` for machine-readable output. The
`install_mode_source` is `marker-file` when
`agents/.agent-state/install-mode.txt` exists (written by the
installer since Step 8) and `heuristic` for back-compat installs.

### When to set `AGENT_CONFIG_LEGACY_ANCHOR=1`

Set this only as a temporary escape hatch — for example, when the
new anchor set surfaces an unexpected ancestor in a CI pipeline that
already passes the legacy walk. Behaviour:

- Walk up for `.git` only (Step-6 behaviour).
- `agents/` and `.agent-settings.yml` are ignored as anchors.
- Cascade order is unchanged — layered `.agent-settings.yml` files
  still merge.

The kill-switch is scheduled for removal after one minor-version
soak (D5). File an issue if you need it longer-term so the precedence
table can absorb the missing case.

### Verifying the resolved root

```bash
agent-config doctor --context
```

prints the resolved project root, origin (`root-flag` / `explicit` /
`env` / anchor name / `cwd-fallback`), install mode, settings-layer
chain, and wrapper state. Use this when a command appears to read the
wrong `.agent-settings.yml`. Pair with `--trace-root` (above) when the
**anchor walk itself** needs debugging.

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
