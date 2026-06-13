# Skill quality — mechanics

Description-triggering recipe, merge-preservation invariants, and
condensation-preservation invariants for the
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

Source: [`skills/skill-creator` in `an external reference`](https://github.com/an external reference/blob/main/skills/skill-creator/SKILL.md).

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

## Condensation Preservation

When condensing a skill, the condensed version MUST preserve:

- Trigger quality (description + When to use)
- All procedure steps that contain decisions
- All concrete validation checks
- All gotchas and anti-patterns
- Strongest example (at minimum one good/bad contrast)

Condensation may remove:
- Verbose explanations
- Redundant examples (keep the strongest)
- Commentary that doesn't affect execution

## Senior-tier patterns

Detail spec for the four blocks the [`skill-quality`](../../../rules/skill-quality.md)
rule requires on `tier: senior` skills. Each block ≤ 6-line spec + 1
reference pattern. Forward-only — applies to new senior-tier skills,
no retrofit on existing Wing-1 skills.

### 1. Context-First lead (description)

Two-sentence frontmatter `description`. First sentence: cognition
cluster anchor — name the domain + the senior role's stance. Second
sentence: the trigger — what the user types that should fire this.

Pattern:

```
description: "Use when {trigger paraphrase}. {Domain} cognition for the
{senior role} — produces {artifact name}."
```

Anti-pattern: leading with the artifact ("Produces a DCF model …") —
buries the cognition cluster, undertriggers on cluster-shaped prompts.

### 2. Related Skills (`## Related Skills`)

Two named lists, no ambiguity:

```markdown
## Related Skills

**WHEN to use this**
- {situation A this skill resolves better than {peer-1}}
- {situation B}

**WHEN NOT to use this**
- {situation C} — route to [`{peer-1}`](../{peer-1}/SKILL.md)
- {situation D} — route to [`{peer-2}`](../{peer-2}/SKILL.md)
```

WHEN-NOT entries MUST name the peer and link it. Naming without a
link drifts the moment the peer renames.

### 3. Proactive Triggers (`## When the agent should load this`)

3–5 concrete user-prompt patterns the agent watches for. Concrete =
phrases users actually type, not abstract categories.

```markdown
## When the agent should load this

- "should we build feature X or Y first" → opportunity-tree shaped
- "what's the ICE / RICE on this backlog" → prioritization shaped
- "how do I split this epic into shippable slices" → INVEST shaped
```

Anti-pattern: abstract categories ("prioritization questions",
"product-shaped requests") — the routing layer matches phrases, not
taxonomies.

### 4. Output Artifacts (`## Output`)

1–4 named artifacts with concrete shape. Each entry: name +
shape-hint the orchestrator can cite by name in a handoff.

```markdown
## Output

1. **opportunity-tree.md** — markdown tree, root = north-star metric,
   leaves = candidate solutions with hypothesis + evidence rank
2. **prioritization-table.md** — markdown table, columns =
   {opportunity, ICE score, evidence-grade, owner, next-step}
```

Anti-pattern: prose summary ("a doc explaining the prioritization") —
no orchestrator-citable identifier, no shape contract.
