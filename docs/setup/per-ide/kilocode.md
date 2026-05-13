# Kilo Code Setup

Kilo Code (VS Code extension, Cline fork) auto-discovers
`.kilocode/rules/*.md` as system-level rules per project.

## Prerequisites

- Kilo Code VS Code extension: <https://github.com/Kilo-Org/kilocode>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Project scope (default):

```bash
npx @event4u/agent-config init --tools=kilocode
```

Global scope (cross-project, deploys the universal skill bundle to
`~/.kilocode/`):

```bash
npx @event4u/agent-config init --tools=kilocode --global
```

Populates (project):

- `.kilocode/rules/agent-config.md` — auto-discovered rule marker
- `AGENTS.md`                       — canonical agent self-orientation
- `.agent-settings.yml`             — per-project knobs

## How to use

- Rules under `.kilocode/rules/*.md` load automatically on every
  Kilo Code session — no manual action required.
- Kilo Code exposes a **mode switcher** (Architect / Code / Ask /
  Debug / Orchestrator). Every mode sees these rules; switch modes
  to trigger different cognition profiles. **Orchestrator** is the
  closest match for running this package's `/implement-ticket` or
  `/work` flows end-to-end.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. Kilo Code does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

## Verification

```bash
test -f .kilocode/rules/agent-config.md
test -f AGENTS.md
```

In VS Code: open the Kilo Code panel and ask *"What is this repo?"*
— the answer should cite the AGENTS.md emergency triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules not picked up | Reload VS Code window after install. |
| Marker missing after install | Re-run with `--force`. |
| Orchestrator skips skills | Kilo Code does not auto-register `.augment/skills/`; name the skill in chat. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
