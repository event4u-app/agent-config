# {{project_name}}

<!--
  Fill placeholders or run `/agents init`, then delete this
  comment. Iron Law — capability bullets, not path lists; paths rot.
  Tool stubs (`CLAUDE.md`, `GEMINI.md`, `.cursorrules`) link here.
  Anatomy + recipes: `.augment/contexts/contracts/agents-md-anatomy.md`.
-->

> {{project_description}}

## Layers

| Layer | Location | Edits |
|---|---|---|
| Installed package | `.augment/`, `.agent-src/` | hands-off — managed by `event4u/agent-config` |
| Project layer | `agents/`, `agents/overrides/`, `.agent-settings.yml` | your customizations and config |

## Pointers

- **Filling out this AGENTS.md** — section templates, capability bullets, multi-agent entry flow, monorepo per-package layout: [`.augment/contexts/contracts/consumer-agents-md-guide.md`](.augment/contexts/contracts/consumer-agents-md-guide.md).
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
6. **Per-module agent docs?** — If `modules.enabled: true`, each module under `modules.root_paths` may carry its own `{agent_folder}/` (default `agents/`). See `module-management` skill.
