---
complexity: lightweight
status: ready
---

# Road to one answer for "where am I"

**Goal.** Give the tree a single resolver for workspace identity — repo root,
main worktree, current worktree, branch, PR base — and put the worktree
inventory on top of it, so the recurring "misclassifies from inside a worktree"
defect class has one place to be fixed instead of eight.

**Source:** `agents/tmp.old/feedback-12.0.0.txt`, raised as a P0 by two of its
five passes. Triage:
`agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md`.

## Context

Measured on this branch:

- **8** call sites run `git rev-parse --show-toplevel` themselves, spread over
  **6** files (`update_roadmap_progress.ts`, `archive_completed_roadmaps.ts`,
  `roadmap_gates.ts`, `evidence_report.ts`, `lint_plan_risk_register.ts`,
  `migration_status.ts`).
- Exactly **one** exported `repoRoot()` exists, and it lives in
  `src/scripts/migration_status.ts:160` — a report script, which is why nothing
  imports it.
- A worktree-aware primitive already exists and is the right foundation:
  `src/scripts/_lib/git_common_dir.ts` exports `git_dir`, `current_branch` and
  `git_common_dir`, with the inherited-`GIT_DIR` hazard documented in its own
  header. It has **4** consumers and no notion of repo root, main worktree, or
  PR base.
- `git worktree list` currently reports **306** entries. Age-based cleanup was
  measured against roughly the same population and addressed two of them.

The defect class this produces is already in the release history: the 12.0.0
span carries `fix(worktrees): the inventory misclassifies from inside a worktree,
totally` and `fix(worktrees): judge location against the main worktree, and
teach the two missing conditions`. Both are the same bug wearing different
call sites.

This roadmap **extends the existing primitive**. It does not add a subsystem —
the reviews that raised it also ask, in the same breath, for no new platforms.

## Non-goals

- Deleting worktrees. Bulk deletion is a Hard-Floor action; everything here is
  report-only, and the disposal question is a blocker, not a step.
- A session/claim redesign. `session_register` keeps its semantics; it becomes
  a consumer of the identity resolver rather than a co-owner of the question.
- Any change to how branches or PRs are created.

## Phase 1 — Census the question and its wrong answers

- [ ] List every site that answers a workspace-identity question for itself
      (repo root, main worktree, current worktree, branch, PR base) and record
      which primitive each uses, in
      `agents/evidence/analysis/workspace-identity-census.md`.
      *verify:* the file has one row per call site with a `file:line`.
- [ ] For each of the two shipped worktree misclassification fixes in the
      12.0.0 span, record which identity question was answered wrongly and by
      which primitive. A third instance found in the census counts as a row.
      *verify:* the census names the primitive per defect.
- [ ] State which of the five identity fields `git_common_dir.ts` already
      answers correctly under an inherited `GIT_DIR`, and which it does not.
      *verify:* the census carries a five-row support table.

## Phase 2 — One resolver, in the module that already owns the hazard

- [ ] Extend `src/scripts/_lib/git_common_dir.ts` with a `workspaceIdentity()`
      returning repo root, main worktree, current worktree, branch and PR base,
      each field carrying whether it was resolved or unresolvable — never a
      silently wrong default.
      *verify:* a test asserts every field is either a value or an explicit
      unresolved marker, from inside a worktree and from the main checkout.
- [ ] Migrate the census's call sites to it, one commit per file, leaving
      behaviour identical where the site was already correct.
      *verify:* the census file records, per row, migrated or deliberately not,
      with a reason for each not.
- [ ] Pin the two shipped misclassification defects as regression tests against
      the new resolver.
      *verify:* both tests fail against the pre-migration primitive and pass
      after.

## Phase 3 — Read the state, do not act on it

- [ ] Add a read-only `workspace doctor` report: repo root, main worktree,
      current worktree, branch, PR base, session claim, conflicting session
      records, stale records, path containment — every field with its
      provenance, in the shape `routing:doctor` already uses.
      *verify:* the command exits 0 in a clean checkout and in a worktree, and
      its output names the provenance of each field.
- [ ] Add a worktree pressure read to the same report: total registered,
      how many are fully merged into the trunk, how many carry commits that are
      not, how many have a live session record.
      *verify:* the counts sum to the `git worktree list` total.
- [~] Propose a disposal policy from the pressure read (merged and
      session-free is eligible; unmerged is preserved). Deferred behind the
      blocker below.

## Blockers

### blocker: worktree-disposal-policy
- **Status:** open
- **Owner:** maintainer
- **Question:** what may be disposed of automatically, if anything? The pressure
  read makes the population legible for the first time, but every disposal is a
  bulk deletion and therefore Hard-Floor. The plausible answers range from
  "nothing, ever — the report is the whole deliverable" to "merged, commit-free
  and session-free entries are proposed for deletion in one confirmable batch".
- **Resolved when:** the maintainer records which of those the policy is.
- **Blocks:** step 3.3 only. Phases 1 and 2 and the read in 3.1–3.2 proceed
  either way.
- **What to do:** pick exactly one — (a) report-only forever: the pressure read
  is the whole deliverable, and step 3.3 is marked `[-]` cancelled; or
  (b) propose a disposal batch from the read, listing merged, commit-free and
  session-free entries for one confirmable deletion under the Hard Floor.
  Mutually exclusive; (a) needs no further work, (b) reopens 3.3 with the tier
  boundary written into it.

## Acceptance criteria

- [ ] Every census row is either migrated to the shared resolver or carries a
      written reason it is not.
- [ ] Both shipped worktree misclassification defects have a regression test
      that fails against the pre-migration primitive.
- [ ] `workspace doctor` reports the same repo root and main worktree from
      inside a worktree as from the main checkout, and says so under an
      inherited `GIT_DIR`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The migration silently changes a gate's scope | implementation | Several call sites are gate scripts that resolve a root and then scan it; a resolver that returns a different root turns a green gate red or, worse, makes it scan nothing and exit green | Phase 2 migrates one file per commit and the census records behaviour-identical per row, so a scope change is visible in a single diff rather than buried in a sweep | Phase 2 — One resolver, in the module that already owns the hazard |
| 2 | A new field is added that nothing consumes | product | `prBase` and `sessionId` are the two fields most likely to be declared because the review named them rather than because a call site needs them, which is the metadata-without-a-consumer failure this package has already recorded twice | Phase 1 derives the field list from the census rather than from the review, and a field with zero census rows is not added | Phase 1 — Census the question and its wrong answers |
| 3 | The pressure read becomes a disposal path by accident | product | A report that classifies entries as eligible is one small step from a command that removes them, and that step crosses a Hard Floor | 3.3 is `[~]` behind a maintainer blocker whose own question names "nothing, ever" as a legitimate answer, and the Non-goals section states deletion is out of scope | Phase 3 — Read the state, do not act on it |
| 4 | The inherited-`GIT_DIR` hazard is re-introduced | implementation | The existing module documents that hooks export `GIT_DIR` and that discovery must not trust it; a new function added beside it can easily forget, and the failure is silent and environment-dependent | The resolver lands in that same module rather than a new one, so the hazard note is adjacent to the code, and the acceptance criteria require the inherited-`GIT_DIR` case to be asserted | Phase 2 — One resolver, in the module that already owns the hazard |
