# CodeBuddy Setup

CodeBuddy (Tencent's AI coding assistant) reads a markdown skill bundle
from its user-level anchor `~/.codebuddy/`. The installer deploys the
shared bundle there.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- CodeBuddy extension or CLI.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=codebuddy
```

Populates `~/.codebuddy/`:

- `~/.codebuddy/rules/`    — kernel + routed rules
- `~/.codebuddy/skills/`   — skill bundle
- `~/.codebuddy/commands/` — slash commands
- `~/.codebuddy/personas/` — review-lens personas

## How to use

- CodeBuddy reads the bundle from `~/.codebuddy/` on every session — no
  manual action required.
- Commands ship in the bundle; invoke them by name in chat.
- Open the project root so the agent finds the repository's own
  `agents/overrides/` folder.

## Verification

```bash
test -d ~/.codebuddy/skills
test -d ~/.codebuddy/rules
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=codebuddy --force`, then restart CodeBuddy. |
| `~/.codebuddy/` missing after install | Check the install summary — it prints the anchor each tool was deployed to. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
