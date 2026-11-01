# Kiro Setup

Kiro (Amazon's agentic IDE, <https://kiro.dev>). The installer deploys
rules, skills and personas to its user-level folder `~/.kiro/`; the skills
land in Kiro's `steering/` folder rather than a separate `skills/` one.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- Kiro IDE: <https://kiro.dev>.
- Node.js >= 22.6 (for `npx`).

## Install

```bash
npx @event4u/agent-config init --tools=kiro
```

## What lands

Under `~/.kiro/`:

- `rules/`    — kernel + routed rules
- `steering/` — the skills, projected as steering documents
- `personas/` — review-lens personas

Nothing is written into your repository besides `agents/overrides/` and
the gitignored bookkeeping files.

## How to use

- Kiro ships two workflows: **Spec mode** (plan-first — the closest match
  for the package's `/implement-ticket` flow) and **Vibe mode** (free-form
  chat).
- Slash commands are not registered natively — name the command in chat
  (e.g. *"run the create-pr command"*).

## Verification

```bash
ls ~/.kiro/steering/ | head -5
ls ~/.kiro/rules/ | head -5
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Steering not loaded | Restart Kiro after install. |
| `~/.kiro/steering/` missing | Re-run `npx @event4u/agent-config init --tools=kiro`. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstalling](../../installation.md#uninstall) — removal sequence.
