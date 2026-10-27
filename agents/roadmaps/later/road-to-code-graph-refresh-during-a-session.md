---
status: later
review_by: 2026-11-24
entry_condition:
  what: "a free slot among the five active roadmaps (owner WIP limit, 2026-10-24)"
  when: "when one of the five active roadmaps completes"
  who: owner
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

> **Arrivals:** 2 — latest `inbox-2026-10-bf` (2026-10-27): a review-graph comparison
> round (S1) asks for the cold build as the oracle of the incremental path and for an
> empty update that resolves nothing; landed as steps 1.5 and 1.6. Its coordinator item
> duplicates 1.1 and added nothing. It contradicts 1.3 — recorded as D1 below, not as
> an edit. Before that: 1 — latest `inbox-2026-10-bb` (2026-10-26): a comparison round
> asks for an update that re-resolves only what changed and survives deletions; landed
> as steps 1.3 and 1.4.

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
- [ ] **1.3 An update that re-resolves only what changed.** `--update` re-extracts
      changed files but re-resolves the whole tree (`build.ts`, the update path).
      Re-resolve only edges from changed files and edges onto exports they removed or
      renamed; unchanged nodes enter the resolver read-only.
      verify: a fixture edits one file of a built graph and asserts the update equals a full rebuild
- [ ] **1.4 A shrink guard.** A smaller graph is written only when every lost node
      belongs to a changed or deleted file; otherwise fall back to a full build. Never
      cache an empty extraction.
      verify: a fixture deletes one file and asserts no ghost node and no other node lost
      NOTE 2026-10-27 (round `inbox-2026-10-bf`): a shrink guard has since shipped
      (`src/scripts/code_graph/verify/shrink_guard.ts`, wired in `cli.ts`, tested in
      `code_graph_verify.test.ts`), with a weaker contract than this step: it admits
      unexplained losses below `shrink_share` (0.2 in `verify/defaults.json`) and on a
      refusal keeps the old cache instead of falling back to a full build. So the box
      stays open; what remains is zero tolerance for unexplained losses, the full-build
      fallback, the empty-extraction case, and the fixture above.
- [ ] **1.5 The cold build as the oracle of the incremental path.** `verify/rebuild_diff.ts`
      already diffs `--update` against a cold build; extend it rather than build a
      second oracle: run lanes in both builds, compare the SQLite twin, and add a
      fixture for seven edit kinds — add, delete, rename, change an import, change a
      signature, move a file, partial parse. Schedule it beside the refreshes it audits.
      Precondition of 1.6 and of any change to 1.3.
      verify: `npx vitest run tests/scripts/code_graph_verify.test.ts -t 'rebuild-diff seven edit kinds'` -> 0
- [ ] **1.6 An empty update resolves nothing.** `--update` always runs `buildGraph`,
      the lanes and the SQLite twin (`build.ts`), so an update with no change pays the
      full resolution. When no extract hash, no lane input and no extractor fingerprint
      changed, the update returns the cached graph unchanged. The target comes from a
      measurement on this repository, not fixed in advance; 1.5 stays green.
      verify: `npx vitest run tests/scripts/code_graph_refresh.test.ts -t 'empty update short-circuits'` -> 0

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council (pending, not yet put) | Step 1.3 asks the update to re-resolve only edges from changed files; round `inbox-2026-10-bf` kills incremental re-resolution, because S1's own fidelity benchmark marks every one of its seven edit kinds as diverging from a cold build, and keeps resolution pure with `--update` as acceleration only. Candidate dispositions for the council: rewrite 1.3 into 1.6's short-circuit plus 1.5's oracle (keeps the item alive), or keep 1.3 gated behind a green 1.5 run. Converting 1.3 to cancelled is owner-reserved and not a council option. 1.3 is left unedited until the verdict | round `inbox-2026-10-bf` plan, kill item against incremental re-resolution; `verify/rebuild_diff.ts` exists as the oracle 1.5 extends | 1.5 shows `--update` equal to a cold build across all seven edit kinds |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Refresh storms | implementation | A query-triggered refresh fires on every stale read in a long session | Batch inside a quiet window behind the existing single-flight lock | Phase 1 — Freshness after the session starts |

## Acceptance Criteria

- [ ] AC-1 — A long session that keeps editing sees the graph refreshed without a restart,
      with at most one refresh per quiet window.
- [ ] AC-2 — The session concern refreshes on Windows without starting a shell.
