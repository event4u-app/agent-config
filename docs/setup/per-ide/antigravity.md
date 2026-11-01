# Antigravity Setup

Antigravity (Google's agentic IDE) reads a markdown skill bundle from its
user-level anchor `~/.agents/`. The installer deploys the shared bundle
there, the same one its other bundle hosts get.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- Antigravity IDE.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=antigravity
```

Populates `~/.agents/`:

- `~/.agents/rules/`    — kernel + routed rules
- `~/.agents/skills/`   — skill bundle
- `~/.agents/commands/` — slash commands
- `~/.agents/personas/` — review-lens personas

## How to use

- Antigravity reads the bundle from `~/.agents/` on every session — no
  manual action required.
- Commands ship in the bundle; invoke them by name in chat.
- Open the project root so the agent finds the repository's own
  `agents/overrides/` folder.

## Verification

```bash
test -d ~/.agents/skills
test -d ~/.agents/rules
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=antigravity --force`, then restart Antigravity. |
| `~/.agents/` missing after install | Check the install summary — it prints the anchor each tool was deployed to. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
