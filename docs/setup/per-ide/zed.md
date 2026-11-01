# Zed Setup

Zed (<https://zed.dev>) is an **export-only host**: it has no user-level
folder convention the installer can deploy into, so
`agent-config init --tools=zed` writes nothing for it and only prints a
hint. You produce the file yourself with `agent-config export`.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- Zed editor: <https://zed.dev/download>.
- Node.js >= 22.6 (for `npx`).

## Install

```bash
npx @event4u/agent-config init --tools=zed   # writes nothing; prints the export hint
npx @event4u/agent-config export --tool=zed --output=<path>
```

`export` ejects a real file (no symlink) into the path you choose;
`--output` is required, `--force` overwrites a drifted file, `--list`
shows every exportable id.

## How to use

- Zed reads `.rules` at the project root as system-level instructions.
  Reference the exported file from there, or paste its content into
  `.rules`.
- Slash commands and skills are not registered natively — name the
  command in chat (e.g. *"run the create-pr command"*).

## Verification

```bash
test -f <path>
```

In Zed: open the Assistant panel and confirm the rules are applied.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `init --tools=zed` changed nothing | Expected — Zed is export-only; run `agent-config export --tool=zed --output=<path>`. |
| `.rules` not applied | Restart Zed; `.rules` is read on session start. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstalling](../../installation.md#uninstall) — removal sequence.
