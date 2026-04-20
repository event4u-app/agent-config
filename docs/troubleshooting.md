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
php vendor/bin/install.php --verbose
# or
bash scripts/install --verbose
# or, to regenerate everything (overwrites existing bridge files):
bash scripts/install --force
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

## `composer require` / `npm install` runs, but no files were created

Several security-conscious setups disable post-install hooks:

```bash
composer config allow-plugins.false
# or in ~/.npmrc:
ignore-scripts=true
```

In that case, the post-install hook never runs. Execute the installer
manually:

```bash
php vendor/bin/install.php          # for Composer
# or for npm — invoke the orchestrator directly:
bash node_modules/@event4u/agent-config/scripts/install
```

The [`scripts/postinstall.sh`](../scripts/postinstall.sh) wrapper prints a
loud error block when the underlying installer fails, so if you saw no
output at all, scripts are likely disabled on your side.

---

## Broken symlinks after `composer update` / `npm update`

When the package version changes, symlinks that pointed to the old
vendor path may break. Re-run the installer — it is idempotent:

```bash
php vendor/bin/install.php
# or
bash scripts/install
```

The installer replaces stale symlinks with fresh ones pointing at the
current vendor path.

---

## Installation on Windows

Native Windows is not a first-class target. The installer relies on Bash
and Unix-style symlinks. Recommended setup:

1. **WSL2** (preferred): install Ubuntu or a distribution of your choice,
   clone the project inside the WSL filesystem, and run `composer
   install` / `npm install` from WSL.
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
# 1. Remove the dependency
composer remove event4u/agent-config
# or
npm uninstall @event4u/agent-config

# 2. Remove generated content from the project
rm -rf .augment .claude .cursor .clinerules .windsurfrules GEMINI.md
rm -f .agent-settings
rm -f .github/copilot-instructions.md
# Remove the "# event4u/agent-config" block from .gitignore manually
```

Keep `AGENTS.md` if you customized it — it is yours, not the package's.

---

## Still stuck?

Open an [issue](https://github.com/event4u-app/agent-config/issues) with:

- your OS and shell,
- PHP / Node / Python versions,
- full output of `bash scripts/install --verbose --dry-run`.
