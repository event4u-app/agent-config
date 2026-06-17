---
class: B
trust: medium
kind: observed-convention
domain: skill-authoring
sources:
  - { pattern: "src/skills/*/SKILL.md", observed_n: 12, note: "sampled across engineering + meta skills" }
confirm_against: "src/scripts/skill_linter.py REQUIRED_SKILL_SECTIONS + an existing sibling skill"
---

# Class-B observed convention — authoring a skill in this repo

> **Lead, not truth.** These are conventions *observed* across real skills, to be
> confirmed against an actual sibling skill + the linter before relying on them.
> Read for heuristics; the linter is the deterministic check.

## Conventions (observed across ≥12 skills)

- **Location & name:** a skill lives at `src/skills/<name>/SKILL.md`; the
  frontmatter `name:` MUST equal the directory `<name>`.
- **Frontmatter keys:** `model_tier`, `name`, `description`, `domain`,
  `workspaces` (list), `packs` (list). `description` ≤ ~200 chars and typically
  opens with "Use when …" / "Use BEFORE …".
- **Required sections (the linter enforces these):** `## When to use`,
  `## Procedure` (or a `## Procedure: …` prefix), `## Output format` (or
  `## Output`), `## Gotcha` (or `## Gotchas`), `## Do NOT` (or `## Anti-patterns`).
- **Output format must carry ≥ 2 ordered requirements** (numbered/bulleted
  response constraints) — a single sentence trips a linter warning.
- **See also:** close with a `## See also` block linking related skills/contexts
  by **relative path** (`../<skill>/SKILL.md`).
