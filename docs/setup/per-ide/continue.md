# Continue.dev Setup

Continue.dev (VS Code and JetBrains extension) reads a markdown skill
bundle from its user-level anchor `~/.continue/`. The installer deploys
the shared bundle there.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- Continue extension: <https://continue.dev>.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=continue
```

Populates `~/.continue/`:

- `~/.continue/rules/`    — kernel + routed rules
- `~/.continue/skills/`   — skill bundle
- `~/.continue/commands/` — slash commands
- `~/.continue/personas/` — review-lens personas

## How to use

- Continue reads the bundle from `~/.continue/` on every session — no
  manual action required.
- Chat is the surface that uses the skills and commands; Edit and
  Autocomplete do not. Continue does not register the commands natively —
  invoke them by name in chat.
- Use `@codebase` alongside a named command so Continue retrieves the
  relevant files first.

## Verification

```bash
test -d ~/.continue/skills
test -d ~/.continue/rules
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=continue --force`, then restart Continue.dev. |
| `~/.continue/` missing after install | Check the install summary — it prints the anchor each tool was deployed to. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
