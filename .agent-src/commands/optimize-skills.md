---
name: optimize-skills
description: Audits skills — measures baseline, finds duplicates/merge candidates, runs linter. Suggest only, never auto-apply.
skills: [skill-reviewer]
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "audit my skills, find duplicate skills"
  trigger_context: "maintainer working on .augment/skills/ files"
superseded_by: optimize skills
deprecated_in: "1.15.0"
---

> ⚠️  /optimize-skills is deprecated; use /optimize skills instead.
> This shim is retained for one release cycle (1.15.0 → next minor) and forwards to the same instructions below. See [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

# /optimize-skills

Skill audit: measure, find duplicates/merge candidates, run linter, present findings. **Suggest only — never auto-apply.**

**Source of truth:** `.agent-src.uncompressed/` — never read or edit `.agent-src/` or `.augment/` directly.

## Steps

### 1. Measure baseline

```bash
total=$(ls -d .agent-src.uncompressed/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
total_lines=$(cat .agent-src.uncompressed/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
echo "Skills: $total, Total lines: $total_lines"

# Top 15 by size
for f in .agent-src.uncompressed/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  lines=$(wc -l < "$f" | tr -d ' ')
  echo "$lines $name"
done | sort -rn | head -15
```

### 2. Run skill linter

```bash
python3 scripts/skill_linter.py --pairs --duplicates .agent-src.uncompressed/skills/*/SKILL.md 2>&1 | tail -20
```

Report FAIL/WARN counts. Do NOT fix linter issues here — that's the linter's or `skill-reviewer`'s job.

### 3. Find duplicates and merge candidates

**Duplicates**: >70% description overlap, same `## When to use` scenarios.
**Merge candidates**: same tool/area, strict subset, <50 lines → section in larger skill.

Present as table:

| # | Skills | Relationship | Recommendation |
|---|---|---|---|
| 1 | skill-a ↔ skill-b | Near-duplicate | Merge unique parts into skill-a |
| 2 | skill-c ↔ skill-d | Strict subset | Merge skill-c into skill-d |
| 3 | skill-e ↔ skill-f | Related but distinct | Keep both, clarify descriptions |

### 4. Find description overlap

Skills with overlapping trigger descriptions that might load simultaneously:

```bash
for f in .agent-src.uncompressed/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  desc=$(grep 'description:' "$f" | head -1 | sed 's/.*"\(.*\)"/\1/')
  echo "$name | $desc"
done | sort -t'|' -k2
```

Flag pairs where descriptions target the same scenario.

### 5. Check sizes

```bash
for f in .agent-src.uncompressed/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  lines=$(wc -l < "$f" | tr -d ' ')
  [ "$lines" -gt 300 ] && echo "⚠️  $name — $lines lines"
done
```

Oversized → suggest splitting by responsibility or extracting reference material.
Size limits: see `docs/guidelines/agent-infra/size-and-scope.md`.

### 6. Present findings

```
## Skill Audit Results

| Metric | Value |
|---|---|
| Total skills | X |
| Total lines | X |
| Linter FAIL | X |
| Linter WARN | X |
| Duplicate/merge candidates | X |
| Oversized (>300 lines) | X |
```

Ask user:

```
> 1. Go through merge candidates one by one
> 2. Fix linter issues (delegates to skill-reviewer)
> 3. Skip — report only
```

## Preservation gate — MANDATORY before any change

Before suggesting ANY modification to a skill, verify:

- [ ] Does the skill lose a concrete `### Validate` section? → **REJECT**
- [ ] Does the skill lose a real example or code snippet? → **REJECT**
- [ ] Does the skill lose a failure pattern from `## Gotcha`? → **REJECT**
- [ ] Does the skill lose a `## Do NOT` entry? → **REJECT**
- [ ] Does strong language get weakened ("MUST" → "should", "NEVER" → "avoid")? → **REJECT**
- [ ] Does the linter still pass after the change? → **REJECT if FAIL**

If any check fails: do NOT suggest the change.

## What this command does NOT do

- **No quality judgments** — the skill linter and `skill-reviewer` handle that
- **No auto-fixes** — all changes require explicit user approval
- **No "make it shorter"** — compression is done by Caveman Compression, not here
- **No Killer checks** — replaced by the skill linter (`scripts/skill_linter.py`)
- **No edits to `.agent-src/` or `.augment/`** — always edit `.agent-src.uncompressed/`, then sync
