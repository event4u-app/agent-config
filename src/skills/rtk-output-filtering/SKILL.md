---
model_tier: medium
name: rtk-output-filtering
description: "Use when running verbose CLI commands — wraps them with rtk (Rust Token Killer, third-party Apache-2.0; upstream reports 60-90% token savings). Covers installation, configuration, and usage patterns."
domain: process
scope:
  write: []
  verification_reason: "this skill wraps another command's stdout; it has no output path of its own. Absence of a write is not something a command can prove."
execution:
  type: assisted
  handler: shell
  allowed_tools: []
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# rtk (Rust Token Killer)

## When to use

- Before running any CLI command expected to produce >30 lines of output
- When setting up rtk on a new machine or project
- When creating/optimizing project-local rtk filters

## What

High-performance CLI proxy that reduces LLM token consumption on common dev
commands through intelligent output filtering (whitespace, boilerplate,
comments, duplicate log messages). Single Rust binary, <10ms startup overhead.
**Third-party Apache-2.0 tool** (rtk-ai upstream — an external project, not part of this package).

**Savings — STALE, and scoped. Do not quote the number without this label.**
Upstream reports 60-90% (their estimate — "actual savings vary").
agent-config's own figure is **33% overall, 0-57% per command**, and it is a
**single spot-measurement from 2026-07-28: one repo, one macOS machine, an
8-command corpus.** It has **not** been superseded by a wider run, and the
widened re-bench is **deferred** — `road-to-terminal-token-economy` steps
3.2-3.4. **The reason changed on 2026-08-23 and the label is updated with it:** the
original deferral was ordering (Phase 2 had not chosen the wrapper mechanism, so a
re-bench would measure the wrong subject). Phase 2 has now chosen — the existing
warn-only nudge — so that objection is discharged. What defers it now is the
re-bench's own registered design, which requires **at least two machines**, and only
one is reachable. A one-machine re-bench would reproduce exactly the narrowness the
widening exists to fix. AI council 2026-08-23, 2/2 convergent, on both readings.

Treat it as an order of magnitude for *that* corpus, never as this package's
general claim. Verbose commands (`git status`, `git log`, `ls -la`) save ~55%;
already-compact output (`--oneline`, `--stat`) passes through at ~0%, which is
why an overall percentage is meaningless without the corpus that produced it.
See `internal/bench/rtk-savings/RESULTS.md`.

**Docs:** https://www.mintlify.com/rtk-ai/rtk
**Repo:** https://github.com/rtk-ai/rtk

## Usage

Wrap any CLI command with `rtk`:
```bash
rtk git status        # verbose status → compact (measured ~55% here)
rtk git log           # compact log output (measured ~55% here)
rtk cargo test        # upstream: only failures shown
rtk npm test          # same for JS/TS
rtk docker compose ps # compact container status
```

## Procedure: Analyze, then wrap commands with rtk

### 1. Analyze the current setup

- Read `personal.rtk_installed` from `.agent-settings.yml`.
- Review the command about to run: estimated output size, whether
  completeness matters (e.g. diff review), and whether a project-local
  filter exists in `.rtk/filters.toml`.

### 2. Wrap (or skip)

1. **If `personal.rtk_installed: true`** → prefix commands with `rtk`
   when output >30 lines expected.
2. **If `false` or missing** → use plain commands. Do not prompt the user.
3. After wrapping: verify output is useful (not truncated on
   completeness-critical commands).

Installation and one-time setup are owned by
[`/onboard`](../../commands/onboard.md). If the user asks to install rtk
outside onboarding, follow the Installation section below and set
`personal.rtk_installed: true` on success.

## Output format

1. Wrapped command with `rtk` prefix
2. Token savings estimate (if first use in conversation)

## Installation (on-demand)

Invoked when rtk is not on `PATH` and the user explicitly asks to install
it. Never fire unsolicited.

1. Offer the verified per-OS install path (same map as
   `src/install/rtkDetection.ts` / `docs/contracts/rtk-detection.md`):
   - macOS → `brew install rtk` (official homebrew-core formula)
   - Linux → `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh`
     (installs to `~/.local/bin`)
   - Windows → `winget install rtk-ai.rtk` (plus the documented ripgrep
     dependency: `winget install BurntSushi.ripgrep.MSVC`); winget-less
     images use the upstream `rtk-x86_64-pc-windows-msvc.zip` release.
   **NEVER `cargo install rtk`** — the bare crates.io `rtk` crate is the
   unrelated Rust Type Kit, not Rust Token Killer.
2. Run the installer only on explicit confirmation. On success:
   1. `rtk gain` to verify IDENTITY (the savings dashboard prints "RTK
      Token Savings" only on Rust Token Killer — `rtk --version` cannot
      distinguish the two same-name tools).
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

Project-local custom filters live in `.rtk/filters.toml` (project root, versioned in Git). These override global filters for matching commands. Add entries for whatever tools the project actually runs.

Coverage shipped with this package (extend per project):
- PHP / Laravel: PHPStan, Pest, PHPUnit, ECS, Rector, Composer, Artisan
- JS / TS: tsc, eslint, prettier, vitest, jest, playwright, pnpm/npm/yarn install + run
- Python: ruff, mypy, pyright, pytest, pip / poetry / uv
- Go: `go test`, `go build`, `go vet`, `golangci-lint`
- Rust: `cargo build`, `cargo test`, `cargo clippy`, `cargo fmt`
- Infra / runtime: Docker Compose, Terraform, kubectl

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
