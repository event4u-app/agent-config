---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
review_by: 2026-12-01
estate_offset_exempt: "Round inbox-2026-10-v reproduced at 324969e7e that worktree_cleanup_check classes a clean, pushed, squash-merged worktree as `review: unmerged work` (isAncestor, worktree_cleanup_check.ts:300-307,485) while its merge-commit twin is `safe`, and that nothing in the tree removes a worktree at all (:19-24, workspace_doctor.ts:5-10). No active or parked roadmap owns cleanup: a grep over agents/roadmaps/{*,later,stubs} for worktree remove, isAncestor, merged-pr and worktrees.cleanup returns nothing, and the only owner is stubs/road-to-worktree-lifecycle.md, parked on zero demand, which this change retires to skipped/ because the owner reported ~250 stale trees on 2026-10-21. Archiving or parking costs more because every new lane, review and security-fix worktree adds to an estate that already holds 73 linked trees in this checkout; merging into road-to-security-fixes-carried-to-the-merge would put a general lifecycle fault behind one consumer of it."
relates:
  - slug: road-to-security-fixes-carried-to-the-merge
    relation: extends
    note: "That file creates security-fix worktrees and calls Phase 3.1 of this one after its merge. This file owns removal for every worktree; that one owns none."
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "Owns persistent grants for irreversible ops. Branch deletion after a squash merge stays listed-not-automatic here (D3) and moves only if that file lands a grant."
---
# Road to worktrees that leave after the merge

> **Source:** `agents/tmp.old/inbox-2026-10-v/` — one owner transcript and
> three supplied plans, pinned at `main@8a2c3b4`, re-read at `main@324969e7e`
> on 2026-10-21. Readings marked *(executed)* ran against this tree or a
> scratch repository outside it.
>
> **Arrivals:** 3 — latest `inbox-2026-10-v` (2026-10-21); earlier: the
> 8.0/8.1 review dumps (stub, council 2026-07-08) and the 12.0.0 feedback round.

## Goal

A worktree exists while work lives in it and not one day longer than its
merge. Every worktree this package or its host created is removed
automatically once its work is provably on the trunk — merge commit, rebase
**or squash** — it is clean, holds no ignored file that cannot be regenerated,
and no session is in it. Everything else is listed once a day with a reason and
one command. No uncommitted change, untracked or local-only file, or unique
commit is ever lost.

## Prerequisites

- None outside this file. `road-to-security-fixes-carried-to-the-merge`
  consumes Phase 3.1; it is not needed for any step here.

## Context — read at `main@324969e7e`

| # | Defect | Evidence |
|---|---|---|
| W1 | **A squash-merged branch is never "merged".** The safe predicate is `merge-base --is-ancestor`. *(executed)* in a scratch repo, a clean, pushed, squash-merged worktree with its remote deleted classes `review` with "not an ancestor … unmerged work" and "commits reachable from NO other ref"; its `--no-ff` twin classes `safe`. 434 of the last 500 first-parent commits on this `main` have one parent, so most PR branches are squash-merged. | `src/scripts/worktree_cleanup_check.ts:300-307,485` |
| W2 | **Nothing removes anything.** The checker is report-only and its header calls bulk removal Hard-Floor; `workspace:doctor` has no `--prune`. The Hard-Floor rule itself never names worktree removal — the classification exists only in the checker's own text. | `worktree_cleanup_check.ts:19-24,633,655`; `src/scripts/workspace_doctor.ts:5-10`; `src/rules/non-destructive-by-default.md:35-36` |
| W3 | **No trigger at the moment a worktree becomes obsolete.** `finishing-a-development-branch` ends at "PR opened", which is not terminal. `/pr:merge` deletes the remote branch and removes only its own temporary base worktree. Lane runs claim end-of-run cleanup in prose only. | `src/skills/finishing-a-development-branch/SKILL.md:170-176`; `src/domains/git/pr/merge/command.md:194,278`; `src/agent-src/contexts/execution/process-full-all.md:70-83,172` |
| W4 | **Most of this estate sits outside the standard roots.** *(executed)* 73 linked worktrees: 26 under `.claude/worktrees`, 47 siblings at `../agent-config-*`. The checker files every one of the 47 as `review: non-standard location`, so a fixed W1 alone still removes none of them. | `worktree_cleanup_check.ts:230,470-472` |
| W5 | **Plain `git worktree remove` deletes ignored files.** *(executed)* a clean worktree holding an ignored `local.cfg` is removed with exit 0 and the file is gone. The supplied plan's "no data can be lost without `--force`" is wrong for `.env`-style local files. | scratch repro 2026-10-21; `git-worktree(1)` "clean" excludes ignored files |
| W6 | **Liveness reads git-dir mtimes the inventory itself bumps.** `lastGitActivity` reads `.git/worktrees/<w>/{index,HEAD}` mtimes; the inventory's own `git status` refreshes the index, and the 48 h window has no override. A daily automatic run keeps every tree it inspects "live". | `worktree_cleanup_check.ts:66-67,222,334-358` |
| W7 | **Consumers cannot reach the command.** `/worktree` and `/worktree cleanup` are `visibility: internal`, `workspaces: agent-config-maintainer`; the skill calls the checker through `node_modules/@event4u/agent-config/…`, which a global-only install lacks. | `src/domains/engineering-base/worktree/command.md:7,16-19`; `…/worktree/cleanup/command.md:5,14-17`; `src/skills/worktree-lifecycle/SKILL.md:109,137` |
| W8 | **The op vocabulary does not split `-d` from `-D`.** Plain `worktree remove` is unclassified; `branch -d` and `branch -D` both classify `branch-delete` (case-insensitive regex), a WARN op. | `src/scripts/hooks/git_command_classifier.ts:116,138,157,313-331` |

## Bestand — reuse, do not rebuild

| Need | Already in tree |
|---|---|
| Per-worktree gates (detached, dirty incl. untracked, unique commits) | `worktree_cleanup_check.ts:84` `checkWorktree` |
| Estate classification, live exclusion, main base | `worktree_cleanup_check.ts:259-500` |
| Live sessions per repository, heartbeat not mtime | `src/scripts/_lib/session_register.ts:35-42` |
| Disclosed `gh` read of PR state | `src/scripts/retro_sweep.ts:275-283,430-450` (per-PR `gh pr view`); settings `src/config/agent-settings.template.yml:1129-1137` |
| Daily throttle | `src/scripts/hooks/probe_throttle.ts` |
| Riding `session_start` without a new concern | `src/scripts/session_register_hook.ts:933-952` |

## Phase 1 — Know what "merged" and "safe to lose" mean

- [x] **1.1 Fixtures first.** F1 squash-merged, remote deleted, clean (W1);
      F2 merge-commit; F3 rebase-merged; F4 squash-merged then one local commit
      after the merge; F5 dirty / untracked; F6 a live session inside; F7 a
      host-locked worktree; F8 a directory deleted by hand; F9 PR closed
      unmerged; F10 `gh` unavailable; F11 an ignored non-regenerable file
      (W5); F12 a sibling-directory worktree (W4). Each fixture backdates
      nothing: 1.4 removes the need.
      verify: the cleanup-check test file carries a named case per fixture,
      and F1 is seen red against the current predicate before 1.2 lands.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **1.2 Merge evidence in three strengths**, strongest wins:
      `merged-ancestor` (today); `merged-pr` — the host reports the branch's PR
      MERGED **and** the branch tip equals that PR's head commit;
      `merged-equivalent` — offline only: the branch's diff against its
      merge-base is already contained in the trunk tree. F4 stays `review`, F9
      is `closed-unmerged` and is never removed.
      verify: F1–F4, F9 and F10 each produce their stated class.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **1.3 One `gh` read per repository per day.** The retro reads per PR;
      merge evidence for an estate needs one `gh pr list --state all --json
      headRefName,headRefOid,state,mergedAt` call (`all`, so F9's closed PR is
      seen), budgeted like the retro and disclosed in the settings template.
      verify: a fixture with six worktrees issues exactly one `gh` invocation.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **1.4 Liveness without self-inflicted mtimes.** Every git call the
      inventory makes runs with `GIT_OPTIONAL_LOCKS=0`, so it never refreshes
      an index (W6); liveness reads the session register first and mtimes
      only as a fallback.
      verify: two consecutive inventories over a fixture leave every
      `.git/worktrees/*/index` mtime unchanged.
      *Executed 2026-10-21: `statusPorcelain` already passed `--no-optional-locks` at the base (W6 was half-fixed); every git call now runs with `GIT_OPTIONAL_LOCKS=0`, and the session register is read first. The mtime fallback stays, so fixtures still backdate — D7.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **1.5 Ignored files are inventoried, not assumed regenerable (W5).**
      `git status --ignored --porcelain` per candidate; a tree holding any
      ignored path outside a regenerable list (paths never hand-edited —
      `node_modules/`, tool caches, `.DS_Store` — plus whatever the project's
      own `.gitignore` comment marks as generated; D6) is `review: local-only
      files` with the paths named.
      verify: F11 classes `review` and names `local.cfg`; a tree holding only
      `node_modules/` classes `safe`.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->

## Phase 2 — Remove what is provably done

- [x] **2.1 The auto-remove set** = merged (any 1.2 strength) ∧ clean ∧ no
      local-only ignored file (1.5) ∧ not live ∧ not locked ∧ merged ≥ 24 h
      ago (D4). Action: `git worktree remove <path>` without `--force`, then
      `git worktree prune`.
      verify: F1, F2, F3 removed; F4–F9, F11 kept with their reason.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **2.2 Sibling worktrees by registration, not by location (W4).** A
      worktree outside the standard roots is eligible only when a
      registration this package wrote names it (3.4) or its directory matches
      the main checkout's own name with a suffix (`../<repo>-*`) and its branch
      has merge evidence. Anything else outside the roots stays `review`.
      verify: F12 with a registration is removed; an unregistered sibling
      with an unrelated name is kept.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **2.3 Removal is logged.** One journal line per removal: path, branch,
      tip SHA, merge evidence. The tip SHA recreates the branch.
      verify: a removal run writes N lines for N removals, each carrying a SHA
      that `git cat-file -e` resolves.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **2.4 Never in an automatic path:** `--force`, `git clean -x`, the main
      worktree, a tree a live session is in.
      verify: `grep -qE "worktree remove.*(--force| -f)" src/scripts/worktree_cleanup_check.ts` -> 1
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **2.5 Correct the checker's self-description.** The header and the two
      plan strings that call this removal Hard-Floor (W2) are rewritten to the
      scoped rule D1 records: proven-merged, clean, not live is housekeeping;
      anything else stays a decision.
      verify: `grep -c "Hard-Floor" src/scripts/worktree_cleanup_check.ts` -> /^[01]$/
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->

## Phase 3 — Triggers: at the merge, and once a day

- [x] **3.1 At the merge.** `/pr:merge`, after a successful merge, runs the
      Phase 2 removal for exactly that PR's worktree with the 24 h delay
      waived (D4); if the session is inside it, the session leaves first.
      verify: a merge fixture leaves no worktree for the merged branch.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **3.2 After a merge someone else did.** The retro's daily probe learns a
      pushed PR merged; the same result enqueues that worktree for 2.1.
      verify: a fixture where the PR is merged outside the session removes the
      tree on the next daily run.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **3.3 Once a day, on the retro's terms.** On the first session of the
      day (`probe_throttle`, riding the existing `session_start` block — no
      new concern), a synchronous pass bounded by a three-second subprocess
      deadline classifies the worktrees from a rotating start, removes the
      proven set under `worktrees.cleanup: auto`, reports it under `notify`,
      and prints one line: "N removed, M need a decision". *Changed from
      "detached" by the council round of 2026-10-21 (D8): a process outliving
      the hook is harder to bound than a budgeted synchronous pass, which is
      the retro's own precedent.*
      verify: a test runs the pass under `notify`, `auto`, `off`, an
      already-stamped day and a spent budget, and a spent budget removes
      nothing.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **3.4 Lanes and night runs register what they create.** Every worktree
      the process-full lanes or `using-git-worktrees` create gets a registry
      line (`agent-config worktree:cleanup register`): path, branch,
      `created_by: agent-config`, `purpose`.
      verify: a lane fixture produces one registry line per worktree.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **3.5 The missing end state.** `finishing-a-development-branch` says:
      "PR opened → the worktree stays until merged; removal is scheduled by
      the daily run, not forgotten".
      verify: `grep -c "removal is scheduled" src/skills/finishing-a-development-branch/SKILL.md` -> /^1$/
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
## Phase 4 — Reach consumers, clear the backlog

- [x] **4.1 `/worktree cleanup` and `/worktree status` become
      consumer-visible** in the engineering pack, with the inventory, the plan
      and `--apply`, which runs Phase 2 on the safe set after one
      confirmation.
      verify: both command files read `visibility: advanced` and the skill's two
      `node_modules/…` invocations are replaced by the global entry point.
      *`advanced`, not `visible`: `internal` is what kept the cluster from consumers (the installer projects every non-internal command), and `visible` is the Tier-0 daily-driver set, whose first-week-need criterion this cluster does not meet.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **4.2 Settings key** `worktrees.cleanup: auto | notify | off`, class
      C `consent`, default `notify` for every install (D8: installation alone
      is not consent to delete). This governs removal only; ADR-229's creation
      rule is untouched.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **4.3 First run on a real estate.** Run the inventory on this checkout
      and on every repository the session register knows, before and after
      `--apply`, and commit the counts as an evidence artifact.
      verify: the artifact under `agents/evidence/analysis/` records before,
      removed and remaining-with-reason per repository.
      *Executed 2026-10-21: 71 registered → 17 removed (all `merged-pr`, zero refused) → 54, each remaining with its reason; `agents/evidence/analysis/worktree-estate-cleanup-2026-10-21.md`.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **4.4 Retire the stub.** `stubs/road-to-worktree-lifecycle.md` moved to
      `skipped/` in the change that added this file; its six-verb cluster
      stays rejected.
      verify: `test -f agents/roadmaps/skipped/road-to-worktree-lifecycle.md` -> 0

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | destructive-owned | owner | Removing a worktree that is proven merged, clean, holds no local-only ignored file and has no live session is housekeeping and runs automatically; every other removal stays a listed decision | owner, 2026-10-21, in the source transcript: the worktree is to be cleaned up "at the latest after the merge … checked regularly and cleaned up, automatically where possible" (translated); the safety conditions are the transcript's own ("protect active sessions … unsaved changes and unintegrated commits", translated) plus W5 | a removal loses a file a user reports as needed |
| D2 | reversible-technical | evidence | Sibling worktrees are eligible by registration or by `<repo>-*` name plus merge evidence, never by location alone | W4: 47 of 73 trees here are siblings; excluding them leaves the owner's problem unsolved | an unregistered sibling turns out to belong to another tool |
| D3 | destructive-owned | agent | Local branches are not deleted automatically; the daily line lists them with the one `git branch -D` command | W8 classes `-d` and `-D` as the same WARN op, so the supplied plan's split has no footing; the owner's directive names worktrees, not branches | `road-to-typed-grants-that-persist` lands a scoped grant |
| D4 | reversible-technical | agent | 24 h delay after merge on the daily path; none on the `/pr:merge` path where the session itself merged | a revert or follow-up can reuse the tree for a day; the session that merged has nothing left to do in it | a follow-up is reported lost to an early removal |
| D5 | deterministic | agent | One `gh pr list` per repository per day, not a per-PR read | 1.3; the retro's per-PR shape scales with the estate | the host rate-limits list calls |
| D6 | reversible-technical | council:agents/evidence/council/advisories-worktree-run-design-20261021.md | The built-in regenerable set holds only paths never hand-edited (`node_modules`, tool caches, `.DS_Store`); everything else must be declared generated by the repository's own `.gitignore` comment | both seats asked for a conservative set; one would allow `dist/` and `vendor/`, the other an empty default — the stricter reading is taken, because a patched `vendor/` or a kept `dist/` artefact is exactly what W5 loses | a repository reports a tree kept for a path that is plainly regenerable and carries no comment |
| D7 | reversible-technical | agent | The git-dir mtime stays as a liveness fallback behind the session register | a session the register cannot see — another host, a plain terminal — would otherwise read as absent while it holds the tree; removing a tree under a running session is the costlier error | every host that runs sessions here writes the register |
| D8 | destructive-owned | council:agents/evidence/council/advisories-worktree-run-design-20261021.md | The daily pass is synchronous and budgeted on the existing `session_start` handler, declared as an authority expansion; `worktrees.cleanup` ships `notify` everywhere and only the user sets `auto` (ADR-295) | council 2026-10-21 Q1 and Q2, 2/2: deletion from a session start is acting, a user-owned key can authorise it, installation alone does not | a removal under `auto` loses something a user reports as needed |

## What this roadmap deliberately does not do

- It does not create worktrees; ADR-229 stands.
- It does not run a daemon; a daily stamp and the merge event suffice.
- It does not add a command verb; the `/worktree` cluster exists.
- It does not treat age or a deleted remote branch as proof of merge.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A local-only file is lost with a removed tree | implementation | W5: git removes ignored files from a clean worktree. | 1.5 inventories ignored paths and keeps any tree holding one outside the regenerable list; F11 is a fixture. | Phase 1 — Know what "merged" and "safe to lose" mean |
| 2 | A squash-merged branch with a later local commit is removed | implementation | The PR head matches an older tip. | 1.2 requires tip == PR head; F4 stays `review`. | Phase 1 — Know what "merged" and "safe to lose" mean |
| 3 | The daily run slows session start | product | Inventory over dozens of trees on the start path. | 3.3 runs detached; the hook reads one file. | Phase 3 — Triggers: at the merge, and once a day |
| 4 | Sibling directories of another tool are removed | implementation | `../<repo>-*` is a naming guess. | 2.2 also requires merge evidence; unregistered and unrelated names stay `review`. | Phase 2 — Remove what is provably done |

## Acceptance Criteria

- [x] **AC-1** F1, F2, F3 and F12 (registered) are removed by the daily path;
      F4, F5, F6, F7, F9, F11 are kept and each line names its reason; F10
      removes only via `merged-equivalent`.
- [x] **AC-2** On this checkout, the committed 4.3 artifact shows zero
      worktrees that are merged, clean, not live and older than 24 h after the
      first daily run, and every remaining one with a reason.
- [x] **AC-3** No automatic path passes `--force` (2.4's check).
- [ ] **AC-4** `task ci` green.

## Provenance

Source-derived under template rule 19; the source is not named here per
`source-confidentiality`; links are `ENC1`-encrypted in the round's intake note.

| Proposed | Verdict | Why |
|---|---|---|
| Squash-aware merge evidence | KEEP | W1 reproduced. |
| Automatic removal of the proven set | KEEP | Owner directive (D1); W5 added a gate the plans lacked. |
| Trigger at merge, daily sweep | KEEP | W3. |
| Consumer-visible `/worktree cleanup` | KEEP | W7. |
| Local branch deletion under a grant | CHANGED | W8 — listed, not automatic (D3). |
| Reuse the retro's PR batch | CHANGED | The retro reads per PR; a list call is new code (D5). |
| Worktree registry with lease and heartbeat, per-process PIDs | CHANGED | The session register already carries heartbeats; 3.4 adds a registry line, not a second lease store. |
| Cross-host (remote server) worktree adapter | CUT | No remote worktree exists in this tree to adapt; revisit when one does. |
| Backup / patch export of dirty trees | CUT | Dirty trees are never removed, so nothing needs exporting. |
| Disk-pressure metrics and a UI | CUT | No measured need; the daily line carries the count. |

## Notes — how this file was derived

Three extraction passes over the transcript and the three plans, converged at
pass 2 (pass 2 added W4, W5, W6, W8 from execution). W1 and W5 were reproduced
in scratch repositories; W4 was counted on this checkout. The owner's "~250"
is not this checkout's count (73); 4.3 measures every repository the register
knows, which is where the difference will show.
