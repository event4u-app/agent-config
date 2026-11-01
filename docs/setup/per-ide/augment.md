# Augment Code Setup

Augment Code (VS Code, JetBrains) reads its content from the user-level
tree `~/.augment/` on every workspace. The installer deploys the full set
there.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

> **Workspace-guidelines limit.** Augment counts the full body of every
> rule file against its 49,512-char workspace-guidelines limit. The rule
> set exceeds that limit, so an overflow warning is expected. See
> [`ADR-007 § Amendment 2026-05-13 — Augment global-only`](../../decisions/ADR-007-agent-discovery-scopes.md#amendment-2026-05-13--augment-global-only).

## Prerequisites

- Augment Code extension: <https://www.augmentcode.com/>.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=augment
```

Populates `~/.augment/`:

- `~/.augment/rules/`     — kernel + routed rules
- `~/.augment/skills/`    — skills
- `~/.augment/commands/`  — slash commands
- `~/.augment/contexts/`  — knowledge-layer contexts
- `~/.augment/personas/`  — review-lens personas
- `~/.augment/templates/` — scaffolds
- `~/.augment/hooks/`     — managed hooks

## How to use

- Augment loads `~/.augment/` on every session — no manual action
  required.
- The kernel rules load first; the routed rules load by intent.
- Commands surface as skills in Augment's available-skills list.
- Personas are review lenses; invoke them by name or via `/mode`.

## Verification

```bash
test -d ~/.augment/rules
test -d ~/.augment/skills
test -d ~/.augment/commands
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not surfaced | Reload the Augment workspace; skills are indexed on session start. |
| `~/.augment/rules/` missing | Re-run `npx @event4u/agent-config init --tools=augment --force`. |
| Workspace-guidelines overflow warning | Expected — see the note above. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/architecture.md`](../../architecture.md) — kernel + router + projection pipeline.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
