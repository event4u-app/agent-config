---
model_tier: medium
name: condense
pack: meta
intent: "Condense src/ sources into the shipped dist/agent-src trees"
routes_to: [skill-management]
replaces: []
tier: 1
visibility: advanced
skills: []
description: Condense .md files from src/ into telegraph format and write to dist/agent-src/
suggestion:
  eligible: false
  rationale: "Package-internal tooling; only the event4u/agent-config repo runs this."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# condense

Condense agent config `.md` files from `src/` into token-efficient telegraph format
and write the condensed output to `dist/agent-src/`.

Uses SHA-256 hashes to track which source files changed since last condensation.
Only changed files need recondensation — saving tokens and time.

## Step 1: Sync non-.md files

```bash
bash scripts/condense.sh --sync
```

This copies non-`.md` files (`.php`, etc.), deletes stale files, and shows the count of
changed `.md` files that need condensation.

## Step 2: Get changed files

```bash
bash scripts/condense.sh --changed
```

This lists only `.md` files whose source has changed since the last condensation (based on
stored SHA-256 hashes). If no files changed → you're done.

If you need to see ALL files regardless of change status:
`bash scripts/condense.sh --list`.

## Step 3: Condense each changed .md file

**Core principle:** Condensation must improve execution quality, not just reduce length.
A condensed file should be easier to scan, easier to trigger, and easier to execute than the original.

For each changed `.md` file:

1. Read the source from `src/{path}`
2. Condense the prose using these rules:
   - **Remove:** articles (a, an, the), filler (just, really, basically, actually, simply, essentially),
     pleasantries, hedging, connective fluff (however, furthermore, additionally),
     redundant wording, obvious framework knowledge, repeated explanations, decorative prose
   - **Shorten:** "in order to" → "to", "make sure to" → "ensure", use short synonyms
   - **Abbreviate** common terms when context is unambiguous: `DB`, `auth`,
     `config`, `req`, `res`, `fn`, `impl`, `env`, `deps`, `ctx`. Skip if it
     would be the first occurrence of the concept in the file, or if the
     abbreviation collides with a domain term (e.g. `auth` stays
     `authentication` inside an auth-module file). Never abbreviate inside
     code blocks, frontmatter, file paths, command strings, or Iron Law
     fenced blocks.
   - **Arrows for causality:** `X causes Y` / `X leads to Y` / `X, then Y`
     → `X → Y`. Keep arrows out of code blocks, frontmatter, and Iron Law
     fenced blocks; only the surrounding prose uses them. (The example
     phrases here are intentionally backticked so the inline-code
     protection skips them — never strip those backticks.)
   - **Fragments OK:** "Run tests before commit" not "You should always run tests before committing"
   - **Drop:** "you should", "make sure to", "remember to" — state action directly
   - **Merge** redundant bullets that say the same thing differently
   - **Prefer** bullets over prose, direct instructions over explanatory paragraphs, one-line decisions over paragraphs
3. **Copy-paste first, condense second:**
   Before condensing ANY prose, extract and set aside these elements from the source.
   They go into the condensed output **unchanged, byte-for-byte**:
   - **All code blocks** (``` fenced or indented) — copy EVERY code block from source to output FIRST
   - **YAML frontmatter** — copy verbatim
   - **All inline code** (`backtick content`)
   - **All URLs, links, file paths, commands**
   - **All H1/H2 headings** — exact text preserved
   - **Tables** (structure preserved, condense cell text only)
   - **Technical terms, library names, API names**
   - **Dates, version numbers, numeric values**
   Then condense ONLY the prose around these preserved elements.
4. **NEVER remove (even if verbose):**
   - Trigger clarity (When to use / description)
   - Decision hints that prevent mistakes
   - Concrete validation checks
   - Gotchas based on real failure patterns
   - Anti-patterns that prevent recurring failures
   - **Iron Law sections** — see "Iron Laws — do not touch" below
5. **Enrich (SKILL.md files only):** During condensation, also improve agent-effectiveness:
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
   - **Do NOT condense weak skills.** If the source has no procedure or no validation, fix structure first.
   - **Reference skill:** See [skill-writing](../skills/skill-writing/SKILL.md) for the gold standard
6. Write the condensed output to `dist/agent-src/{path}`
7. **MANDATORY: Run condensation quality check on this file:**

```bash
./scripts-run src/scripts/check_condensation --format text 2>&1 | grep "{path}"
```

If the output contains 🔴 (error) for this file: **STOP. Fix the condensed file before continuing.**
Common errors and how to fix them:
- `lost_code_blocks` → You dropped a code block. Copy ALL code blocks from source.
- `modified_code_block` → Code block content changed. Replace with exact source content.
- `frontmatter_mismatch` → YAML frontmatter differs. Copy verbatim from source.

**Do NOT call `mark-done` until this file has zero 🔴 errors.**

8. Show word count: `{original} → {condensed} words ({saved}% saved)`
9. **Mark as done:** `bash scripts/condense.sh --mark-done {path}`

### Batch processing

When condensing multiple files, process them in batches of ~10.
Mark each file done after writing it. After each batch, show a progress summary:

```
Batch 1/5 complete: 10 files, avg 42% saved
```

## Step 4: Final verification gate

Run BOTH checks. Both must pass before finishing.

```bash
bash scripts/condense.sh --check
```

Must show ✅ (hashes in sync).

```bash
./scripts-run src/scripts/check_condensation
```

Must show **zero 🔴 errors**. Warnings (🟡) are acceptable.
If any 🔴 errors remain: go back and fix those files before finishing.

## Step 5: Summary (verbosity-gated)

Read `verbosity.post_action_reports` from `.agent-settings.yml` (default
`minimal`).

- `off` → emit nothing on success; surface errors only.
- `minimal` (default) → one line: `→ N files condensed (avg X% savings)`.
- `full` → multi-line table with per-category stats (files condensed,
  avg savings).

## Hash management

- Hashes are stored in `.augment/.condensation-hashes.json` (committed to Git).
- `bash scripts/condense.sh --sync` automatically cleans up hashes for deleted source files.
- `bash scripts/condense.sh --mark-all-done` marks ALL current `.md` files as condensed
  (useful after an initial full condensation or when bootstrapping the hash file).
- A file with no stored hash is always treated as "changed".

## Iron Laws — do not touch

Sections under headings matching `Iron Law`, `Iron Laws`, or `The Iron Law` (any
heading level, numbered variants like `Iron Law 1` included) are **load-bearing
behavioral rules**. Condensation rules above do **not** apply to them.

For every Iron Law section in a source file:

- **Copy the heading verbatim**, exact text, exact `#` level. NEVER downgrade
  `## Iron Law` to `### Iron Law` or to inline `**Iron Law:**`.
- **Copy the fenced code block byte-for-byte**, including capitalization, line
  breaks, and trailing punctuation.
- **Copy the negation clauses verbatim** — `NO X`, `NEVER Y`, `NOT Z`. These
  are the law's exception denials; stripping them weakens the rule.
- **Telegraph the prose, keep every passage** — every paragraph, every list
  item, and every fenced code block from the source must appear in the
  condensed output, in order. Drop articles, shorten phrasing, primitive
  grammar, terse cave-speak — all encouraged. What's forbidden is dropping
  whole sentences, merging two paragraphs into one, or skipping a bullet.
  One paragraph → one paragraph; one bullet → one bullet.
- **No word-count budget** — condense the prose as hard as telegraph style
  allows. The check is structural (passage count), not quantitative.

`scripts/check_condensation.py` enforces these mechanically — `iron_law_missing`,
`iron_law_passage_dropped`, and `iron_law_heading_downgrade` are `error`-level
and block CI.

If an Iron Law section genuinely contains filler (rare): edit the SOURCE in
`src/`, not the condensed copy. Source is the truth.

## Condensation quality checklist

**Also apply the [preservation-guard](../rules/preservation-guard.md) rule** — strongest validation, example, anti-pattern, and decision hints must survive condensation. Iron Laws are non-negotiable.

See also: [markdown-safe-codeblocks](../rules/markdown-safe-codeblocks.md) for fenced-block hygiene.

After condensing each file, verify:

- [ ] All code blocks preserved exactly (no content changes)
- [ ] All inline code, URLs, file paths unchanged
- [ ] YAML frontmatter identical to source
- [ ] Headings match source exactly
- [ ] Tables structure preserved (cell text may be shortened)
- [ ] "NEVER", "MUST", "Do NOT" and other strong language preserved
- [ ] Technical terms, library names, API names unchanged
- [ ] No meaning lost — condensed version says the same thing, shorter
- [ ] No sections accidentally removed
- [ ] Word count reduction is 20-50% (typical range for prose-heavy files)

### Safe vs unsafe condensation

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
- **Do NOT modify `src/`** — it is the source of truth.
- **Only write to `.augment/`** — the condensed output directory.
- **Preserve ALL technical content** — only condense natural language prose.
- **YAML frontmatter** in command/skill files must be preserved exactly.
- **Always run `bash scripts/condense.sh --mark-done {path}`** after writing each condensed file.
