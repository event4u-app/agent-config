# GitHub Copilot Setup

`agent-config init` writes nothing for GitHub Copilot — it prints a hint
instead. Two ways to give Copilot the suite's content:

- **Copilot CLI plugin** — a discovery plugin (a read-only MCP server plus
  one pointer skill, `install-agent-config`); it is not the full suite.
- **Export** — Copilot Chat (VS Code, JetBrains, Neovim) reads
  `.github/copilot-instructions.md` from the repository; you produce that
  file with `agent-config export`.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- GitHub Copilot subscription with Copilot Chat enabled in your IDE.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Copilot CLI plugin

```bash
copilot marketplace add event4u-app/agent-config
copilot plugin install agent-config@event4u-agent-config
```

## Export

```bash
npx @event4u/agent-config init          # installs the package globally
agent-config export --tool=copilot-instructions --output=.github/copilot-instructions.md
agent-config export --tool=agents-md --output=AGENTS.md   # optional
```

`--output` is required. The exported `copilot-instructions.md` is
deliberately thin and points back to `AGENTS.md`. Commit both files if
your team wants them. `agent-config export --list` shows every exportable
id; re-running is idempotent and refuses to overwrite a changed file
unless you pass `--force`.

## Where Copilot reads it

- **VS Code / JetBrains / Neovim** (`copilot.lua`, `CopilotChat.nvim`) —
  read `.github/copilot-instructions.md` from the open repository. Reload
  the window or project after exporting.

## Verification

```bash
test -f .github/copilot-instructions.md
```

In Copilot Chat ask *"What is this repo?"* — the answer should draw on
the exported instructions.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Copilot ignores the file | Reload the IDE window after exporting. |
| `export` refuses to overwrite | The file changed since the last export — re-run with `--force` to replace it. |
| Copilot PR review too noisy | See the `copilot-config` skill for suppression patterns. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
