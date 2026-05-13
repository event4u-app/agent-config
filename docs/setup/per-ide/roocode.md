# Roo Code Setup

Roo Code (VS Code extension, formerly Roo Cline) auto-discovers
`.roo/rules/*.md` as system-level instructions per project.

## Prerequisites

- Roo Code VS Code extension: <https://github.com/RooCodeInc/Roo-Code>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Project scope (default):

```bash
npx @event4u/agent-config init --tools=roocode
```

Global scope (cross-project, deploys the universal skill bundle to
`~/.roo/`):

```bash
npx @event4u/agent-config init --tools=roocode --global
```

Populates (project):

- `.roo/rules/agent-config.md` — auto-discovered rule marker
- `AGENTS.md`                  — canonical agent self-orientation
- `.agent-settings.yml`        — per-project knobs

## How to use

- Rules under `.roo/rules/*.md` load automatically on every Roo Code
  session — no manual action required.
- Roo Code exposes a **mode switcher** (Architect / Code / Ask /
  Debug / Custom). Every mode sees these rules; switch modes to
  trigger different cognition profiles without losing context.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. Roo Code does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).
- For free-form orchestration with the project's `/work` or
  `/implement-ticket` workflows, name the command in chat; the
  agent reads `.augment/commands/<name>.md` and follows the steps.

## Verification

```bash
test -f .roo/rules/agent-config.md
test -f AGENTS.md
```

In VS Code: open the Roo Code panel, switch to **Ask mode**, then
ask *"What is this repo?"* — the answer should cite the AGENTS.md
emergency triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rules not picked up | Reload VS Code window after install. |
| `.roo/rules/agent-config.md` missing | Re-run with `--force`. |
| Mode switch loses context | Roo Code keeps rules across modes by design; verify the marker file still exists. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
