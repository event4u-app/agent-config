---
name: copilot-agents-optimize
description: Analyzes and refactors AGENTS.md and copilot-instructions.md — removes duplications, enforces line budgets, and ensures both files are optimized for their audience.
skills: [copilot-agents-optimization, copilot-config, agent-docs-writing]
disable-model-invocation: true
---

# /copilot-agents-optimize

Analyzes and refactors `AGENTS.md` and `.github/copilot-instructions.md` against the `.augment/` ecosystem.

## Steps

### 1. Measure current state

```bash
wc -l AGENTS.md .github/copilot-instructions.md
```

Report line counts with budget status:

| File | Lines | Budget | Status |
|---|---|---|---|
| `AGENTS.md` | {n} | ≤ 500 ideal, max 1000 | 🟢/🟡/🔴 |
| `copilot-instructions.md` | {n} | ≤ 500 ideal, max 1000 | 🟢/🟡/🔴 |

### 2. Scan for duplications

Read both files and compare against `.augment/` content:

**Check against rules:**
```bash
ls .augment/rules/*.md
```
For each rule, check if AGENTS.md or copilot-instructions.md duplicates its content.

**Check against guidelines:**
```bash
find .augment/guidelines/ -name '*.md'
```
For each guideline, check if either file repeats the same conventions.

**Check against skills:**
```bash
ls .augment/skills/*/SKILL.md
```
For each skill, check if either file contains domain knowledge that belongs in the skill.

**Check between the two files:**
Compare sections — anything duplicated between AGENTS.md and copilot-instructions.md
that isn't required for Copilot's self-containment.

### 3. Present findings

Show a table of issues found:

| # | File | Section | Issue | Action |
|---|---|---|---|---|
| 1 | AGENTS.md | "Coding Standards" | Duplicates `.augment/rules/php-coding.md` | Remove, add reference |
| 2 | copilot | "SOLID Principles" | Duplicates `.augment/rules/architecture.md` | Keep (Copilot needs it) |
| 3 | copilot | "Trailing commas" | Auto-enforced by ECS | Remove |
| ... | | | | |

Classify each issue:

| Action | Meaning |
|---|---|
| **Remove** | Content exists in `.augment/` and the file can reference it |
| **Keep** | Content is needed self-contained (copilot-instructions.md) |
| **Compress** | Content is valid but too verbose — shorten |
| **Extract** | Move to a dedicated file in `agents/` and link |
| **Update** | Content is outdated or references have changed |

### 4. Ask for confirmation

> Found {n} optimizations:
> - {x} duplicates to remove (AGENTS.md)
> - {y} sections to compress
> - {z} sections to extract to `agents/`
>
> 1. Apply all changes
> 2. Confirm each change individually
> 3. Only optimize AGENTS.md
> 4. Only optimize copilot-instructions.md

### 5. Apply changes

For each approved change:

1. **Remove duplicates** — Delete the section, add a reference line if needed
2. **Compress** — Rewrite verbose sections as concise tables/bullets
3. **Extract** — Create file in `agents/`, move content, add link in original
4. **Update** — Fix outdated references, paths, or descriptions

After each file is modified, verify:
- Line count is within budget
- No broken references
- Self-containment preserved for copilot-instructions.md

### 6. Verify cross-references

Check that all references in both files are valid:

```bash
# Find all markdown links in both files
grep -oE '\[.*\]\(.*\)' AGENTS.md .github/copilot-instructions.md
```

For each link, verify the target file exists.

### 7. Report results

> ✅  Optimization complete:
>
> | File | Before | After | Δ |
> |---|---|---|---|
> | `AGENTS.md` | {old} lines | {new} lines | -{diff} |
> | `copilot-instructions.md` | {old} lines | {new} lines | -{diff} |
>
> **Removed duplicates:** {n}
> **Compressed sections:** {n}
> **Extracted content:** {n} (to `agents/`)

### 8. Suggest follow-ups

If issues were found that need manual attention:

> ⚠️ Manual review recommended:
> - {issue description}

If `.augment/` content is missing that both files reference:

> 💡 Missing `.augment/` content:
> - {missing skill/rule/guideline}

## Rules

- **NEVER strip strong language** — "Do NOT", "NEVER", "MUST" are load-bearing words.
  See the Iron Laws in `/optimize-agents` — they apply here too.
- **NEVER remove examples** from `copilot-instructions.md` — Copilot Code Review cannot
  read other files, so examples must be self-contained.
- **`copilot-instructions.md` MUST remain self-contained** — it cannot reference `.augment/`
  files because Copilot Code Review has no access to them. Only Copilot Chat can read other files.
- **`AGENTS.md` MAY reference `.augment/`** — it is read by tools that can follow links.
- **Ask before removing** — present findings first, apply after approval.
