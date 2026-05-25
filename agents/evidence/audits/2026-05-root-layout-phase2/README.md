# Root-layout Phase 2 audits — verdict bundle

> Phase 2 of [`road-to-root-layout-cleanup.md`](../../../roadmaps/archive/road-to-root-layout-cleanup.md) (archived). Four pre-audits required by [`ADR-028`](../../../../docs/decisions/ADR-028-root-layout.md) before Phase 3 (multi-workspace) can open. Each audit produces a verdict file in this directory.

## Verdict roll-up

| # | Audit | Verdict | File |
|---|---|---|---|
| 1 | Consumer-contract | ✅ Pass — published surface enumerated | [`01-consumer-contract.md`](01-consumer-contract.md) |
| 2 | Symlink-mobility | ⚠️ Partial — subdirectory symlinks proven, top-level untested | [`02-symlink-mobility.md`](02-symlink-mobility.md) |
| 3 | Hash-sequencing | ✅ Pass — source-relative keys, idempotent regeneration | [`03-hash-sequencing.md`](03-hash-sequencing.md) |
| 4 | CI-path inventory | ✅ Pass — complete inventory, ~27 edit points enumerated | [`04-ci-path-inventory.md`](04-ci-path-inventory.md) |

## Gate decision

Phase 3 opens iff **all four** verdicts are ✅. With Audit 2 at ⚠️, Phase 3 does **not** open as an execution roadmap. The successor ADR ([`ADR-029`](../../../../docs/decisions/ADR-029-multi-workspace-deferred.md)) documents the blocker (untested top-level symlink mobility for `.cursor/`, `.windsurf/`, `.claude/` tool roots) and the conditions under which Phase 3 can be re-opened.

## Re-open triggers

Phase 3 becomes eligible when **all** of these are true:

1. A maintainer (or community contributor) runs the symlink-mobility test from Audit 2 against Cursor, Claude Code, and Windsurf with current versions, captures the result, and amends Audit 2 to ✅.
2. The ~27 CI-path edit points from Audit 4 are accepted as in-scope for the migration window (no new hardcoded paths added in the interim).
3. A council session synthesizes the verdict bundle and produces a fresh recommendation.

## See also

- [`docs/decisions/ADR-028-root-layout.md`](../../../../docs/decisions/ADR-028-root-layout.md) — the governing two-phase decision.
- [`docs/decisions/ADR-029-multi-workspace-deferred.md`](../../../../docs/decisions/ADR-029-multi-workspace-deferred.md) — Phase 3 close-out decision.
- [`agents/roadmaps/archive/road-to-root-layout-cleanup.md`](../../../roadmaps/archive/road-to-root-layout-cleanup.md) — execution roadmap, archived (Phase 1 ✅, Phase 2 ✅, Phase 3 closed).
