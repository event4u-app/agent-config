<!-- evidence-type: analysis -->

# Consumer classification of the four candidate derived artifacts

> Produced by `road-to-generated-artifacts-out-of-index` Phase 1.1 on
> 2026-08-22, to discharge the AI council's first condition on option B: the
> phrase "zero runtime consumers" was an assertion, and both seats refused to
> treat it as established. Every hit for each of the four literal paths is
> listed below and classified into exactly one of three kinds.

## The three kinds

| Kind | Meaning | Compatible with untracking? |
|---|---|---|
| **names-path** | the path appears as a string in a list, comment, description, or test fixture; nothing opens the file | yes |
| **writes** | the code generates or stages the file | yes, if the write target is allowed to be untracked |
| **requires-tracked** | the code depends on the file being in the git index or on disk in a clone | **no** — must be repaired first |

## `agents/roadmaps-progress.md`

| Site | Kind | Note |
|---|---|---|
| `taskfiles/content.yml:269,282` | names-path | task descriptions |
| `src/agent-src/scripts/update_roadmap_progress.ts` (header) | writes | the generator |
| `src/agent-src/scripts/archive_completed_roadmaps.ts:403` | **requires-tracked** | `git add -- agents/roadmaps-progress.md`, guarded only by `_isFile`. See § The one real dependency. |
| `src/scripts/check_references.ts:105,725` | names-path | already carves the path out as a deliberately untracked generated artefact — half the tree assumes the end state |
| `src/scripts/sync_pr_branch.ts` (`GENERATED`) | names-path | conflict-class classifier, string list |
| `templates/github-workflows/roadmap-progress-check.yml` | **requires-tracked** | consumer-facing template; tells the reader to *"commit and push the updated agents/roadmaps-progress.md"* |
| `tests/scripts/{sync_pr_branch,check_references,lint_governed_writes,check_release_highlights}.test.ts` | names-path | fixtures |

## `agents/roadmaps/archive/INDEX.md` and `agents/roadmaps/archive/index.json`

| Site | Kind | Note |
|---|---|---|
| `src/scripts/build_archive_index.ts:409-410` | writes | the generator; `--check` compares against the committed copies |
| `src/agent-src/scripts/archive_completed_roadmaps.ts:432` | writes | rebuilds after an archival move |
| `src/scripts/sync_pr_branch.ts:84-85` (`GENERATED`) | names-path | string list |
| `src/scripts/hooks/ship_diff_volume_hook.ts:53` (`EXCLUDED`) | names-path | string list; excludes the path from a volume count |
| `tests/scripts/sync_pr_branch.test.ts`, `tests/hooks/ship_diff_volume.test.ts` | names-path | fixtures |

No site opens either file. `build_archive_index --check` reads the committed
copy, which is the behaviour Phase 3.2 replaces rather than a dependency to
preserve.

## `agents/roadmaps/stubs/README.md` — reclassified, and it leaves this roadmap

**This file is authored prose, not a generated artifact.** No generator writes
it: `grep -rn "stubs/README" --include='*.ts' src/` returns nothing, and
`tests/scripts/sync_pr_branch.test.ts:112` asserts
`out.authored == ['agents/roadmaps/stubs/README.md']` — the repository's own
conflict classifier already calls it authored.

Its place in the merge-hotspot table was real (32 of 120 merges) and its cause
is already fixed upstream: `3793855b3` (2026-08-21,
*"delete the hand-maintained stub index, the last authored hotspot"*) removed the
hand-maintained inventory that every new stub had to touch. Commits since that
change: **3 non-merge**, against 78 in the preceding 60 days.

There is nothing to untrack — an untracked file that nothing can regenerate is
simply a deleted file — so this artifact is **out of scope**, and the roadmap's
Phase 1.4 is answered: keep it tracked, no generator to delete, hotspot already
closed by other work.

## The one real dependency

`archive_completed_roadmaps.ts:403` runs `git add -- agents/roadmaps-progress.md`
after regenerating the dashboard. Probed on 2026-08-22 in a scratch repository:
`git add -- <ignored-path>` exits **1** with *"The following paths are ignored by
one of your .gitignore files"*. `_run` (`:81-91`) returns the code and the call
site at `:403` discards it, so this is a **silent no-op today**, not a crash —
which is why it survived the 2026-08-21 untrack unnoticed.

The repair is deletion, not `-f`: an untracked dashboard is never staged, so the
block has no correct behaviour left. Carried by Phase 3.1.

The consumer-facing workflow template is the second site and is a genuine
contract change for consumers, not a bug — carried by Phase 4.4.

## Verdict

Three artifacts are compatible with untracking after one code repair. The
fourth is not a generated artifact at all and leaves the roadmap.
