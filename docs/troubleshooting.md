# Troubleshooting

Common problems and how to resolve them. If your case is not covered,
please open an [issue](https://github.com/event4u-app/agent-config/issues)
and include the output of:

```bash
composer show event4u/agent-config            # or: npm ls @event4u/agent-config
node --version

bash src/scripts/install --verbose --dry-run
```

---

## Agent doesn't seem to pick up the rules or skills

### Check 1: Are the files actually in the project?

```bash
ls -la .augment/rules/        # should list real files (rules are copied)
ls -la .augment/skills/       # should list symlinks
ls -la .claude/rules/         # Claude users: should list symlinks
ls -la .cursor/rules/         # Cursor users: should list symlinks
cat  .windsurfrules           # Windsurf users: should be a populated file
cat .github/copilot-instructions.md  # Copilot users: should exist
```

If any of these are missing or empty, the installer either didn't run or
was interrupted. Re-run it:

```bash
bash src/scripts/install --verbose
# or, to regenerate everything (overwrites existing bridge files):
bash src/scripts/install --force
# or, for one-shot installs without a local node_modules tree:
npx @event4u/agent-config init --tools=claude-code,cursor
```

### Check 2: Does your agent actually read these directories?

| Tool | Expected location |
|---|---|
| Augment Code | `.augment/rules/`, `.augment/skills/`, `.augment/commands/` |
| Claude Code | `.claude/rules/`, `.claude/skills/` (symlinks into `.augment/`) |
| Cursor | `.cursor/rules/*.mdc` |
| Cline | `.clinerules/` |
| Windsurf | `.windsurfrules` (single concatenated file) |
| Gemini CLI | `GEMINI.md` (symlinked to `AGENTS.md`) |
| GitHub Copilot | `.github/copilot-instructions.md` + `AGENTS.md` |

If a path is missing for your tool, re-running the installer recreates it.

### Check 3: Is the plugin-level install masking the project install?

If you installed the Augment / Claude Code / Copilot CLI plugin globally
AND also installed the package in the project, the agent may pick up the
plugin copy instead of the project copy. This is usually fine — both
should be the same version — but if they have drifted, pin the project
version explicitly and reinstall the plugin.

---

## Installer ran but no files appeared

The v2 distribution does **not** ship a `postinstall` hook — installing
`@event4u/agent-config` via `npm install -g` only puts the `agent-config`
binary on `$PATH`; it does not seed any project files. Run the
orchestrator explicitly inside the project root:

```bash
# One-shot, no local checkout required (recommended)
npx @event4u/agent-config init --tools=claude-code,cursor

# When the global CLI is installed
agent-config install --tools=claude-code,cursor
```

---

## Broken symlinks after upgrading the package

When the package version changes, symlinks that pointed to the old
package path may break. Re-run the installer — it is idempotent:

```bash
npx @event4u/agent-config init --tools=claude-code,cursor
```

The installer replaces stale symlinks with fresh ones pointing at the
current package path.

---

## Installation on Windows

Native Windows is not a first-class target. The installer relies on Bash
and Unix-style symlinks. Recommended setup:

1. **WSL2** (preferred): install Ubuntu or a distribution of your choice,
   clone the project inside the WSL filesystem, and run
   `npx @event4u/agent-config init` from WSL.
2. **Git Bash**: works for the basic install, but symlinks require
   Developer Mode (Windows 10 1703+) or admin privileges. Without either,
   Git Bash falls back to copies, which means updates will not propagate
   automatically — re-run the installer after each update.
3. **Plain PowerShell / cmd**: not supported.

If you need native Windows support without WSL, please open an issue —
we cannot validate changes without access to a Windows setup.

---

## `Node.js is required but was not found`

The installer is Node.js-based and needs Node 20.11+ on PATH.

\- **macOS**: install via [nodejs.org](https://nodejs.org/) or `brew install node`.
\- **Linux**: `apt install nodejs` / `dnf install nodejs` / equivalent (ensure Node 20+).
\- **Windows**: install from [nodejs.org](https://nodejs.org/) or the Microsoft
  Store; ensure "Add to PATH" is checked.

Every install path needs Node — the curl one-liner included. Python is not
required by any of them.

---

## `npm error ETARGET` / `No matching version found`

Re-run with a forced fresh metadata fetch:

```bash
npx -y --prefer-online @event4u/agent-config init
```

This happens when the project's `.npmrc` sets `prefer-offline=true`, or points
at a private-registry mirror: npm resolves dependencies against cached registry
metadata that predates a recently published version. `--prefer-online` bypasses
the cache for this run; `npm cache verify` fixes it permanently for that machine.

If the registry path stays unusable — a restricted network, an air-gapped
mirror — take the registry-independent door instead. It fetches a GitHub
tarball and runs a dependency-inlined bundle, so it performs no npm dependency
resolution at all:

```bash
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash
```

**Why this should no longer happen because of us.** The failure needs a
dependency floor that names a version your mirror has not seen yet. Since
`check_dependency_floors` runs in CI, every runtime floor we publish is a
settled minor (`^X.Y.0`), which a mirror lagging by a patch can still satisfy.
The gate exists because npm resolves dependencies *before* our CLI is executed —
when resolution fails, no code of ours ever runs, so there is nothing that could
detect the error and retry. If you hit `ETARGET` on a current version, the
remaining causes are a mirror lagging by a whole minor, or a corrupted local
cache — and the two commands above address exactly those.

---

## Uninstalling the package

There is no dedicated uninstall command yet. Remove the package and
clean up manually:

```bash
# 1. Remove the dependency (skip when installed via npx / -g)
npm uninstall @event4u/agent-config

# 2. Remove generated content from the project
rm -rf .augment .claude .cursor .clinerules .windsurfrules GEMINI.md
rm -f .agent-settings .agent-settings.yml .agent-settings.backup.key-value
rm -f .github/copilot-instructions.md agent-config
# Remove the "# event4u/agent-config" block from .gitignore manually
```

Keep `AGENTS.md` if you customized it — it is yours, not the package's.

---

## Upgrade and staleness

Moved out of `README.md` so the front page reaches its first command quickly; the content is unchanged.

### A new command / skill is missing in Claude Code after an upgrade

Under the single-surface model, `agent-config upgrade` refreshes the
`~/.claude/` file projection — that IS the content surface, so a fresh
session picks the new commands up directly. If commands are still missing,
the usual cause is a leftover **marketplace plugin**: it is a git-SHA
snapshot that never moves with the npm upgrade and it shadows nothing —
it just lists everything twice while lagging behind. Remove it:

```bash
claude plugin uninstall agent-config@event4u-agent-config
```

Then start a **new** Claude Code session. `agent-config doctor` reports a
leftover plugin as `claude-plugin: duplicate surface`; hooks are unaffected
(they live in a managed `~/.claude/settings.json` block — verify with the
`hook-wiring` check).

### Skills / commands appear twice in Claude Code

Same cause as above: the deprecated marketplace plugin is installed next to
the `~/.claude/` file projection, so every skill lists plain **and**
`agent-config:`-prefixed. Uninstall the plugin (command above) and start a
new session.

### `agent-config upgrade` fails with `Unknown argument: --no-ui`

Known bug in 8.2.0: `upgrade` passed a `--no-ui` flag that the install
orchestrator did not accept yet, so the run aborted early. Fixed on `main`;
until the next release, work around it with:

```bash
AGENT_CONFIG_NO_UI=1 agent-config global   # refresh the global install, no wizard
```

### Upgrade was interrupted (Ctrl-C, wizard closed, step failed)

Only the initial `npm install -g` hard-aborts an upgrade. Every later step
(global re-deploy with hook registration, settings sync, wrapper + git-hook
refresh) runs independently — a single failed step is reported in the
end-of-run summary instead of silently skipping the rest. Re-run
`agent-config upgrade` to converge and use `agent-config doctor` to name
anything left in a mixed state.

### `agent-config: command not found` / hooks stopped firing

Runtime hooks resolve the **global** binary on `PATH` — a project-local
install alone is not enough for them. Reinstall the binary:

```bash
npm install -g @event4u/agent-config
agent-config doctor   # verifies PATH + plugin wiring
```

### Project files look stale after a package update

Project-local projections are only rewritten on an explicit refresh:

```bash
agent-config refresh             # re-apply the installed version to this project
agent-config refresh --global    # same-version re-install of the global root
```

More per-version steps: [Migration](MIGRATION.md) ·
[getting-started § Keeping current](getting-started.md#keeping-current).

## Still stuck?

Open an [issue](https://github.com/event4u-app/agent-config/issues) with:

- your OS and shell,
- Node / Python versions,
- full output of `bash src/scripts/install --verbose --dry-run`.
