# Continue.dev Setup

Continue.dev (VS Code + JetBrains extension) auto-discovers
`.continue/rules/*.md` as system-level rules per project.

## Prerequisites

- Continue extension: <https://continue.dev>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Project scope (default):

```bash
npx @event4u/agent-config init --tools=continue
```

Global scope (cross-project, deploys the universal skill bundle to
`~/.continue/`):

```bash
npx @event4u/agent-config init --tools=continue --global
```

Populates (project):

- `.continue/rules/agent-config.md` — auto-discovered rule marker
- `AGENTS.md`                       — canonical agent self-orientation
- `.agent-settings.yml`             — per-project knobs

## How to use

- Rules under `.continue/rules/*.md` load automatically on every
  Continue session — no manual action required.
- Continue exposes **Chat**, **Edit** (inline) and **Autocomplete**
  surfaces. All three honor the rules; Chat is the surface that
  reads `AGENTS.md` and the skill bundle.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. Continue does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).
- For repository-aware orchestration, use **`@codebase`** in
  Continue chat alongside the named command/skill so Continue
  retrieves the relevant files first.

## Verification

```bash
test -f .continue/rules/agent-config.md
test -f AGENTS.md
```

In VS Code or JetBrains: open the Continue panel and ask
*"What is this repo?"* — the answer should cite the AGENTS.md
emergency triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules not picked up | Reload the IDE window after install. |
| Marker missing | Re-run `npx @event4u/agent-config init --tools=continue --force`. |
| Continue ignores `@codebase` results | Index the workspace once via the Continue settings panel. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
