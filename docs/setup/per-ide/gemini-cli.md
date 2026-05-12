# Gemini CLI Setup

Google's Gemini CLI reads `GEMINI.md` (which is a symlink to `AGENTS.md`
in the package's projection) for project context.

## Prerequisites

- Gemini CLI installed: <https://github.com/google-gemini/gemini-cli>.
- Node.js ≥ 18 (for the install entrypoints).

## Install

```bash
npx @event4u/agent-config init --tools=gemini
```

Populates:

- `GEMINI.md` → `AGENTS.md` — symlink so Gemini CLI loads the same
  self-orientation as Codex / Aider / Augment.
- `AGENTS.md`             — canonical content (single source of truth).
- `.agent-settings.yml`   — per-project knobs.

## Verification

```bash
test -L GEMINI.md && readlink GEMINI.md   # → AGENTS.md
gemini --version                           # confirm CLI installed
```

In a Gemini CLI session: `GEMINI.md` informs every turn — verify by
asking *"what is this repo?"* and confirming the answer matches
`AGENTS.md`'s emergency-triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Gemini CLI doesn't see `GEMINI.md` | Some Gemini versions require absolute paths — `gemini --context $(pwd)/GEMINI.md`. |
| Symlink broken on Windows | Re-run installer; on Windows the projection may emit a copy instead of a symlink. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
