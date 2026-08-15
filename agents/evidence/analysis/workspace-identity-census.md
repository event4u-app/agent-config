# Workspace-identity census

Phase 1 of `road-to-inbox-harvest-2026-08-c-workspace-identity`. Measured on
`feat/workspace-identity`, based on `origin/main` @ `e3bd96158`, 2026-08-15.

Scope: every site in `src/` that answers one of the five workspace-identity
questions **for itself** — repo root, main worktree, current worktree, branch,
PR base — rather than importing an answer.

The `GIT_DIR-safe` column is the load-bearing one. Git hooks export `GIT_DIR`,
every child inherits it, and an inherited `GIT_DIR` **overrides** repository
discovery — so `execFileSync('git', …, { cwd })` silently resolves against the
hook's repository instead of `cwd`. `src/scripts/_lib/git_env.ts` exists to
strip exactly that; a site that does not use it, and does not read files
directly, answers wrongly under a hook with no error to show for it.

## 1. Repo root — 8 call sites, 6 files

| # | Site | Primitive | GIT_DIR-safe | Fallback when git fails | Migrate? |
|---|---|---|---|---|---|
| R1 | `src/agent-src/scripts/archive_completed_roadmaps.ts:93` (`_repo_root`) | `git rev-parse --show-toplevel`, `cwd = process.cwd()` | no | `process.cwd()` — a **silently wrong root** | yes |
| R2 | `src/agent-src/scripts/roadmap_gates.ts:440` (`_resolveRepoRoot`) | marker probe (`agents/roadmaps`) first, `--show-toplevel` second | no | marker walk; root must contain the marker | yes |
| R3 | `src/agent-src/scripts/update_roadmap_progress.ts:972` (`_fallback_git_toplevel`) | `--show-toplevel`, validated against the `agents/roadmaps` marker | no | caller-supplied `--repo-root` | yes |
| R4 | `src/scripts/evidence_report.ts:44` (`_repo_root`) | `--show-toplevel` with **no `cwd` at all** | no | `dirname(import.meta.url)/../..` | yes |
| R5 | `src/scripts/lint_plan_risk_register.ts:511` (`fileHistory`) | `_git(dir, …)` → `env: gitEnv()` | **yes** | `[]` (explicit unresolved) | yes — behaviour-identical |
| R6 | `src/scripts/lint_plan_risk_register.ts:543` (`hasUncommittedChanges`) | `_git(dir, …)` → `env: gitEnv()` | **yes** | `false` (explicit unresolved) | yes — behaviour-identical |
| R7 | `src/scripts/lint_plan_risk_register.ts:554` (`_blobAt`) | `_git(dir, …)` → `env: gitEnv()` | **yes** | `null` (explicit unresolved) | yes — behaviour-identical |
| R8 | `src/scripts/migration_status.ts:161` (`repoRoot`) | `--show-toplevel`, `cwd = process.cwd()` | no | **throws** (`execFileSync` unguarded) | yes |

R8 is the tree's only exported `repoRoot()`. It lives in a report script, which
is why nothing imports it — the roadmap's Context states this and it is
confirmed: `grep -rn "from '.*migration_status" src/` returns no importer of
`repoRoot`.

**Three of the eight already strip `GIT_DIR`** (R5–R7) and three of the eight
fall back to a value that is *plausible but wrong* rather than to an explicit
unresolved marker (R1 → `process.cwd()`, R4 → a path derived from the script's
own location, R8 → an exception). That split is the whole case for a resolver
whose fields are `resolved | unresolved`, never a silent default.

## 2. Main worktree — 3 call sites

| # | Site | Primitive | GIT_DIR-safe | Notes |
|---|---|---|---|---|
| M1 | `src/scripts/worktree_cleanup_check.ts:406` (`buildInventoryInner`) | first entry of `git worktree list --porcelain`, `canonical()`-normalised | no | correct **since** `5cf7450da`; see § 5 |
| M2 | `src/scripts/cache_realization_report.ts:449` | first entry of `git worktree list --porcelain` | no | same technique, independently re-derived |
| M3 | `src/scripts/sessions_cli.ts:109` | `git worktree list --porcelain` (enumeration, not main-selection) | no | consumes the list; does not select a main |

The `git worktree list --porcelain` first-entry rule is documented twice
(`sessions_cli.ts:85`, `cache_realization_report.ts:442`) and implemented three
times. It is the same fact stated in three places.

## 3. Current worktree / git dir — the existing primitive

| # | Site | Primitive | GIT_DIR-safe | Notes |
|---|---|---|---|---|
| C1 | `src/scripts/_lib/git_common_dir.ts:59` (`git_dir`) | reads `<root>/.git` as file or dir | **yes** (reads files, never shells out) | the foundation |
| C2 | `src/scripts/_lib/git_common_dir.ts:106` (`git_common_dir`) | reads `commondir` | **yes** | realpath-normalised |
| C3 | `src/scripts/session_register_hook.ts:53` | imports C1/C2/`current_branch` | **yes** | the model consumer |

`git_dir` and `git_common_dir` both take `project_root` as an **input**. Neither
discovers it. That is precisely the gap the eight § 1 sites fill by hand.

## 4. Branch — 5 call sites, 1 correct

| # | Site | Primitive | GIT_DIR-safe | Migrate? |
|---|---|---|---|---|
| B1 | `src/scripts/session_register_hook.ts:330,377` | `current_branch()` from the shared module | **yes** | already correct |
| B2 | `src/scripts/hot_context_hook.ts:84` (`_current_branch`) | `rev-parse --abbrev-ref HEAD`, `env: hardenedSpawnEnv()` | partial — hardened env, not `gitEnv()` | yes |
| B3 | `src/scripts/check_release_trunk_sync.ts:40` (`_current_branch`) | `rev-parse --abbrev-ref HEAD`, **no `cwd`, no env scrub** | no | yes |
| B4 | `src/scripts/check_branch_freshness.ts:551` | `rev-parse --abbrev-ref HEAD` | no | yes |
| B5 | `src/scripts/check_release_published.ts:68` | `rev-parse --abbrev-ref HEAD` | no | yes |

Four private `_current_branch` implementations exist beside one shared,
file-based, `GIT_DIR`-immune `current_branch()`.

## 5. PR base — 5 call sites, three different definitions

| # | Site | Definition of "base" | Resolvable offline |
|---|---|---|---|
| P1 | `src/scripts/check_branch_freshness.ts:162` | `gh pr list --json baseRefName` — the real PR base | no (network + auth) |
| P2 | `src/scripts/check_branch_freshness.ts:204` | `symbolic-ref --short refs/remotes/origin/HEAD` — the remote default | yes |
| P3 | `src/scripts/worktree_cleanup_check.ts:287` (`resolveTrunk`) | first of a candidate ref list that `rev-parse --verify` resolves | yes |
| P4 | `src/scripts/lint_breaking_changes_index.ts:125` | `BASE_REF` module constant | yes |
| P5 | `src/scripts/check_structural_breaking.ts:68` | `BASE_REF` module constant | yes |

**Risk 2 verdict — `prBase` is added, `sessionId` is not.** The roadmap's Risk 2
requires each field to be justified by census rows rather than by the review
that asked for it. `prBase` has five rows and three incompatible definitions, so
it earns a field — resolved from the offline P2 form (the remote default
branch), with `gh`-derived bases left to their existing caller. `sessionId` has
**zero** rows in this census: nothing in `src/` resolves a session id as part of
answering a location question; `session_register_hook.ts` receives it from the
host envelope. It is therefore **not added** to the resolver.

## 6. The two shipped misclassification defects (Phase 1 step 2)

| Defect | Commit | Identity question answered wrongly | Primitive at fault |
|---|---|---|---|
| D1 — the inventory misclassifies from inside a worktree, totally | `52d7fe1b8` (2026-08-14, defect recorded) | **main worktree** — the conventional-root test resolved against the *invoking* checkout | ad-hoc: `isStandardLocation(basePath, …)` was passed `repoPath` (the invocation directory), not the main worktree |
| D2 — judge location against the main worktree | `5cf7450da` (2026-08-14, fix) | **main worktree** — same question, fixed by passing `mainPath`, which `buildInventory` had already computed and was not passing | same site; `worktree_cleanup_check.ts:427` now carries the comment `` `mainPath`, NOT `repoPath` `` |

Both are one defect at one call site, recorded twice because the first commit
diagnosed it and the second repaired it. The measured symptom is identical in
both: from `.claude/worktrees/<branch>` the tool reported **safe 0 of 304** with
278 disqualified as outside the conventional roots; from the main checkout,
**safe 181**. Same binary, same repo, same minute.

**No third instance was found.** The census surfaces the *conditions* for one —
M2 re-derives the same main-worktree rule independently, and B2–B5 re-derive the
branch rule four times — but neither is currently wrong. Recorded as zero rather
than left unstated: the roadmap's step 2 allows a third instance to count as a
row, and there is none.

## 7. What `git_common_dir.ts` already answers under an inherited `GIT_DIR`

Five-row support table (Phase 1 step 3):

| Identity field | Answered today? | Under inherited `GIT_DIR` | Why |
|---|---|---|---|
| Repo root | **no** | n/a | `project_root` is an input, never derived; nothing walks up to find it |
| Main worktree | **no** | n/a | `git_common_dir()` returns `<main>/.git`, not the worktree path; the one-step `dirname` is never taken, and is wrong for a bare/separate-gitdir layout |
| Current worktree | **no** | n/a | same as repo root — supplied by the caller |
| Branch | **yes** | **correct** | `current_branch()` reads `<git-dir>/HEAD` with `fs.readFileSync`; there is no `git` process to redirect |
| PR base | **no** | n/a | no notion of a remote, a default branch, or a trunk |

One of five is answered, and it is the only one that shells out to nothing. The
resolver extends this module rather than starting a new one so the hazard note
stays adjacent to the code (Risk 4).

## 8. Migration ledger (Phase 2)

`workspaceIdentity()` ships in `src/scripts/_lib/git_common_dir.ts`. Every row
below is either migrated or carries a written reason it is not.

| Row | Migrated? | Reason if not |
|---|---|---|
| R1 `archive_completed_roadmaps.ts:93` | **no** | projection boundary — see § 9 |
| R2 `roadmap_gates.ts:440` | **no** | projection boundary — see § 9 |
| R3 `update_roadmap_progress.ts:972` | **no** | projection boundary — see § 9 |
| R4 `evidence_report.ts:44` | **yes** | primary path now file-based; the `import.meta.url` fallback is unchanged |
| R5 `lint_plan_risk_register.ts:511` | **yes** | via a local `_repoRootOf`; already `GIT_DIR`-safe, so behaviour-identical by construction |
| R6 `lint_plan_risk_register.ts:543` | **yes** | same |
| R7 `lint_plan_risk_register.ts:554` | **yes** | same |
| R8 `migration_status.ts:161` | **yes** | the throw is preserved; the message now names the reason |
| M1 `worktree_cleanup_check.ts:406` | **no** | already correct since `5cf7450da`, and `buildInventoryInner` needs the full `git worktree list` enumeration regardless — selecting the main from a second source would be two answers to one question, which is the defect this roadmap exists to remove. Pinned by regression test instead (§ 10). |
| M2 `cache_realization_report.ts:449` | **no** | same shape as M1: the site already enumerates worktrees for its own report |
| M3 `sessions_cli.ts:109` | **no** | enumerates; never selects a main worktree, so it answers no identity question |
| C1 `git_common_dir.ts:59` | n/a | the primitive itself |
| C2 `git_common_dir.ts:106` | n/a | the primitive itself |
| C3 `session_register_hook.ts:53` | n/a | already the model consumer |
| B1 `session_register_hook.ts:330,377` | n/a | already uses the shared `current_branch()` |
| B2 `hot_context_hook.ts:84` | **no** | **behaviour would change.** On a detached HEAD it returns the literal `HEAD`, and lines 302–304 discard the hot context on `stampedBranch !== currentBranch` while explicitly excluding the sentinel `'unknown'`. Mapping unresolved onto `'unknown'` would silently stop that discard from firing on a detached HEAD. Migrating it needs its own change with a test for that transition. |
| B3 `check_release_trunk_sync.ts:40` | **yes** | `main()` already collapses `'HEAD'` and `''` onto one skip path |
| B4 `check_branch_freshness.ts:551` | **yes** | the guard already collapses `null` and `'HEAD'` onto one skip path |
| B5 `check_release_published.ts:68` | **yes** | a detached `'HEAD'` failed the `MAIN_BRANCH` comparison; unresolved fails it identically |
| P1 `check_branch_freshness.ts:162` | **no** | different question — the `gh`-derived base of a real open PR needs network and auth. `prBase` is deliberately the offline form; both are correct and neither replaces the other. |
| P2 `check_branch_freshness.ts:204` | **no** | same question, but this is a push-time gate and `prBase` is currently **unresolved in this repository** (§ 11). Swapping a live code path onto a field that resolves to nothing here would change the gate's behaviour on the one repo that runs it. |
| P3 `worktree_cleanup_check.ts:287` | **no** | `resolveTrunk` walks a candidate ref list and verifies each; that is a trunk *search*, not a recorded default |
| P4 `lint_breaking_changes_index.ts:125` | **no** | module constant, not a resolution |
| P5 `check_structural_breaking.ts:68` | **no** | module constant, not a resolution |

**7 migrated, 11 deliberately not, 3 n/a** (of 21 rows).

## 9. The projection boundary — why R1–R3 cannot migrate

`src/agent-src/scripts/*` is projected to `dist/agent-src/scripts/` and shipped
to consumers. Measured on this branch:

- every import in those files resolves inside `src/agent-src/` (`./`,
  `../templates/`); not one reaches into `src/scripts/`;
- `dist/agent-src/` carries `scripts/` but **no** `_lib/git_common_dir.ts`, and
  the only `_lib` under it is `templates/scripts/work_engine/_lib`.

So the three sites that would benefit most — two of them roadmap gates, all
three consumer-facing — are structurally outside the resolver's reach. Closing
that needs either projecting the lib or duplicating it, and both are a wider
change than this roadmap's Non-goals allow ("does not add a subsystem").

Recorded as the finding it is: **the resolver reaches the maintainer-side tree
and not the consumer-side one.** Anyone extending this should start here.

## 10. What pins the two defects

`tests/scripts/workspace_identity.test.ts`, 14 assertions over real git repos
and a real linked worktree. Two of them are the regression pins:

- `mainWorktree is the main checkout even when called from inside a worktree`;
- `mainWorktree is invariant across checkouts; the pre-migration primitive is
  not` — which asserts, in the same test, that
  `git rev-parse --show-toplevel` **does** differ between the two locations.
  That control is what makes the pin falsifiable rather than vacuous: an
  implementation built on the pre-migration primitive fails it by construction.

A third pair asserts the inherited-`GIT_DIR` hazard directly, with its own
control proving the variable really does redirect a `git` child (Risk 4).

## 11. `prBase` is unresolved in this repository, and that is the design

Probed on this branch, from both locations:

```
prBase  UNRESOLVED: no refs/remotes/origin/HEAD on disk —
        run `git remote set-head origin -a`; not guessed
```

`refs/remotes/origin/HEAD` is a **symbolic** ref. `git pack-refs` never packs
one, so `packed-refs` is not a fallback — this repo's `packed-refs` carries
`refs/remotes/origin/main` but no `HEAD`, and there is no loose file. A repo
that has never run `git remote set-head` simply has no recorded answer.

Reporting that is the whole point of the type. The alternative — defaulting to
`main` — is exactly the "plausible but wrong" shape § 1 measured at three of
eight sites, and it would be wrong on any repo whose trunk is `master`,
`develop`, or a release line.

The same probe confirms the acceptance criterion: `mainWorktree` reads
`…/event4u/agent-config` from inside `.worktrees/workspace-identity` and from
the main checkout alike, while `repoRoot` and `currentWorktree` differ between
them and say which they are.
