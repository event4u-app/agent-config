---
name: optimize-skills
description: Audits and optimizes all skills — deduplicates, merges related skills, fixes descriptions, adds Gotcha sections, removes Do NOT dupes, enforces the 5 Skill Killers checklist.
skills: [skill-reviewer]
---

# /optimize-skills

Full skill audit: 5 Skill Killers checks, duplicates, merge candidates, redundancies. Present findings first.

## Steps

### 1. Measure baseline

```bash
total=$(ls -d .augment/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
total_lines=$(cat .augment/skills/*/SKILL.md | wc -l | tr -d ' ')
echo "Skills: $total, Total lines: $total_lines"

# Top 15 by size
for f in .augment/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  lines=$(wc -l < "$f" | tr -d ' ')
  echo "$lines $name"
done | sort -rn | head -15
```

### 2. Find duplicates and merge candidates

**Duplicates**: >70% description overlap, same `## When to use` scenarios.
**Merge candidates**: same tool/area, strict subset, <50 lines → section in larger skill.

```
## Duplicate/Merge Analysis

| # | Skills | Relationship | Recommendation |
|---|---|---|---|
| 1 | skill-a ↔ skill-b | Near-duplicate — both cover X | Delete skill-b, merge unique parts into skill-a |
| 2 | skill-c ↔ skill-d | skill-c is subset of skill-d | Merge skill-c into skill-d, delete skill-c |
| 3 | skill-e ↔ skill-f | Related but distinct | Keep both, clarify descriptions to avoid overlap |
```

Ask user:

```
> 1. Apply all merge/delete recommendations
> 2. Go through one by one — ask before each change
> 3. Skip — keep all skills as-is, proceed with optimization
```

Deletions → remove folder + update docs. Merges → combine + remove + update.

### 3. Killer 1 — Fix descriptions

```bash
# Find skills NOT starting with "Use when" or "ONLY when"
for f in .augment/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  desc=$(grep 'description:' "$f" | head -1)
  if ! echo "$desc" | grep -qi 'Use when\|ONLY when'; then
    echo "❌ $name"
  fi
done
```

Rewrite: `"Use when..."` / `"ONLY when..."` + 2-3 trigger phrases + 1 sentence purpose. <200 chars.

### 4. Killer 2 — Over-defining

Top 20: >15 steps? HOW vs WHAT? Report, don't auto-fix.

### 5. Killer 3 — Obvious content

Flag paragraphs restating model knowledge (language features, framework basics, SOLID). Present for review.

### 6. Killer 4 — Missing Gotchas

```bash
for f in .augment/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  grep -q "^## Gotcha" "$f" || echo "❌ $name — missing Gotcha"
done
```

Per missing skill: write 2-4 concrete failure patterns. Insert before `## Do NOT`.

### 7. Deduplicate Gotcha vs Do NOT

Do NOT entry same as Gotcha? → remove Do NOT (Gotcha has more context). Keep genuinely different entries.

### 8. Killer 5 — Check sizes

```bash
for f in .augment/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  lines=$(wc -l < "$f" | tr -d ' ')
  [ "$lines" -gt 500 ] && echo "⚠️  $name — $lines lines (>500)"
done
```

Oversized → extract reference tables/templates/examples into separate files.

### 9. Update docs

Update `contexts/augment-infrastructure.md` counts/tables.

### 10. Present results

```
## Optimization Results

| Metric | Before | After | Δ |
|---|---|---|---|
| Total skills | X | Y | -Z |
| Total lines | X | Y | -Z |
| Skills with "Use when" desc | X% | 100% | +Z% |
| Skills with Gotcha section | X% | 100% | +Z% |
| Do NOT duplicates removed | — | Z | — |
| Merges performed | — | Z | — |
| Skills deleted | — | Z | — |
```

## Rules

### Destructive — ALWAYS ask

- NEVER delete/merge without approval
- NEVER compress below functional minimum (400→86 = broken)
- NEVER strip strong language or remove examples

### Safe — auto-apply

- Description rewrites, Gotcha additions, Do NOT deduplication, frontmatter quotes

### Process

- Killer 3 requires review. Quality > tokens. Show before/after. No silent changes.
