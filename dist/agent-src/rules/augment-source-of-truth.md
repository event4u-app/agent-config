---
type: "auto"
tier: "1"
description: "Editing files in dist/agent-src/ or .augment/ — source of truth is .agent-src.uncondensed/; never edit generated dirs directly"
load_context:
  - ../contexts/communication/rules-auto/augment-source-of-truth-mechanics.md
triggers:
  - path_prefix: "dist/agent-src/"
  - path_prefix: ".augment/"
  - path_prefix: ".claude/"
  - path_prefix: ".cursor/"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule documents the source-of-truth boundary; mentioning the path is its purpose."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Source of Truth

`.agent-src.uncondensed/` is the **single source of truth**. The condensed
output ships as `dist/agent-src/`. In the package repo, `.augment/` is a local
projection of `dist/agent-src/` for Augment Code (rules copied, rest symlinked).
Consumer projects still see `.augment/` as the installed runtime tree.

Never edit any of these generated layers directly:

- `dist/agent-src/` — condensed output shipped in the package
- `.augment/` — local projection (gitignored in the package repo; installer
  output in consumer projects)
- `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` — tool projections

## The Iron Rule

```
NEVER CREATE OR EDIT FILES IN dist/agent-src/ OR .augment/ DIRECTLY — NOT EVEN "JUST A SMALL FIX".
ALWAYS WORK IN .agent-src.uncondensed/ — THEN CONDENSE VIA THE /condense COMMAND.
```

**There are ZERO exceptions to this rule.** Even if:

- You "know" the condensed content is correct
- It's "just adding a missing section"
- It's "faster to edit the condensed file directly"
- The fix is "trivially obvious"

**STOP. Edit `.agent-src.uncondensed/` first. Always.**

Direct edits to `dist/agent-src/` break condensation hashes, cause CI failures
("Verify condensation hashes" step), and create drift between source and output.

**Condensation is ONLY done via the `/condense` command.** The command handles
hashing, sync verification, and quality checks automatically.

## Pre-review consistency checkpoints

Before asking for review or creating a PR, verify derived outputs are not stale:

1. Run `bash scripts/condense.sh --changed` — check if `.agent-src.uncondensed/` has changes not yet condensed
2. If stale files exist: run `/condense` before pushing
3. Before merge: verify derived outputs (`dist/agent-src/`, `.augment/`, `.claude/skills/`) are regenerated
4. Do NOT leave `dist/agent-src/` stale across review cycles

## Mechanics — workflow, condensation rules, commands, symlinks, quick reference

The authoring workflow, what condensation does (and never touches), the
commands workflow with required frontmatter, the multi-agent symlink
mapping, and the per-task quick-reference table live in
[`contexts/communication/rules-auto/augment-source-of-truth-mechanics.md`](../contexts/communication/rules-auto/augment-source-of-truth-mechanics.md).
Pull it whenever an edit, new file, new command, or sync question
fires — the rule above is the obligation surface; the mechanics file
is the lookup material.
