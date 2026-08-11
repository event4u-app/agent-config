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

Inside the version block, the **curated head comes first** — before any
generated section:

```md
### Release highlights

- **Behaviour changes:** …
- **Default changes + migration:** …
- **Security and correctness:** …
- **Honest nulls:** …
- **Known limitations:** …
```

Five lines, that order, capped at roughly ten operator-relevant lines
(`RELEASE_HEAD_CAP_LINES` in `src/scripts/release.ts`). `release.ts` emits the
skeleton on every release so it cannot be forgotten; the maintainer fills it
before merge. `_none_` is a legitimate value and often the true one — a
release that changed no defaults should say so rather than carry an unfilled
marker.

### Curated-head cadence — retro-curation, not a merge precondition

The generator pre-fills each *substantiated* label with a marked line
(`DERIVED_MARKER` in `src/scripts/_lib/release_highlights.ts`) carrying the real
reason plus the citing SHAs; the maintainer rewrites it into prose. When a marked
line survives to merge, `src/scripts/check_release_highlights.ts` warns and still
exits 0. Whether that is a defect or the intended cadence was open until
2026-08-11, and one marked line reached npm and GitHub Releases in the v9.32.0
head before it was settled. Both branches are recorded here so the decision is
legible later (AI-council convergence 2/2, 2026-08-11, anthropic + openai).

**The cadence is retro-curation.** A marked line is a legitimate interim state:
unpolished, never false — its reason is derived and its SHAs are real. Curation
is expected before merge and permitted after; a shipped head may be rewritten in
place by a later change, which is how the v9.32.0 head was repaired.

**The rejected branch.** Hard-blocking a surviving marker in the final release
head was rejected. The marker is present *by construction* on every release that
carries any substantiated category, so blocking it re-introduces the
guaranteed-first-run red that pre-filling was introduced to remove — the failure
mode `check_release_highlights.ts` names in its own source. A marked line is a
prose gap, not a contradiction, and contradictions (`_none_` against derived
evidence) remain the sole blocking condition.

**What that concedes.** The advisory already failed once, and no non-gate
mechanism is added here to make the next survivor less likely; this branch
accepts recurrence rather than claiming a process reminder prevents it. The
behaviour is pinned in `tests/scripts/check_release_highlights.test.ts` — a
surviving marker warns and exits 0, verified to go red when that branch is
flipped — so reversing the decision stays a one-line diff a test notices.

Why it is a *head* and not a trailer: reviewers of 9.9.0 and 9.10.0 repeatedly
could not tell, from a generated commit log, which entries change consumer
behaviour, which need migration, which are internal gate repairs, and which
ended as nulls. The log is a faithful record of what was committed; it is not
a statement of what changed for the reader. That statement has to be the first
thing in the entry.

Below the head, group changes under level-3 headings using
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

No line appears twice. A cherry-pick, a re-land, or one change split across
branches produces the same `scope: subject` under two SHAs; the generator folds
those to the first occurrence (`dedupe_commit_lines`). A breaking commit is
never folded into a non-breaking twin — `!` changes what the line means.

Optional trailers — a free-form paragraph for the release narrative
(only for non-trivial releases), followed by a single-line test count
delta:

```md
Tests: NNNN (+M since X.Y.(Z-1))
```

The test-count line is enforced for any release that ships changes to
`scripts/`, `internal/workers/`, or `dist/agent-src/` content; it can be omitted for
pure-docs releases.

Minor / major sections (`## [X.Y.0]`) additionally carry a `Rollback:` line for
every introduced or substantially reworked subsystem — required by
[`release-sizing.md`](release-sizing.md) and enforced by
`src/scripts/lint_changelog_rollback.ts` for versions above the current
`package.json` version (historical sections never retro-fail).

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
   directories under `dist/agent-src/`, `.augment/`, `.claude/`,
   `.cursor/`, `.clinerules/`, or `.windsurfrules`.
5. **Settings keys** — removing / renaming a key in
   `.agent-settings.yml` that consumer projects may rely on. Adding a
   new key with a default is **not** breaking.
6. **AGENTS.md / kernel rules** — removing or renaming an Iron-Law
   rule, or changing the kernel-membership contract per
   [`kernel-membership.md`](kernel-membership.md).

Internal refactors, doc rewrites, test changes, and any change to
files under `.agent-src.uncondensed/` that round-trip through
`task sync` unchanged are **not** breaking.

## Era splits

`CHANGELOG.md` keeps only the **current era** inline; prior eras live
under [`docs/archive/`](../archive/) and are read-only.

Drift gate — `tests/test_changelog_eras.py` fails when the current
era's body (lines between `# Era: X.Y.x — current` and the next era
header) exceeds **250 lines**. When that happens:

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

### Gate-vs-script contract

- **Canonical splitter** — `src/scripts/release.ts`, run via `task release`
  or the `release`-labeled-PR CI path
  (`.github/workflows/release.yml`, see
  [`ADR-113`](../decisions/ADR-113-ci-native-release-label-trigger.md)).
  When a release crosses a minor/major boundary and the current era body
  is at or over the 250-line cap, the release pipeline writes the
  `chore(changelog): split era …` commit **first**, then the
  `release: X.Y.Z` commit. The maintainer does not run the split by
  hand for the release path.
- **Backstop** — `tests/lib/changelog_eras.test.ts` (`test_current_era_body_under_cap`)
  catches entries written **outside** the release script (hand-edited
  Unreleased section, agent-authored hotfix entries, doc patches). The
  failure message names `task release` as the auto-split path.
- **Shared cap constant** — `src/scripts/_lib/changelog_eras.ts` owns
  `CURRENT_ERA_BODY_CAP` and the era-header regex. Both the test and
  the release script import from there; no parallel copies.
- **Patch-release overflow** — a `patch` bump cannot cross an era
  boundary by definition, so the release script refuses to auto-split
  on a patch and surfaces the manual-intervention message instead.

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
