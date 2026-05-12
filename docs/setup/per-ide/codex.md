# OpenAI Codex CLI Setup

OpenAI's Codex CLI (the `codex` command) reads `AGENTS.md` from the
repo root for project context.

## Prerequisites

- Codex CLI installed: <https://github.com/openai/codex>.
- Node.js ≥ 18 (for the install entrypoints).

## Install

```bash
npx @event4u/agent-config init --tools=codex
```

Populates:

- `AGENTS.md`             — agent self-orientation (Codex auto-loads)
- `.agent-settings.yml`   — per-project knobs

Codex CLI reads `AGENTS.md` automatically when invoked from the repo
root. No additional configuration needed.

## Verification

```bash
test -f AGENTS.md
codex --help            # confirm CLI installed
```

In a Codex CLI session, the loaded `AGENTS.md` content informs every
turn — verify by asking *"what is this repo?"* and confirming the
answer matches `AGENTS.md`'s emergency-triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Codex ignores `AGENTS.md` | Run from repo root, not a subdirectory. |
| Out-of-date context | `codex` re-reads on each session start — quit and restart. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
