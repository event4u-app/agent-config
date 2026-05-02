---
name: fix-references
description: Find and fix broken cross-references in .augment/ and agents/ files
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Package-internal — only the event4u/agent-config repo runs this."
---

<!-- F2-deprecation-banner -->
> **Deprecated — use `/fix references`.** This standalone command
> is kept as a deprecation shim for one release cycle and routes to
> the same instructions below. New invocations should go through the
> `/fix` orchestrator (`commands/fix.md`).
<!-- /F2-deprecation-banner -->

# fix-references

## Instructions

### 1. Run the reference checker

```bash
python3 scripts/check_references.py --format json
```

### 2. Parse findings

If output is `[]` or "No broken references found":

```
✅  No broken references found. All cross-references are valid.
```

Stop here.

### 3. Display findings

```
═══════════════════════════════════════════════
  🔗 BROKEN REFERENCE REPORT
═══════════════════════════════════════════════

  Found: {count} broken reference(s)
```

Group by file:

```
  {file}:
    Line {line}: `{ref}` ({ref_type}) → suggested: `{suggestion}`
    Line {line}: `{ref}` ({ref_type}) → no suggestion
```

### 4. Auto-fix with confirmation

For each broken reference:

1. **If suggestion exists** → open the file, find the line, replace the broken ref with the suggestion.
2. **If no suggestion** → search the codebase for the closest match. If found, propose it. If not, flag for manual review.
3. **If the reference is in a code block** → skip (code blocks are not cross-references).
4. **If the reference is in an example/template** → skip (placeholders are intentional).

Present a summary before applying:

```
  Proposed fixes:
  1. {file}:{line} — `{old}` → `{new}`
  2. {file}:{line} — `{old}` → `{new}`
  3. {file}:{line} — MANUAL: no match found

> 1. Apply all automatic fixes
> 2. Apply interactively (ask for each)
> 3. Skip — just show the report
```

### 5. Apply fixes

Edit files in `.agent-src.uncompressed/` (source of truth). Regenerate `.agent-src/` and `.augment/` via `bash scripts/compress.sh --sync`.

After all fixes:

```bash
python3 scripts/check_references.py
```

Show final result.

### 6. Mark hashes

For each modified file:

```bash
python3 scripts/compress.py --mark-done "{relative_path}"
```

## Rules

- **Always fix in `.agent-src.uncompressed/`** — never edit `.agent-src/` or `.augment/` directly.
- **Run `bash scripts/compress.sh --sync`** after fixing to regenerate `.agent-src/` and `.augment/`.
- **Do NOT commit or push** — the user decides.
- **Do NOT fix references in code blocks** — they are examples, not live refs.
- **Do NOT auto-fix without showing the summary first.**
- **Run the checker again after fixing** to verify 0 remaining issues.
