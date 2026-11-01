# Windsurf Setup

Windsurf (Codeium, <https://codeium.com/windsurf>). The installer deploys
the rules to Windsurf's user-level folder `~/.codeium/windsurf/` and
registers its hooks there.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- Windsurf: <https://codeium.com/windsurf>.
- Node.js >= 22.6 (for `npx`).

## Install

```bash
npx @event4u/agent-config init --tools=windsurf
```

Combine with other hosts in one run:

```bash
npx @event4u/agent-config init --tools=windsurf,claude-code,cursor
```

## What lands

- `~/.codeium/windsurf/rules/` — kernel + routed rules
- `~/.codeium/windsurf/hooks/` — managed hooks
- `.windsurf/agent-config.bridge.yml` — gitignored pointer in the
  repository (the only repo-local file besides `agents/overrides/`)

Skills and commands are not deployed for Windsurf.

## Cascade integration

When Cascade asks a clarifying question, the package's `user-interaction`
rule applies — Cascade surfaces numbered options with a single
recommendation.

## Verification

```bash
ls ~/.codeium/windsurf/rules/ | head -5
ls ~/.codeium/windsurf/hooks/
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules not picked up | Reload the Windsurf window after install. |
| `~/.codeium/windsurf/rules/` missing | Re-run `npx @event4u/agent-config init --tools=windsurf`. |

## Cross-references

- [`docs/installation.md`](../../installation.md) — install matrix index.
- [Uninstalling](../../installation.md#uninstall) — removal sequence.
