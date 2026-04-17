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
The `install.sh` script copies a default version if none exists.

`AGENTS.md` provides project-specific context to the agent: tech stack, conventions,
module structure, test setup, and quality tooling.

It is loaded by Claude Code, Augment Code, and Gemini CLI.

---

## Agent Settings

The `.agent-settings` file in the consumer project configures agent behavior.

### Available settings

| Setting | Default | Description |
|---|---|---|
| `user_name` | *(empty)* | User's first name for personalized responses |
| `minimal_output` | `true` | Suppress intermediate output |
| `play_by_play` | `false` | Share intermediate findings during analysis |
| `auto_open_files` | `true` | Open edited files in IDE |
| `ide` | `cursor` | IDE for file opening (`cursor`, `code`, `phpstorm`) |
| `cost_profile` | `minimal` | Token budget (`minimal`, `balanced`, `full`, `custom`) |
| `runtime_auto_read_reports` | `false` | Auto-inject reports into context |
| `skill_improvement_pipeline` | `false` | Enable post-task learning capture |
| `language` | `de` | Response language (`de`, `en`) |

### Cost profiles

| Profile | Description |
|---|---|
| `minimal` | Zero token overhead. Reports persisted but never auto-read. |
| `balanced` | Light context injection. Key metrics available on request. |
| `full` | Full observability. Reports, metrics, and feedback in context. |
| `custom` | Ignore profile — every matrix value must be set explicitly. |

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
