# {{project_name}}

<!--
  AGENTS.md entry point for AI coding agents. Installed by
  `event4u/agent-config`. Fill placeholders (or run `/copilot-agents-init`)
  and delete this comment. Keep thin; bulk prose belongs in the linked guide.
-->

{{project_description}}

## Layers

| Layer | Location | Purpose |
|---|---|---|
| **Shared package** | `.augment/`, `.agent-src/` | Installed skills / rules / commands — do not hand-edit |
| **Project overrides** | `agents/overrides/` | Customizations of shared resources |
| **Project docs** | `agents/` | Architecture, features, roadmaps, sessions, contexts |
| **Agent settings** | `.agent-settings.yml` | Project-specific config consumed by skills |

## Pointers

- **Filling out this AGENTS.md** — tech-stack / dev-setup / testing / quality / project-structure templates plus `/work` + `/implement-ticket` entry flow and multi-agent matrix: [`.augment/contexts/contracts/consumer-agents-md-guide.md`](.augment/contexts/contracts/consumer-agents-md-guide.md).
- **Behavior rules (always active)** — Iron Laws and routed rules that fire automatically while you work in this project: [`.augment/rules/`](.augment/rules/).
- **Skills (on-demand expertise)** — domain skills surfaced by description; invoked when their trigger fires: [`.augment/skills/`](.augment/skills/).
- **Commands (workflows)** — slash-commands the agent runs end-to-end (`/work`, `/implement-ticket`, `/commit`, `/create-pr`, …): [`.augment/commands/`](.augment/commands/).
- **Project-specific docs** — your own architecture notes, roadmaps, sessions, contexts: [`agents/`](agents/).

## Emergency triage — read this when nothing else is reachable

1. **What is this repo?** — Consumer project; agent-config is installed as a shared skill / rule / command suite at `.augment/` and `.agent-src/`.
2. **What language?** — Project-specific; agents mirror the user's language at runtime.
3. **Where do I edit agent-config?** — Do not edit `.augment/` or `.agent-src/` here; they are installed artifacts. Project edits live in `agents/` and project source.
4. **Lint / test / sync entry point?** — Project-specific (see project README); agent-config reinstalls via `composer update event4u/agent-config` or `npm update @event4u/agent-config`.
5. **Where do the always-active rules live?** — `.agent-src/rules/` (kernel = 9 Iron-Law rules; tier-1 / tier-2 routed via `.agent-src/router.json`).
