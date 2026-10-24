---
complexity: lightweight
execution:
  mode: phase-checkpoints
owner: maintainer
estate_offset_exempt: "Follow-up named by the PR #2604 reviews (2026-10-24) for the points that PR documents as limits rather than fixes. grep -rlF -e 'auto-refresh' -e 'refresh_lock' -e 'single-flight' over agents/roadmaps/*.md, later/ and stubs/: no roadmap owns graph freshness after session start, Windows spawning or a shared refresh coordinator."
relates: []
# relates: probe — grep -rlF -e 'auto-refresh' -e 'refresh_lock' over agents/roadmaps/*.md, later/, stubs/ (2026-10-24): no hit.
---
# Road to code-graph refresh during a session

> **Source:** two reviews of PR #2604 (2026-10-24), pasted into the session that fixed the
> pre-merge findings. Re-read at `feat/code-graph-auto-refresh` after those fixes.

## Goal

The code graph and `agents/map/` stay current for the whole length of an agent session, on
every host the suite supports, through one refresh coordinator that later providers reuse
instead of each adding their own trigger.

## Phase 1 — Freshness after the session starts

- [ ] **1.1 A refresh coordinator.** One entry point that session start, the git hooks and a
      graph query that finds the index behind (`code-graph-context` reports `behind:N`) can
      all ask for a refresh; it batches requests inside a quiet window and never parses on
      every file access. Lock, snapshot build, scheduling and publication stay separate
      responsibilities, so language and framework providers reuse it.
      verify: a test fires three requests inside the window and asserts one refresh.
- [ ] **1.2 Windows.** A spawn strategy for `win32` that starts the refresh without a shell
      (resolve the CLI's real `.js` entry and run it with `process.execPath`), so the session
      concern stops returning `unsupported` there.
      verify: a test on a `win32` platform stub asserts a spawn with no shell and the resolved entry.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Refresh storms | implementation | A query-triggered refresh fires on every stale read in a long session | Batch inside a quiet window behind the existing single-flight lock | Phase 1 — Freshness after the session starts |

## Acceptance Criteria

- [ ] AC-1 — A long session that keeps editing sees the graph refreshed without a restart,
      with at most one refresh per quiet window.
- [ ] AC-2 — The session concern refreshes on Windows without starting a shell.
