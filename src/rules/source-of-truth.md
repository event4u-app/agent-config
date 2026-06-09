---
type: "auto"
tier: "1"
description: "Editing files in dist/agent-src/, .augment/, .claude/, or .cursor/ — source of truth is src/; never edit a generated projection directly"
load_context:
  - contexts/communication/rules-auto/source-of-truth-mechanics.md
triggers:
  - path_prefix: "dist/agent-src/"
  - path_prefix: ".augment/"
  - path_prefix: ".claude/"
  - path_prefix: ".cursor/"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Source of Truth

`src/` is the **single source of truth** — `src/skills/`, `src/rules/`,
`src/agent-src/` (profiles, user-types, commands, contexts, personas, packs),
`src/domains/<pack>/`, `src/scripts/`. Everything else is a **generated
projection of `src/`** — equal, derived, never authoritative:

- `dist/agent-src/` — the condensed output shipped in the package
- `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`,
  `GEMINI.md` — per-tool projections

**No tool is privileged.** Augment is just another agent — exactly like Claude,
Cursor, Cline, Windsurf, Gemini. `.augment/` is not the source; it is one
projection among equals.

> `.augment/` carries a second, deployment-only role: in a **consumer** project
> the installer writes `dist/agent-src/` → that project's `.augment/` as the
> installed runtime tree. That is a deployment fact, not a source privilege —
> in **this** repo `.augment/` is still a generated projection you never edit.

## The Iron Rule

```
NEVER CREATE OR EDIT FILES IN ANY GENERATED PROJECTION — dist/agent-src/,
.augment/, .claude/, .cursor/, .clinerules/, .windsurfrules, GEMINI.md.
EVERY PROJECTION IS READ-ONLY. NOT EVEN "JUST A SMALL FIX".
ALWAYS WORK IN src/ — THEN CONDENSE VIA THE /condense COMMAND.
```

**There are ZERO exceptions to this rule.** Even if:

- You "know" the projected content is correct
- It's "just adding a missing section"
- It's "faster to edit the projected file directly"
- The fix is "trivially obvious"

**STOP. Edit `src/` first. Always.** A projection is an output, not an input —
editing one is editing build output, and the next `/condense` overwrites it.

Direct edits to `dist/agent-src/` break condensation hashes, cause CI failures
("Verify condensation hashes" step), and create drift between source and output.

**Condensation is ONLY done via the `/condense` command.** The command handles
hashing, sync verification, and quality checks automatically.

## Pre-review consistency checkpoints

Before asking for review or creating a PR, verify derived outputs are not stale:

1. Run `bash src/scripts/condense.sh --changed` — check if `src/` has changes not yet condensed
2. If stale files exist: run `/condense` before pushing
3. Before merge: verify derived outputs (`dist/agent-src/`, `.augment/`, `.claude/skills/`) are regenerated
4. Do NOT leave `dist/agent-src/` stale across review cycles

## Mechanics — workflow, condensation rules, commands, symlinks, quick reference

The authoring workflow, what condensation does (and never touches), the
commands workflow with required frontmatter, the multi-agent symlink
mapping, and the per-task quick-reference table live in
[`contexts/communication/rules-auto/source-of-truth-mechanics.md`](../contexts/communication/rules-auto/source-of-truth-mechanics.md).
Pull it whenever an edit, new file, new command, or sync question
fires — the rule above is the obligation surface; the mechanics file
is the lookup material.
