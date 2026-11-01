# Cursor Setup

Cursor reads user-level rules and commands from `~/.cursor/`. The
installer deploys them there; Cursor merges these user rules with any
rules a workspace defines itself.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- Cursor (any current build): <https://cursor.com>.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=cursor
```

Combine hosts in one run if you also use Claude Code:

```bash
npx @event4u/agent-config init --tools=cursor,claude-code
```

Populates `~/.cursor/`:

- `~/.cursor/rules/`    — kernel + routed rules
- `~/.cursor/commands/` — slash commands
- `~/.cursor/personas/` — review-lens personas
- `~/.cursor/hooks.json` + `~/.cursor/hooks/` — managed hooks

## Verification

```bash
ls ~/.cursor/rules/    | head -5
ls ~/.cursor/commands/ | head -5
test -f ~/.cursor/hooks.json
```

In Cursor type `/` in the chat — the commands should be listed.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules or commands not picked up | Reload the Cursor window after install. |
| `~/.cursor/rules/` empty | Re-run `npx @event4u/agent-config init --tools=cursor --force`. |
| Hooks never fire | Check `~/.cursor/hooks.json` exists and names the managed hooks. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [`AGENTS.md`](../../../AGENTS.md) — package self-orientation.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
