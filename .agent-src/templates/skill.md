# Skill Template

> Template for creating new skills in `.augment/skills/{skill-name}/SKILL.md`.

## Instructions

1. Create directory: `.augment/skills/{skill-name}/`
2. Copy the template below into `SKILL.md`
3. Replace all `{placeholders}` with actual content
4. Remove sections that don't apply
5. Remove all `<!-- comments -->` when done

## Template

````markdown
---
name: {skill-name}
description: "Use when {trigger situation — what the user says or does}. {What the skill does in 1 sentence}."
status: active
---

<!-- STATUS VALUES (delete this comment when done):
  - active: default, skill is in use
  - deprecated: better alternative exists (add replaced_by if applicable)
  - superseded: fully replaced by another skill (add replaced_by)
  Example: status: deprecated
           replaced_by: other-skill-name
-->

<!-- EXECUTION METADATA (optional — delete this comment when done):
  Add if the skill supports controlled execution beyond instructional use.
  Omit entirely for manual/instructional-only skills.

  execution:
    type: manual | assisted | automated
    handler: none | shell | php | node | internal
    timeout_seconds: 30
    safety_mode: strict
    allowed_tools: []

  See guidelines/agent-infra/runtime-layer.md for details.
-->

<!-- DESCRIPTION RULES (delete this comment when done):
  - Start with "Use when..." — this is a TRIGGER, not a summary
  - Include 2-3 phrases users actually say: "create a DTO", "add column", "fix tests"
  - For explicit-only skills: "ONLY when user explicitly requests: [X]. NOT for [Y]."
  - Keep it under 200 chars — it's loaded into the system prompt on every conversation
  - Write in third person — the skill description is injected as context, not spoken by the agent
-->

# {skill-name}

## When to use

Use this skill when:
- {Scenario 1}
- {Scenario 2}
- {Scenario 3}

Do NOT use when:
- {Wrong scenario — suggest alternative skill}
- {Another wrong scenario}

## Before writing code

<!-- Optional — checklist to run before starting work. Delete if not applicable. -->

1. **Detect {thing}** — check {file} for {what to look for}.
2. **Check {convention}** — read {reference}.
3. **Read project docs** — `./agents/`, module-specific docs if applicable.

## Procedure: {skill-name}

<!-- REQUIRED — The core workflow. Use "Procedure" or "Procedure: {name}" as heading.
  - Numbered steps with concrete commands or actions
  - Each step independently verifiable
  - End with a validation/verification step
  - For coding skills: include code examples in steps
  - For process skills: workflow phases with decision points
  - For tool skills: commands with expected output -->

### Step 0: Inspect

1. {What to check before starting — existing code, conventions, project docs}

### Step 1: {action}

1. {Concrete step}
2. {Concrete step}

### Step 2: Validate

1. {Concrete check — command output, test result, or assertion}
2. {Second check}

## Output format

<!-- REQUIRED — What the skill produces. Use numbered list with 2-4 items.
  Describe the deliverables, not the process. -->

1. {Primary deliverable — file, config, report}
2. {Secondary deliverable or verification result}

## Gotcha

<!-- REQUIRED — The highest-value section in any skill.
  Document failure patterns the model actually hits — not theoretical advice.
  Format: "The model tends to X — do Y instead" or "Don't assume X because Y".
  Grow this organically: add entries when real failures happen. Seed with 2-3 known issues. -->

- {The model tends to do X when Y — instead, do Z.}
- {Don't assume X — check Y first because Z.}
- {Edge case: when A happens, do B instead of C.}

## Do NOT

- Do NOT {anti-pattern 1}.
- Do NOT {anti-pattern 2}.
- Do NOT {anti-pattern 3}.
````

## Quality Checklist (5 Skill Killers)

Before considering a skill complete, verify it passes all 5 checks:

- [ ] **K1: Description is a trigger** — starts with "Use when...", includes phrases users actually say, is specific enough for skill discovery
- [ ] **K2: Not over-defined** — guides rather than railroads; tight for fragile ops, loose for creative tasks; <15 numbered steps
- [ ] **K3: No obvious content** — doesn't teach the model what it already knows; only project-specific conventions and non-obvious patterns
- [ ] **K4: Has Gotcha section** — documents real failure patterns, not theoretical advice; seeded with 2-3 entries
- [ ] **K5: Has Output format** — numbered list with 2-4 deliverables describing what the skill produces
- [ ] **K6: Under 500 lines** — if larger, extract reference tables or templates into separate files in the skill folder
- [ ] **English only** — all content in English
- [ ] **No duplication** — doesn't repeat rules or guidelines that are already enforced elsewhere
- [ ] **No "Related skills" section** — the agent discovers skills via `<available_skills>` descriptions; cross-links waste tokens and create maintenance burden

