<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
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

- [x] List every site that answers a workspace-identity question for itself
      (repo root, main worktree, current worktree, branch, PR base) and record
      which primitive each uses, in
      `agents/evidence/analysis/workspace-identity-census.md`.
      *verify:* the file has one row per call site with a `file:line`.
      **21 rows** across five questions: 8 repo-root (6 files, premise
      confirmed), 3 main-worktree, 3 current-worktree, 5 branch, 5 PR-base.
- [x] For each of the two shipped worktree misclassification fixes in the
      12.0.0 span, record which identity question was answered wrongly and by
      which primitive. A third instance found in the census counts as a row.
      *verify:* the census names the primitive per defect.
      Both are the **main worktree** question at one call site
      (`worktree_cleanup_check.ts` `isStandardLocation`), diagnosed in
      `52d7fe1b8` and repaired in `5cf7450da`. **No third instance** — recorded
      as zero rather than left unstated.
- [x] State which of the five identity fields `git_common_dir.ts` already
      answers correctly under an inherited `GIT_DIR`, and which it does not.
      *verify:* the census carries a five-row support table.
      **1 of 5** — branch only, and correct precisely because it reads
      `<git-dir>/HEAD` with `fs` instead of spawning `git`.

## Phase 2 — One resolver, in the module that already owns the hazard

- [x] Extend `src/scripts/_lib/git_common_dir.ts` with a `workspaceIdentity()`
      returning repo root, main worktree, current worktree, branch and PR base,
      each field carrying whether it was resolved or unresolvable — never a
      silently wrong default.
      *verify:* a test asserts every field is either a value or an explicit
      unresolved marker, from inside a worktree and from the main checkout.
      `IdentityField` is a two-shape union, so a third shape is not
      expressible; totality asserted from the main checkout, from inside a
      worktree, and from outside any repository. **`sessionId` was not added** —
      zero census rows (Risk 2).
- [x] Migrate the census's call sites to it, one commit per file, leaving
      behaviour identical where the site was already correct.
      *verify:* the census file records, per row, migrated or deliberately not,
      with a reason for each not.
      **7 migrated, 11 deliberately not, 3 n/a** of 21 rows. The largest "not"
      is structural and is the run's main finding: `src/agent-src/scripts/` is
      projected to `dist/agent-src/scripts/`, which carries no
      `_lib/git_common_dir.ts`, so the three consumer-facing sites cannot
      import the resolver at all (census § 9).
- [x] Pin the two shipped misclassification defects as regression tests against
      the new resolver.
      *verify:* both tests fail against the pre-migration primitive and pass
      after.
      The pin carries its own control: the same test asserts
      `rev-parse --show-toplevel` **does** differ between the two locations, so
      an implementation built on the pre-migration primitive fails it by
      construction rather than the pin passing vacuously.

## Phase 3 — Read the state, do not act on it

- [x] Add a read-only `workspace doctor` report: repo root, main worktree,
      current worktree, branch, PR base, session claim, conflicting session
      records, stale records, path containment — every field with its
      provenance, in the shape `routing:doctor` already uses.
      *verify:* the command exits 0 in a clean checkout and in a worktree, and
      its output names the provenance of each field.
      `agent-config workspace:doctor` — exit 0 from the main checkout, from
      inside a worktree, and under an inherited `GIT_DIR`; the CLI-registry
      budget moved in the same change (97 → 98), per that record's contract.
- [x] Add a worktree pressure read to the same report: total registered,
      how many are fully merged into the trunk, how many carry commits that are
      not, how many have a live session record.
      *verify:* the counts sum to the `git worktree list` total.
      The three buckets **partition** the registered set and the report prints
      the sum against the total (live probe: 307 of 307 ✅). A fourth bucket for
      detached entries was added rather than folding them into "merged" — an
      unclassifiable entry must not be assumed merged. The live-session count
      overlaps every bucket, so it is reported *outside* the partition and the
      test asserts that separation.
- [-] Propose a disposal policy from the pressure read (merged and
      session-free is eligible; unmerged is preserved). **Cancelled** — the
      blocker resolved to option (a), report-only. See the blocker below for
      the resolution and its honest quorum caveat.

## Blockers

### blocker: worktree-disposal-policy
- **Status:** resolved
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

**Resolution 2026-08-15 — (a) report-only, and the quorum is stated honestly.**

Routed to the AI council with the live pressure read as evidence (307
registered · 298 merged · 7 unmerged · 2 unclassifiable · 2 with a live session).
The run came back **1 of 2 present — DEGRADED, which is not convergence**: the
openai seat failed with `model_unsupported_on_transport` (its pinned model is
refused by the CLI on a subscription account — a known, separately-tracked
defect, not a judgement about this question). Actual cost $0.0313.

So this is **one reasoned answer, not a two-member convergence**, and it is
recorded as such rather than dressed up as a quorum. What makes it enough to act
on is that it agrees with three independent sources that already existed:

1. **This roadmap's own text.** Non-goals: "Deleting worktrees … everything here
   is report-only". Risk 3: "the pressure read becomes a disposal path by
   accident". (b) is the risk the plan was written to avoid.
2. **The maintainer's own recorded conclusion in the 12.0.0 span.** Under the
   approved predicate the safe set was **2, not 181**; both were removed by name
   and a re-run reported safe 0 — "the approval is spent". The same commit found
   **275 of 304** worktrees with git activity inside 60 days and concluded that
   reclaiming disk means deciding about *recent* worktrees, "a policy call and it
   is not made here".
3. **The delta test in the blocker's own question 2.** (b) either reuses the
   predicate `worktree:cleanup` has already tested — redundant — or drops the age
   floor, which *is* the policy call source 2 deferred. Neither is a technical
   gap this roadmap can close.

The 298-merged figure does not reverse it: merged is not the same as
safe-to-delete (recently integrated, still referenced, under review), and it is
the 275-of-304 activity finding wearing a different number.

**What this does not decide.** Disposal is scoped out of *this* roadmap, not
ruled out forever — the answering member made that correction to its own
framing explicitly. If disk pressure becomes the binding constraint, it is a
separate roadmap carrying an explicit disposal policy, and the pressure read
shipped here is what makes that decision legible for the first time.

Reversing this costs one checkbox: flip 3.3 back to `[ ]` and reopen with the
tier boundary written in.

## Acceptance criteria

- [x] Every census row is either migrated to the shared resolver or carries a
      written reason it is not.
      21 rows: **7 migrated · 11 deliberately not · 3 n/a**, each with a reason
      (census § 8).
- [x] Both shipped worktree misclassification defects have a regression test
      that fails against the pre-migration primitive.
      `tests/scripts/workspace_identity.test.ts`, plus a control assertion that
      `rev-parse --show-toplevel` genuinely differs between the two locations —
      so the pin cannot pass vacuously.
- [x] `workspace doctor` reports the same repo root and main worktree from
      inside a worktree as from the main checkout, and says so under an
      inherited `GIT_DIR`.
      **Discharged with one correction to the criterion's own wording, stated
      rather than quietly worked around.** `mainWorktree` is identical from both
      locations and under an inherited `GIT_DIR` — verified by live probe and by
      test, and it is the invariant the criterion exists for. `repoRoot` is
      **not** identical between the two, and cannot be: `git rev-parse
      --show-toplevel` is defined as the top level of the *invoking* working
      tree, so inside a linked worktree it is the worktree's own root. That is
      also why the roadmap's Phase 2 lists repo root, main worktree and current
      worktree as three fields rather than one. What the criterion is really
      asking — "the answer does not change depending on where you stand" — holds
      for `mainWorktree`, and `currentWorktree` names which checkout you are in
      so the difference is legible instead of silent.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The migration silently changes a gate's scope | implementation | Several call sites are gate scripts that resolve a root and then scan it; a resolver that returns a different root turns a green gate red or, worse, makes it scan nothing and exit green | Phase 2 migrates one file per commit and the census records behaviour-identical per row, so a scope change is visible in a single diff rather than buried in a sweep | Phase 2 — One resolver, in the module that already owns the hazard |
| 2 | A new field is added that nothing consumes | product | `prBase` and `sessionId` are the two fields most likely to be declared because the review named them rather than because a call site needs them, which is the metadata-without-a-consumer failure this package has already recorded twice | Phase 1 derives the field list from the census rather than from the review, and a field with zero census rows is not added | Phase 1 — Census the question and its wrong answers |
| 3 | The pressure read becomes a disposal path by accident | product | A report that classifies entries as eligible is one small step from a command that removes them, and that step crosses a Hard Floor | 3.3 is `[~]` behind a maintainer blocker whose own question names "nothing, ever" as a legitimate answer, and the Non-goals section states deletion is out of scope | Phase 3 — Read the state, do not act on it |
| 4 | The inherited-`GIT_DIR` hazard is re-introduced | implementation | The existing module documents that hooks export `GIT_DIR` and that discovery must not trust it; a new function added beside it can easily forget, and the failure is silent and environment-dependent | The resolver lands in that same module rather than a new one, so the hazard note is adjacent to the code, and the acceptance criteria require the inherited-`GIT_DIR` case to be asserted | Phase 2 — One resolver, in the module that already owns the hazard |
