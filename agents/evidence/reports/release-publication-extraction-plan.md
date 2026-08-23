<!-- evidence-type: analysis -->

# Release publication guard — Phase 1 artefacts

**Date:** 2026-08-23. **For:** `road-to-release-publication-integrity` Phase 1, which
produces exactly the three things the stub's promotion criteria name and does **not**
implement the guard.

## 1.1 — the extraction, measured rather than proposed

The first refused attempt died on `check_source_size_budget`: `release.ts` was **2,818**
lines against a 1,500-line ceiling, so *any* net growth in it is refused — including a
four-line version of the guard.

**The split is three modules, and the shape was forced rather than chosen.** A single cut
does not compile: the publication unit needs `REMOTE`, `MAIN_BRANCH`, `REPO_ROOT`,
`CHANGELOG`, `GH_PR_BODY_LIMIT`, `SystemExitError`, `CalledProcessError` and `_cap_body`
from `release.ts`, while `release.ts` needs `die`, `run`, `git`, `gh` and twenty more names
back — a cycle, and a cycle is worse than the large file the split is fixing. So a third
leaf module carries what both need.

| module | lines | contents |
|---|---|---|
| `src/scripts/release.ts` | 2,818 → **2,030** | plan, changelog, version math, the step machinery, CLI |
| `src/scripts/release_publication.ts` | **727** (new) | the process/`gh` primitives and everything that reaches GitHub |
| `src/scripts/release_env.ts` | **238** (new) | paths, branch names, GitHub body limits, three Python-parity error classes, code-point helpers, `_cap_body` |

**Moved into `release_publication.ts`** (the unit is chosen by dependency shape, not by
tidiness — taking the orchestration without its primitives is what closes the cycle):
`die` · `_set_exec_override` · `run` · `git` · `_sleep_ms` · `gh` · `_failed_check_names` ·
`_failed_checks_report` · `_required_contexts_from_rules` · `_no_checks_action` ·
`watch_pr_checks` · `_is_non_fast_forward` · `push_release_branch` · `_pr_merge_state` ·
`_MERGE_UPDATE_ROUNDS` · `_target_from_branch` · `_refresh_pr_body_from_head` ·
`merge_release_pr` · `have` · `_branch_exists_local` · `_branch_exists_remote` ·
`_tag_exists_local` · `_tag_exists_remote` · `_is_tag_already_exists` ·
`_remote_tag_commit` · `_push_tag` · `_pr_for_branch` · `_release_exists` · `RunResult`.

**Moved into `release_env.ts`:** `SystemExitError` · `ArgparseExit` ·
`CalledProcessError` · `REPO_ROOT` · `PACKAGE_JSON` · `PACKAGE_LOCK_JSON` ·
`MARKETPLACE_JSON` · `PROJECT_TEMPLATE` · `CHANGELOG` · `MAIN_BRANCH` · `REMOTE` ·
`REPO_SLUG` · `GH_PR_BODY_LIMIT` · `GH_RELEASE_NOTES_LIMIT` · `pyLen` · `pySlice` ·
`commaGroup` · `reEscape` · the JSON-dump helpers · `_cap_body`.

**Re-export shape.** `release.ts` already carried a single trailing `export {…}` block
listing its public surface; the imports above make every moved name resolve through it
unchanged, and the six names tests import directly — `_failed_check_names`,
`_failed_checks_report`, `_is_non_fast_forward`, `_is_tag_already_exists`,
`_no_checks_action`, `_required_contexts_from_rules` — are re-exported with
`export … from './release_publication.js'` rather than imported, because they are not used
in `release.ts` and an unused import would be dropped, breaking the test path silently.

**Measured, not asserted.** `check_source_size_budget` total excess **19,363 → 18,575**
(−788, exactly what left `release.ts`, because both new files sit under the ceiling and so
contribute zero excess). The gate reported the ratchet loose and the baseline is lowered to
18,575 in the same change. **133 release tests pass against the split, unmodified** —
`release.test.ts`, `release_drill.test.ts`, `release_no_checks_tolerance.test.ts`,
`release_push_failure_masking.test.ts`, `release_tag_race.test.ts`.

## 1.2 — the irreversible publication transitions, by hand

The council recorded that the asked-for conjunction (ratchet-clean · fires only on real
publication · no call-site enumeration) has **no** solution, because the state machine has
no single dominating checkpoint. So this list is deliberate work, not a failure to find an
elegance. Every site is where a **check would have to be placed**, and the file:line is at
this commit.

| # | transition | site | irreversible because |
|---|---|---|---|
| 1 | push the release branch | `release_publication.ts:424`, `:452` (retry after non-fast-forward) | externally visible ref; recoverable but observed |
| 2 | open the PR | `release.ts:1361` | body is published; editing leaves history |
| 3 | rewrite the PR body from head | `release_publication.ts:507` | same surface, second write |
| 4 | merge the PR | `release_publication.ts:520` | lands on `main`; not revertible without a new commit |
| 5 | create the annotated tag | `release.ts:1414` | **message is derived from the merged CHANGELOG here** — the one site that reads changelog content in the tag path |
| 6 | push the tag | `release.ts:1415` (fresh) and `release.ts:1397` (**resume**), both via `release_publication.ts:641` | a pushed tag message is published and immutable in practice |
| 7 | create the GitHub Release | `release.ts:1445` | release notes published |
| 8 | dispatch the follow-on workflows | `release.ts:1470` | fires `publish-npm` / `release-guard` / `cloud-release` against the tag |

**The `--resume` created-but-unpushed-tag path is its own case, and it is the one that
matters most.** `release.ts:1392-1397`: when the tag exists locally but not on the remote,
the pipeline calls `_push_tag` **and nothing else** — the tag message was rendered on the
earlier run and is never re-read here. So a check placed only at the tag-*creation* branch
(#5) is bypassed entirely on resume, publishing a message nobody re-inspected. `grep -n
resume src/scripts/release.ts` matches 42 lines, and this branch is the one the first
attempt found.

**Consequence for a guard:** sites 5 and 6 need *separate* checks, not one. Placing it only
at #5 leaves the resume path open; placing it only at #6 checks a message it must then
re-derive.

## 1.3 — the drill fixture question: fixtures, decided

**Decision: controlled changelog fixtures for the drill.** AI council 2026-08-23, 2/2
convergent, over a scoped exemption.

**Reason.** `release_drill.ts:137-141` answered `git show <target>:CHANGELOG.md` with the
**live** `CHANGELOG.md`, so every sequencing scenario depended on whatever the repository's
changelog happened to contain. That coupling is what broke four `release_drill.test.ts`
scenarios in the second refused attempt: a guard reading real content refuses on real
markers, and the drill then failed for a reason with nothing to do with sequencing. An
exemption was rejected because a prior council had already refused letting drills bypass
policy universally — an exempt drill proves the sequencing and proves nothing about the
policy, while a fixture holding policy-valid content exercises the same parsing path with
content the test controls.

**Shipped** as `WorldConfig.changelog`, defaulting to `defaultChangelogFixture(target)`:
an `## [X.Y.Z]` heading (without which `extract_changelog_section` finds nothing), a body
for `tag_message_from_section` / `pr_body_from_section` to render, and a **second** section
below it so the extractor's boundary is exercised rather than assumed. It carries no
placeholder marker — a fixture that trips the guard the drill exists to sequence would
reproduce the very failure this removes. The live file stays available by passing it
explicitly; nothing does today, and doing it *silently* is what the seam removes.

**Sabotage-proven:** breaking the fixture's section heading takes exactly **4** of the 8
drill scenarios RED — the same four the refused attempt broke — so the fixture is genuinely
on the path. Restored, 8/8 green.

## Scope boundary

Phase 1 produced the three artefacts and **no guard**. Phase 2 is not started; see
`b-stub-promotion-authority` for the recorded disposition and the reopening condition.
