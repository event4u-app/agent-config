# Aider Setup

Aider is an **export-only host**: it has no user-level folder convention
for skills or rules, so the installer deploys nothing for it and prints a
hint instead. You produce Aider's content yourself with
`agent-config export`.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- Aider installed: <https://aider.chat>.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Export

```bash
npx @event4u/agent-config init          # installs the package globally
agent-config export --tool=aider --output=<path>
```

`--output` is required — you choose where the file lands. The exported
marker documents the manual `read:` wiring inline; point Aider at it with
`--read <path>` or a `read:` entry in your Aider config. `agent-config
export --list` shows every exportable id; re-running is idempotent and
refuses to overwrite a changed file unless you pass `--force`.

## Verification

```bash
test -f <path>
```

In Aider: type `/tokens` — the exported file should appear in the loaded
files list.

## Troubleshooting

| Symptom | Fix |
|---|---|
| File not loaded | `aider --read <path>` or `/read <path>` in the chat. |
| `export` refuses to overwrite | The file changed since the last export — re-run with `--force` to replace it. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
