# Augment Code Setup

Augment Code is the **substrate** for this package — every other tool
mirrors content from the canonical `.augment/` tree. The Augment
extension (VS Code, JetBrains) reads `.augment/rules/`,
`.augment/skills/`, `.augment/commands/`, `.augment/personas/`, and
`.augment/contexts/` directly.

## Prerequisites

- Augment Code extension: <https://www.augmentcode.com/>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Project scope (default):

```bash
npx @event4u/agent-config init --tools=augment
```

Global scope (cross-project, deploys the full bundle to `~/.augment/`):

```bash
npx @event4u/agent-config init --tools=augment --global
```

Populates (project):

- `.augment/rules/`     — kernel (9 Iron-Law rules) + tier-1/2 routed rules
- `.augment/skills/`    — domain skills
- `.augment/commands/`  — slash commands
- `.augment/personas/`  — review-lens personas
- `.augment/contexts/`  — knowledge-layer contexts
- `.augment/templates/` — scaffolds for AGENTS.md, copilot-instructions, etc.
- `AGENTS.md`           — canonical agent self-orientation
- `.agent-settings.yml` — per-project knobs

## How to use

- Augment auto-discovers `.augment/` on every session — no manual
  action required.
- The kernel rules (always-on Iron Laws) load first; tier-1/2
  rules are routed by the rule-router based on intent.
- Slash commands (`/work`, `/implement-ticket`, `/commit`,
  `/create-pr`, `/refine-ticket`, …) are registered as Augment
  Skills and surfaced in the agent's available-skills list.
- Personas are review-lens voices; invoke them per `/mode` or by
  name inside `/work` and `/implement-ticket` plans.
- `.agent-settings.yml` controls per-project knobs (autonomy
  default, cost profile, role-mode, learning opt-out).

## Verification

```bash
test -d .augment/rules
test -d .augment/skills
test -d .augment/commands
test -f AGENTS.md
```

Open the Augment panel and ask *"What is this repo?"* — the answer
should cite the AGENTS.md emergency triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not surfaced | Reload the Augment workspace; skills are indexed on session start. |
| Symlinked sub-dirs missing | `.augment/skills` is a symlink to `.agent-src/skills`; run `task sync` to rebuild. |
| Iron Laws not firing | Confirm `.augment/rules/` contains 9 kernel files (`task ci` validates the kernel count). |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/architecture.md`](../../architecture.md) — kernel + router + projection pipeline.
- [`docs/installation.md`](../../installation.md) — install matrix index.
