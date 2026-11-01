# Roo Code Setup

Roo Code (VS Code extension, formerly Roo Cline). The installer deploys the skill bundle to its user-level folder `~/.roo/`.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- Roo Code VS Code extension: <https://github.com/RooCodeInc/Roo-Code>.
- Node.js >= 22.6 (for `npx`).

## Install

```bash
npx @event4u/agent-config init --tools=roocode
```

## What lands

Under `~/.roo/`:

- `rules/`    — kernel + routed rules
- `skills/`   — skill bundle
- `commands/` — slash-command bodies (invoke them by name in chat)
- `personas/` — review-lens personas

Nothing is written into your repository besides `agents/overrides/` and
the gitignored bookkeeping files.

## How to use

- Roo Code exposes a mode switcher (Architect / Code / Ask / Debug /
  Custom).
- Slash commands are not registered natively — name the command in chat
  (e.g. *"run the create-pr command"*).

## Verification

```bash
ls ~/.roo/rules/ | head -5
ls ~/.roo/skills/ | head -5
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Directories under `~/.roo/` missing | Re-run `npx @event4u/agent-config init --tools=roocode`. |
| You used `--tools=roocode` and nothing changed in the repo | Expected — the install is user-level; check `~/.roo/`. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstalling](../../installation.md#uninstall) — removal sequence.
