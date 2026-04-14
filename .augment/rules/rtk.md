---
type: "auto"
alwaysApply: false
description: "Using rtk (Rust Token Killer) to wrap CLI commands for token-efficient output filtering"
source: package
---

# rtk (Rust Token Killer)

CLI proxy reducing LLM token consumption 60-90% via intelligent output filtering. Single Rust binary, <10ms overhead.

**Docs:** https://www.mintlify.com/rtk-ai/rtk
**Repo:** https://github.com/rtk-ai/rtk

## Usage

```bash
rtk git status        # 80-92% savings
rtk git log           # compact log output
rtk cargo test        # 90% savings — only failures shown
rtk npm test          # same for JS/TS
rtk docker compose ps # compact container status
```

## Detection & Installation

Before verbose CLI commands, check rtk:

1. `which rtk` (silent)
2. **Installed** → prefix with `rtk` for >30 line output
3. **Not installed** → check project settings file for `rtk_last_asked`:
   - Missing or before today → prompt user
   - Today → skip, use normal commands

**Prompt:**

> 💡 **rtk** (Rust Token Killer) is not installed.
> Reduces token consumption 60-90%.
>
> 1. Install via Homebrew — `brew install rtk` (recommended on macOS)
> 2. Install via Cargo — `cargo install rtk`
> 3. Skip for now — I'll ask again tomorrow

**On response:**
- **1/2** → install, then: `rtk --version`, `rtk init --global`, Post-Install Setup, generate project-local filters, save `rtk_installed=true` in project settings
- **3** → save `rtk_last_asked=YYYY-MM-DD` in project settings, use normal commands

## Post-Install Setup (mandatory)

### 1. Disable telemetry

Telemetry enabled by default (opt-out).

```bash
# Add BOTH — env var (immediate) + config (persistent)
echo 'export RTK_TELEMETRY_DISABLED=1' >> ~/.zshrc

mkdir -p ~/.config/rtk
# In ~/.config/rtk/config.toml:
# [telemetry]
# enabled = false
```

### 2. Enable tee recovery

Saves raw unfiltered output on failures. Auto-cleans (max 20 files).

```toml
# In ~/.config/rtk/config.toml:
[tee]
enabled = true
mode = "failures"
max_files = 20
max_file_size = 1048576
```

### 3. Enable hook audit logging

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

Debugging/reviewing diffs → raw command, no rtk.

## Project-Local Filters

`.rtk/filters.toml` (project root, Git-versioned). Overrides global filters.
Covered: PHPStan, Pest, ECS, Rector, Docker Compose, Artisan, Composer.
