# OpenAI Codex CLI Setup

OpenAI's Codex CLI (the `codex` command) reads skills from its user-level
anchor `~/.codex/`. The installer deploys the shared bundle there.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- Codex CLI installed: <https://github.com/openai/codex>.
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Install

```bash
npx @event4u/agent-config init --tools=codex
```

Populates `~/.codex/`:

- `~/.codex/skills/`   — skill bundle
- `~/.codex/rules/`    — kernel + routed rules
- `~/.codex/commands/` — slash commands
- `~/.codex/personas/` — review-lens personas

## How skills reach the model

Codex drops skills from its listing once the listing exceeds its context
budget. To keep that predictable, the installer lists a fixed resident set
of skills and marks the rest as not implicitly invoked; they stay installed
on disk. It also writes one extra entry, `agent-config-skill-finder`,
which finds an unlisted skill by exact name or by task and points the
model at its file — so every installed skill stays reachable in one step.

## Verification

```bash
test -d ~/.codex/skills
test -d ~/.codex/skills/agent-config-skill-finder
codex --help            # confirm the CLI is installed
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| A skill answers as unavailable | Ask for it through `agent-config-skill-finder` — it is installed but not in the resident listing. |
| Out-of-date skills | Re-run `npx @event4u/agent-config init --tools=codex`, then start a new `codex` session. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstall](../../installation.md#uninstall) — removing the global install.
