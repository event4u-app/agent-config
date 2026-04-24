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
| `onboarding.onboarded` | `false` | Whether `/onboard` has run. The `onboarding-gate` rule prompts for `/onboard` while this is `false`. |

### Cost profiles

| Profile | Description |
|---|---|
| `minimal` | Rules, skills, and commands only. **Includes the learning loop.** Default. |
| `balanced` | `minimal` + Runtime dispatcher for skills that declare a shell command. |
| `full` | `balanced` + Tool adapters (GitHub / Jira, read-only, opt-in). |
| `custom` | Ignore profile — every matrix value must be set explicitly. |

All profiles except `custom` ship with `pipelines.skill_improvement: true`,
so the agent captures learnings after meaningful tasks by default. Set it
to `false` in `.agent-settings.yml` to silence post-task analysis without
changing the profile.

The authoritative matrix of all matrix-controlled settings lives in
[`.agent-src.uncompressed/templates/agent-settings.md`](../.agent-src.uncompressed/templates/agent-settings.md).

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
