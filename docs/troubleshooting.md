# Troubleshooting

Common problems and how to resolve them. If your case is not covered,
please open an [issue](https://github.com/event4u-app/agent-config/issues)
and include the output of:

```bash
composer show event4u/agent-config            # or: npm ls @event4u/agent-config
php --version
python3 --version
bash scripts/install --verbose --dry-run
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
bash scripts/install --verbose
# or, to regenerate everything (overwrites existing bridge files):
bash scripts/install --force
# or, for one-shot installs without a local node_modules tree:
npx @event4u/create-agent-config init --tools=claude-code,cursor
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
npx @event4u/create-agent-config init --tools=claude-code,cursor

# When the global CLI is installed
agent-config install --tools=claude-code,cursor
```

---

## Broken symlinks after upgrading the package

When the package version changes, symlinks that pointed to the old
package path may break. Re-run the installer — it is idempotent:

```bash
npx @event4u/create-agent-config init --tools=claude-code,cursor
```

The installer replaces stale symlinks with fresh ones pointing at the
current package path.

---

## Installation on Windows

Native Windows is not a first-class target. The installer relies on Bash
and Unix-style symlinks. Recommended setup:

1. **WSL2** (preferred): install Ubuntu or a distribution of your choice,
   clone the project inside the WSL filesystem, and run
   `npx @event4u/create-agent-config init` from WSL.
2. **Git Bash**: works for the basic install, but symlinks require
   Developer Mode (Windows 10 1703+) or admin privileges. Without either,
   Git Bash falls back to copies, which means updates will not propagate
   automatically — re-run the installer after each update.
3. **Plain PowerShell / cmd**: not supported.

If you need native Windows support without WSL, please open an issue —
we cannot validate changes without access to a Windows setup.

---

## `Python 3 is required but was not found`

The bridge installer is Python-based and needs Python 3.8+ on PATH.

- **macOS 12.3+**: Python 3 is pre-installed as `python3`.
- **Linux**: `apt install python3` / `dnf install python3` / equivalent.
- **Windows**: install from [python.org](https://www.python.org/downloads/)
  or from the Microsoft Store; ensure "Add python.exe to PATH" is
  checked.

The portability check, compression pipeline, and test suite also depend
on Python 3 — it is required for contributors, not just consumers.

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

## Still stuck?

Open an [issue](https://github.com/event4u-app/agent-config/issues) with:

- your OS and shell,
- Node / Python versions,
- full output of `bash scripts/install --verbose --dry-run`.
