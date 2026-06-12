---
adr: 089
status: accepted
date: 2026-06-12
decision: lean-local-plugin-install
supersedes: —
superseded_by: —
phase: plugin-distribution-hygiene
type: structural
---

# ADR-089 — Lean local plugin installs via git-worktree source; marketplace restructure rejected

## Status

**Accepted** · 2026-06-12.

## Context

The Claude Code plugin `agent-config@event4u-agent-config`
([`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json))
declares `source: "./"` — the repo root is the plugin root. Two channels
consume it:

- **GitHub (official, documented):** Claude Code `git clone`s the repo →
  committed files only → lean (`git archive HEAD` ≈ 27 MB).
- **Local path** (`claude plugin marketplace add <repo>`): Claude Code
  **raw-copies the entire `source` dir verbatim** — neither `.gitignore`
  nor `.claudeignore` is honored (verified empirically, 2026-06-12) — so
  untracked dev trees (`.venv`, `.venv-mcp`, `node_modules`,
  `internal/bench/ab/clones`) come along: **~1.5 GB per snapshot**,
  regrown on every `claude plugin update`.

Additionally, whenever the plugin source contains a `package.json`,
Claude Code runs a full `npm install` (devDependencies included) into the
cache during install — ~180 MB of `@babel`/`@eslint`/`@esbuild` the plugin
never uses at runtime (hooks delegate to the global binary; skills are
markdown). This is unavoidable on any source that carries the package
manifest.

A failed/never-registered local-path install on this machine left a
1.1 GB orphan under `~/.claude/plugins/cache/event4u-agent-config/` that
surfaced a stale, pre-rename `commit-in-chunks` skill alongside the
current `git-commit-in-chunks`. Cleaning it + registering the plugin
properly exposed the bloat as a local-path-channel artifact.

The forcing question: can the local-path channel be made lean so a
maintainer can dogfood plugin changes without a 1.5 GB snapshot?

## Decision

**Keep `source: "./"`. Do not restructure the marketplace source.** For
lean local installs, point the marketplace at a **dedicated git worktree**
of the repo instead of the live working tree:

- `git worktree add <path> <ref>` → a checkout of committed files only
  (~27 MB), with the 146 symlinked command-skills resolving because the
  full tracked tree is present.
- `claude plugin marketplace add <worktree-path>` → Claude Code copies
  only the ~45 MB worktree (tracked files; no `.venv`/`internal` clones),
  then `npm install`s the manifest deps → **~224 MB total** (vs 1.5 GB).
- Test local plugin edits: commit on the worktree's branch +
  `claude plugin update` (snapshots key on commit SHA, so a commit is
  required either way; no push needed).

This is operational, not a contract change — `source`, the skill-path
shape, the two marketplace linters, and the GitHub channel are all
untouched.

## Consequences

- Local install drops 1.5 GB → ~224 MB (−85 %) **and** keeps local-change
  testing, with zero risk to the consumer-facing marketplace contract or
  the GitHub channel. The residual ~180 MB is Claude Code's auto
  `npm install`; eliminating it would require a `package.json`-free
  assembled source — i.e. the rejected restructure below.
- Maintainer keeps one extra worktree dir; to test a branch's plugin,
  `git -C <worktree> checkout <branch>` + `claude plugin update`.
- No content duplication, no generator/linter churn, no stale generated
  tree to drift.
- The 1.5 GB cost is simply avoided by never installing from the live
  working tree.

## Alternatives

- **Restructure `source` to a self-contained lean plugin root**
  (e.g. `source: ".claude-plugin"` or an assembled `dist/plugin/`) —
  **rejected.** The 373 plugin skills are layout-spread: 227 are real
  files under `dist/agent-src/skills/`, and 146 under
  `.claude-plugin/skills/` are **symlinks pointing out of the dir**
  (`../../../src/domains/…`, `dist/agent-src/commands/`). A lean source
  would dangle all 146 symlinks and drop the 227. Making it work needs a
  new assembly step that materializes all 373 skills as real files into a
  committed plugin dir — generator rewrite, committed content
  duplication, both marketplace linters, both-channel re-verification —
  for a **disk-only** benefit (the GitHub channel is already 27 MB).
  Cost/risk far exceeds the gain.
- **`.claudeignore` allowlist** — rejected: not honored for local-path
  copies (verified).
- **GitHub-source-only install** — rejected as the primary dev loop:
  lean, but cannot test local commits without pushing to the shared
  remote first.
- **Leave the live-working-tree local install** — rejected: 1.5 GB per
  snapshot, regrown every update.

## References

- [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json) — `source: "./"` unchanged by this decision.
- [`docs/contracts/skill-distribution-channels.md`](../contracts/skill-distribution-channels.md) — git-consumed marketplace channel.
- [`src/scripts/condense.py`](../../src/scripts/condense.py) — `generate_plugin_hooks`; skill projection into `.claude-plugin/skills/` (the symlinks).
- ADR-085 (MCP stdio distribution shape), ADR-088 (no external runtime federation) — sibling distribution-shape decisions.
