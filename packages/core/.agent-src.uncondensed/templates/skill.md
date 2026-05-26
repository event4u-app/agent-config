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

<!-- COUNCIL DEPTH (optional — delete this comment when done):
  Add `council_depth: deep` to the frontmatter when this skill triggers
  AI Council on architecture, refactoring, or bug-diagnosis artefacts.
  The host translates `deep` into `--depth deep` on the council CLI,
  raising the round floor to `max(ai_council.deep_min_rounds,
  ai_council.min_rounds)`.

  Only `deep` is accepted. **Omit the key for default depth** —
  `standard` is the implicit default and is rejected by the schema
  (every frontmatter byte counts against the context window).

  Example:
    council_depth: deep

  See .augment/skills/ai-council/SKILL.md.
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

<!-- FRUGALITY STANDARDS (writer skills only — REQUIRED for skills whose
  name ends in `-writing`, `-authoring`, or `-create`, AND for any
  skill on the `FRUGALITY_WRITER_SKILLS` allowlist in
  `scripts/skill_linter.py`. Mid-/untiered non-writer skills MUST
  remove this section entirely.

  Layer-1 of the linter checks for:
    1. The literal H2 `## Frugality Standards`,
    2. A markdown link matching the regex
       `\[[^\]]+\]\([^)]*frugality-charter\.md[^)]*\)`.

  Body shape — single charter cite, then 3–5 decidable pre-save
  questions framed as *applying the charter*, not parallel rules
  (council Pass #4 finding 0.B):

  ## Frugality Standards

  Per the [Frugality Charter](../../contexts/contracts/frugality-charter.md),
  this writer applies the default-terse standard: no narrative intros,
  no preview-then-confirm gates, no numbered options without a real
  trade-off.

  Pre-save self-check:
  1. Does every body section start with the obligation, not an intro?
  2. Are numbered options absent unless options differ in *consequence*?
  3. Is every cited rule linked, not restated?
  4. {artifact-specific question — e.g., for `command-writing`:
     "Does the command honor `verbosity.routine_confirmations: false`?"}
  5. {artifact-specific question — e.g., for `rule-writing`:
     "Does the rule body open with the Iron Law, no preamble?"}
-->

<!-- SENIOR-TIER STUB BLOCKS (delete entire section if not `tier: senior`):
  Senior-tier skills (frontmatter `tier: senior`) require four extra
  blocks per `.agent-src.uncondensed/rules/skill-quality.md` §
  Senior-Tier Required Structure. Mid-tier and untiered skills MUST
  remove this section entirely. The four blocks are enforced by
  `scripts/skill_linter.py` for `tier: senior` skills only.

  ## Related Skills

  **WHEN to use this**
  - {situation A this skill resolves better than peer skill}
  - {situation B}

  **WHEN NOT to use this**
  - {situation C} — route to [`{peer-skill}`](../{peer-skill}/SKILL.md)
  - {situation D} — route to [`{peer-skill}`](../{peer-skill}/SKILL.md)

  ## When the agent should load this

  - "{user phrase 1 — concrete paraphrase}"
  - "{user phrase 2}"
  - "{user phrase 3}"

  ## Output

  1. **{artifact-name.md}** — {shape: markdown table / tree / report}
  2. **{artifact-name-2.md}** — {shape}
-->
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
- [ ] **No "Related skills" section for mid-tier / untiered skills** — the agent discovers them via `<available_skills>` descriptions; cross-links waste tokens. Senior-tier skills (`tier: senior`) MUST include the block per `skill-quality.md` § Senior-Tier Required Structure (linter-enforced).

