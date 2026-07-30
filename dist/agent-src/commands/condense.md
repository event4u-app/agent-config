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

## Step 3: nothing to condense — the projection is a deterministic copy

**ADR-201 (accepted 2026-07-29) removed the LLM prose rewrite from this command.**
`.md` is copied verbatim and path-rewritten by `condense.sh --sync`; there is no
per-file condensation step for the agent to perform any more.

Why it was removed, measured with exact `tiktoken cl100k_base` over 429 artefacts:
0 of them saved >= 500 tok, the aggregate saving was 0.86%, 267/429 pairs were
byte-identical, and the 9 always-loaded kernel rules came out **36 tokens worse**.
Determinism failed by construction — the hash covered the source and never the
output, so divergence was undetectable, and it went undetected three times in a
single session.

The instruction that used to live here already demanded *"copy EVERY code block
from source to output FIRST, unchanged, byte-for-byte"*. It was clear, and it was
broken anyway in six artefacts — corrupting template blocks users copy verbatim —
because nothing checked it. That is the case for removing the rewrite rather than
restating the rule more firmly.

What survives is the one deterministic transform: `apply_path_rewriter` fixes
relative links so they resolve from the delivered location (`../../docs/…` →
`../docs/…`, ~38 artefacts). It runs automatically on every copy.

**If you were sent here to condense a file: don't.** Edit `src/`, run
`--sync`, and let Step 4 verify that `dist == rewrite(src)` byte-for-byte.

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

`scripts/check_condensation.ts` enforces these mechanically — `iron_law_missing`,
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
