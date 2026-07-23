---
title: Installation
description: Install agent-config via npx, the curl one-liner, or as an npm dependency — plus the host-tool support matrix and install scope.
---

The fastest path — run in your project and follow the wizard:

```bash
npx -y @event4u/agent-config init
```

On a terminal with a display this auto-launches a browser wizard; the same
installer runs behind it. All install paths run the **same** installer and
produce identical results.

## Three install paths

| Path | Command | Notes |
|---|---|---|
| **npx** (canonical) | `npx -y @event4u/agent-config init` | Recommended; opens the wizard on a TTY |
| **curl one-liner** | `curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh \| bash` | Downloads the tarball, runs the installer, cleans up |
| **npm dependency** | install as a dependency, then `agent-config …` | `bin.agent-config` → the bundled CLI |

**npx flags:** `--profile=<minimal|balanced|full>`, `--tools=<list>`,
`--dry-run` (preview writes), `--no-ui`, `--gui`.

**Headless / CI:** the wizard is skipped automatically when `CI` is set, stdout
is not a TTY, `--no-ui` is passed, or an explicit `--tools=` is given — the
non-interactive installer then runs directly.

The **setup wizard** (`agent-config setup`) boots a small server on `127.0.0.1`
(loopback-bound, CSRF-gated) and opens at `/#/wizard`; its first question is
which experience you want, which sets your [profile](/agent-config/configuration/profiles/).

## Install scope

Pick **one scope per machine**:

- **User-global** (default for `init` since v2.5+) — writes
  `~/.event4u/agent-config/`, `~/.claude/`, `~/.cursor/`, … Your project tree
  gets an `agents/overrides/` folder only.
- **Project-local** — maintainer-only, behind `AGENT_CONFIG_DEV_MODE=1`.

The installer refuses a second conflicting scope via a pre-flight guard.

## Supported host tools

Rules project into every tool; skills are native to Claude Code; commands are
native on Claude Code and text-referenced elsewhere.

| Tool | Rules | Skills | Commands | Mechanism |
|---|---|---|---|---|
| Claude Code | ✅ | ✅ | ✅ | `.claude/` |
| Cursor | ✅ | — | text-ref | `.cursor/rules/` + `AGENTS.md` |
| Cline | ✅ | — | text-ref | `.clinerules/` + `AGENTS.md` |
| Windsurf | ✅ | — | text-ref | `.windsurfrules` + `AGENTS.md` |
| Gemini CLI | ✅ | — | text-ref | `GEMINI.md` |
| GitHub Copilot | ✅ | — | text-ref | `.github/copilot-instructions.md` |
| Roo Code | ✅ | — | text-ref | `.roo/rules/` + `AGENTS.md` |
| Codex CLI | ✅ | — | text-ref | `AGENTS.md` |
| Continue.dev | ✅ | — | text-ref | `.continue/rules/` + `AGENTS.md` |
| Aider · Augment · Claude Desktop | marker | — | — | global / manual marker |

Full `--tools=` id list:
`claude-code,cursor,augment,windsurf,cline,gemini-cli,copilot,roocode,aider,codex,claude-desktop,continue`.

> The core suite is **provider-agnostic and needs no API keys**. Only the
> optional AI-council and team features consult external models, and those keys
> are configured separately (see
> [Configuration](/agent-config/configuration/overview/)).

## Keeping in sync

Team members run `npx @event4u/agent-config sync` after clone; CI can gate drift
with `agent-config validate`. There is no one-shot uninstall command yet —
removal is manual (see the
[installation guide](https://github.com/event4u-app/agent-config/blob/main/docs/installation.md)).
