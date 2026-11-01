---
title: Settings reference
description: The settings keys you are most likely to change, their defaults and what they do — the commented template in the repository lists every key.
---

The keys below are the ones worth knowing; the [template](https://github.com/event4u-app/agent-config/blob/main/src/config/agent-settings.template.yml) carries every key with a comment. Read the value in effect, and the file it came from:

```bash
agent-config settings:get <key>
```

| Key | Default | What it does |
|---|---|---|
| `agent_config_version` | `""` | Exact version a project is pinned to; `""` means unpinned. Set it with `agent-config update`. |
| `profile.id` | `developer` | Your role profile — see [Choose a profile](/agent-config/getting-started/choose-a-profile/). |
| `discipline_profile` | set by the install profile | How many rules load: `off`, `essential`, `full` or `auto`. The install profile fills it: `minimal` → `off`, `balanced` → `auto`, `full` → `full`. |
| `rule_loading_tier` | set by the install profile | The older switch for the same thing; `discipline_profile` wins when both are set. |
| `personal.autonomy` | `auto` | Whether the agent asks about trivial workflow steps: `on` stops asking, `off` asks, `auto` asks until you tell it to stop. |
| `personal.pr_progress_comments` | `false` | Allow the agent to post progress comments on pull requests unasked. |
| `personal.user_type` | set by the wizard | Filters skills for one user type. |
| `model.auto_switch` | `suggest` | When a skill wants a stronger or cheaper model: `suggest`, `auto` or `off`. |
| `cost.budgets.daily` / `.weekly` / `.monthly` | `0` (no budget) | Ceilings in US dollars for [Cost and budget](/agent-config/features/cost/). |
| `cost.enforcement` | `advisory` | At the ceiling: `advisory` warns, `hard-stop` refuses the next turn. |
| `quality.local_auto_run` | `false` | Let the agent run the full local test and lint pipeline on its own; by default your remote CI is the check. |
| `design.fidelity_mode` | `strict` | How closely the agent follows a design you provide: `strict`, `structural` or `hard-floor`. |
| `code_style.docblocks` | `minimal` | Comment discipline in generated code: `minimal` or `full`. |
| `reasoning.enabled` | `true` | The structured reasoning steps for vague or long tasks. |
| `memory.redact_patterns` | `[]` | Patterns removed from transcripts before [memory](/agent-config/features/memory/) mines them. |
| `onboarding.onboarded` | `false` | Set to `true` by the setup wizard; until then the agent points you at `agent-config setup`. |
| `update_check.enabled` | `true` | The daily check for a newer release — see [What leaves your machine](/agent-config/trust/network/). |
| `update.mode` | `notify` | What the agent may do about a newer release: `notify` never installs. |
| `advisories.mode` / `.egress` | `notify` / `query` | The security advisory notices, and what `audit:deps refresh` may send. |
| `retro.enabled` | `true` | A short look back after merged work, keeping at most one learning. |
| `star_ask.mode` | `monthly` | The monthly request to star the repository; `off` stops it. |
| `legal_review_prep.acknowledged` | `false` | Consent for the legal review skills. |

## Second-opinion keys

The keys for the [second opinion from other AI models](/agent-config/features/second-opinion/) are not in this file. They live in `~/.event4u/agent-config/settings/.ai-council.yml`, for your user only; store provider keys with `agent-config keys:install-anthropic` and `agent-config keys:install-openai`.
