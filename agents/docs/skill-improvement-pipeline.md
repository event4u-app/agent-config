# Skill Improvement Pipeline

## Overview

An opt-in pipeline that captures post-task learnings, converts them into rules or skills,
and optionally proposes improvements upstream to the shared agent-config package.

## How it works

```
Task Complete → Trigger Rule checks settings → Quick mental check
  → Learning found? → Ask user → Pipeline Skill orchestrates:
    Capture → Promotion Gate → Classify → Create/Update → Validate → Apply
```

## Components

| Component | Type | Purpose |
|---|---|---|
| `skill-improvement-trigger` | Rule (auto) | Detects learning opportunities after tasks |
| `skill-improvement-pipeline` | Skill | Orchestrates the full pipeline |
| `learning-to-rule-or-skill` | Skill | Classifies learnings as rule vs skill |
| `skill-writing` | Skill | Creates new skills to standard |
| `skill-management` | Skill | Updates existing skills |
| `skill-reviewer` | Skill | Validates quality |
| `capture-learnings` | Rule (auto) | Always-apply reflex for pattern recognition |

## Settings

| Key | Default | Description |
|---|---|---|
| `skill_improvement_pipeline` | `false` | Enable/disable the pipeline |
| `upstream_repo` | _(empty)_ | Target repo for universal improvements |
| `improvement_pr_branch_prefix` | `improve/agent-` | Branch prefix for PRs |

Configure in `.agent-settings` (git-ignored, per developer).

## Promotion Gate

Most learnings should be **rejected**. The gate ensures only high-quality,
repeated, actionable patterns become rules or skills:

- **Repeated or generalizable?** — one-offs are rejected
- **Prevents real failure?** — theoretical improvements are rejected
- **Not already covered?** — duplicates are rejected
- **Actionable?** — vague advice ("be careful") is rejected

## Scope decisions

After creating/updating a rule or skill, the user decides:

1. **Universal** — apply locally + PR to upstream package
2. **Project-specific** — apply to `agents/overrides/` only

Universal improvements benefit all projects using the package.
Project-specific overrides stay local.
