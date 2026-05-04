---
type: "auto"
description: "Creating, editing, or modifying files inside .agent-src/ or .augment/ — the source of truth is .agent-src.uncompressed/, never edit the generated directories directly"
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/augment-source-of-truth-mechanics.md
---

# Source of Truth

`.agent-src.uncompressed/` is the **single source of truth**. The compressed
output ships as `.agent-src/`. In the package repo, `.augment/` is a local
projection of `.agent-src/` for Augment Code (rules copied, rest symlinked).
Consumer projects still see `.augment/` as the installed runtime tree.

Never edit any of these generated layers directly:

- `.agent-src/` — compressed output shipped in the package
- `.augment/` — local projection (gitignored in the package repo; installer
  output in consumer projects)
- `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` — tool projections

## The Iron Rule

```
NEVER create or edit files in .agent-src/ or .augment/ directly — not even "just a small fix".
ALWAYS work in .agent-src.uncompressed/ — then compress via /compress command.
```

**There are ZERO exceptions to this rule.** Even if:

- You "know" the compressed content is correct
- It's "just adding a missing section"
- It's "faster to edit the compressed file directly"
- The fix is "trivially obvious"

**STOP. Edit `.agent-src.uncompressed/` first. Always.**

Direct edits to `.agent-src/` break compression hashes, cause CI failures
("Verify compression hashes" step), and create drift between source and output.

**Compression is ONLY done via the `/compress` command.** The command handles
hashing, sync verification, and quality checks automatically.

## Pre-review consistency checkpoints

Before asking for review or creating a PR, verify derived outputs are not stale:

1. Run `bash scripts/compress.sh --changed` — check if `.agent-src.uncompressed/` has changes not yet compressed
2. If stale files exist: run `/compress` before pushing
3. Before merge: verify derived outputs (`.agent-src/`, `.augment/`, `.claude/skills/`) are regenerated
4. Do NOT leave `.agent-src/` stale across review cycles

## Mechanics — workflow, compression rules, commands, symlinks, quick reference

The authoring workflow, what compression does (and never touches), the
commands workflow with required frontmatter, the multi-agent symlink
mapping, and the per-task quick-reference table live in
[`contexts/communication/rules-auto/augment-source-of-truth-mechanics.md`](../contexts/communication/rules-auto/augment-source-of-truth-mechanics.md).
Pull it whenever an edit, new file, new command, or sync question
fires — the rule above is the obligation surface; the mechanics file
is the lookup material.
