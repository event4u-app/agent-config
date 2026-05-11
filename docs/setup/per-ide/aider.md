# Aider Setup

Aider reads `AGENTS.md` (and the legacy `CONVENTIONS.md` if present)
from the repo root for project conventions.

## Prerequisites

- Aider installed: <https://aider.chat>.
- Node.js ≥ 18 (for the install entrypoints).

## Install

```bash
npx @event4u/create-agent-config init --tools=aider
```

Populates:

- `AGENTS.md`             — agent self-orientation (Aider auto-loads)
- `.agent-settings.yml`   — per-project knobs

Aider's chat will read `AGENTS.md` on every session start. Add it to
the chat explicitly if Aider doesn't pick it up:

```bash
aider AGENTS.md
```

## Verification

```bash
test -f AGENTS.md
```

In Aider: type `/tokens` — `AGENTS.md` should appear in the loaded
files list.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `AGENTS.md` not auto-loaded | `aider --read AGENTS.md` or `/read AGENTS.md`. |
| Conventions ignored | Aider reads `CONVENTIONS.md` legacy too — check `--auto-commits` flag. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
