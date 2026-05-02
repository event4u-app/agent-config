---
name: check-current-md
description: Check the open .md file (or a passed path) for German outside DE:/EN: anchor blocks — umlauts, function words, untranslated quotes. Reports and offers fixes.
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Package-internal — only the event4u/agent-config repo runs this."
---

# check-current-md

Manual runner for the [`md-language-check`](../skills/md-language-check/SKILL.md)
skill. Use to spot-check an `.md` file the agent did not just edit, or to
audit a file before opening a PR.

## Instructions

### 1. Resolve target paths

If the user passed one or more paths, use those. Otherwise, default to
the file currently open in the editor (per `personal.ide` open-file
context). If no file is open and no path was passed:

```
> ❌  No target file. Pass a path: /check-current-md path/to/file.md
```

Stop here.

### 2. Run the checker

```bash
python3 scripts/check_md_language.py <path> [<path> …] --format json
```

Exit codes:

- `0` → no findings; report and stop
- `1` → findings present; continue to step 3
- `3` → internal error; surface stderr and stop

### 3. Display findings

```
═══════════════════════════════════════════════
  📒 .md LANGUAGE CHECK
═══════════════════════════════════════════════

  Found: {count} violation(s) across {files} file(s)
```

For each violation:

```
  {file}:{line} — kind: {umlaut|de_word} — match: `{matched_text}`
    │ {context_line}
```

Group by file when multiple files are scanned.

### 4. Classify and propose fixes

For each violation, propose one of:

| Cause | Proposed fix |
|---|---|
| German sentence in body prose | Translate the line to English |
| Quoted German token used as example | Move into a labeled `DE: … · EN: …` block |
| Meta-documentation that documents trigger words | Append `<!-- md-language-check: ignore -->` to the line |
| Line is intentionally bilingual but unlabeled | Reformat as labeled anchor block |

Present a summary:

```
  Proposed fixes:
  1. {file}:{line} — {strategy}
  2. {file}:{line} — {strategy}

> 1. Apply all fixes
> 2. Apply interactively
> 3. Skip — report only
```

Recommendation: **2 — Apply interactively** when ≥3 findings, **1 —
Apply all fixes** for ≤2 findings or when all are pure translations.

### 5. Apply fixes

Edit only the source-of-truth file:

- Path under `.agent-src.uncompressed/` → edit there directly
- Path under `.agent-src/` → edit the matching
  `.agent-src.uncompressed/` file instead, then run
  `bash scripts/compress.sh --sync`
- Path under `.augment/` → same as `.agent-src/` (it's a projection)
- Path under `agents/` → edit directly (no compression layer)

After all fixes, re-run:

```bash
python3 scripts/check_md_language.py <path> [<path> …]
```

### 6. Mark hashes (only if `.agent-src.uncompressed/` was edited)

For each modified source file:

```bash
python3 scripts/compress.py --mark-done "{relative_path}"
```

This keeps `.compression-hashes.json` consistent with the new content.

## Rules

- **Never edit `.augment/` directly** — it's a generated projection.
  Per [`augment-source-of-truth`](../rules/augment-source-of-truth.md),
  the source is `.agent-src.uncompressed/`.
- **Per-line ignore marker is reserved** for meta-documentation that
  must quote German tokens; do NOT use it as a generic mute.
- **Frontmatter is exempt** — the checker skips YAML frontmatter at
  the head of the file; do not try to "fix" frontmatter.
- **Do NOT commit or push** — finishing the check leaves the working
  tree to the user.

## When NOT to use

- Project content outside `.agent-src*/`, `.augment/`, or `agents/`
  follows a different language policy — do not enforce English there.
- During autonomous edits, the [`md-language-check`](../skills/md-language-check/SKILL.md)
  skill already gates saves; this command is for **manual** spot-checks.

## See also

- [`md-language-check`](../skills/md-language-check/SKILL.md) — the gate skill this command wraps
- [`language-and-tone`](../rules/language-and-tone.md) — the rule that defines the policy
- [`augment-source-of-truth`](../rules/augment-source-of-truth.md) — where to apply fixes
