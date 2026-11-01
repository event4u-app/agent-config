# Kilo Code Setup

Kilo Code (VS Code extension, Cline fork). The installer deploys the skill bundle to its user-level folder `~/.kilocode/`.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- Kilo Code VS Code extension: <https://github.com/Kilo-Org/kilocode>.
- Node.js >= 22.6 (for `npx`).

## Install

```bash
npx @event4u/agent-config init --tools=kilocode
```

## What lands

Under `~/.kilocode/`:

- `rules/`    — kernel + routed rules
- `skills/`   — skill bundle
- `commands/` — slash-command bodies (invoke them by name in chat)
- `personas/` — review-lens personas

Nothing is written into your repository besides `agents/overrides/` and
the gitignored bookkeeping files.

## How to use

- Kilo Code exposes a mode switcher (Architect / Code / Ask / Debug /
  Orchestrator). Orchestrator is the closest match for this package's
  `/implement-ticket` or `/work` flows.
- Slash commands are not registered natively — name the command in chat
  (e.g. *"run the create-pr command"*).

## Verification

```bash
ls ~/.kilocode/rules/ | head -5
ls ~/.kilocode/skills/ | head -5
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Directories under `~/.kilocode/` missing | Re-run `npx @event4u/agent-config init --tools=kilocode`. |
| You used `--tools=kilocode` and nothing changed in the repo | Expected — the install is user-level; check `~/.kilocode/`. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstalling](../../installation.md#uninstall) — removal sequence.
