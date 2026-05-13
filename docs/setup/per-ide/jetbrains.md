# JetBrains AI Assistant Setup

JetBrains AI Assistant reads custom prompts and guidelines from
project-level config (`.idea/`) and user-scope settings. Because
`.idea/` is team-shared, the canonical scope for this bridge is
**global** — the project-scope marker is informational only.

## Prerequisites

- JetBrains IDE (IntelliJ IDEA, PyCharm, WebStorm, PhpStorm, …) with
  the AI Assistant plugin enabled.
- Node.js ≥ 18 for the install entrypoints.

## Install

Canonical (global, cross-project):

```bash
npx @event4u/agent-config init --tools=jetbrains --global
```

Deploys the universal skill bundle to `~/.config/JetBrains/`.

Project-scope marker (informational only):

```bash
npx @event4u/agent-config init --tools=jetbrains
```

Populates (global):

- `~/.config/JetBrains/skills/`  — Anthropic-shaped skill bundle
- `~/.config/JetBrains/rules/`   — kernel + tier-1/2 rules
- `~/.config/JetBrains/personas/` — review-lens personas

Populates (project, informational):

- `.jetbrains/agent-config.md` — pointer to the global install
- `AGENTS.md`                  — canonical agent self-orientation
- `.agent-settings.yml`        — per-project knobs

## How to use

- In your JetBrains IDE, open **Settings → Tools → AI Assistant →
  Prompts** and point the custom-prompts path at
  `~/.config/JetBrains/` (or copy the relevant rules into your
  JetBrains profile via the *Import* button).
- AI Assistant exposes **Chat**, **Ask**, and **inline edits**.
  Chat is the surface that reads the imported rules; inline edits
  stay local to the current selection.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. JetBrains AI does not register them natively
  — invoke them by name in chat (e.g. *"run the create-pr command"*).

## Verification

```bash
test -d ~/.config/JetBrains/skills
test -f AGENTS.md
```

In the IDE: open the AI Assistant chat and ask *"What is this repo?"*
— the answer should cite the AGENTS.md emergency triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Custom prompts not shown | Restart the IDE after pointing the prompts path at `~/.config/JetBrains/`. |
| `.jetbrains/` missing | The project marker is optional; the canonical install is `--global`. |
| AI Assistant ignores rules | Verify the prompts path under Settings; AI Assistant does not auto-discover `.idea/agent-config.md`. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
