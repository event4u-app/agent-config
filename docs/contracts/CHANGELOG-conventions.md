---
stability: stable
---

# Changelog Conventions

> **Status:** Active · governs the shape of [`CHANGELOG.md`](../../CHANGELOG.md)
> and the per-era archive files under [`docs/archive/`](../archive/).
> Cited from the CHANGELOG header and enforced by
> `tests/test_changelog_eras.py`.

## Purpose

Locks the entry shape, the breaking-change rules, and the era-split
discipline for `event4u/agent-config`. Auto-generated entries (e.g.
release-please) and hand-written entries follow the same shape so the
file remains uniform across automated and manual releases.

## Entry shape

Each released version is a level-2 heading with a compare link and a
release date:

```md
## [X.Y.Z](https://github.com/event4u-app/agent-config/compare/PREV...X.Y.Z) (YYYY-MM-DD)
```

Inside the version block, group changes under level-3 headings using
the Conventional Commits family the entry came from:

- `### Features` — `feat:` commits.
- `### Bug Fixes` — `fix:` commits.
- `### Chores` — `chore:`, `build:`, `ci:` commits a user might want
  to see (silent infra-only chores stay out).
- `### Docs` — `docs:` commits that change user-facing behaviour or
  surface (otherwise drop them).
- `### BREAKING CHANGES` — see [What counts as breaking](#what-counts-as-breaking).
- `### Reverts` — `revert:` commits, with the SHA of the original commit.

Each bullet is one line, scope-prefixed, with the short SHA linked:

```md
* **scope:** imperative-mood summary ([abc1234](https://github.com/event4u-app/agent-config/commit/abc1234...))
```

Optional trailers — a free-form paragraph for the release narrative
(only for non-trivial releases), followed by a single-line test count
delta:

```md
Tests: NNNN (+M since X.Y.(Z-1))
```

The test-count line is enforced for any release that ships changes to
`scripts/`, `workers/`, or `.agent-src/` content; it can be omitted for
pure-docs releases.

## What counts as breaking

A change is **breaking** (and MUST appear under `### BREAKING CHANGES`
**and** bump the major version) when it changes:

1. **Public CLI surface** — `agent-config <cmd>` flags / subcommands at
   Tier-0 or Tier-1 (Tier-2 is internal per
   [`command-surface-tiers.md`](command-surface-tiers.md) and may shift
   without a major bump).
2. **Install scopes** — adding / removing a scope (`global`, `project`,
   `mcp_scope: lite|full`) or changing its default discovery path per
   [`ADR-007`](../decisions/ADR-007-agent-discovery-scopes.md).
3. **MCP Worker contracts** — anything that breaks
   [`mcp-cloud-scope.md`](mcp-cloud-scope.md) or
   [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) (tool shape, prompt
   ids, resource URIs).
4. **Generated tree shape** — removing or renaming top-level
   directories under `.agent-src/`, `.augment/`, `.claude/`,
   `.cursor/`, `.clinerules/`, or `.windsurfrules`.
5. **Settings keys** — removing / renaming a key in
   `.agent-settings.yml` that consumer projects may rely on. Adding a
   new key with a default is **not** breaking.
6. **AGENTS.md / kernel rules** — removing or renaming an Iron-Law
   rule, or changing the kernel-membership contract per
   [`kernel-membership.md`](kernel-membership.md).

Internal refactors, doc rewrites, test changes, and any change to
files under `.agent-src.uncompressed/` that round-trip through
`task sync` unchanged are **not** breaking.

## Era splits

`CHANGELOG.md` keeps only the **current era** inline; prior eras live
under [`docs/archive/`](../archive/) and are read-only.

Drift gate — `tests/test_changelog_eras.py` fails when the current
era's body (lines between `# Era: X.Y.x — current` and the next era
header) exceeds **200 lines**. When that happens:

1. Pick the next major or significant minor boundary at the bottom of
   the current era (typically the last `X.Y.0` release).
2. Move every entry at or below that boundary into
   `docs/archive/CHANGELOG-pre-<boundary>.md`, prepending the standard
   archive header.
3. Replace the moved entries in `CHANGELOG.md` with a single collapsed
   `# Era: pre-<boundary> — archived` section that links to the
   archive file.
4. Rename the active era header to `# Era: <new-current>.x — current`.
5. Update the `## [Unreleased]` placeholder unchanged.

Each era split lands as its own `chore(changelog): split era X.Y.x →
pre-X.Y.x` commit — never bundled with a feature release.

## Cross-references

- [`../../CHANGELOG.md`](../../CHANGELOG.md) — active era + Unreleased.
- [`../archive/CHANGELOG-pre-2.2.0.md`](../archive/CHANGELOG-pre-2.2.0.md) —
  frozen pre-2.2.0 entries.
- [`command-surface-tiers.md`](command-surface-tiers.md) — Tier-0/1/2
  split that governs CLI-surface breaking-change classification.
- [`mcp-cloud-scope.md`](mcp-cloud-scope.md) ·
  [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) — MCP contract bounds.
- [`../decisions/ADR-007-agent-discovery-scopes.md`](../decisions/ADR-007-agent-discovery-scopes.md) —
  install scope discovery.
