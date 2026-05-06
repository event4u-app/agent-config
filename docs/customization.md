# Customization

## Override System

The project override system allows consumer projects to extend or replace shared skills,
rules, and commands **without modifying the package**.

```
agents/overrides/
├── skills/                  ← Override skill behavior
│   └── pest-testing/
│       └── SKILL.md         ← Replaces .augment/skills/pest-testing/SKILL.md
├── rules/                   ← Override rule behavior
│   └── php-coding.md        ← Replaces .augment/rules/php-coding.md
└── commands/                ← Override command behavior
    └── commit/
        └── SKILL.md
```

**Resolution order:** project override → shared package (`.augment/`).

Overrides are project-specific and should be committed to the consumer project.
Use the `/override-create` command to scaffold a new override.

---

## AGENTS.md

Every consumer project should have an `AGENTS.md` at the project root.
The installer copies a default version if none exists.

`AGENTS.md` provides project-specific context to the agent: tech stack, conventions,
module structure, test setup, and quality tooling.

It is loaded by Claude Code, Augment Code, and Gemini CLI.

---

## Agent Settings

The `.agent-settings.yml` file in the consumer project configures agent behavior.
It is written as YAML with section-level grouping; dotted keys below reference
those sections.

### Available settings

| Setting | Default | Description |
|---|---|---|
| `cost_profile` | `minimal` | Token budget (`minimal`, `balanced`, `full`, `custom`) |
| `personal.user_name` | *(empty)* | User's first name for personalized responses |
| `personal.minimal_output` | `true` | Suppress intermediate output |
| `personal.play_by_play` | `false` | Share intermediate findings during analysis |
| `personal.open_edited_files` | `false` | Open edited files in IDE |
| `personal.ide` | *(empty)* | IDE for file opening (`cursor`, `code`, `phpstorm`) |
| `pipelines.skill_improvement` | `true` | Post-task learning capture. Included in every profile except `custom`. |
| `chat_history.enabled` | `true` | Persistent JSONL log at `agents/.agent-chat-history` for crash recovery. |
| `chat_history.frequency` | per profile | Logging granularity: `per_turn`, `per_phase`, or `per_tool` (see matrix below). |
| `chat_history.max_size_kb` | per profile | Max file size before overflow handling (see matrix below). |
| `chat_history.on_overflow` | per profile | `rotate` drops oldest, `compress` marks for summarization (see matrix below). |
| `onboarding.onboarded` | `false` | Whether `/onboard` has run. The `onboarding-gate` rule prompts for `/onboard` while this is `false`. |
| `ai_council.enabled` | `false` | Master switch for the `/council` command. Even when enabled, every consultation asks before spending tokens. |
| `ai_council.members.<provider>.enabled` | `false` | Per-provider opt-in (`anthropic`, `openai`). Tokens live in `~/.config/agent-config/<provider>.key` (mode 0600), never in this file. |
| `ai_council.members.<provider>.model` | per provider | Which model the provider sends the query to (e.g. `claude-sonnet-4-5`, `gpt-4o`). |
| `ai_council.cost_budget.max_input_tokens` | `50000` | Hard cap on summed input tokens per `/council` invocation. |
| `ai_council.cost_budget.max_output_tokens` | `20000` | Hard cap on summed output tokens per `/council` invocation. |
| `ai_council.cost_budget.max_calls` | `10` | Maximum council members per invocation. |
| `ai_council.cost_budget.max_total_usd` | `0.0` | Per-invocation USD ceiling. `0` disables (token caps still apply). |
| `ai_council.cost_budget.daily_limit_usd` | `0.0` | Rolling 24h USD ceiling across all `/council` calls. `0` disables. Ledger lives at `~/.config/agent-config/council-spend.jsonl` (mode 0600). |
| `ai_council.session_retention_days` | `14` | Auto-prune for `agents/council-sessions/` audit folders. Older session directories are removed on the next `save()`. `0` disables (keep forever). |

> **Experimental.** AI Council is not yet validated by external users. API costs apply per consultation.

Council API tokens are installed via `./agent-config keys:install-anthropic`
and `./agent-config keys:install-openai` — they prompt on `/dev/tty`, write to
`~/.config/agent-config/<provider>.key` with mode `0600`, and never accept env
vars. The `/council` command refuses to run if the key file's permissions
drift.

### Cost profiles

`cost_profile` is the master switch for rule-tier loading. The kernel
(always-loaded Iron-Law floor, ≤ 26k chars across 9 rules) ships in every
profile. Tier-1 and tier-2 rules are gated by profile and resolved at
session start from `router.json` (compiled by `scripts/compile_router.py`).

| Profile | Rule tiers loaded | Token footprint | Best for |
|---|---|---|---|
| `minimal` | kernel only (no router, no auto-rules) | lowest | Cost-sensitive sessions; trivial Q&A; CI runs |
| `balanced` | kernel + tier-1 auto-rules (default) | medium | Day-to-day work — current behaviour superset |
| `full` | kernel + tier-1 + tier-2 (everything) | highest | Agent-config development; full rule fidelity |
| `custom` | profile ignored — every matrix value must be set explicitly | varies | Power users with bespoke rule sets |

The kernel-and-router architecture is documented in
[`docs/contracts/rule-router.md`](contracts/rule-router.md) and
[`docs/contracts/kernel-membership.md`](contracts/kernel-membership.md).
Tier flags live in each rule's frontmatter (`tier: kernel | tier-1 | tier-2`);
the router compiles them into `router.json` deterministically.

All profiles except `custom` ship with `pipelines.skill_improvement: true`,
so the agent captures learnings after meaningful tasks by default. Set it
to `false` in `.agent-settings.yml` to silence post-task analysis without
changing the profile.

The authoritative matrix of all matrix-controlled settings lives in
[`.agent-src.uncompressed/templates/agent-settings.md`](../.agent-src.uncompressed/templates/agent-settings.md).

### Chat-history defaults per profile

`scripts/install.py` fills these placeholders from
[`config/profiles/*.ini`](../config/profiles) when it writes
`.agent-settings.yml`. Edit the values afterwards if you want different
behavior — the per-profile table is just the initial default.

| Setting | `minimal` | `balanced` | `full` |
|---|---|---|---|
| `chat_history.enabled` | `true` | `true` | `true` |
| `chat_history.frequency` | `per_turn` | `per_phase` | `per_tool` |
| `chat_history.max_size_kb` | `128` | `256` | `512` |
| `chat_history.on_overflow` | `rotate` | `rotate` | `compress` |

`custom` ignores these defaults — set every value explicitly.

---

## Project documentation

Consumer projects can maintain their own agent documentation:

```
agents/
├── docs/                    ← Feature docs, architecture decisions
├── contexts/                ← Shared knowledge documents
├── features/                ← Feature plans
├── roadmaps/                ← Active roadmaps
└── overrides/               ← Skill/rule/command overrides
```

Module-level documentation goes into `app/Modules/*/agents/`.

---

← [Back to README](../README.md)
