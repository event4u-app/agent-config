---
name: check-current-md
description: Check the currently open .md file (or a path you pass) for German content outside DE:/EN: anchor blocks — umlauts, German function words, untranslated quoted phrases. Reports findings and offers fixes.
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Package-internal — only the event4u/agent-config repo runs this."
---

# check-current-md

Manual runner for [`md-language-check`](../skills/md-language-check/SKILL.md).
Use to spot-check an `.md` file the agent did not just edit, or to audit
before opening a PR.

## Instructions

### 1. Resolve target paths

User passed paths → use those. Else default to the file currently open
in the editor (per `personal.ide` open-file context). No file open and
no path passed:

```
> ❌  No target file. Pass a path: /check-current-md path/to/file.md
```

Stop.

### 2. Run the checker

```bash
python3 scripts/check_md_language.py <path> [<path> …] --format json
```

Exit codes: `0` clean, `1` violations (continue to step 3), `3`
internal error (surface stderr, stop).

### 3. Display findings

```
═══════════════════════════════════════════════
  📒 .md LANGUAGE CHECK
═══════════════════════════════════════════════

  Found: {count} violation(s) across {files} file(s)
```

Per violation:

```
  {file}:{line} — kind: {umlaut|de_word} — match: `{matched_text}`
    │ {context_line}
```

Group by file when multiple files are scanned.

### 4. Classify and propose fixes

| Cause | Proposed fix |
|---|---|
| German sentence in body prose | Translate to English |
| Quoted German token used as example | Move into a labeled `DE: … · EN: …` block |
| Meta-doc that documents trigger words | Append `<!-- md-language-check: ignore -->` to the line |
| Intentionally bilingual but unlabeled | Reformat as labeled anchor block |

Summary:

```
  Proposed fixes:
  1. {file}:{line} — {strategy}
  2. {file}:{line} — {strategy}

> 1. Apply all fixes
> 2. Apply interactively
> 3. Skip — report only
```

Recommendation: **2 — Apply interactively** when ≥3 findings,
**1 — Apply all fixes** for ≤2 findings or all-translation diffs.

### 5. Apply fixes

Edit only the source-of-truth file:

- `.agent-src.uncompressed/` → edit directly
- `.agent-src/` → edit the matching `.agent-src.uncompressed/` file,
  then `bash scripts/compress.sh --sync`
- `.augment/` → same as `.agent-src/` (it's a projection)
- `agents/` → edit directly (no compression layer)

Re-run after fixes:

```bash
python3 scripts/check_md_language.py <path> [<path> …]
```

### 6. Mark hashes (only if `.agent-src.uncompressed/` was edited)

```bash
python3 scripts/compress.py --mark-done "{relative_path}"
```

Keeps `.compression-hashes.json` consistent.

## Rules

- **Never edit `.augment/` directly** — it's a generated projection
  ([`augment-source-of-truth`](../rules/augment-source-of-truth.md))
- **Per-line ignore marker** is reserved for meta-documentation that
  must quote German tokens; not a generic mute
- **Frontmatter is exempt** — checker skips it; don't try to "fix" it
- **Do NOT commit or push** — leave the working tree to the user

## When NOT to use

- Project content outside `.agent-src*/`, `.augment/`, or `agents/`
  follows a different language policy
- During autonomous edits the [`md-language-check`](../skills/md-language-check/SKILL.md)
  skill already gates saves; this command is for **manual** spot-checks

## See also

- [`md-language-check`](../skills/md-language-check/SKILL.md) — the gate skill this command wraps
- [`language-and-tone`](../rules/language-and-tone.md) — the rule that defines the policy
- [`augment-source-of-truth`](../rules/augment-source-of-truth.md) — where to apply fixes
