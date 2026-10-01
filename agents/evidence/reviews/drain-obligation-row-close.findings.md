<!-- evidence-type: review -->
# Completion review — drain, obligation-row writer roadmap close

**Skipped:** no code surface for this completion — the diff is one roadmap markdown file: step 2.2 moved from bare `[ ]` to `[~]` deferred with its evidence paragraph, recording that the blocker's `Resolved when` was executed and still unmet, that the remaining decision is owner-reserved, a re-read of the split reporter and the four owner inputs a future session needs; the validator reports 0 code path(s) of 1 changed file(s), scope 191b716b2c52ecae4900fd16ff75dc015df620c7d21d2f9683edef41fff9100f, declared 2026-10-01

## Why a skip is the honest disposition here, not a convenience

The skip phrase is a false statement on a code diff, so it is worth naming what
this diff is. `git diff --name-only origin/main` returns exactly one path,
`agents/roadmaps/road-to-an-obligation-row-that-names-its-writer.md`. No file
under `src/`, `tests/`, `scripts/` or any config surface is touched, which is
also why no `task sync` / `task generate-tools` pass is owed.

The shipped code this roadmap built in Phase 1 was NOT re-reviewed here because
it is unchanged and already carries its own review from the change that landed
it. It was, however, re-verified rather than assumed: the `WriterRole` union
still declares three literals and nothing else, the only `payload|notes|extra`
occurrence in `src/scripts/_lib/obligations.ts` is the comment documenting their
absence, and `tests/scripts/obligations.test.ts` (39) plus
`tests/scripts/obligation_writer_split.test.ts` (18) run **57 passed**.

## Two pre-existing reds observed, neither caused by this diff

Recorded here rather than handed back silently, per `fix-what-you-see`:

- `lint_roadmap_complexity` fails on `agents/roadmaps/road-to-a-stop-that-holds.md`
  (920 lines against the 600-line `lightweight` cap). That file is unmodified by
  this diff and was last written by `5689c2d12` (#2128), already on `main`. The
  gate offers two remedies — retag `structural` or trim — and the choice belongs
  to that roadmap's author, so it is reported rather than taken.
- `task roadmap-progress-check` fails on Iron Law 3. Verified pre-existing by
  restoring this roadmap to its `origin/main` content and re-running: the check
  still failed, on `road-to-host-claims-the-tree-contradicts.md` (8/8 done, 2
  deferred). This diff adds a second entry to that same pre-existing failure,
  which is the gate working as designed — it exists to stop a roadmap carrying
  `[~]` items from auto-archiving, and this roadmap is deliberately not archived.

Neither gate is in the CI job set: `main`'s head `9f2b9fb4a` is green across all
seven reported checks while both fail locally against that same tree.
