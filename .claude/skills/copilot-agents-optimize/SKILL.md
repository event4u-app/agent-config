---
name: copilot-agents-optimize
description: "Copilot Agents Optimize"
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

Compare both files against `.augment/rules/`, `.augment/guidelines/`, `.augment/skills/`. Also compare between the two files (excluding Copilot self-containment needs).

### 3. Present findings

Show a table of issues found:

| # | File | Section | Issue | Action |
|---|---|---|---|---|
| 1 | AGENTS.md | "Coding Standards" | Duplicates `.augment/rules/php-coding.md` | Remove, add reference |
| 2 | copilot | "SOLID Principles" | Duplicates `.augment/rules/architecture.md` | Keep (Copilot needs it) |
| 3 | copilot | "Trailing commas" | Auto-enforced by ECS | Remove |
| ... | | | | |

Actions: **Remove** (exists in `.augment/`), **Keep** (self-contained need), **Compress**, **Extract** (to `agents/`), **Update**.

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

Remove/compress/extract/update as approved. Verify: budget, references, copilot self-containment.

### 6. Verify cross-references — all markdown links point to existing files.

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

### 8. Suggest follow-ups — manual review needed, missing `.augment/` content.

## Rules

- NEVER strip strong language or remove copilot examples (self-contained requirement)
- `copilot-instructions.md` MUST stay self-contained (no `.augment/` refs)
- `AGENTS.md` MAY reference `.augment/`
- Ask before removing — findings first
