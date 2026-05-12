# Kiro Setup

Kiro (Amazon's agentic IDE) auto-discovers `.kiro/steering/*.md`
as steering documents per project.

## Prerequisites

- Kiro IDE: <https://kiro.dev>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Project scope (default):

```bash
npx @event4u/agent-config init --tools=kiro
```

Global scope (cross-project, deploys the universal skill bundle to
`~/.kiro/`):

```bash
npx @event4u/agent-config init --tools=kiro --global
```

Populates (project):

- `.kiro/steering/agent-config.md` — auto-discovered steering marker
- `AGENTS.md`                      — canonical agent self-orientation
- `.agent-settings.yml`            — per-project knobs

## How to use

Kiro ships two top-level workflows; both honor the steering
documents in `.kiro/steering/`.

- **Spec mode** — plan-first. Kiro produces a spec → task list →
  implementation under your review. The closest match for the
  package's `/implement-ticket` flow.
- **Vibe mode** — free-form chat. Best for exploration, quick
  edits, and one-off questions.
- Steering documents load automatically on every Kiro session —
  no manual action required for either workflow.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. Kiro does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).
- When the global skill bundle is installed, Kiro reads it from
  `~/.kiro/steering/` (the skills are projected into the
  steering anchor, not a separate `skills/` directory).

## Verification

```bash
test -f .kiro/steering/agent-config.md
test -f AGENTS.md
```

In Kiro: start a new Spec and ask *"What is this repo?"* — the
answer should cite the AGENTS.md emergency triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Steering not loaded | Restart Kiro after install. |
| Marker missing | Re-run with `--force`. |
| Spec mode ignores rules | Both Spec and Vibe read `.kiro/steering/`; check the marker file actually exists at the project root. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
