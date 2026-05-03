# Skill quality — mechanics

Description-triggering recipe, merge-preservation invariants, and
compression-preservation invariants for the
[`skill-quality`](../../../rules/skill-quality.md) rule. The minimum
sharpness table, required sections, frontmatter contract, the
skill-independence Iron Law, and the refactor-safety NEVER list live
in the rule; this file is the lookup material when authoring or
refactoring a skill.

## Description Triggering

Claude routes skills by reading the frontmatter `description`. Polite, generic,
or hedged descriptions cause **undertriggering** — the skill never loads when it
should, and the user never learns it exists.

Make descriptions "pushy" — explicit about when to fire:

- Start with a concrete verb phrase: `Use when ...`, `Creates ...`, `Reviews ...`.
- Name 2+ concrete triggers — domains, symptoms, file types, user phrasing.
- End with: `... even if they don't explicitly ask for \`<skill-name>\`.`
- Avoid hedges: `may help with`, `can be useful for`, `covers various`.
- **Keep it ≤ 200 characters.** `scripts/skill_linter.py` warns at
  `description_too_long` above this. If the pushy tail pushes you over, cut
  adjectives, drop the second example phrasing, or collapse a list — do
  **not** drop the trigger vocabulary or the `even if ...` tail.

Source: [`skills/skill-creator` in `anthropics/skills`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md).

**Litmus test:** Read the description cold, without the skill's body. If you
cannot name at least two phrasings a user would realistically type that should
route to this skill, the description is too polite. Rewrite it.

## Merge Preservation

When merging or refactoring skills, the merged result MUST preserve:

1. **Strongest validation** from each source skill
2. **Strongest example** (good/bad contrast) from each source
3. **Strongest anti-pattern** from each source
4. **All concrete decision criteria** that differ between sources

A merge is invalid if:
- Validation got weaker than the strongest source
- Examples were lost without replacement
- Anti-pattern coverage decreased
- The merged skill became a generic umbrella doc

## Compression Preservation

When compressing a skill, the compressed version MUST preserve:

- Trigger quality (description + When to use)
- All procedure steps that contain decisions
- All concrete validation checks
- All gotchas and anti-patterns
- Strongest example (at minimum one good/bad contrast)

Compression may remove:
- Verbose explanations
- Redundant examples (keep the strongest)
- Commentary that doesn't affect execution
