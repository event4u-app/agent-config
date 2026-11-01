# Installation

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

This page is the install reference: every entry point, what lands where,
updating and removal. For the short path, start with
[Getting started](getting-started.md). Why the install is global-only:
[ADR-020](decisions/ADR-020-global-only-consumer-scope.md).

The install records itself in `~/.event4u/agent-config/installed.lock`
(schema_version, agent_config_version, installed_at, tools[]; the legacy
`~/.config/agent-config/installed.lock` is read as a fallback). Only the
global install writes it — `agent-config upgrade` moves it forward. `npx
@event4u/agent-config update` moves the project pin in `.agent-settings.yml`
and leaves the manifest alone — but when the global install is older than
the version it pins, it runs `agent-config upgrade` to that version FIRST and
writes the pin only once that succeeded, because hooks, rules and skills run
from the global install and only the CLI follows the pin. A re-run of `init` from a package
older than the recorded version is refused with exit code 1 unless you pass
`--force`.

## Per-IDE setup — quick index

Pick your editor and follow its page; each lists what lands where, how to
verify it and how to fix common problems.

| Surface | One-liner | Per-IDE page |
|---|---|---|
| **Claude Code** | `npx @event4u/agent-config init --tools=claude-code` | [`per-ide/claude-code.md`](setup/per-ide/claude-code.md) |
| **Claude Desktop** | `npx @event4u/agent-config init --tools=claude-desktop` | [`per-ide/claude-desktop.md`](setup/per-ide/claude-desktop.md) |
| **Cursor** | `npx @event4u/agent-config init --tools=cursor` | [`per-ide/cursor.md`](setup/per-ide/cursor.md) |
| **Windsurf** | `npx @event4u/agent-config init --tools=windsurf` | [`per-ide/windsurf.md`](setup/per-ide/windsurf.md) |
| **Cline** | `npx @event4u/agent-config init --tools=cline` | [`per-ide/cline.md`](setup/per-ide/cline.md) |
| **Codex CLI** | `npx @event4u/agent-config init --tools=codex` | [`per-ide/codex.md`](setup/per-ide/codex.md) |
| **Gemini CLI** | `npx @event4u/agent-config init --tools=gemini-cli` | [`per-ide/gemini-cli.md`](setup/per-ide/gemini-cli.md) |
| **Augment Code** | `npx @event4u/agent-config init --tools=augment` | [`per-ide/augment.md`](setup/per-ide/augment.md) |
| **Roo Code** | `npx @event4u/agent-config init --tools=roocode` | [`per-ide/roocode.md`](setup/per-ide/roocode.md) |
| **Kilo Code** | `npx @event4u/agent-config init --tools=kilocode` | [`per-ide/kilocode.md`](setup/per-ide/kilocode.md) |
| **Continue.dev** | `npx @event4u/agent-config init --tools=continue` | [`per-ide/continue.md`](setup/per-ide/continue.md) |
| **Kiro** | `npx @event4u/agent-config init --tools=kiro` | [`per-ide/kiro.md`](setup/per-ide/kiro.md) |
| **Qoder** | `npx @event4u/agent-config init --tools=qoder` | [`per-ide/qoder.md`](setup/per-ide/qoder.md) |
| **OpenCode** | `npx @event4u/agent-config init --tools=opencode` | [`per-ide/opencode.md`](setup/per-ide/opencode.md) |
| **Trae** | `npx @event4u/agent-config init --tools=trae` | [`per-ide/trae.md`](setup/per-ide/trae.md) |
| **Antigravity** | `npx @event4u/agent-config init --tools=antigravity` | [`per-ide/antigravity.md`](setup/per-ide/antigravity.md) |
| **CodeBuddy** | `npx @event4u/agent-config init --tools=codebuddy` | [`per-ide/codebuddy.md`](setup/per-ide/codebuddy.md) |
| **Droid (Factory)** | `npx @event4u/agent-config init --tools=droid` | [`per-ide/droid.md`](setup/per-ide/droid.md) |
| **Warp** | `npx @event4u/agent-config init --tools=warp` | [`per-ide/warp.md`](setup/per-ide/warp.md) |
| **GitHub Copilot** (plugin or export) | `copilot plugin install agent-config@event4u-agent-config` | [`per-ide/copilot.md`](setup/per-ide/copilot.md) |
| **Aider** (export-only) | `agent-config export --tool=aider --output=<path>` | [`per-ide/aider.md`](setup/per-ide/aider.md) |
| **Zed** (export-only) | `agent-config export --tool=zed --output=<path>` | [`per-ide/zed.md`](setup/per-ide/zed.md) |
| **JetBrains AI** (export-only) | `agent-config export --tool=jetbrains --output=<path>` | [`per-ide/jetbrains.md`](setup/per-ide/jetbrains.md) |

Combine tools by comma-separating: `--tools=claude-code,cursor,windsurf`.
**Export-only** hosts (Aider, Zed, JetBrains) and Copilot have no user-level
folder the installer can write to: `init` prints a hint for them and writes
nothing; `agent-config export`
writes real files into a path you choose (and you decide whether to commit
them).

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

## Install commands

### `npx` (Node ≥ 22.6)

```bash
# Opens the browser wizard on a desktop
npx @event4u/agent-config init

# No wizard: pick the tools on the command line
npx @event4u/agent-config init --tools=claude-code,cursor

# No wizard, no questions (CI, scripts)
npx @event4u/agent-config init --yes --tools=claude-code

# Test a specific git ref (branch, tag, sha) instead of the latest npm tag
npx @event4u/agent-config init --ref=main --yes
```

`init` opens the install wizard when a display is usable and otherwise runs
the same installer without it. `--yes`, `--tools=<ids>`, `--no-ui`,
`--dry-run`, a CI environment, `AGENT_CONFIG_NO_UI=1` or a non-interactive
terminal all select the path without the wizard. `agent-config install`
opens the same wizard as `init`; it is not a separate installer. The same
package exposes every other subcommand — see `npx @event4u/agent-config help`.

### `curl | bash` (registry-independent)

```bash
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh \
  | bash -s -- --tools=claude-code,cursor --yes
```

Requires `bash`, `tar`, `curl` (or `wget`) and **Node ≥ 22.6** (`setup.sh`
runs `need_cmd node`). It fetches a GitHub tarball and runs a
dependency-inlined bundle, so it never performs npm dependency resolution —
use it when the registry path cannot resolve
([`ETARGET` / `No matching version found`](troubleshooting.md#npm-error-etarget--no-matching-version-found)):
restricted networks, mirrored or private registries, stale cached metadata.

### Global CLI (`agent-config` on `$PATH`)

```bash
npm install -g @event4u/agent-config
agent-config init --tools=claude-code
```

Optional. It puts `agent-config` on `$PATH` so you do not type `npx` each
time; what `init` installs is the same either way.

### Install flags worth knowing

- `--dry-run` prints the plan (tools, targets, wizard decision) and exits 0
  without writing anything.
- `--no-ui` suppresses the browser wizard (also `AGENT_CONFIG_NO_UI=1`).
  See [`wizard.md § Auto-launch`](wizard.md#auto-launch-from-npx--init).
- `--full` keeps this machine's installed rule layer full-bodied: it writes
  one `user_pin` field into the install receipt
  (`~/.event4u/agent-config/runtime/carrier.json`), and the package never
  thins the layer while it is there. It is sticky — a later install or
  upgrade keeps it — and `agent-config uninstall` removes it.
- `--enrol` lets a session thin this machine's installed rule layer while
  the package's own promotion switch is still off. The layer is thinned only
  when the layer-form decision holds (`agent-config doctor --check
  layer-form` prints it). `--full` wins over `--enrol`. Meant for maintainer
  machines; not a setting.

## What lands where

**In your home directory.** The package, its lockfile
(`~/.event4u/agent-config/installed.lock`) and its runtime live under
`~/.event4u/agent-config/`. Each selected tool gets its content in its own
user-level folder — `~/.claude/`, `~/.cursor/`, `~/.codeium/windsurf/`,
`~/.gemini/` and so on; the per-IDE pages list the exact folders. For Claude
Code the install also registers its hooks in a managed block of
`~/.claude/settings.json`.

**In a repository.** Your own changes live in `agents/overrides/`, which you
commit. The gitignored bookkeeping files are:

- the managed `# event4u/agent-config` block in `.gitignore`;
- the `./agent-config` wrapper script;
- the install-mode marker `agents/.agent-state/install-mode.txt`;
- one pointer file each for the three tools that cannot read a user-level
  folder: `.windsurf/agent-config.bridge.yml`,
  `.clinerules/agent-config.bridge.yml` and `.gemini/agent-config.bridge.yml`.

`agent-config init --project` (the same writer as `agent-config refresh
--project`) creates the `agents/overrides/` folder and the `.gitignore` block
in the current repository and installs nothing else.

To commit a tool's generated config into a repository on purpose, eject it:

```bash
agent-config export --tool=<id> --output=<path>
```

(Idempotent; `--force` overrides drift; `--list` enumerates the tool ids. The
export contract is in [`docs/contracts/command-clusters.md`](contracts/command-clusters.md).)

## Teams

Every developer runs `init` once on their own machine; nothing about the
install is shared through the repository. What a team shares is
`agents/overrides/` — commit it, and every teammate's agent picks it up. A
new teammate clones the repository and runs
`npx @event4u/agent-config init --tools=<their tools>`.

Settings resolve through a cascade that starts in your home directory
(`~/.event4u/agent-config/settings/`); a project may add its own
`.agent-settings.yml` on top. `agent-config settings:get <key>` prints a value
and the file it came from.

---

## Marketplace plugins

### Claude Code — the plugin is a shim, not a content channel

The Claude Code marketplace plugin carries one pointer skill
(`install-agent-config`) that tells you to run the npm install; it delivers no
skills, rules or commands
([ADR-209](decisions/ADR-209-projection-era-corrections.md)).

**Do not install the marketplace plugin for Claude Code.** The npx/npm
global install (`npx -y @event4u/agent-config init`) is the single supported
surface: it deploys skills/commands/rules to `~/.claude/` **and** registers
the deterministic hooks in a managed `~/.claude/settings.json` block. The
plugin would only duplicate every skill/command listing while its git-SHA
snapshot silently lags each release.

Already have the plugin from an earlier install?

```bash
claude plugin uninstall agent-config@event4u-agent-config
```

Hooks keep firing after removal (they live in `settings.json`, not the
plugin); `agent-config doctor` verifies via the `hook-wiring` check and
flags a leftover plugin as `claude-plugin: duplicate surface`.

The hook commands do not depend on `PATH`. The global install stages what they
need — the dispatcher bundle, the node it ran under, and the rule bodies the
stubs of a thinned layer point at — under `~/.event4u/agent-config/runtime/`,
so an `npx` install keeps working after npm clears its cache. Each command
tries that staged dispatcher first, then an `agent-config` binary on `PATH` —
only when its resolved path is absolute and outside the opened project. Since
17.0.0 nothing inside the project runs as a hook: not a project-local install,
not a source checkout's `dist/`, not a local `./agent-config`, because a cloned
repository could commit any of them. When no dispatcher is reachable, a
`PreToolUse` call from the `settings.json` carrier is refused with a message
naming the repair, so on an npx/npm install the `fail_closed` guards never pass
silently; every other event keeps exit 0. The plugin carrier is the exception,
below. To work on the hooks in a source checkout, reinstall to stage your build.

**A plugin-only install is unguarded.** If the marketplace plugin is installed
without the npm package (no `npx -y @event4u/agent-config init`, no
`npm i -g @event4u/agent-config`), no dispatcher is reachable, so no
agent-config hook runs at all — the three `fail_closed` guards
`block-no-verify`, `block-kernel-rule-writes` and `block-plumbing-writes`
included. The plugin's `PreToolUse` command then exits 0 with one stderr line,
which Claude Code generally does not show you; the only visible notice is the
line the `SessionStart` hook prints into the session context. This degraded
state is deliberate — refusing every tool call on a plugin-only install would
lock out a user who has no package to enforce with — but it means guard
coverage does **not** extend to plugin-only installs. Install the npm package
to get the guards. The install probes the `SessionStart` command
from `PATH=/usr/bin:/bin` and records the outcome in
`~/.event4u/agent-config/runtime/carrier.json`; the `hook-carrier` check in
`agent-config doctor` re-runs the probe and prints the layer state and since
when the outcome holds. A thinned rule layer is only written on a carrier that
probe reached. If a session still starts with no dispatcher on a thinned layer,
it prints one line saying so, restores the full layer for the next session, and
the machine stays full until an install, upgrade or doctor run passes the probe.
An install always writes the full layer. Thinning it is a later session's
decision, made by the `layer-promote` `SessionStart` concern from the package's
own evidence (`agent-config doctor --check layer-form` prints the decision), and
that promotion ships switched off until the package's pre-registered comparison
enables it; a session whose rule arrivals contradict a thinned layer restores it
and demotes the machine, whatever the switch says. `AGENT_CONFIG_LAYER_PROMOTE=off`
stops the concern. A promotion holds the lock file
`~/.event4u/agent-config/runtime/promoting`, naming its process; if that process
is gone but its id was reused by another, the concern does nothing until that
process exits, and deleting the file releases it at once.
`agent-config uninstall --global --purge` removes the staged runtime; a plain
uninstall keeps it, because the preserved stubs under `~/.claude` point into it.

The same global install also writes Claude Code's `skillOverrides` for the
skills it deployed: the set that fits the host's description budget keeps its
description, every other package skill is set `name-only` — still listed, still
invocable by name and by `/name`. There is no setting for it. A key you already
set is never overwritten (the installer reports it), and what the package wrote
is recorded in `~/.event4u/agent-config/skill-overrides.json`;
`agent-config uninstall` removes exactly those keys, keeping any you changed
since. To undo it by hand, delete the recorded keys under `skillOverrides` and
the record file.

These values sit on the **user** layer, and a project layer wins over it: a
`skillOverrides` value in a project's `.claude/settings.json` overrode a
user-layer value for the same skill when observed on Claude Code 2.1.299
(`agents/evidence/analysis/host-skill-listing-override.md`; one skill, one value
pair). So a project can set a skill differently without touching the install,
and the installer's values do not reach a skill the project already sets.
Whether a project's `skillOverrides` merges per skill or replaces the user's
whole object was not observed.

### Augment CLI and Copilot CLI

```bash
auggie plugin install agent-config@event4u-agent-config
copilot plugin install agent-config@event4u-agent-config
```

Both need the marketplace registered once
(`auggie marketplace add event4u-app/agent-config`,
`copilot marketplace add event4u-app/agent-config`). The npm install above is
the supported path for both tools; see their per-IDE pages.

---

## Cloud / Hosted agent installation

For agents running outside your local machine — Claude.ai Web Skills
and Linear AI — the package's local installer cannot run. Instead,
the package ships pre-built artefacts you upload or paste into the
hosted platform's own configuration surface.

These channels are **additional** to the local install;
use them when the agent loop runs on the platform's servers,
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
   See [`scripts/audit_cloud_compatibility.py`](../src/scripts/audit_cloud_compatibility.ts)
   for per-skill tier and [`scripts/build_cloud_bundle.py`](../src/scripts/build_cloud_bundle.ts)
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

## After installation: choose a profile

The system works immediately with sensible defaults. Optionally, create `.agent-settings.yml`
to choose a profile:

```yaml
rule_loading_tier: balanced
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

→ [Full getting started guide](getting-started.md)

---

## Updating

```bash
agent-config upgrade                   # install the latest package and refresh every tool
agent-config refresh --global          # re-apply the installed version (no version change)
npx @event4u/agent-config@latest init  # or: run init again from the latest tarball
```

The installer is idempotent. It never overwrites anything in
`agents/overrides/` or a file you changed after the install; those are kept
and reported.

---


## AI Council local state

The AI Council ([`docs/contracts/ai-council-config.md`](contracts/ai-council-config.md))
writes two local-only files outside the repo contract:

- `~/.event4u/agent-config/cli-calls.json` — per-day call counter for
  `mode: cli` members. Daily UTC reset. Inspect with
  `agent-config council quota`; clear today's counter for one provider
  with `agent-config council quota --reset <provider> --confirm`.
- `agents/runtime/council/events.log` — JSONL audit trail. One line per
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
  `agents/runtime/council/events.log` in-process. Quota counter and council
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
   `settings/.ai-council.yml`, or `roadmaps-progress.md` — bare `agents/`
   does **not** anchor (D1).

If no boundary anchor exists in any ancestor, the **outermost**
(closest-to-fs-root) `.agent-settings.yml` becomes the root. This
preserves the layered-settings cascade — see
[`agents/runtime/council/sessions/step-7-d3-cascade-conflict-decision.md`](../agents/runtime/council/sessions/step-7-d3-cascade-conflict-decision.md)
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

### What the agent is actually carrying — `doctor --anatomy`

```bash
agent-config doctor --anatomy          # text
agent-config doctor --anatomy --json   # one document, both halves
```

Renders the injection anatomy from measurements that already exist: the
preamble byte census (what occupies the always-loaded context — user-scope
rules, project-scope rules, the `CLAUDE.md` hierarchy, the skills catalog, and
the named residual bucket) joined to the dispatch-economy report (what the
dispatch legs cost). It takes **no new measurement** and gates on nothing —
both sources are advisory and stay advisory here.

The dispatch-economy half needs local transcripts and the registration file. On
a machine that has neither it is reported as unavailable, with the reason, and
never as a zero.

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

## Uninstall

```bash
agent-config uninstall --global --dry-run   # preview: what would be removed
agent-config uninstall --global --purge     # remove everything the install wrote
```

`agent-config uninstall --global` removes the install's entries for every tool
(or only those named with `--tools=<ids>`), the Claude Code hooks block in
`~/.claude/settings.json`, the listing overrides it wrote and the lockfile.
Without `--purge` the deployed skills, rules and commands stay in the tools'
user-level folders; with `--purge` it deletes exactly the files it recorded
and keeps any you changed since. `--force` proceeds when the lockfile and the
folders disagree.

**Full removal**, in this order:

1. `agent-config uninstall --global --purge`
2. Delete the package's own folder: `rm -rf ~/.event4u/agent-config`
   (deployment ledger, install log, settings state).
3. In each repository you used it in: delete the
   `# event4u/agent-config` … `# event4u/agent-config — END` block from
   `.gitignore`, the `./agent-config` wrapper,
   `agents/.agent-state/install-mode.txt`, any
   `.windsurf/agent-config.bridge.yml`, `.clinerules/agent-config.bridge.yml`
   and `.gemini/agent-config.bridge.yml`, and `agents/overrides/` if you no
   longer want your overrides.
4. Remove the npm package if you installed it globally:
   `npm uninstall -g @event4u/agent-config`.
5. If you ever installed the Claude Code plugin:
   `claude plugin uninstall agent-config@event4u-agent-config`.

After these steps no agent-config path remains; a `~/.claude/settings.json`
the install created stays behind as an empty `{}`.

See also: [docs/troubleshooting.md](troubleshooting.md).


---

← [Back to README](../README.md)
