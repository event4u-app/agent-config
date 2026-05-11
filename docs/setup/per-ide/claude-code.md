# Claude Code Setup

Claude Code is the canonical agent surface for `event4u/agent-config`. It
reads from `.claude/skills/`, `.claude/commands/`, `CLAUDE.md`,
`.claude/hooks/`, and project-level MCP servers. Everything in this repo
projects to those paths during install.

## Prerequisites

- Claude Code installed (CLI or VS Code extension): <https://claude.com/code>.
- Node.js ≥ 18 (for the `npx` entrypoints).
- Git working tree (the package is repository-aware).

## Project install (recommended)

```bash
# Inside an existing repo:
npx @event4u/create-agent-config init --tools=claude-code

# Or with the curl entrypoint:
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh \
  | bash -s -- --tools=claude-code
```

Either form populates:

- `.claude/skills/`         — symlinks into `.agent-src/skills/`
- `.claude/commands/`       — symlinks into `.agent-src/commands/`
- `CLAUDE.md`               — agent root pointer (auto-loaded by Claude Code)
- `.agent-settings.yml`     — your per-project knobs (kept out of git)

## Global install (cross-project skills)

```bash
npx @event4u/agent-config global --tools=claude-code
```

Seeds `~/.claude/skills/` with the curated top-N skills from
[`templates/global-install-manifest.yml`](../../../templates/global-install-manifest.yml).
Available across every project on the machine; project-level files
always take precedence.

Uninstall:

```bash
npx @event4u/agent-config global --uninstall
```

## Plugin marketplace (Claude Code 2026+)

Claude Code 2026 supports plugin marketplaces via
`.claude-plugin/marketplace.json`. The package ships one — once
listed at the Anthropic marketplace (Phase 7 / S34) you can also:

```bash
claude plugin install event4u/agent-config
```

Today the npm/curl entrypoints above are the supported install path.

## CLAUDE.md

Auto-loaded by Claude Code from the repo root. The package's `CLAUDE.md`
points to `AGENTS.md` (single source of truth for all agent surfaces);
edit `AGENTS.md`, never `CLAUDE.md`.

## Hooks

Claude Code reads `.claude/hooks/` for pre/post tool hooks. The package
ships a memory-extraction hook (Phase 7 of `road-to-mcp-full-coverage`).
Local overrides go in `agents/overrides/.claude/hooks/`.

## Skills you'll use most

- `/work "<prompt>"` — refine → plan → implement → verify → report loop.
- `/commit` — Conventional-Commit splitter with confirmation gate.
- `/create-pr` — opens a structured PR from the current branch.
- `/review-changes` — five-judge self-review before requesting human review.
- `/agent-handoff` — produces a fresh-chat continuation summary.

Full list: `ls .claude/skills/`.

## Verification

```bash
ls -la .claude/skills/        # should symlink into .agent-src/skills/
ls -la CLAUDE.md              # exists, points to AGENTS.md
test -f .agent-settings.yml   # per-project settings rendered
```

In Claude Code itself: type `/` — the slash menu should list `work`,
`commit`, `create-pr`, etc.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/` menu empty | `ls .claude/skills/` — re-run installer if empty. |
| Skills look stale after `git pull` | `task sync && task generate-tools`. |
| Hook never fires | `claude --debug` and inspect hook output. |
| Memory MCP missing | See `road-to-mcp-full-coverage` — Phase 3 ships read-only tools. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [`docs/setup/per-ide/claude-desktop.md`](claude-desktop.md) — Desktop +
  Cowork share the same `~/.claude/skills/` path; install once, both surfaces benefit.
- [`AGENTS.md`](../../../AGENTS.md) — package self-orientation.
