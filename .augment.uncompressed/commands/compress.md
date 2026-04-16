---
name: compress
skills: []
description: Compress .md files from .augment.uncompressed/ into caveman format and write to .augment/
disable-model-invocation: true
---

# compress

Compress agent config `.md` files from `.augment.uncompressed/` into token-efficient caveman format
and write the compressed output to `.augment/`.

Uses SHA-256 hashes to track which source files changed since last compression.
Only changed files need recompression — saving tokens and time.

## Step 1: Sync non-.md files

```bash
task sync
```

This copies non-`.md` files (`.php`, etc.), deletes stale files, and shows the count of
changed `.md` files that need compression.

## Step 2: Get changed files

```bash
task sync-changed
```

This lists only `.md` files whose source has changed since the last compression (based on
stored SHA-256 hashes). If no files changed → you're done.

If you need to see ALL files regardless of change status: `task sync-list`.

## Step 3: Compress each changed .md file

**Core principle:** Compression must improve execution quality, not just reduce length.
A compressed file should be easier to scan, easier to trigger, and easier to execute than the original.

For each changed `.md` file:

1. Read the source from `.augment.uncompressed/{path}`
2. Compress the prose using these rules:
   - **Remove:** articles (a, an, the), filler (just, really, basically, actually, simply, essentially),
     pleasantries, hedging, connective fluff (however, furthermore, additionally),
     redundant wording, obvious framework knowledge, repeated explanations, decorative prose
   - **Shorten:** "in order to" → "to", "make sure to" → "ensure", use short synonyms
   - **Fragments OK:** "Run tests before commit" not "You should always run tests before committing"
   - **Drop:** "you should", "make sure to", "remember to" — state action directly
   - **Merge** redundant bullets that say the same thing differently
   - **Prefer** bullets over prose, direct instructions over explanatory paragraphs, one-line decisions over paragraphs
3. **Copy-paste first, compress second:**
   Before compressing ANY prose, extract and set aside these elements from the source.
   They go into the compressed output **unchanged, byte-for-byte**:
   - **All code blocks** (``` fenced or indented) — copy EVERY code block from source to output FIRST
   - **YAML frontmatter** — copy verbatim
   - **All inline code** (`backtick content`)
   - **All URLs, links, file paths, commands**
   - **All H1/H2 headings** — exact text preserved
   - **Tables** (structure preserved, compress cell text only)
   - **Technical terms, library names, API names**
   - **Dates, version numbers, numeric values**
   Then compress ONLY the prose around these preserved elements.
4. **NEVER remove (even if verbose):**
   - Trigger clarity (When to use / description)
   - Decision hints that prevent mistakes
   - Concrete validation checks
   - Gotchas based on real failure patterns
   - Anti-patterns that prevent recurring failures
5. **Enrich (SKILL.md files only):** During compression, also improve agent-effectiveness:
   - **Validation steps:** If a Procedure ends with a vague validation ("check if it works"),
     replace with concrete checks (expected output, commands to verify, specific conditions)
   - **Mini examples:** If no `Examples` section exists, add a short safe/unsafe or good/bad example
     (2-4 lines max — not a tutorial)
   - **Output format:** If the Output format section is vague ("explain everything"), sharpen it to
     specific numbered expectations ("1. Code snippet 2. Where to register 3. Gotcha if relevant")
   - **Anti-patterns:** If the same mistake keeps recurring, add a short anti-patterns section
   - **Do NOT invent content.** Only concretize what the source implies. If the source says
     "validate copy/paste safety", you can add "Check: no nested backticks, fully selectable".
     But don't add unrelated sections.
   - **Do NOT compress weak skills.** If the source has no procedure or no validation, fix structure first.
   - **Reference skill:** See `.augment.uncompressed/skills/skill-writing/SKILL.md` for the gold standard
6. Write the compressed output to `.augment/{path}`
7. **MANDATORY: Run compression quality check on this file:**

```bash
python3 scripts/check_compression.py --format text 2>&1 | grep "{path}"
```

If the output contains 🔴 (error) for this file: **STOP. Fix the compressed file before continuing.**
Common errors and how to fix them:
- `lost_code_blocks` → You dropped a code block. Copy ALL code blocks from source.
- `modified_code_block` → Code block content changed. Replace with exact source content.
- `frontmatter_mismatch` → YAML frontmatter differs. Copy verbatim from source.

**Do NOT call `mark-done` until this file has zero 🔴 errors.**

8. Show word count: `{original} → {compressed} words ({saved}% saved)`
9. **Mark as done:** `task sync-mark-done -- {path}`

### Batch processing

When compressing multiple files, process them in batches of ~10.
Mark each file done after writing it. After each batch, show a progress summary:

```
Batch 1/5 complete: 10 files, avg 42% saved
```

## Step 4: Final verification gate

Run BOTH checks. Both must pass before finishing.

```bash
task sync-check
```

Must show ✅ (hashes in sync).

```bash
python3 scripts/check_compression.py
```

Must show **zero 🔴 errors**. Warnings (🟡) are acceptable.
If any 🔴 errors remain: go back and fix those files before finishing.

## Step 5: Summary

Show a summary table with per-category stats (files compressed, avg savings).

## Hash management

- Hashes are stored in `.augment/.compression-hashes.json` (committed to Git).
- `task sync` automatically cleans up hashes for deleted source files.
- `task sync-mark-all-done` marks ALL current `.md` files as compressed (useful after an
  initial full compression or when bootstrapping the hash file).
- A file with no stored hash is always treated as "changed".

## Compression quality checklist

**Also apply the `preservation-guard` rule** — strongest validation, example, anti-pattern, and decision hints must survive compression.

After compressing each file, verify:

- [ ] All code blocks preserved exactly (no content changes)
- [ ] All inline code, URLs, file paths unchanged
- [ ] YAML frontmatter identical to source
- [ ] Headings match source exactly
- [ ] Tables structure preserved (cell text may be shortened)
- [ ] "NEVER", "MUST", "Do NOT" and other strong language preserved
- [ ] Technical terms, library names, API names unchanged
- [ ] No meaning lost — compressed version says the same thing, shorter
- [ ] No sections accidentally removed
- [ ] Word count reduction is 20-50% (typical range for prose-heavy files)

### Safe vs unsafe compression

Safe:
- "You should always make sure to run the tests before committing" → "Run tests before commit"
- "In order to ensure that the configuration is correct" → "To verify config"
- "It is important to note that this feature requires" → "Requires"

Unsafe (DO NOT do this):
- Removing a bullet point that contains unique information
- Changing `php artisan test --filter=MyTest` to `php artisan test`
- Shortening "Do NOT use float for money" to "Avoid float"
- Removing "NEVER" from "NEVER add to phpstan-baseline.neon"

## Rules

- **Do NOT commit or push.** Only write files.
- **Do NOT modify `.augment.uncompressed/`** — it is the source of truth.
- **Only write to `.augment/`** — the compressed output directory.
- **Preserve ALL technical content** — only compress natural language prose.
- **YAML frontmatter** in command/skill files must be preserved exactly.
- **Always run `task sync-mark-done`** after writing each compressed file.
