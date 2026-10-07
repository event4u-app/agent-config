---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
depends: [road-to-a-git-convention-that-reaches-every-checkout]
estate_offset_exempt: "Third of three receivers for inbox round inbox-2026-10-f. PR #2235 introduces a rebase update strategy whose stop and lease resolve through @{u}, which is the base for a branch pushed without -u, and which has no snapshot, no equivalence proof and no merge-commit check; no active roadmap owns the rebase path, and branch-update.md does not exist on main, so nothing can be offset against it."
relates:
  - slug: road-to-a-git-convention-that-reaches-every-checkout
    relation: depends
    note: Every step reads the strategy through that file's reader (its 1.1); Phase 1 here shares its release-ordering constraint.
  - slug: road-to-one-owner-for-the-ticket-and-the-subject
    relation: disjoint
    note: Sibling from the same round; no shared surface.
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: Owns whether a rebase of a pushed branch needs a question and what replaces the removed gate. Step 3.5 hands it two measured counts and changes nothing it owns.
  - slug: road-to-merge-surface-zero
    relation: disjoint
    note: Parked in later/. Owns a merge queue for this repository; the blocker here decides only what /pr:merge does without one.
---
# Road to a rebase that leaves a way back

> **Source:** `agents/tmp.old/inbox-2026-10-f/` — the round on pull request #2235
> described in `road-to-a-git-convention-that-reaches-every-checkout`. Anchors
> re-read at the pull request head `2333b93d6` on 2026-10-07; git semantics read
> from the local manual pages. "Measured" marks a reading the proposals ran.

## Goal

Under `git.update_strategy: rebase`, a branch update rewrites the ref it actually
publishes, stops before anything it cannot carry over, leaves a private way back,
reports whether the result is mechanically equivalent, and pushes with an
explicit expected value; what it breaks outside the branch — the completion
review, the conformance count, a merge run — is decided, not discovered.

## Prerequisites

- `road-to-a-git-convention-that-reaches-every-checkout` step 1.1 has merged:
  the strategy is read through the fail-closed reader.
- Phase 1 here lands before a release carries `rebase`: `branch-update.md` does
  not exist at the merge base `e3c30fc9d`, so its `@{u}` rows are exposure #2235
  introduces.

## Context

- **`@{u}` is not the published branch.** It occurs 18 times in three files —
  among them the stop, the lease and the squash snapshot
  (`src/skills/git-workflow/SKILL.md:173`, `:182`, `:207`;
  `references/branch-update.md:12`; `src/domains/git/pr/create/command.md:148-150`)
  — the rest are post-push and divergence checks (`SKILL.md:210`, `:219`,
  `:231-281`, `:324`). Measured: for a branch cut from `origin/main` and pushed
  without `-u`, `@{u}` is the base, so the stop fires exactly when the branch is
  behind and the lease carries the base's sha. Replacing it with
  `origin/<branch>` is wrong too: `branch.<name>.pushRemote`,
  `remote.pushDefault`, a fork head and a triangular workflow publish elsewhere.
  `src/` has no reference to `@{push}`, `pushRemote` or `pushDefault`, and
  `sync_pr_branch.ts:402` hard-codes `ls-remote … origin`. Treating "no
  `origin/<branch>`" as "never pushed" skips the stop for exactly those cases.
- **The lease is in the strong form, written short.** Measured: an explicit
  `<branch>:<sha>` lease rejected a collaborator's push; the bare form after a
  fetch overwrote it. The skill writes the short form
  (`SKILL.md:208`, `:262`, `:287`).
- **No snapshot, no proof, no merge-commit check.** The `rebase` row
  (`branch-update.md:12`) names none of them. The squash snapshot uses two
  lightweight tags (`SKILL.md:172-173`, `:246-247`, `:328`), which
  `git push --tags` publishes and `git_command_classifier.ts:230` counts as a tag
  push. A plain rebase drops merge commits, and the default strategy
  (`branch-update.md:11`) and `/prepare-for-review`
  (`src/domains/engineering-base/prepare-for-review/command.md:72-73`) put them
  there, so every branch switched from `merge` to `rebase` carries some.
- **`git range-diff` is not a proof.** Its manual states under OUTPUT STABILITY
  that the output is not intended to be machine-readable. `git patch-id --stable`
  is stable per its manual; a conflict resolution changes it, which makes a
  mismatch "needs review", never "wrong".
- **The repository's own `post-rewrite` hook fires on every rebase.**
  `src/scripts/install-hooks.sh:496` installs one for this checkout only
  (`:2`, `package.json:103`); no consumer has it, so it cannot carry an old→new
  map.
- **Rebasing a stacked child "parent first" is unsafe without `--onto`.** After
  the parent is rewritten, `git rebase origin/<parent>` on the child replays the
  parent's old commits, and an unasked `--onto` reseat needs a question
  (`SKILL.md:304-309`). `/prepare-for-review` already reports a chain and defers
  (`prepare-for-review/command.md:76-84`).
- **What a rebase breaks outside the branch.** Measured: a branch with a `fixed`
  review row passes the completion-review gate; after a plain rebase the same
  repository fails `fix-before-artifact` and a transport clone fails
  `unresolvable-fix-ref` (`src/scripts/check_completion_review.ts:1067`,
  `:1076`, `:1102`). An asked-for rebase plus the required lease push counts one
  `git-authorization` violation for the push
  (`src/scripts/hooks/git_command_classifier.ts:114`,
  `src/scripts/conformance_scan.ts:822`); an unasked `git rebase` alone counts
  none (`git_command_classifier.ts:153`). A rising count is ADR-254's reopen
  trigger.
- **A target behind its own default** makes `sync_pr_branch` exit 3 on every
  run with the ordinary behind message (`sync_pr_branch.ts:941-949`); under
  `rebase` the first merge of a `/pr:merge all` run leaves every other pull
  request `blocked-external` (`src/domains/git/pr/merge/command.md:153-156`).

## Phase 1 — The rebase addresses the ref it publishes

- [x] **1.1 The published ref is resolved, never assumed.** The skill, the
      reference and `/create-pr` resolve the publish target through
      `git rev-parse --symbolic-full-name @{push}` and, for a pull request, its
      head repository, after a fetch; they pin its sha once, test that sha for
      ancestry in `HEAD` as the stop, and reuse the same literal as the lease.
      An unresolved target means no rewrite, never "never pushed"; only a
      resolved target with no remote ref means never pushed.
      verify: `test -z "$(git grep -l -F -e '@{u}..HEAD' -e 'HEAD...@{u}' -e 'tag-before-rewrite' -- src/skills/git-workflow/references src/domains/git/pr/create)" && git grep -q -F '@{push}' -- src/skills/git-workflow/references/branch-update.md` -> 0
      Positive control: the first `git grep` prints two files at `2333b93d6`.
- [x] **1.2 The lease is fully qualified and its race is a test.** The push is
      `git push --force-with-lease=refs/heads/<b>:<sha> <remote> HEAD:refs/heads/<b>`
      with remote and branch from 1.1; a rejected lease is a stop — refetch and
      report, never a bare `--force-with-lease`, never `--force`. The post-push
      check reads the resolved ref back. A test with a real bare remote runs the
      sequence while a second clone pushes in between, and repeats it with
      `pushRemote`, `remote.pushDefault` and a fork remote.
      verify: `test -f tests/scripts/rebase_lease_race.test.ts && npx vitest run tests/scripts/rebase_lease_race.test.ts` -> 0

## Phase 2 — A rewrite with a way back and an equivalence report

- [x] **2.1 Three stops before the rebase.** The `rebase` row stops when the
      topic range carries a merge commit
      (`git rev-list --merges origin/<base>..HEAD` is non-empty), when the
      working tree is dirty, and on the foreign-commit rule
      `branch-update.md:23-25` already states. `--rebase-merges` is named as a
      separate operation the user asks for, never a silent fallback.
      verify: `grep -q 'rev-list --merges' src/skills/git-workflow/references/branch-update.md` -> 0
- [x] **2.2 A private recovery ref replaces the tags.** Before the rewrite the
      old head is kept at `refs/agent-config/rewrites/<tx>/before` via
      `git update-ref`, outside `refs/tags/`, so `git push --tags` cannot publish
      it. The ref is removed after the post-push check passes and kept, with the
      one recovery command printed, when anything fails. The squash snapshot in
      `SKILL.md:166-177` uses the same ref.
      verify: `test -z "$(git grep -l -F 'git tag ' -- src/skills/git-workflow)" && git grep -q -F 'refs/agent-config/rewrites/' -- src/skills/git-workflow/SKILL.md src/skills/git-workflow/references/branch-update.md` -> 0
- [x] **2.3 Equivalence is reported from stable data.** After the rebase the
      reference compares the stable patch ids of the old and the new range: equal
      sets mean "mechanically equivalent"; anything else means "needs review"
      and names the commits, never inferring a pair from subject or position.
      Tree equality is checked whenever the old head already contained the new
      base. `git range-diff` output is shown to the human and never parsed.
      `merge-conflicts/SKILL.md:228-233` keeps one sentence and the link.
      verify: `test -f tests/scripts/rebase_equivalence.test.ts && npx vitest run tests/scripts/rebase_equivalence.test.ts && grep -q 'patch-id --stable' src/skills/git-workflow/references/branch-update.md` -> 0
- [x] **2.4 A branch with known descendants is not rebased alone.** When
      `/prepare-for-review`'s pull-request bases show another branch built on
      this one, the `rebase` row refuses and reports the chain; restacking is
      out of scope (see below). Nothing is inferred from branch names.
      verify: `grep -q 'descendant' src/skills/git-workflow/references/branch-update.md` -> 0

## Phase 3 — What a rebase breaks outside the branch

- [x] **3.1 A target behind its own default is told apart.** `sync_pr_branch`
      refuses that case with the reason code `TARGET_POLICY_STALE` instead of the
      ordinary behind message, and `/fix:ci` and `/roadmap:next` name it.
      verify: `test -f tests/scripts/sync_pr_branch_target_behind_default.test.ts && npx vitest run tests/scripts/sync_pr_branch_target_behind_default.test.ts && git grep -q TARGET_POLICY_STALE -- src/domains/engineering-base/fix/ci/command.md` -> 0
- [ ] **3.2 `/pr:merge` treats a behind pull request as the owner decided.**
      § 2 and § 6 merge a green, conflict-free pull request that is behind its
      base when the forge does not require an up-to-date branch, and say so in
      the summary (D7); where the forge requires one, the pull request stays
      blocked and the summary names that setting. A merge run never rebases a
      pull request it did not author, and its summary lists each pull request
      with its state and reason.
      verify: `grep -q 'up-to-date branch' src/domains/git/pr/merge/command.md` -> 0
- [ ] **3.3 The gate's verdicts after a rebase become a test.**
      `tests/scripts/check_completion_review_after_rebase.test.ts` records the
      three measured readings: pass before the rebase, `fix-before-artifact`
      after it, `unresolvable-fix-ref` in a `git clone --no-local` of it.
      verify: `test -f tests/scripts/check_completion_review_after_rebase.test.ts && npx vitest run tests/scripts/check_completion_review_after_rebase.test.ts` -> 0
- [ ] **3.4 The council decides what a rebase does to cited commits, and it is
      built.** The first action runs the council on three options: (a) the
      documented path re-points the `fixed` refs of the branch's own findings
      file through commits whose stable patch ids match, in a commit of its own;
      (b) under a strategy other than `merge` the completion review binds after
      the last rebase, stated in `docs/contracts/plan-review-gates.md` § 2.5;
      (c) only a conflict-free rebase whose patch ids all match may re-point,
      anything else re-binds. The gate's strictness is unchanged in every option.
      The verdict becomes a Decisions row with its council record and is then
      built with a test that rebases a branch with a `fixed` row.
      verify: `test -f tests/scripts/check_completion_review_rebase_remedy.test.ts && npx vitest run tests/scripts/check_completion_review_rebase_remedy.test.ts tests/scripts/check_completion_review.test.ts` -> 0
- [ ] **3.5 The scan's two counts are recorded and handed over.** A test fixes
      them: one violation for an asked-for rebase with its lease push, none for
      an unasked rebase. An evidence note (typed `analysis`) states both for
      `road-to-typed-grants-that-persist`. The classifier is unchanged: what
      replaces the gate is owner-reserved under ADR-254.
      verify: `test -s agents/evidence/analysis/rebase-lease-push-conformance-count.md && npx vitest run tests/scripts/conformance_scan_paired_lease_push.test.ts` -> 0

## What this roadmap deliberately does not do

- No change to who may authorise a rebase or a force push, and none to the
  classifier; a paired lease push stays counted as it is today.
- No automatic restacking of a branch chain and no `--onto` recipe. A stack
  engine needs an explicit parent graph and an undo, which the tree does not
  model.
- No old→new map from the `post-rewrite` hook: it exists in this checkout only.
- No merge queue, no forge-side rebase and no strategy derived from the forge.
- No edit to #2235's review file.

## Acceptance Criteria

- [ ] AC-1 — No stop, snapshot or lease in the git surfaces resolves through
      `@{u}`, and the lease race passes with `pushRemote`, `remote.pushDefault`
      and a fork remote.
- [ ] AC-2 — A topic range with a merge commit, or a dirty tree, stops the
      rebase before anything is rewritten.
- [ ] AC-3 — Every rewrite leaves a recovery ref that `git push --tags` does not
      publish, and the report says "mechanically equivalent" or "needs review"
      from patch ids, never from `range-diff` text.
- [ ] AC-4 — What a rebase does to the review gate is a recorded decision with a
      test, and the scan's counts are a recorded measurement.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The lease keeps its explicit expected-sha form, fully qualified | Fixture run: it rejected a collaborator's push; the bare form after a fetch overwrote one; `git-push` documents the forms without an expected value as experimental | — |
| D2 | deterministic | evidence | The publish target comes from `@{push}` or the pull request's head repository | `@{u}` is the base for a branch pushed without `-u`; `origin/<branch>` misses pushRemote, pushDefault and forks | — |
| D3 | deterministic | evidence | Equivalence is reported from stable patch ids; `range-diff` is shown, never parsed | `git-range-diff` OUTPUT STABILITY; `git-patch-id --stable` | — |
| D4 | reversible-technical | agent | The recovery ref lives under `refs/agent-config/rewrites/` | Lightweight tags leak through `git push --tags` and count as a tag push | A host needs the snapshot visible to a non-git tool |
| D5 | reversible-technical | agent | A branch with known descendants is refused, not restacked | Parent-first without `--onto` replays rewritten commits; `--onto` unasked needs a question | The tree gains an explicit parent graph with an undo |
| D7 | product-owned | owner | Under a strategy other than `merge`, `/pr:merge` merges a green, conflict-free but behind pull request when the forge does not require an up-to-date branch, and says so in the summary | Owner answer to blocker `behind-pr-under-non-merge`, 2026-10-07; matches waiver `arr-2026-09-10-strict-status-checks` | A merge of a behind pull request breaks the base |
| D6 | deterministic | evidence | "merge", "push" and "rebase" in this file name the procedure being specified, never an operation this roadmap authorises; every real rewrite or push during execution stays governed by `git-history-discipline` and is asked per turn | `closure_scan` classifies the word `merge` as a typed operation on every line that mentions it | — |

## Blockers

### blocker: behind-pr-under-non-merge
- **Status:** resolved — owner chose (a) on 2026-10-07; recorded as D7
- **Ownership:** product-owned
- **Owner:** user
- **Blocks:** step 3.2 — `/pr:merge` treats a behind pull request as the owner decided
- **Question:** Under a strategy other than `merge`, may `/pr:merge` merge a
  green, conflict-free pull request that is behind its base when the forge does
  not require an up-to-date branch?
- **Recommendation:** (a). It matches the waiver
  `arr-2026-09-10-strict-status-checks`: three green branches should merge
  without sequential rebases. The case against it is #2235's own sentence at
  `pr/merge/command.md:154-156`: such a pull request's checks never ran against
  the current base.
- **If you do nothing:** under `rebase`, a `/pr:merge all` run merges one pull
  request and leaves every other one `blocked-external`.
- **What to do:** pick exactly one — (a) merge it and say so in the summary;
  (b) keep it blocked until its author updates the branch. The forge's current
  setting is read with
  `gh api repos/{owner}/{repo}/branches/main/protection --jq .required_status_checks.strict`.
- **Resolved when:** the answer is a row in this file's Decisions table with
  `resolved by` set to `owner`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The `@{u}` rows ship in a release | product | #2235 is released before Phase 1 lands and a `rebase` team skips the stop for a branch pushed without `-u`. | The prerequisite places Phase 1 before a release carries `rebase`. | Phase 1 — The rebase addresses the ref it publishes |
| 2 | `@{push}` is unset on an old or unusual configuration | implementation | Without a push default, `@{push}` does not resolve. | 1.1 makes an unresolved target a stop, never a guess. | Phase 1 — The rebase addresses the ref it publishes |
| 3 | Patch-id equivalence reads as approval | product | "Mechanically equivalent" could be read as "reviewed". | 2.3 reports, never re-binds; re-binding is 3.4's council decision. | Phase 2 — A rewrite with a way back and an equivalence report |
| 4 | Recovery refs accumulate | implementation | A failed run keeps its ref under `refs/agent-config/rewrites/`. | 2.2 removes the ref after a passing post-push check and prints the one command that removes a kept one. | Phase 2 — A rewrite with a way back and an equivalence report |
| 5 | The remedy for cited commits edits evidence | product | Option (a) of 3.4 rewrites refs inside a review record. | It is confined to the branch's own findings file and to patch-id matches, in a commit of its own; (b) edits nothing. | Phase 3 — What a rebase breaks outside the branch |
