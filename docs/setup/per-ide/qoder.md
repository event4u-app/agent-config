# Qoder Setup

Qoder (<https://qoder.com>). The installer deploys the skill bundle to its user-level folder `~/.qoder/`.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- Qoder IDE: <https://qoder.com>.
- Node.js >= 22.6 (for `npx`).

## Install

```bash
npx @event4u/agent-config init --tools=qoder
```

## What lands

Under `~/.qoder/`:

- `rules/`    — kernel + routed rules
- `skills/`   — skill bundle
- `commands/` — slash-command bodies (invoke them by name in chat)
- `personas/` — review-lens personas

Nothing is written into your repository besides `agents/overrides/` and
the gitignored bookkeeping files.

## How to use

- Slash commands (`/work`, `/implement-ticket`, `/commit`, …) are not
  registered natively — invoke them by name in chat.
- Open the project root in Qoder so the agent sees your
  `agents/overrides/` folder.

## Verification

```bash
ls ~/.qoder/rules/ | head -5
ls ~/.qoder/skills/ | head -5
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Directories under `~/.qoder/` missing | Re-run `npx @event4u/agent-config init --tools=qoder`. |
| You used `--tools=qoder` and nothing changed in the repo | Expected — the install is user-level; check `~/.qoder/`. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstalling](../../installation.md#uninstall) — removal sequence.
