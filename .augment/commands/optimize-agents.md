---
name: optimize-agents
description: Analyzes and optimizes the entire agent setup — rules, skills, commands, AGENTS.md, copilot-instructions, .agent-settings — for token efficiency and quality.
skills: [copilot-agents-optimizer, agents-audit, agent-docs, quality-tools]
---

# /optimize-agents

Full agent infrastructure analysis/optimization. Minimize tokens, preserve quality. Present findings, ask before changes.

## Steps

### 1. Measure baseline

Count lines affecting token consumption:

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

- **Frontmatter**: `type: "always"` or `type: "auto"` with `description`?
- **always vs auto**: Could it be `auto`? Always > 150 lines → check necessity
- **Redundancy**: Duplicates with other rules, AGENTS.md, skills?
- **Merge candidates**: Small rules (< 15 lines) belonging elsewhere?
- **Duplicate triggers**: Same `description` → both load simultaneously

```bash
# Check for duplicate rule triggers
for f in .augment/rules/*.md; do
  desc=$(head -5 "$f" | grep 'description:' | sed 's/.*"\(.*\)"/\1/')
  [ -n "$desc" ] && echo "$desc | $(basename "$f")"
done | sort | awk -F' \\| ' '{descs[$1]=descs[$1] " " $2} END {for (d in descs) {n=split(descs[d], a, " "); if (n>1) print "⚠️  " d " →" descs[d]}}'
```

### 3. Check skills (top 20 by size)

- **Description**: specific enough? Analysis skills MUST start with `"ONLY when user explicitly requests: ..."`
- **Redundancy with rules**: repeats "Do NOT" lists? → `"See {rule} rule."`
- **Overlap**: nearly identical skills?
- **Size**: >300 lines → compressible?

### 4. Check commands (top 10)

- Redundancy with skills, correct `skills:` frontmatter, consistent structure

### 5. Check AGENTS.md + copilot-instructions.md

- **Budget**: ≤500 lines each
- **Quality**: Dev Setup, Testing, Quality Tools need full detail — don't compress to one-liners
- **Duplication**: only word-for-word identical. Summary + detail = layered context, NOT duplication
- **Freshness**: paths, commands, references match reality?

```bash
# Measure AGENTS.md size and compare with target
lines=$(wc -l < AGENTS.md); bytes=$(wc -c < AGENTS.md)
echo "AGENTS.md: $lines lines, $bytes bytes (~$((bytes / 4)) tokens)"
[ "$lines" -gt 500 ] && echo "⚠️  Over 500-line target — check for unnecessary verbosity"
```

### 6. Check .agent-settings template

Compare template with actual. All settings documented? All referenced by rule/skill/command?

### 7. Check docs sync

Counts and lists in `contexts/augment-infrastructure.md` correct?

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

Apply approved changes → update `contexts/augment-infrastructure.md` → re-run baseline → show before/after.

## Rules — Iron Laws of Optimization

NON-NEGOTIABLE. Previous runs caused severe damage.

### Content preservation

- **NEVER strip strong language** — "Do NOT", "NEVER", "MUST" are load-bearing. Weaker phrasing = sabotage.
- **NEVER remove examples** — most actionable part. Removing = quality loss.
- **NEVER compress to one-liners** — 400→86 lines loses critical content. Ask before removing sections.
- **NEVER delete files** without explicit user approval.
- **NEVER remove cross-references** to existing systems (overrides, templates, contexts).

### Optimization IS

- `always` → `auto` (with good trigger), deduplication, missing frontmatter, better descriptions, moving rarely-needed tables to context

### Optimization is NOT

- "Do NOT" → passive voice, removing examples, deleting "obvious" sections, merging for count reduction

### Process

- Show before/after counts
- Quality > tokens
- Findings first, apply after approval
- One category at a time
