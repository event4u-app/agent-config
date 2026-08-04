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

Project agent config `.md` files from `src/` into `dist/agent-src/` — verbatim
copy with the path rewriter applied (ADR-201; the LLM prose rewrite is removed).

The projection is deterministic: `dist == rewrite(src)` byte-for-byte. A file is
out of date only when its projection does not match that rewrite.

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

This lists only `.md` files whose projection is out of date (`dist != rewrite(src)`).
If no files are listed → you're done.

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

Must show ✅ (`dist/agent-src/` in sync with source).

```bash
./scripts-run src/scripts/check_condensation
```

Must show **zero 🔴 errors**. Warnings (🟡) are acceptable.
If any 🔴 errors remain: go back and fix those files before finishing.

## Step 5: Summary (verbosity-gated)

Read `verbosity.post_action_reports` from `.agent-settings.yml` (default
`minimal`).

- `off` → emit nothing on success; surface errors only.
- `minimal` (default) → one line: `→ N files synced`.
- `full` → multi-line table with per-category stats (files synced,
  stale files reaped).

## Iron Laws — preserved by construction

Sections under headings matching `Iron Law`, `Iron Laws`, or `The Iron Law` (any
heading level, numbered variants like `Iron Law 1` included) are **load-bearing
behavioral rules**. Post-ADR-201 the projection is a verbatim copy, so headings,
fenced blocks, and negation clauses survive by construction — there is no manual
preservation step for the agent to perform.

`scripts/check_condensation.ts` enforces this mechanically — since ADR-201 it
asserts `dist == rewrite(src)` byte-for-byte; `iron_law_missing`,
`iron_law_passage_dropped`, and `iron_law_heading_downgrade` remain `error`-level
diagnostics that name what differs when the bytes do.

If an Iron Law section genuinely contains filler (rare): edit the SOURCE in
`src/`, not the projected copy. Source is the truth. Authoring-time transforms
(merges, splits, refactors) remain governed by
[preservation-guard](../rules/preservation-guard.md).

## Rules

- **Do NOT commit or push.** Only write files.
- **Do NOT modify `src/`** — it is the source of truth.
- **Only write to `dist/agent-src/`** (via `condense.sh` / the script) — never
  hand-edit any projection.
