# Droid (Factory) Setup

Droid (Factory AI's coding agent, <https://factory.ai>) reads a markdown
skill bundle from its user-level anchor `~/.factory/`. The installer
deploys the shared bundle there.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- Factory CLI or extension: <https://factory.ai>.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=droid
```

Populates `~/.factory/`:

- `~/.factory/rules/`    — kernel + routed rules
- `~/.factory/skills/`   — skill bundle
- `~/.factory/commands/` — slash commands
- `~/.factory/personas/` — review-lens personas

## How to use

- Droid reads the bundle from `~/.factory/` on every session — no
  manual action required.
- Commands ship in the bundle; invoke them by name in chat.
- Every Droid profile reads the same `~/.factory/` bundle.

## Verification

```bash
test -d ~/.factory/skills
test -d ~/.factory/rules
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=droid --force`, then restart Droid. |
| `~/.factory/` missing after install | Check the install summary — it prints the anchor each tool was deployed to. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
