---
title: Settings Reference
description: The key .agent-settings.yml groups and their defaults — a compact reference; the template carries the exhaustive comments.
---

The most-used setting groups and their defaults. The
[template](https://github.com/event4u-app/agent-config/blob/main/src/config/agent-settings.template.yml)
is the exhaustive, commented source of truth.

| Group / key | Default | Purpose |
|---|---|---|
| `agent_config_version` | `""` | Exact-semver release pin (ranges rejected; `""` = unpinned) |
| `profile.id` | `developer` | Experience profile (see [Profiles](/agent-config/configuration/profiles/)) |
| `discipline_profile` | `auto` | Successor governance knob — `off \| essential \| full \| auto` |
| `rule_loading_tier` | `balanced` | **Legacy** tier switch — `minimal \| balanced \| full \| custom` |
| `tokens.rich_skills` | `on` | Load rich skills in full — `on \| ask \| off` |
| `cost.enforcement` | `advisory` | USD budget mode — `advisory \| hard-stop`; `budgets.*` = 0 (off) |
| `model.auto_switch` | `suggest` | Per-skill model switch — `suggest \| auto \| off` |
| `personal.autonomy` | `auto` | Suppress trivial workflow questions — `on \| off \| auto` |
| `personal.pr_progress_comments` | `false` | Allow unsolicited PR progress comments |
| `personal.minimal_output` | `true` | Terse bullets vs verbose |
| `personal.user_type` | `""` | Skill-filter axis (`developer`, `founder`, `finance`, …) |
| `quality.local_auto_run` | `false` | Autonomously run local CI/tests (remote CI is the gate) |
| `design.fidelity_mode` | `strict` | Provided-design fidelity — `strict \| structural \| hard-floor` |
| `consistency.cross_source` | `on` | Cross-source discrepancy detection — `on \| auto \| off` |
| `code_style.docblocks` | `minimal` | Comment/docblock discipline — `minimal \| full` |
| `subagents.enabled` / `.auto` | `true` / `on` | Subagent orchestration — `auto: off \| ask \| on` |
| `worktrees.mode` | `off \| on \| ask` | Governed git worktrees |
| `reasoning.enabled` | `true` | Reasoning Discipline Protocol (RDP) |
| `memory.cadence` | `always` | Memory-consolidation cadence — `auto \| always \| never` |
| `roadmap.*` | — | Roadmap execution + dashboard cadence |
| `commands.auto_detect` | `enabled` | Command auto-detection + suggestion + `/create-pr` config |
| `onboarding.onboarded` | `false` | Onboarding-gate state (wizard flips to `true`) |
| `legal_review_prep.acknowledged` | `false` | Legal-pack consent gate |

## AI council keys

The AI-council configuration is **user-global only** — it lives at
`~/.event4u/agent-config/settings/.ai-council.yml`, not in `.agent-settings.yml`.
Install provider keys with `agent-config keys:install-anthropic` /
`keys:install-openai`. See the
[council docs](https://github.com/event4u-app/agent-config/blob/main/docs/customization.md)
for the budget and member settings.
