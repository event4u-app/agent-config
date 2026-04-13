---
name: optimize-agents
description: Analyzes and optimizes the entire agent setup — rules, skills, commands, AGENTS.md, copilot-instructions, .agent-settings — for token efficiency and quality.
skills: [copilot-agents-optimizer, agents-audit, agent-docs, quality-tools]
---

# /optimize-agents

Full analysis and optimization of the agent infrastructure. Goal: minimize token consumption
without losing quality. Present findings, ask before making changes.

## Steps

### 1. Measure baseline

Count lines for everything that affects token consumption:

```bash
# Always-loaded (per chat)
for f in .augment/rules/*.md; do
  type=$(head -5 "$f" | grep 'type:' | sed 's/.*"\(.*\)"/\1/')
  [ "$type" = "auto" ] && continue
  lines=$(wc -l < "$f"); echo "always | $lines | $(basename "$f")"
done | sort -t'|' -k2 -rn
agents=$(wc -l < AGENTS.md); echo "always | $agents | AGENTS.md"

# Auto-loaded rules
for f in .augment/rules/*.md; do
  type=$(head -5 "$f" | grep 'type:' | sed 's/.*"\(.*\)"/\1/')
  [ "$type" != "auto" ] && continue
  lines=$(wc -l < "$f"); echo "auto | $lines | $(basename "$f")"
done | sort -t'|' -k2 -rn

# Skills (top 20 by size)
for f in .augment/skills/*/SKILL.md; do
  name=$(echo "$f" | sed 's|.augment/skills/||;s|/SKILL.md||')
  lines=$(wc -l < "$f"); echo "$lines | $name"
done | sort -rn | head -20

# Commands (top 10 by size)
for f in .augment/commands/*.md; do
  lines=$(wc -l < "$f"); echo "$lines | $(basename "$f")"
done | sort -rn | head -10
```

Report totals:

| Category | Files | Lines |
|---|---|---|
| Always-loaded rules + AGENTS.md | {n} | {n} |
| Auto-loaded rules | {n} | {n} |
| Skills (total) | {n} | {n} |
| Commands (total) | {n} | {n} |
| **TOTAL** | {n} | {n} |

### 2. Check rules

For each rule:

- **Frontmatter**: Does it have `type: "always"` or `type: "auto"` with a `description`?
- **always vs auto**: Should this rule really be always-loaded? Could it be `auto` without risk?
- **Size**: Always-loaded rules > 150 lines — check if truly necessary. Prefer quality over compression.
  Only move detail to a context file if it's rarely needed. Do NOT strip actionable content.
- **Redundancy**: Does this rule duplicate content from another rule, AGENTS.md, or a skill?
- **Merge candidates**: Are there small rules (< 15 lines) that belong in another rule?
- **Duplicate triggers**: Do any two auto-loaded rules share the exact same `description`?
  If yes, both load simultaneously — fix by making descriptions unique.

```bash
# Check for duplicate rule triggers
for f in .augment/rules/*.md; do
  desc=$(head -5 "$f" | grep 'description:' | sed 's/.*"\(.*\)"/\1/')
  [ -n "$desc" ] && echo "$desc | $(basename "$f")"
done | sort | awk -F' \\| ' '{descs[$1]=descs[$1] " " $2} END {for (d in descs) {n=split(descs[d], a, " "); if (n>1) print "⚠️  " d " →" descs[d]}}'
```

### 3. Check skills

For each skill (focus on the 20 largest):

- **Description precision**: Is it specific enough to avoid false-positive matching?
  Analysis/research/audit skills MUST start with `"ONLY when user explicitly requests: ..."`
- **Redundancy with rules**: Does the skill repeat "Do NOT" lists or policies from rules?
  If yes → replace with `"See {rule} rule."` reference.
- **Overlap with other skills**: Are there skills that do nearly the same thing?
- **Size**: Skills > 300 lines — can sections be compressed?

### 4. Check commands

For each command (focus on the 10 largest):

- **Redundancy**: Does the command duplicate workflow steps from a skill?
- **Skills reference**: Does it declare the right `skills:` in frontmatter?
- **Consistency**: Do all commands follow the same structure (Steps, Rules sections)?

### 5. Check AGENTS.md and copilot-instructions.md

Run the checks from `/copilot-agents-optimize`:

- **Line budget**: AGENTS.md ≤ 500 ideal. copilot-instructions.md ≤ 500 ideal.
- **Quality over tokens**: AGENTS.md MUST contain full detail for Dev Setup, Testing, and Quality Tools.
  These sections are critical for correct behavior. Do NOT compress them into one-liners.
  Add `→ Full details: agents/docs/{file}.md` references as ADDITIONS, not replacements.
- **Duplication**: Only flag content that is TRULY redundant (word-for-word identical in two places).
  Having a summary in AGENTS.md + detail in agents/docs/ is NOT duplication — it's layered context.
- **Freshness**: Do file paths, command names, and tool references match reality?

```bash
# Measure AGENTS.md size and compare with target
lines=$(wc -l < AGENTS.md); bytes=$(wc -c < AGENTS.md)
echo "AGENTS.md: $lines lines, $bytes bytes (~$((bytes / 4)) tokens)"
[ "$lines" -gt 500 ] && echo "⚠️  Over 500-line target — check for unnecessary verbosity"
```

### 6. Check .agent-settings template

- Compare `.augment/templates/agent-settings.md` with actual `.agent-settings`.
- Are all settings documented in the template?
- Are all template settings referenced by at least one rule, skill, or command?

### 7. Check docs sync

- Does `contexts/augment-infrastructure.md` list all rules with correct count?
- Does `contexts/augment-infrastructure.md` list all rules?

### 8. Present findings

Present a summary table:

| # | Category | Finding | Impact | Suggestion |
|---|---|---|---|---|
| 1 | Rule | `{name}` could be `auto` | ~{n} lines saved per chat | Switch to auto |
| 2 | Skill | `{name}` description too broad | May load unnecessarily | Restrict description |
| ... | | | | |

Ask the user:

```
> 1. Apply all suggestions
> 2. Go through one by one — ask before each change
> 3. Apply only high-impact changes (saves > 50 lines)
> 4. Skip — just show the report
```

### 9. Apply approved changes

Apply the approved optimizations. After all changes:

- Update `contexts/augment-infrastructure.md` counts and tables
- Update `contexts/augment-infrastructure.md` rule table
- Re-run the baseline measurement from step 1
- Show before/after comparison

## Rules — The Iron Laws of Optimization

These rules exist because previous optimization runs caused severe damage.
They are NON-NEGOTIABLE. Violating any of them is a critical failure.

### Content preservation

- **NEVER strip strong language** — "Do NOT", "NEVER", "MUST", "CRITICAL" are load-bearing words.
  They exist because the model ignores weaker phrasing. Replacing "NEVER do X" with "Prefer Y"
  or "Only do X when..." is NOT optimization — it's sabotage.
- **NEVER remove examples** — code examples, option blocks, and sample output are NOT fluff.
  They are the most actionable part of a rule. Removing them to save lines degrades quality.
- **NEVER compress detail sections into one-liners** — a 400-line skill compressed to 86 lines
  loses critical command references, config details, and workflow instructions.
  If a section exists, it exists for a reason. Ask before removing.
- **NEVER delete files without explicit user approval** — not skills, not commands, not templates,
  not contexts. Even if they seem unused. Always ask first.
- **NEVER remove cross-references to existing systems** — if an override system, template system,
  or context system exists in the project, its references MUST stay in all related files.

### What optimization IS

- Switching a rule from `always` to `auto` (with a good trigger description)
- Deduplicating word-for-word identical content between two files
- Adding missing frontmatter (`type`, `description`)
- Improving a description to be more trigger-specific
- Moving rarely-needed reference tables into a context file (keeping a summary + link)

### What optimization is NOT

- Replacing "Do NOT" with passive voice
- Removing example blocks to save lines
- Deleting sections because "the model already knows this"
- Merging files to reduce count (unless truly redundant)
- Stripping detail from commands, skills, or configs

### Process rules

- **Always show before/after line counts** so the user sees the impact.
- **Quality over tokens** — if compression would lose clarity, don't compress.
- **Present findings first, apply after approval** — no silent changes.
- **One category at a time** — don't batch all changes into one massive commit.
