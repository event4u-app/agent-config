# Cline Setup

Cline (VS Code extension) reads global rules from
`~/Documents/Cline/Rules/`. The installer deploys the rules there.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- Cline VS Code extension: <https://github.com/cline/cline>.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=cline
```

Populates:

- `~/Documents/Cline/Rules/` — the rules, as flat files, plus the managed hooks
- `.clinerules/agent-config.bridge.yml` — a gitignored pointer in the repository

## Verification

```bash
ls ~/Documents/Cline/Rules/ | head
```

In VS Code open the Cline panel — the global rules should be listed in
Cline's rules view.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules not picked up | Reload the VS Code window after install. |
| `~/Documents/Cline/Rules/` empty | Re-run `npx @event4u/agent-config init --tools=cline --force`. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
