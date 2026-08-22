---
complexity: structural
status: ready
execution:
  mode: autonomous
---
# Road to generated artifacts out of the git index

> **Source:** a 50-session review run on 2026-08-22 over the transcripts under
> `~/.claude/projects/*agent-config*` (2026-08-18 → 2026-08-22, 550 user turns,
> 14 257 tool calls). Two of the maintainer's own asks converge on this
> roadmap's subject. DE: *"Wir haben oft Merge Konflikte … Viele der Konflikte
> kommen durch automatisch generierte Dateien … brauchen wir die zur Laufzeit?
> Oder für das Repo? … Oder nur für die CI? Und wenn nur dort, können wir sie
> nicht dann erst dort generieren?"* · EN: *"We often have merge conflicts …
> many of them come from automatically generated files … do we need them at
> runtime? For the repository? … Or only for CI? And if only there, can we not
> generate them there instead?"* — and, on the second ask, DE: *"fixe die
> verfickte ci dauerhaft. andauernd bricht momentan die ci."* · EN: *"fix the
> damn CI permanently, it keeps breaking right now."* Scope decided by AI council
> (2026-08-22, 2 seats + blind peer review, $0.099, `--prompt-mode design`):
> **option B, 2/2 convergent**, with the five conditions carried into Phases 1–4
> below. Both seats named the same hardest pushback independently — a re-add
> guard that ships on the PR branch is not authoritative — and the peer round
> added the transition-window gap that neither first-round answer covered.

## Goal

The three derived artifacts that have no runtime consumer —
`agents/roadmaps-progress.md`, `agents/roadmaps/archive/INDEX.md`,
`agents/roadmaps/archive/index.json` — are absent from the git index
(`agents/roadmaps/stubs/README.md` was the fourth candidate; Phase 1.4
established it is authored prose with no generator and dropped it), cannot be re-added by any pull request (including one
branched before this change, carrying no knowledge of it), and are covered in CI
by a contract that asserts three separate properties: **absence**,
**buildability from a clean checkout**, and **correctness of the generated
output**. The two ratchet baselines stay tracked, deliberately and on the
record. When this is finished, `git log --merges` over a subsequent window shows
those three paths gone from the conflict-resolution set, and `task ci` is green on
`main` — which it is not today.

## Context

**Measured 2026-08-22.** Over the last 120 merge commits, files touched in merge
commits — a proxy for conflict-resolution traffic — form a distribution with a
cliff after six entries:

| Path | merges of 120 | commits/60 d | consumer |
|---|---|---|---|
| `src/config/estate-count-budget.json` | 53 | 127 | read by `check_estate_count` (a gate) |
| `agents/roadmaps-progress.md` | 50 | 1055 | none |
| `agents/roadmaps/archive/index.json` | 49 | 86 | path-string only |
| `agents/roadmaps/archive/INDEX.md` | 49 | 86 | path-string only |
| `agents/roadmaps/stubs/README.md` | 32 | 78 | none found |
| `src/config/gate-violation-baselines.json` | 21 | 59 | read by gates |
| *next path down* | 6 | — | — |

CI over the last 300 runs fails at 6.0 % (18 runs). Of the six `Consistency`
failures sampled, **three are literally** `archive index out of date
(agents/roadmaps/archive/INDEX.md, agents/roadmaps/archive/index.json) — run
task build-archive-index`; the remaining three are other stale-derived-artifact
classes. Per PR, with roughly eight workflows, a 6 % per-run rate compounds to a
red PR being the normal case — which is what *"die halbe CI ist rot"* describes.

**The live regression this roadmap must also repair.** Commit `945502ea8`
(2026-08-21) untracked `agents/roadmaps-progress.md` and added
`/agents/roadmaps-progress.md` at `.gitignore:108`. `origin/main` at `c298a6aba`
(PR #1505) carries it **tracked again**: a branch created before the untrack
brought the file back through a merge. `task roadmap-progress-check` exits 1 on
the trunk right now. The untrack shipped without anything that could refuse a
re-add, so it regressed within a day — which is the precise failure mode Phase 2
exists to close before Phase 3 repeats the same move.

**Why the two ratchet baselines are out of scope, on the record.** ADR-241
(accepted 2026-08-21) establishes that their churn is not append-shaped — 39 of
43 sampled commits moved the baseline value — so `merge=union` cannot resolve
them. `sync_pr_branch.ts:110` states the other half: *"an untracked baseline is a
baseline no PR diff can be compared against, which deletes the ratchet."*
Untracking them is therefore not available either. They keep their `REMEASURED`
class and their conflicts; this roadmap does not reopen ADR-241.

**Prior art superseded.** A stub, `road-to-dashboard-untrack-cutover`, held the
dashboard half of this work with two open guards. This roadmap promotes it — the
documented un-stubbing path — and widens it to the sibling artifacts that share
the mechanism, so Phase 4.3 removes it rather than leaving it to describe work
that has landed. It is named without a link on purpose: the file is deleted in
this change, and a link would be a broken reference by the time anyone read it.

## Phase 1 — Establish the facts option B rests on

No path leaves the index in this phase. Both council seats refused B without
this evidence, and the openai seat's peer round argued for retention until it
exists; Phase 1 is what settles that dissent one way or the other.

- [x] **1.1 Prove the four paths have no content or presence consumer.**
      Grep the whole tree for each of the four literal paths, and classify every
      hit as *reads content*, *requires presence*, or *names the path only*.
      The two known automation hits must be shown to be the third kind:
      `sync_pr_branch.ts` lists them in a `GENERATED` array to choose
      "regenerate, never merge", and `ship_diff_volume_hook.ts` lists
      `archive/index.json` in `EXCLUDED` to keep it out of a volume count.
      Record the classification in `agents/evidence/analysis/`.
      verify: `agents/evidence/analysis/derived-artifact-consumers-2026-08.md`
      names every hit for all four paths and classifies each.
      **Result — two corrections, both material.** (a) The two automation hits
      are confirmed string-list only. (b) `archive_completed_roadmaps.ts:403`
      runs `git add -- agents/roadmaps-progress.md`, a real tracked-state
      dependency: probed 2026-08-22, `git add` on an ignored path exits 1, and
      `_run`'s code is discarded at the call site, so it is a silent no-op today
      and survived the 2026-08-21 untrack unnoticed. Repaired in 3.1. (c) A
      consumer-facing workflow template instructs the reader to commit the
      dashboard — a contract change, carried by 4.4.
- [x] **1.2 Prove nothing breaks with the three files absent.** Delete all four
      from the working tree of a clean checkout — do not commit — and run the
      gate set. This is the step the council added between "inspect the code"
      and "untrack", on the grounds that the dashboard regression proves code
      inspection alone can be wrong.
      verify: the run completes with no failure attributable to the missing
      files; any failure that appears is recorded with its cause.
      **Result — no hidden consumer.** With all three absent,
      `check_references`, `check_roadmap_trackable`, `lint_roadmap_complexity`,
      `lint_empty_roadmaps` and `check_no_roadmap_refs` all pass. Two gates go
      red and both were isolated by re-running with the files restored:
      `check_estate_count` fails identically either way (`active_roadmaps 6 → 7`
      — this roadmap's own +1, discharged by archiving in the same change), and
      `build_archive_index --check` passes with the files present and fails
      without, because its contract *is* the committed-copy comparison Phase 3.2
      replaces. Neither is a consumer.
- [x] **1.3 Prove each generator is buildable and deterministic from a clean
      checkout.** For each of the three generators, run it twice into separate
      temporary directories from a checkout with no pre-existing copy of its
      output, and byte-compare the two results. A non-deterministic generator is
      a stop condition for its own artifact, not for the phase.
      verify: two independent runs produce byte-identical output for each
      artifact, and the command needed is a single documented invocation with no
      undocumented local state.
      **Result — both deterministic**, measured 2026-08-22 by deleting the
      output and regenerating twice: `build_archive_index` →
      `483d30f0…` / `c98da496…` on both runs; `update_roadmap_progress` →
      `ffe17843…` on both runs. One trap worth recording: the first dashboard
      probe compared two *empty* hashes and reported green, because
      `taskfiles/content.yml` invokes the generator through
      `.augment/scripts/…`, a gitignored projection that `task sync` builds and
      a fresh worktree does not have. A probe that scans nothing exits green —
      the source path `src/agent-src/scripts/update_roadmap_progress` is the one
      that runs anywhere.
- [x] **1.4 Decide `agents/roadmaps/stubs/README.md` explicitly.** The
      council named this the canary, and it was right to: the file is **not a
      generated artifact at all.** No generator writes it — `grep -rn
      "stubs/README" --include='*.ts' src/` is empty — and
      `tests/scripts/sync_pr_branch.test.ts:112` asserts the repository's own
      conflict classifier already calls it `authored`. Its 32-of-120 merge share
      was real and its cause is already closed by `3793855b3` (2026-08-21,
      *"delete the hand-maintained stub index, the last authored hotspot"*): 3
      non-merge commits since, against 78 in the preceding 60 days.
      **Decision: keep it tracked and drop it from this roadmap.** Untracking a
      file nothing can regenerate is deleting it, and the hotspot it caused is
      already gone. There is no generator to delete either.
      verify: the decision and its evidence are recorded in
      `agents/evidence/analysis/derived-artifact-consumers-2026-08.md`, and every
      later phase names three artifacts, not four.

## Phase 2 — Deploy enforcement that a stale branch cannot bypass

Ordered before Phase 3 on both seats' insistence: the guard must already be
refusing merges at the moment the paths leave the index, or Phase 3 reproduces
the regression it exists to repair.

- [x] **2.1 Add an index-level guard that refuses a tracked derived artifact.**
      A gate that reads the git index — not the working tree and not
      `.gitignore`, neither of which can refuse a re-add — and fails naming the
      path and the `git rm --cached` that fixes it. Its path list is one
      constant, so a fifth artifact is one line.
      verify: the gate exits non-zero on a tree with any of the paths tracked
      and zero on a tree with none of them, both proven by running it.
      **Result — no new gate script.** The table this needs already exists:
      `src/agent-src/scripts/dashboard_mode.ts` decides tracked/untracked/stale
      as a pure function and was already path-generic — only its regeneration
      hint was hard-coded. It gained two optional fields (`regen`, `noun`, both
      defaulting so every existing message stays byte-identical), and
      `build_archive_index --check` gained `--untracked-mode`, importing that
      table rather than restating it so the two artefacts cannot drift into
      different verdicts for the same state. A new `lint_`/`check_` script would
      have cost six downstream surfaces and three ratchets
      (`check_ci_local_parity`, `check_gate_coverage`, the gate ledger) for a
      verdict the repository already knew how to compute.
      Sensitivity proven in both directions: with the two archive paths tracked
      the gate exits **1** naming both; with `--check` alone it still exits 0.
- [x] **2.2 Wire it into the one check that is already required on `main`.**
      The repository ruleset `main protection` (id 17749383, `active`) requires
      exactly one status check: `Sync + Generate Tools Consistency`. The guard
      belongs inside it, because a check that is merely present in a workflow
      file is skippable by a branch whose workflow file predates it.
      verify: `gh api repos/event4u-app/agent-config/rulesets/17749383` still
      names that check as required, and the guard runs within that job.
      **Result.** `task check-archive-index` (already a step in that job) now
      passes `--untracked-mode`, and a new step runs `task
      roadmap-progress-check`. One repair was required to make the second step
      runnable at all: both dashboard tasks invoked
      `.augment/scripts/update_roadmap_progress.ts`, a gitignored projection
      `task sync` builds — and the new step is ordered before `task sync`. They
      now call `./scripts-run src/agent-src/scripts/update_roadmap_progress`,
      which runs from a fresh checkout. This is the same defect that made the
      Phase 1.3 determinism probe silently compare two empty hashes.
- [x] **2.3 Prove the guard is base-controlled, not branch-controlled.** The
      openai seat made this its decisive condition and the anthropic peer round
      agreed it is the load-bearing one. Construct a pull request from a
      pre-cutover commit that re-adds one of the paths and does **not** contain
      the guard on its own branch, and show the required check still rejects it.
      verify: the constructed PR's required check is red, with the guard named
      as the reason, on a branch whose own tree has no guard.
      **Result — the regression was reproduced and both guards caught it.**
      `origin/main` at `c298a6aba` is the stale side by construction: it carries
      all three files tracked and no guard. Merging it into this branch produced
      exactly the failure `git` produces for a straggler:

      ```
      CONFLICT (modify/delete): agents/roadmaps-progress.md deleted in HEAD and modified in origin/main.
        Version origin/main of agents/roadmaps-progress.md left in tree.
      ```

      — one per path, with the stale version **left in the tree**, which is how
      PR #1505 resurrected the dashboard: a resolution loop that stages what it
      finds re-adds all three without anything objecting. Resolved that way
      deliberately, all three read `RE-ADDED`, and on that tree
      `task check-archive-index` and `task roadmap-progress-check` both exit
      **1**, each naming its paths and the `git rm --cached` that fixes them.
      The probe branch was deleted.

      **What this proves and what it does not.** The tree the guards ran on is
      the merge of base and head — the same tree GitHub builds for a
      `pull_request` event — so the *content* half is demonstrated: a stale
      branch cannot carry the file past a check that runs on the merge result.
      The *workflow-provenance* half (that GitHub takes the workflow definition
      from that merge ref rather than from the head branch alone) is platform
      behaviour this branch cannot execute before it is itself on `main`. It is
      recorded as AC-2's post-merge verification rather than claimed here, per
      the openai seat's own condition that the acceptance test be a real PR.

## Phase 3 — Atomic cutover

- [x] **3.1 Untrack the three paths and repair the live regression in one
      commit.** `git rm --cached` for each path the Phase-1 decisions kept,
      together with the matching `.gitignore` entries, in a single commit — the
      dashboard's `.gitignore` line already exists and its index entry is the
      regression. Untracking before the CI contract flips would red the trunk;
      untracking after would leave a window with no guard. One commit, both.
      verify: `git ls-files` returns nothing for all three paths, and
      `git check-ignore` returns each of them. **Both hold**: `git ls-files`
      returns 0 lines, and `.gitignore:108,120,121` match all three.
      One repair rode along, and Phase 1.1 is why it was found:
      `archive_completed_roadmaps.ts` ran `git add -- agents/roadmaps-progress.md`
      after regenerating. `git add` on an ignored path exits 1, `_run` returns
      that code and the call site discarded it — a silent no-op since the
      2026-08-21 untrack. Deleted rather than forced: an untracked dashboard is
      never staged, so the block had no correct behaviour left. Its test already
      asserted *"deliberately NO `git add`"* and still passes.
- [x] **3.2 Flip the CI contract from committed-then-diffed to
      derived-then-verified.** "Derive and verify nothing" was refused by both
      seats: option B promises on-demand regeneration, so CI has to prove the
      promise. Three properties, and one check may not stand in for all three —
      **absence** (2.1), **buildability** (the generator runs from a clean
      checkout), **correctness** (two runs agree, and for `index.json` the
      schema and its cross-format agreement with `INDEX.md` hold).
      verify: each of the three properties is asserted by a named check, and
      each check is shown failing when its property is violated.
      **Absence** — `evaluateDashboardState` returns `stale` with the
      `git rm --cached` fix when `trackedInGit`. **Buildability** — the CLI runs
      the untracked table against the real repository from the source path, no
      `.augment/` projection required. **Correctness** — a present-but-stale copy
      still fails, and it is told to run its OWN regeneration command, so a
      second artefact reusing the table cannot be sent to the wrong tool.
      Five tests added to `tests/scripts/build_archive_index.test.ts` (18 pass).
      **Sensitivity proven by sabotage, twice**, per
      *a test never seen red has unknown sensitivity*: neutralising the injected
      `regen` reds exactly the stale-copy test; short-circuiting the
      `trackedInGit` branch reds exactly the in-index test; restoring returns
      18/18. Neither sabotage reddened an unrelated test, so the assertions are
      pointed at the mechanism and not at its neighbourhood.
- [x] **3.3 Carry the in-flight branches across the window.** The peer round
      found this gap in both first-round answers: during the cutover some
      branches carry the new contract and some do not. Three pull requests are
      open (#1517, #1504, #1495) and 284 remote branches exist. State the
      transition rule, apply it to the three open PRs, and record what happens
      to a straggler branch that is opened later.
      verify: each open PR is either updated or explicitly recorded as handled
      by the rule, and the rule is written down.
      **The rule, and it is enforced by a tool rather than by prose:** a branch
      that predates this change hits `modify/delete` on these paths, and the
      resolution is **take the deletion** — `git rm --cached -- <file>`, keeping
      the working-tree copy. `sync_pr_branch.ts` printed the generic generated
      advice for them, `git checkout --ours`, which has no side to check out on
      a modify/delete and re-adds the file when followed. That is the exact
      instruction PR #1505 acted on. The three paths are now split into an
      `UNTRACKED BY DESIGN` class carrying the deletion instruction; the split
      is asserted and its sensitivity proven by sabotage.
      **Live state at execution, re-read rather than recalled:** two open PRs,
      not the three this roadmap was authored against — #1504 merged in the
      interval. #1517 (`drain/road-to-drain-commands`, MERGEABLE) and #1495
      (`drain/road-to-per-turn-hook-economy`, CONFLICTING) both carry all three
      paths tracked, so both will hit the conflict. Neither is edited from here:
      working inside another session's active PR is the shared-tree collision
      that contaminated commits earlier in this estate. They are handled by the
      rule, which their own next `sync_pr_branch` run prints.
- [x] **3.4 Leave the `GENERATED` classification in place for one release.**
      `sync_pr_branch.ts` still lists two of the paths. A straggler branch
      created before the cutover still carries the tracked file, and removing
      the classification now would take away the resolution advice exactly where
      it is still needed. Record the removal as a follow-up condition, not a
      step of this roadmap.
      verify: the `GENERATED` array is unchanged by this roadmap, and the
      condition for removing the entries is written where the next reader finds
      it. **Both hold.** The `GENERATED` array is byte-identical; what changed
      is which instruction the three paths are printed under, which is additive
      — a straggler still gets a report naming its paths, and now a correct one.
      The removal condition is written at `UNTRACKED_BY_DESIGN`'s own doc
      comment, next to the list it governs, rather than in a roadmap that will
      be archived before the release it refers to.

## Phase 4 — Rollback, record, and close the stub

- [x] **4.1 Write artifact-scoped rollback criteria.** Both seats required
      these and both required that a rollback never be achieved by disabling the
      guard globally. Name the conditions — clean-clone generation is
      non-deterministic, automation is found to need tracked state, generation
      needs undocumented state, the guard cannot be deployed before the untrack
      — and bound a rollback to one named artifact, with an owner and an expiry.
      verify: the criteria are in this roadmap, each names an observable
      condition, and none of them restores all three or disables the guard.
      **Written below as § Rollback criteria.**
- [x] **4.2 Record the boundary as an ADR.** What makes an artifact eligible to
      leave the index, why the two ratchet baselines are not eligible, and the
      `review_trigger` that reopens it. This is the durable half: without it the
      next derived artifact is decided from scratch.
      verify: the ADR exists, its status and provenance fields are populated,
      and the decisions index is regenerated. **ADR-242** —
      `docs/decisions/ADR-242-derived-artifacts-leave-the-index.md`, accepted,
      `provenance.kind: agentic` with both seats named, `evidence.strength: E2`
      over four cited artefacts, and a `review_trigger` phrased on two
      falsifying observations rather than a calendar. `docs/decisions/INDEX.md`
      regenerated (181 numbered) — with `--dir docs/decisions`, since the
      script defaults to `docs/adr` and exits **0** doing nothing otherwise.
      The one German quotation carries the sanctioned `DE: … · EN: …` anchor;
      `check_md_language` scans `docs/**` and was run to confirm.
- [x] **4.3 Close the superseded stub.** Remove
      `road-to-dashboard-untrack-cutover`, whose
      content this roadmap absorbs, and state in the removal where its two open
      guards were discharged.
      verify: the stub file is gone and this roadmap names both guards and where
      each was closed. **Done.** `check_references` was run with the file
      deleted before committing to it: exactly **one** inbound reference broke
      and it was this roadmap's own, now written as a name rather than a link.
      The stub's two open guards: **the version guard** — discharged by 3.4,
      which keeps the `GENERATED` classification for a release and moves only
      the instruction, so a straggler branch is still told what to do; **the
      consumer unstage mechanism** — NOT discharged, and deliberately not: 4.4
      keeps the two `.gitignore` entries repository-local, so no consumer needs
      unstaging by this change. That guard belongs to the consumer rollout,
      which stays separate work.
- [x] **4.4 Carry the consumer half to the boundary, not across it.** The
      maintainer's criterion covers consumer repositories too. The
      consumer-facing `src/config/gitignore-block.txt` and a `BREAKING_CHANGES`
      entry are where that starts; a tracked-to-untracked transition cannot be
      made atomic across independently versioned consumer repositories, so the
      rollout itself stays a separate change.
      verify: the consumer-facing entry and the `BREAKING_CHANGES` note exist,
      and the part deliberately not done here is named as such.
      **Corrected during execution: no consumer-facing entry is added, and that
      is the finding.** The step was authored assuming
      `src/config/gitignore-block.txt` was the right place to start. It is not,
      yet: shipping `/agents/roadmaps/archive/{INDEX.md,index.json}` to every
      consumer would untrack files in repositories that have no re-add guard,
      no `--untracked-mode` check, and a workflow template
      (`templates/github-workflows/roadmap-progress-check.yml`) that still tells
      the reader to *commit* the dashboard. That is this repository's own
      2026-08-21 regression, exported. Both `.gitignore` entries therefore stay
      repository-local, matching the dashboard entry's existing reasoning, and
      the consumer rollout — template inversion first, then the block entry, then
      an unstage mechanism — is named here as separate work rather than started.
      No `BREAKING_CHANGES` entry either: nothing consumer-facing changed.

## Rollback criteria

Both council seats required these, and both required the same bound: a rollback
names **one** artifact and never disables the guard globally. Restoring all
three, or removing the check from the required job, has a blast radius the
problem does not justify — and would silently re-open the conflict class this
change closed.

Pause or revert **that artifact's** cutover, and only that one, on any of:

| Condition | How it is observed |
|---|---|
| Generation is non-deterministic from a clean clone | two independent runs of its generator produce different bytes |
| Repository automation is found to need the tracked state | a gate or tool fails in a way that a present-but-untracked copy does not fix |
| Generation needs undocumented or unavailable local state | the documented single command fails on a fresh checkout |
| The guard cannot be deployed ahead of the untrack | the required job does not carry the check at the moment the path leaves the index |
| CI cannot tell a generator failure from a semantic one | the check exits non-zero without naming which of the three properties failed |

A rollback record names the artifact, the owner, the condition that fired, and
the condition under which it is removed again. An open-ended rollback is a
second untracked decision wearing the first one's clothes.

**Not a rollback condition:** the conflicts get worse, or a reader misses the
file in a PR diff. The first is what the change is for; the second is the
trade-off the maintainer already made explicitly for the dashboard.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The guard ships on the branch it is meant to judge | implementation | A pre-cutover branch re-adds a path and supplies a workflow that does not contain the guard, so the check appears required and is in fact absent. This is the mechanism that already regressed the dashboard once. | Wire the guard into the single already-required check and prove rejection from a branch that does not carry it | Phase 2 — Deploy enforcement that a stale branch cannot bypass |
| 2 | A consumer is found only after the paths are gone | implementation | The classification in 1.1 is code inspection, and code inspection missed something once already. | 1.2 deletes the files and runs the gates before anything leaves the index, so the discovery happens while it is still cheap | Phase 1 — Establish the facts option B rests on |
| 3 | A generator turns out to be non-deterministic | implementation | An artifact regenerated on demand that differs run to run is worse untracked than tracked, because nothing then holds the canonical copy. | 1.3 byte-compares two independent runs per artifact and makes a failure a stop condition for that artifact alone | Phase 1 — Establish the facts option B rests on |
| 4 | The transition window swallows an open pull request | implementation | Branches that predate the cutover expect the files tracked and the ones after expect them absent; an unstated rule resolves that inconsistently per PR. | 3.3 states the rule, applies it to the three open PRs by number, and records the straggler case | Phase 3 — Atomic cutover |
| 5 | The dashboard's browsing value is worth more than the drift it causes | product | The anthropic seat argued the maintainer's criterion is "do I need it in the repo", not "does anything read it", and that untracking costs PR-diff visibility, GitHub browsing and `git blame`. | The maintainer answered this for the dashboard verbatim; 1.4 forces the same question for the stubs README rather than deciding it by silence | Phase 1 — Establish the facts option B rests on |
| 6 | Enforcement machinery outgrows the problem it solves | product | The openai peer round warned that mandatory CI, hooks and cutover machinery can turn a narrow fix into repository-wide workflow ownership. | The guard is one path list inside a check that is already required; no new required check and no new hook is introduced | Phase 2 — Deploy enforcement that a stale branch cannot bypass |

## Acceptance Criteria

- [ ] AC-1 — None of the three paths is present in `git ls-files` on the branch
      this roadmap ships, and each is matched by `git check-ignore`.
- [ ] AC-2 — A pull request built from a commit that predates this change, which
      re-adds one of the paths and carries no guard on its own branch, is
      refused by the required check on `main`.
- [ ] AC-3 — For every artifact kept, CI asserts all three properties
      separately: absent from the index, buildable from a clean checkout, and
      byte-identical across two independent generations.
- [ ] AC-4 — `src/config/estate-count-budget.json` and
      `src/config/gate-violation-baselines.json` are byte-identical to their
      state at the base commit, so ADR-241 is neither bypassed nor reopened.
- [ ] AC-5 — `task roadmap-progress-check` exits zero on the branch, which it
      does not on `main` at the base commit of this work.
- [ ] AC-6 — `agents/roadmaps/stubs/road-to-dashboard-untrack-cutover.md` no
      longer exists, and this roadmap names where each of its two open guards
      was discharged.
