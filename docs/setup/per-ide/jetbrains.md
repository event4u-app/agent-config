# JetBrains AI Assistant Setup

JetBrains AI Assistant is an **export-only host**: it has no user-level
folder convention the installer can deploy into, so
`agent-config init --tools=jetbrains` writes nothing for it and only
prints a hint. You produce the file yourself with `agent-config export`.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files; `agent-config init --project`
> creates just that folder in a repository and nothing else.

## Prerequisites

- JetBrains IDE (IntelliJ IDEA, PyCharm, WebStorm, PhpStorm, …) with the
  AI Assistant plugin enabled.
- Node.js >= 22.6 (for `npx`).

## Install

```bash
npx @event4u/agent-config init --tools=jetbrains   # writes nothing; prints the export hint
npx @event4u/agent-config export --tool=jetbrains --output=<path>
```

`export` ejects a real file (no symlink) into the path you choose;
`--output` is required, `--force` overwrites a drifted file, `--list`
shows every exportable id.

## How to use

- In the IDE, open **Settings → Tools → AI Assistant → Prompts** and add
  the exported file's content as a custom prompt, or import it into your
  JetBrains profile.
- Slash commands and skills are not registered natively — name the
  command in chat (e.g. *"run the create-pr command"*).

## Verification

```bash
test -f <path>
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `init --tools=jetbrains` changed nothing | Expected — JetBrains is export-only; run `agent-config export --tool=jetbrains --output=<path>`. |
| `export` refuses to overwrite | The target drifted from the shipped content; add `--force`. |
| Custom prompts not shown | Restart the IDE after adding the prompt. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstalling](../../installation.md#uninstall) — removal sequence.
