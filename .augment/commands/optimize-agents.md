---
name: optimize-agents
description: Audits agent infrastructure — measures token overhead, checks rule triggers, verifies AGENTS.md. Suggest only, never auto-apply.
skills: [copilot-agents-optimization, agents-audit, agent-docs-writing, quality-tools]
disable-model-invocation: true
---

# /optimize-agents

Agent infrastructure audit: measure token overhead, check rule triggers, verify AGENTS.md, find stale references. **Suggest only — never auto-apply.**

**Source of truth:** `.augment.uncompressed/` — never read or edit `.augment/` directly.

## Steps

### 1. Measure baseline

Count lines affecting token consumption:

```bash
# Always-loaded (per chat)
for f in .augment.uncompressed/rules/*.md; do
  type=$(head -5 "$f" | grep 'type:' | sed 's/.*"\(.*\)"/\1/')
  [ "$type" = "auto" ] && continue
  lines=$(wc -l < "$f"); echo "always | $lines | $(basename "$f")"
done | sort -t'|' -k2 -rn
agents=$(wc -l < AGENTS.md); echo "always | $agents | AGENTS.md"

# Auto-loaded rules
for f in .augment.uncompressed/rules/*.md; do
  type=$(head -5 "$f" | grep 'type:' | sed 's/.*"\(.*\)"/\1/')
  [ "$type" != "auto" ] && continue
  lines=$(wc -l < "$f"); echo "auto | $lines | $(basename "$f")"
done | sort -t'|' -k2 -rn

# Skills (top 20 by size)
for f in .augment.uncompressed/skills/*/SKILL.md; do
  name=$(echo "$f" | sed 's|.augment.uncompressed/skills/||;s|/SKILL.md||')
  lines=$(wc -l < "$f"); echo "$lines | $name"
done | sort -rn | head -20
```

Report totals:

| Category | Files | Lines |
|---|---|---|
| Always-loaded rules + AGENTS.md | {n} | {n} |
| Auto-loaded rules | {n} | {n} |
| Skills (total) | {n} | {n} |
| **TOTAL** | {n} | {n} |

### 2. Check rules

- **Frontmatter**: `type: "always"` or `type: "auto"` with `description`?
- **Duplicate triggers**: Same `description` → both load simultaneously

```bash
for f in .augment.uncompressed/rules/*.md; do
  desc=$(head -5 "$f" | grep 'description:' | sed 's/.*"\(.*\)"/\1/')
  [ -n "$desc" ] && echo "$desc | $(basename "$f")"
done | sort | awk -F' \\| ' '{descs[$1]=descs[$1] " " $2} END {for (d in descs) {n=split(descs[d], a, " "); if (n>1) print "⚠️  " d " →" descs[d]}}'
```

- **Redundancy**: Duplicates between rules, AGENTS.md, skills?
- **Merge candidates**: Small rules (< 15 lines) that belong elsewhere?

### 3. Check always → auto candidates

Apply the `rule-type-governance` rule criteria:

1. Does it apply to EVERY conversation? → keep `always`
2. Can it be triggered by a specific topic? → candidate for `auto`
3. Is it a core behavior constraint (scope-control, verify-before-complete, token-efficiency)? → **NEVER change to auto**

**Decision test:** "Does this rule need to be active when the user asks a simple question, reviews a PR, or discusses architecture?" No → `auto`.

**Safety gate for always → auto:**

- [ ] Rule is NOT a core behavior constraint
- [ ] A clear, specific trigger description exists
- [ ] The trigger won't miss conversations where the rule matters

Present candidates with explicit justification. **Never auto-apply.**

### 4. Check AGENTS.md + copilot-instructions.md

- **Budget**: AGENTS.md target ≤800 words (max ~1200). copilot-instructions.md < 60 lines (max ~150).
  See `guidelines/agent-infra/size-and-scope.md` for all limits.
- **Quality**: Dev Setup, Testing, Quality Tools need full detail — don't compress to one-liners
- **Duplication**: only word-for-word identical. Summary + detail = layered context, NOT duplication
- **Freshness**: paths, commands, references match reality?

```bash
lines=$(wc -l < AGENTS.md); bytes=$(wc -c < AGENTS.md)
echo "AGENTS.md: $lines lines, $bytes bytes (~$((bytes / 4)) tokens)"
[ "$lines" -gt 300 ] && echo "⚠️  Over 300-line target (review size-and-scope guideline)"
```

### 5. Check docs sync

Counts and lists in `contexts/augment-infrastructure.md` correct?

### 6. Run linters

```bash
python3 scripts/skill_linter.py --all --pairs --duplicates 2>&1 | grep "Summary:"
```

Report FAIL/WARN counts. Do NOT fix here — delegate to linter/skill-reviewer.

### 7. Present findings

| # | Category | Finding | Impact | Suggestion |
|---|---|---|---|---|
| 1 | Rule | `{name}` duplicate trigger | Both load simultaneously | Fix trigger description |
| 2 | Rule | `{name}` could be `auto` | ~{n} lines saved/chat | Switch (with safety gate) |
| ... | | | | |

Ask the user:

```
> 1. Go through suggestions one by one
> 2. Apply only high-impact changes (saves > 50 lines)
> 3. Skip — report only
```

## Preservation gate — MANDATORY before any change

- [ ] Does a rule lose strong enforcement language? → **REJECT**
- [ ] Does a rule lose a concrete example? → **REJECT**
- [ ] Does an always → auto switch risk missing relevant conversations? → **REJECT**
- [ ] Does the linter still pass after the change? → **REJECT if FAIL**

## What this command does NOT do

- **No quality judgments on skills** — use `/optimize-skills` or `skill-reviewer`
- **No auto-fixes** — all changes require explicit user approval
- **No "make it shorter"** — compression is done by Caveman Compression
- **No edits to `.augment/`** — always edit `.augment.uncompressed/`, then sync
