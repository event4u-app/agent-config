# Claude Code Setup

Claude Code (CLI and IDE extensions) reads user-level skills, commands
and hooks from `~/.claude/`. The installer deploys the full set there, so
every repository you open in Claude Code gets it.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- Claude Code installed (CLI or IDE extension): <https://claude.com/code>.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=claude-code
```

Populates `~/.claude/`:

- `~/.claude/skills/`   — skills
- `~/.claude/commands/` — slash commands (nested ones route as `/<cluster>:<sub>`)
- `~/.claude/rules/`    — kernel + routed rules
- `~/.claude/personas/` — review-lens personas
- `~/.claude/settings.json` — the managed hooks are registered here

## The Claude Code plugin is a shim

The package also publishes a Claude Code plugin
(`.claude-plugin/marketplace.json`). It is **not** a content channel and
not an alternative install: it carries one pointer skill,
`install-agent-config`, which tells you to run the npm install above. It
delivers no skills, rules or commands. See
[Marketplace plugins](../../installation.md#claude-code--the-plugin-is-a-shim-not-a-content-channel).

## Commands you'll use most

- `/work "<prompt>"` — refine → plan → implement → verify → report loop.
- `/commit` — Conventional-Commit splitter with a confirmation gate.
- `/pr:create` — opens a structured PR from the current branch.
- `/review:changes` — multi-judge self-review before requesting human review.
- `/agent-handoff` — generate a handoff summary for a fresh session.

## Verification

```bash
ls ~/.claude/skills/ | head
ls ~/.claude/commands/ | head
```

In Claude Code type `/` — the slash menu should list `work`, `commit`
and the other commands.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/` menu missing the commands | `ls ~/.claude/skills/` — re-run `npx @event4u/agent-config init --tools=claude-code` if empty. |
| Skills look stale after a package update | `agent-config upgrade`, then start a new Claude Code session. |
| Hook never fires | Run `claude --debug` and check the hooks block in `~/.claude/settings.json`. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [`claude-desktop.md`](claude-desktop.md) — Claude Desktop needs a separate
  upload step; it does not read `~/.claude/`.
- [`AGENTS.md`](../../../AGENTS.md) — package self-orientation.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
