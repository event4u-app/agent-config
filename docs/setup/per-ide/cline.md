# Cline Setup

Cline (formerly Claude Dev) reads `.clinerules` (single-file aggregate)
and `AGENTS.md`.

## Prerequisites

- Cline VS Code extension: <https://github.com/cline/cline>.
- Node.js ≥ 18.

## Install

```bash
npx @event4u/create-agent-config init --tools=cline
```

Populates:

- `.clinerules`           — single-file aggregate (rules)
- `AGENTS.md`             — agent self-orientation
- `.agent-settings.yml`   — per-project knobs

## Verification

```bash
test -f .clinerules
test -f AGENTS.md
```

In VS Code: open the Cline panel — it should pick up the rules
automatically. Run `/help` in the chat to verify rule loading.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules not picked up | Reload VS Code window after `task generate-tools`. |
| `.clinerules` missing | Re-run `npx @event4u/create-agent-config init --tools=cline`. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
