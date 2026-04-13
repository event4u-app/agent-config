---
name: optimize-skills
description: Audits and optimizes all skills — deduplicates, merges related skills, fixes descriptions, adds Gotcha sections, removes Do NOT dupes, enforces the 5 Skill Killers checklist.
skills: [skill-reviewer]
---

# /optimize-skills

Full audit and optimization of all skills in `.augment/skills/`.
Runs the 5 Skill Killers checks, finds duplicates and merge candidates,
and cleans up redundancies. Present findings first, then apply.

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

Scan ALL skill descriptions and content for:

**Duplicates** (nearly identical purpose):
- Compare every skill's description with every other skill's description.
- Flag pairs where >70% of the description words overlap.
- Flag skills whose `## When to use` sections describe the same scenarios.

**Merge candidates** (related but separate):
- Skills that cover the same tool/area from different angles (e.g., `composer` + `composer-packages`).
- Skills where one is a strict subset of the other.
- Small skills (<50 lines) that could be a section in a larger skill.

Present findings:

```
## Duplicate/Merge Analysis

| # | Skills | Relationship | Recommendation |
|---|---|---|---|
| 1 | skill-a ↔ skill-b | Near-duplicate — both cover X | Delete skill-b, merge unique parts into skill-a |
| 2 | skill-c ↔ skill-d | skill-c is subset of skill-d | Merge skill-c into skill-d, delete skill-c |
| 3 | skill-e ↔ skill-f | Related but distinct | Keep both, clarify descriptions to avoid overlap |
```

**Ask the user before proceeding:**

```
> 1. Apply all merge/delete recommendations
> 2. Go through one by one — ask before each change
> 3. Skip — keep all skills as-is, proceed with optimization
```

For approved deletions: remove the skill folder and update `contexts/augment-infrastructure.md`.
For approved merges: combine content, remove the absorbed skill, update docs.

### 3. Killer 1 — Fix descriptions

Scan all skills for description format:

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

For each failing skill, rewrite the description following these rules:
- Start with `"Use when..."` or `"ONLY when user explicitly requests: ..."`.
- Include 2-3 trigger phrases users actually say.
- End with 1 sentence describing what the skill does.
- Keep under 200 chars.

### 4. Killer 2 — Check for over-defining

Scan the top 20 largest skills:
- Count numbered steps — flag if >15 sequential steps.
- Check if the skill prescribes HOW to think vs guiding WHAT to do.
- Report findings but don't auto-fix — ask the user.

### 5. Killer 3 — Check for obvious content

For each skill, check if paragraphs explain things the model already knows:
- Basic language features (what `strict_types` does, how `match` works).
- Framework fundamentals (how middleware works, what a controller is).
- General programming concepts (what DI is, what SOLID means).

Flag sections that restate model knowledge. Present for review — don't auto-delete.

### 6. Killer 4 — Add missing Gotcha sections

```bash
for f in .augment/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  grep -q "^## Gotcha" "$f" || echo "❌ $name — missing Gotcha"
done
```

For each skill missing a `## Gotcha` section:
- Read the skill's purpose and Do NOT list.
- Write 2-4 concrete failure patterns in format:
  - `"The model tends to X — do Y instead."`
  - `"Don't assume X — check Y first because Z."`
  - `"Edge case: when A happens, do B instead of C."`
- Insert `## Gotcha` section BEFORE the `## Do NOT` section.

### 7. Deduplicate Gotcha vs Do NOT

For each skill that has BOTH `## Gotcha` AND `## Do NOT`:
- Compare every Do NOT entry with every Gotcha entry.
- If a Do NOT entry says the same thing as a Gotcha entry (just without the explanation),
  remove the Do NOT entry — the Gotcha already covers it with more context.
- Keep Do NOT entries that are genuinely different from all Gotcha entries.

### 8. Killer 5 — Check sizes

```bash
for f in .augment/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  lines=$(wc -l < "$f" | tr -d ' ')
  [ "$lines" -gt 500 ] && echo "⚠️  $name — $lines lines (>500)"
done
```

For oversized skills: suggest extracting reference tables, templates, or
examples into separate files in the skill's folder.

### 9. Update docs

After all changes:
- Update skill count and category tables in `contexts/augment-infrastructure.md`.

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

### Destructive actions — ALWAYS ask first

- **NEVER delete a skill** without explicit user approval (step 2).
- **NEVER merge skills** without explicit user approval (step 2).
- **NEVER compress a skill below its functional minimum** — if a skill has command references,
  config tables, workflow steps, or "Do NOT" lists, those are load-bearing content.
  A 400-line skill compressed to 86 lines is NOT optimized — it's broken.
- **NEVER strip strong language** — "Do NOT", "NEVER", "MUST" exist because the model
  ignores weaker phrasing. "Avoid X" does NOT equal "NEVER do X".
- **NEVER remove examples or code blocks** — they are the most actionable content.
  Removing them to save lines degrades skill quality.

### Safe actions — can be auto-applied

- **Descriptions** — rewriting to "Use when..." format is safe (additive).
- **Gotcha sections** — adding missing Gotchas is safe (additive).
- **Do NOT deduplication** — removing a Do NOT entry that's already covered by a Gotcha is safe.
- **Frontmatter quotes** — adding quotes around descriptions is safe.

### Process rules

- **Killer 3 (obvious content) requires review** — don't auto-delete, the user decides.
- **Quality over tokens** — if a change would lose clarity, don't make it.
- **Always show before/after** so the user sees the impact.
- **Present findings first** — no silent changes to skill content.
