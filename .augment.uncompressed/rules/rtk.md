---
type: "auto"
description: "Using rtk (Rust Token Killer) to wrap CLI commands for token-efficient output filtering"
---

# rtk (Rust Token Killer)

**What:** High-performance CLI proxy that reduces LLM token consumption by 60-90%
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

## Detection & Installation Prompt

**Before using CLI commands that produce verbose output**, check if rtk is available:

1. Run `which rtk` (silent, no output to user).
2. **If installed** → prefix commands with `rtk` when output may exceed ~30 lines.
3. **If NOT installed** → check `.agent-settings` for `rtk_last_asked`:
   - If missing or date is **before today** → prompt the user (see below).
   - If date is **today** → skip, don't ask again. Use normal commands.

**Prompt template** (translate to user's language):

> 💡 **rtk** (Rust Token Killer) is not installed on your system.
> It reduces token consumption by 60-90% on common CLI commands — recommended by Matze.
>
> 1. Install via Homebrew — `brew install rtk` (recommended on macOS)
> 2. Install via Cargo — `cargo install rtk`
> 3. Skip for now — I'll ask again tomorrow

**On user response:**
- **1 or 2** → Run the chosen install command. After success:
  1. `rtk --version` to verify installation.
  2. `rtk init --global` to enable auto-rewrite hooks.
  3. Apply **Post-Install Setup** (see below) — telemetry, tee, audit logging.
  4. Run `/optimize-rtk-filters` to create project-local filters.
  5. Save `rtk_installed=true` in `.agent-settings`.
- **3** → Save `rtk_last_asked=YYYY-MM-DD` (today) in `.agent-settings`. Use normal commands.

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
