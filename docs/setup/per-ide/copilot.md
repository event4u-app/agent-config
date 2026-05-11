# GitHub Copilot Setup

GitHub Copilot Chat (VS Code, JetBrains, Neovim, `gh copilot` CLI)
reads `.github/copilot-instructions.md` for project-level guidance and
falls back to `AGENTS.md` where supported.

## Prerequisites

- GitHub Copilot subscription (Individual, Business, or Enterprise).
- Copilot Chat enabled in your IDE.
- Node.js ≥ 18 for the install entrypoints.

## Install

```bash
npx @event4u/create-agent-config init --tools=copilot
```

Populates:

- `.github/copilot-instructions.md` — Copilot's project-level prompt
- `AGENTS.md`                       — canonical agent self-orientation
- `.agent-settings.yml`             — per-project knobs

The package keeps `.github/copilot-instructions.md` deliberately thin
(it points back to `AGENTS.md`) so all surfaces share a single source
of truth.

## VS Code Copilot Chat

Auto-loads `.github/copilot-instructions.md` once you reload the VS
Code window after install. Verify in the Copilot Chat panel —
*"What is this repo?"* should answer using the AGENTS.md emergency
triage block.

## JetBrains Copilot

JetBrains Copilot 1.5+ reads the same `.github/copilot-instructions.md`
file. No extra steps; reload the project after install.

## Neovim Copilot

`copilot.lua` and `CopilotChat.nvim` honor
`.github/copilot-instructions.md`. No extra config needed.

## `gh copilot` CLI

The `gh copilot` plugin (`gh extension install github/gh-copilot`)
reads the repo context including `AGENTS.md` and
`.github/copilot-instructions.md` when invoked from the repo root.

## Suppressing Copilot PR review noise

Copilot's PR auto-review can flag the package's own kernel rules as
"unusual phrasing". The package ships a Copilot-suppression rule
([`augment-portability`](../../../.augment/rules/augment-portability.md))
that documents this trade-off.

## Verification

```bash
test -f .github/copilot-instructions.md
test -f AGENTS.md
gh copilot --version             # if you want CLI plugin
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Copilot ignores the file | Reload the IDE window after install. |
| File missing after install | Re-run `npx @event4u/create-agent-config init --tools=copilot`. |
| Copilot PR review too noisy | See the `copilot-config` skill for suppression patterns. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`.augment/skills/copilot-config/SKILL.md`](../../../.augment/skills/copilot-config/SKILL.md)
  — tuning Copilot output and suppressing review noise.
- [`docs/installation.md`](../../installation.md) — install matrix index.
