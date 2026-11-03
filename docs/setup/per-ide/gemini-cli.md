# Gemini CLI Setup

Google's Gemini CLI (<https://github.com/google-gemini/gemini-cli>). The
installer deploys the skill bundle to its user-level folder `~/.gemini/`
and registers hooks in `~/.gemini/settings.json`.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- Gemini CLI installed: <https://github.com/google-gemini/gemini-cli>.
- Node.js >= 22.6 (for `npx`).

## Install

```bash
npx @event4u/agent-config init --tools=gemini-cli
```

The tool id is `gemini-cli`, not `gemini`.

## What lands

Under `~/.gemini/`:

- `rules/`, `skills/`, `commands/`, `personas/` — the skill bundle
- `settings.json` — agent-config hooks registered alongside your own settings

In the repository, only a gitignored pointer
`.gemini/agent-config.bridge.yml` is written (plus `agents/overrides/`).

## Verification

```bash
ls ~/.gemini/skills/ | head -5
gemini --version          # confirm the CLI is installed
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Unknown tool id | The id is `gemini-cli` — the short form `gemini` is not accepted. |
| `~/.gemini/skills/` missing | Re-run `npx @event4u/agent-config init --tools=gemini-cli`. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstalling](../../installation.md#uninstall) — removal sequence.
