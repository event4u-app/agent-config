---
stability: beta
keep-beta-until: 2026-08-12
---

# ADR — Release-trunk sync: main fast-forwards on every tag

> **Status:** Decided · 2026-05-14
> **Context:** PR #43 feedback (Level-5/6 product rating) and PR #143
> revealed `main` lagging the latest tag by N skills + rules at multiple
> points across the 2.x cycle. External readers landing on `main`
> consistently saw stale README counts and missing skill catalogues
> relative to the npm/Packagist artefact.
> **Closes:** the `road-to-productization` roadmap § P1.2 (under
> `agents/roadmaps/`).

## Decision

Every tagged release (`X.Y.Z`) **fast-forwards `main` to the tag's
commit as the final step of the release pipeline**. No exceptions. No
grace period.

The fast-forward is owned by [`scripts/release.py`](../../src/scripts/release.py)
and runs after the GitHub Release is published. The release pipeline
is **not green** until `main == <new-tag>` at the remote.

`main` is therefore a **moving stable trunk pointer**, not a feature
branch. External readers (README, AGENTS.md, marketplace metadata, npm
tarball provenance) reading `main` see the artefact that was last
published, not work-in-progress.

## Protocol

1. `scripts/release.py` cuts `release/X.Y.Z`, bumps version files,
   opens a release PR against `main`, waits for CI, merges.
2. The merge commit on `main` becomes the tag's commit; the tag is
   pushed.
3. `publish-npm.yml` and the marketplace flow trigger on the tag.
4. The release pipeline asserts `git rev-parse origin/main ==
   git rev-parse refs/tags/X.Y.Z` before exit-0.
5. If a hotfix lands on `release/X.Y.Z` after step 1 but before step 4,
   the FF still happens — release-branch commits are part of the
   release, not a separate trunk.

### Why fast-forward, not merge

Fast-forward keeps `main` linear with the tag history. A merge-commit
on top of the tag would put `main` at a SHA that is **not** the tag's
SHA, re-introducing the exact divergence this contract closes.

If a fast-forward is impossible (force-push to `main`, divergent
history, abandoned release-prep), the pipeline **fails loudly**; the
operator either resets `main` manually with an audit trail or aborts
the release.

## CI Gate (P1.3)

[`scripts/check_release_trunk_sync.py`](../../src/scripts/check_release_trunk_sync.py)
runs on every `release/X.Y.Z` branch (detected by `git rev-parse
--abbrev-ref HEAD` matching `^release/\d+\.\d+\.\d+$`).

It enforces: **`main` is at most ONE tagged release behind the
release-prep branch's target version.**

- On `release/2.11.0`: `main` may be at `2.10.0` or `2.11.0`. `2.9.0`
  or older → **hard fail**.
- On any other branch class (feature, fix, chore, docs, the agent's
  own `feat/road-to-productization` branch): the check is a **no-op**
  exit-0 — feature branches never trip the gate.
- Wired into `task ci` as `check-release-trunk-sync`. No warning-only
  mode; the exit code is the gate.

### Bootstrap mode

When the repo state does not yet match the gate (transitional first
run after this contract lands), the check reads
`docs/contracts/release-trunk-sync.bootstrap` for an opt-out window
keyed by current version. The bootstrap file is purged at the next
release. Absence of the file = gate is live.

## Rollback

Revertible by removing `check-release-trunk-sync` from `Taskfile.yml`
and deleting `scripts/check_release_trunk_sync.py`. No state, no
schema, no migration. Branch-detection key (`release/X.Y.Z`) is
already used by `scripts/release.py` so removing this contract does
not orphan the convention.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Gate fires on feature branches mid-PR | Branch-name regex; non-`release/` branches no-op exit-0 |
| 2 | Hotfix release leaves `main` behind | FF runs **after** hotfix commits land on the release branch |
| 3 | Manual tag (no `scripts/release.py`) skips the FF | Out of scope of this contract — covered by `release-guard.yml` which fails on tag/version mismatch; manual tags already break the pipeline |
| 4 | Detached HEAD or shallow checkout breaks detection | Check gracefully exits-0 with a `::warning::` line when `git rev-parse --abbrev-ref HEAD == HEAD` (detached) |

## See also

- [`scripts/release.py`](../../src/scripts/release.py) — release pipeline owner.
- [`.github/workflows/release-guard.yml`](../../.github/workflows/release-guard.yml)
  — tag/version-file integrity gate (orthogonal: this contract handles
  trunk position, release-guard handles version-string integrity).
- The `road-to-productization` roadmap § Phase 1 (under
  `agents/roadmaps/`).
