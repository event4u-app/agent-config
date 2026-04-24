---
name: rtk-output-filtering
description: "Use when running verbose CLI commands — wraps them with rtk (Rust Token Killer) for 60-90% token savings. Covers installation, configuration, and usage patterns."
source: package
execution:
  type: assisted
  handler: shell
  allowed_tools: []
---

# rtk (Rust Token Killer)

## When to use

- Before running any CLI command expected to produce >30 lines of output
- When setting up rtk on a new machine or project
- When creating/optimizing project-local rtk filters

## What

High-performance CLI proxy that reduces LLM token consumption by 60-90%
on common dev commands through intelligent output filtering (whitespace, boilerplate,
comments, duplicate log messages). Single Rust binary, <10ms startup overhead.

**Docs:** https://www.mintlify.com/rtk-ai/rtk
**Repo:** https://github.com/rtk-ai/rtk

## Usage

Wrap any CLI command with `rtk`:
```bash
rtk git status        # 80-92% savings
rtk git log           # compact log output
rtk cargo test        # 90% savings — only failures shown
rtk npm test          # same for JS/TS
rtk docker compose ps # compact container status
```

## Procedure: Wrap commands with rtk

1. Read `personal.rtk_installed` from `.agent-settings.yml`.
2. **If `true`** → prefix commands with `rtk` when output >30 lines expected.
3. **If `false` or missing** → use plain commands. Do not prompt the user.
4. After wrapping: verify output is useful (not truncated on completeness-critical commands).

Installation and one-time setup are owned by
[`/onboard`](../../commands/onboard.md). If the user asks to install rtk
outside onboarding, follow the Installation section below and set
`personal.rtk_installed: true` on success.

## Output format

1. Wrapped command with `rtk` prefix
2. Token savings estimate (if first use in conversation)

## Installation (on-demand)

Invoked by `/onboard` when rtk is not on `PATH`, or on explicit user
request. Never fire unsolicited.

1. Ask which installer to use (macOS → Homebrew; otherwise Cargo).
2. Run the installer. On success:
   1. `rtk --version` to verify.
   2. `rtk init --global` to enable auto-rewrite hooks.
   3. Apply **Post-Install Setup** below (telemetry, tee, audit logging).
   4. Generate project-local filters (see Post-Install Setup).
   5. Write `personal.rtk_installed: true` to `.agent-settings.yml`.

## Post-Install Setup (mandatory)

After installation, **always** apply these steps before any rtk usage:

### 1. Disable telemetry

rtk ships with **telemetry enabled by default** (opt-out). Sends anonymous usage data daily.

```bash
# Add BOTH — env var (immediate) + config (persistent)
echo 'export RTK_TELEMETRY_DISABLED=1' >> ~/.zshrc

mkdir -p ~/.config/rtk
# In ~/.config/rtk/config.toml:
# [telemetry]
# enabled = false
```

### 2. Enable tee recovery (safety net)

Saves raw unfiltered output on command failures. Auto-cleans (max 20 files, oldest deleted).
Prevents re-running commands just to see full output.

```toml
# In ~/.config/rtk/config.toml:
[tee]
enabled = true
mode = "failures"
max_files = 20
max_file_size = 1048576
```

### 3. Enable hook audit logging

Logs all hook-rewritten commands so you can trace what rtk intercepted.

```bash
echo 'export RTK_HOOK_AUDIT=1' >> ~/.zshrc
```

### Reference config (`~/.config/rtk/config.toml`)

```toml
[telemetry]
enabled = false

[tracking]
enabled = true
history_days = 30

[tee]
enabled = true
mode = "failures"
max_files = 20
max_file_size = 1048576

[display]
colors = true
emoji = true
max_width = 120
```

## When to use rtk

| Command | Use rtk? |
|---|---|
| `git status/log` | ✅ Always |
| `git push/pull` | ✅ Always |
| Test runners (`cargo test`, `npm test`, `phpunit`) | ✅ Always |
| Linters (`phpstan`, `eslint`, `tsc`) | ✅ Always |
| `docker compose ps/logs` | ✅ Always |
| Short commands (< 5 lines expected) | ❌ No overhead benefit |
| Commands piped to `grep`/`tail` already | ❌ Already filtered |

## Never use rtk for

| Command | Why |
|---|---|
| `git diff` | ⛔ Silent truncation at ~50 changes — LLM decides on incomplete data (Issue #827) |
| `rtk read` | ⛔ Same truncation risk — use `cat`/`view` instead |
| Any command where **completeness matters** | ⛔ rtk may strip context needed for correct decisions |

When debugging or reviewing diffs, **always run the raw command** without rtk.

## Project-Local Filters

Custom filters for the project's PHP/Laravel toolchain live in `.rtk/filters.toml`
(project root, versioned in Git). These override global filters for matching commands.

Covered: PHPStan, Pest, ECS, Rector, Docker Compose, Artisan, Composer.

To generate or update project-local filters → use the `/optimize-rtk-filters` command.

## Gotcha

- `rtk git diff` silently truncates at ~50 changes — you'll make decisions on incomplete data
- `rtk read` has the same truncation risk — always use `cat`/`view` instead
- Telemetry is enabled by default — always disable it during installation
- The tee recovery (`mode = "failures"`) is your safety net — without it, re-run is the only option

## Do NOT

- Do NOT use `rtk` for `git diff` or any command where completeness matters
- Do NOT skip the post-install setup (telemetry, tee, audit logging)
- Do NOT use rtk for commands already piped through `grep`/`tail`
- Do NOT use rtk for short commands (< 5 lines expected output)
