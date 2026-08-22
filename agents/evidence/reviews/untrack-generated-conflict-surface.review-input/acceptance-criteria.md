## Acceptance Criteria

- [x] AC-1 — `agents/roadmaps-progress.md` is absent from `git ls-files` and
      matched by `.gitignore`, while the file still exists on disk after
      `task roadmap-progress` and `task roadmap-progress-check` exits 0.
- [x] AC-2 — `update_roadmap_progress.ts --check` distinguishes tracked from
      untracked by an explicit flag, defaults to tracked, and all four mode ×
      state cells plus the still-tracked case are asserted in the test file with
      each assertion having been observed red.
- [x] AC-3 — no file shipped to consumers changes its behaviour:
      `src/config/gitignore-block.txt` and
      `src/agent-src/templates/github-workflows/roadmap-progress-check.yml` are
      byte-identical to `origin/main`.
- [x] AC-4 — `agents/roadmaps/stubs/README.md` carries no per-stub inventory,
      and every fact deleted from it is present in the corresponding stub file.
- [x] AC-5 — `sync_pr_branch.ts` classifies `docs/decisions/INDEX.md` and
      `dist/router.json` as generated, asserted in its test file.
- [x] AC-6 — the three refused items are carried, not dropped: the
      estate-history split exists as a stub naming the explicit-record-reference
      design and the concurrent-branch test, the three unclassified baselines are
      a second carried item in that stub naming PR #1513, and the gate-baseline split remains
      recorded as blocked in that record with no change made to it. It is cited by
      decision name, not number: `ADR-239` was taken on `main` by the drain-command
      record while #1513 was open, so the number will change.
- [x] AC-7 — `git merge-tree --write-tree origin/main HEAD` reports **0**
      conflicts, i.e. this branch introduces none. **The second clause as
      originally written is FALSE and is corrected rather than marked satisfied:**
      the two fixed paths do NOT disappear from the conflict set of the three
      already-open PRs. Measured against this branch, each still reports
      `agents/roadmaps-progress.md` as **modify/delete** and
      `agents/roadmaps/stubs/README.md` as a content conflict — their append
      against this branch's delete. That is a **one-time** cost the council
      predicted (P4) and accepted: those three PRs need a resolution pass on
      those paths either way, and after it the paths cannot conflict again,
      because one is no longer tracked and the other no longer has a shared
      table to append to. What is verified here is the mechanism, not a
      disappearance: an untracked file cannot appear in any future diff, and a
      new stub adds a FILE rather than a row.
      **An empirical probe of the post-untrack case was attempted and is not
      claimed:** a scratch worktree on a branch off this HEAD failed to commit
      (the pre-commit hook demanded `--no-verify`, which is blocked), so it
      measured HEAD and proved nothing. Recorded as an attempt rather than
      deleted, because the numbers above are the ones that matter and they were
      measured directly.
