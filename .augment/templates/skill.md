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

## {Main content section}

<!-- The core of the skill. Structure depends on the topic:
  - For coding skills: patterns, code examples, conventions
  - For process skills: workflow phases, checklists
  - For tool skills: commands, configuration, integration

  Use tables for comparisons:
  | Pattern | When to use | Example |
  |---|---|---|

  Use code blocks for examples:
  ```php
  // ✅ Correct
  $result = doTheThing();

  // ❌ Wrong
  $result = doTheWrongThing();
  ```
-->

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
- [ ] **K5: Under 500 lines** — if larger, extract reference tables or templates into separate files in the skill folder
- [ ] **English only** — all content in English
- [ ] **No duplication** — doesn't repeat rules or guidelines that are already enforced elsewhere
- [ ] **No "Related skills" section** — the agent discovers skills via `<available_skills>` descriptions; cross-links waste tokens and create maintenance burden

