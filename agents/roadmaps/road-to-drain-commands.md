---
complexity: structural
status: ready
execution:
  mode: autonomous
---
# Road to drain commands

> **Source:** three operator artifacts from the 2026-08-20/21 sessions, handed
> over via `agents/tmp.old/roadmap-process.txt` — (a) an "Autonomous Roadmap
> Drain" prompt, (b) an "Autonomous PR Merge Queue" prompt, and (c) a
> merge-extension message adding cutoff / window-scheduling / expiry-reporting
> semantics. All three were proven by hand in live runs; this roadmap turns
> them into governed command surface. Design questions were put to the AI
> council (2 reviewers + chairman, deep + peer-review, 2026-08-21) — its
> verdicts are recorded per phase below and reshaped the plan in two places.
> Verified against `origin/main @ b900dd099`.

## Goal

A maintainer can drain the roadmap estate and the open-PR queue with two
invocations instead of two pasted prompts: `/roadmap:process-full --all
[--merge]` iterates every active roadmap to one PR each, and `/pr:merge
[all|<N>] [--no-merge]` prepares open PRs to mergeable and merges them. Both
terminate provably against a concurrently-producing session, both stop and
report instead of stalling when their authorization window closes, and neither
adds a new authorization store the agent could write on the user's behalf. The
temporary 6-hour weakening of the git guard is off the trunk, and the hook
bundle that enforces it is verified by content rather than by timestamp.

## The defect, stated first

**A drain run longer than the authorization window is structurally impossible,
and the workaround for that is currently a committed security hole.**

- `src/scripts/hooks/block_unauthorized_git.ts:489` reads
  `export const LEDGER_MAX_AGE_MS = 6 * 60 * 60 * 1000; // TEMP: PR-drain run,
  revert after`. The intended bound is 30 minutes. The `// TEMP` widening was
  committed to the trunk during the 2026-08-21 drain run and never reverted —
  a twelvefold expansion of the authorization lifetime on the guard that gates
  `pr-merge`, which is a `BLOCK_OPS` member (`:90`) precisely because it is
  irreversible.
- Measured live on 2026-08-21: of 9 open PRs, 8 are `CONFLICTING` and 1 is
  `MERGEABLE`. Every one of them touches `agents/roadmaps-progress.md` and
  `src/config/estate-count-budget.json`, so **each merge re-conflicts every
  remaining PR**. Throughput is one merge per authorization window, and
  pre-greening several PRs ahead of their merge is wasted work by construction.
- The bundle that actually enforces the guard is `dist/hooks/dispatch.js`, and
  the repo-local copy shadows the global install. `check_hook_bundle_freshness.ts`
  compares **mtimes**, not content, so an mtime-preserving edit or a `touch`
  passes. In the live run a source edit was silently inert and the run started
  on a false premise.

## Council verdicts that reshaped this plan

Recorded here rather than in a PR body, because two of them changed the
deliverable and a later reader needs to see why.

| Q | Verdict | Effect on this roadmap |
|---|---|---|
| Is `process-all` a new command? | **No — `/roadmap:process-full --all`.** `docs/contracts/command-clusters.md` says "sibling variants become a flag, never a second command"; `all` changes cardinality, not lifecycle. | The operator asked for `/roadmap:process-all`. It ships as a flag instead. Same capability, no registry violation. |
| `/prs:merge` or `/pr:merge`? | **`/pr:merge`**, path-derived per ADR-044, `all` as an argument. | Naming settled without a second command. |
| Merge authority vs ADR-237 | ADR-237:92 excludes merging and says "no invocation extends it". Council: mergeability-only until authorization is target-bound and tamper-resistant. | `--merge` **does** ship — but on the *existing* human-only authorization path, not a new grant store. See Phase 4. |
| The committed `// TEMP` weakening | **Immediate hotfix, blocks the rest.** | Phase 1, first commit of this branch. Deviation from "own PR" is recorded in that phase. |
| Bundle freshness | mtime proves ordering, not equivalence. Content check is a prerequisite. | Phase 2. |

**Why `--merge` ships despite the Q1/Q3 verdict, stated openly.** The council's
blocker was a *new* agent-writable grant store. This roadmap adds none. The
guard already classifies `pr-merge` as `BLOCK_OPS` and already derives its
authorization from the user's own prompt text on the `UserPromptSubmit` path
(`src/scripts/git_authorization_hook.ts:466`, from `classifyAuthorization`) —
a signal the agent cannot forge. `--merge` consumes that existing
authorization and nothing else; when it expires the run stops and reports
(Phase 3, E3), which is the periodic re-authorization the council asked for.

## Prerequisites

- `gh` CLI authenticated with merge rights.
- Surface this builds on, verified at `b900dd099`:
  `src/domains/product-basic/roadmap/process-full/command.md` (ADR-237 grant,
  terminal outcomes) · `.../roadmap/next/command.md` (§4 worktree routing, §7
  CI push gate) · `src/domains/git/pr/create/` (the `pr` verb family,
  `visibility: advanced`) · `src/scripts/hooks/block_unauthorized_git.ts` ·
  `src/scripts/check_hook_bundle_freshness.ts` + `rebuild_hook_bundle.ts` ·
  `docs/contracts/command-clusters.md` (locked registry).

## Phase 1 — Security hotfix: the guard window

- [x] **1.1 Restore the intended authorization window.** Set
      `LEDGER_MAX_AGE_MS` back to `30 * 60 * 1000` at
      `src/scripts/hooks/block_unauthorized_git.ts:489` and delete the
      `// TEMP: PR-drain run, revert after` marker. Rebuild the hook bundle so
      `dist/hooks/dispatch.js` carries the restored value — the source edit
      alone is inert.
      verify: `grep -n 'LEDGER_MAX_AGE_MS = ' src/scripts/hooks/block_unauthorized_git.ts`
      shows `30 * 60 * 1000` and no `TEMP` marker; `grep -c '6 \* 60 \* 60 \* 1e3' dist/hooks/dispatch.js`
      returns 0.
- [x] **1.2 Record the one-PR deviation.** The council asked for this as its
      own PR blocking the roadmap. It ships as the first commit of this branch
      instead, because this branch merges in the same session — a separate PR
      would add a round-trip without shortening the exposure. State that
      reasoning in the guard's header comment next to the constant, so the next
      reader of the constant sees why it was widened and why it is not again.
      verify: the header comment names the 2026-08-21 incident and says that
      widening `LEDGER_MAX_AGE_MS` for a run is forbidden practice.

## Phase 2 — The bundle is verified by content, not by timestamp

- [x] **2.1 Add a content-equivalence check for the hook bundle — against the
      LOCAL bundle, not a committed one.** Measured 2026-08-21:
      `git ls-files dist/hooks/` returns **zero** files, so the council's
      framing ("compare against the committed artifact") has nothing to compare
      against and is re-scoped here rather than implemented as stated. The
      bundle is a local build artefact, which is exactly why the live-run
      divergence was invisible: the executing copy is machine-local and no gate
      reads it. The check therefore rebuilds with the same esbuild flags
      `package.json` `build:hooks` uses, into a temporary location, and
      compares a digest against the bundle **present on this machine**. Keep
      `check_hook_bundle_freshness.ts` as the fast mtime diagnostic; the
      content check is the authority.
      verify: the new script exits 0 on a freshly built tree, and exits
      non-zero after an mtime-preserving edit to a bundled hook source that the
      existing mtime check passes — demonstrate both, since a check never seen
      red has unknown sensitivity.
- [x] **2.2 Wire it into the same local task the mtime check runs in**, after
      the healer, so a stale bundle is rebuilt before it is judged. State
      plainly that this gate is **local-only and cannot be a CI gate**: a fresh
      CI checkout has no `dist/hooks/` at all, so CI has nothing to verify and
      a green CI says nothing about the bundle a maintainer is actually
      running. That asymmetry is the finding, not a gap to paper over.
      verify: the task target invokes the new script; a deliberately corrupted
      local `dist/hooks/dispatch.js` makes that target fail; the script's
      header states the CI limitation.
- [x] **2.3 Handle non-determinism honestly.** If the rebuild is not
      byte-reproducible, that is a release-integrity defect, not a reason to
      fall back to mtime — record it as a finding with the exact difference and narrow
      the comparison to a canonical form only if the residue is provably
      inert (timestamps, absolute paths).
      verify: the script's header states which of the two cases holds, with the
      evidence.

## Phase 3 — `/pr:merge` — prepare one PR or drain the queue

Command home `src/domains/git/pr/merge/command.md`. **`pr/` is a bare path
segment, not a cluster** — `create/` is itself a cluster head
(`cluster: git-pr-create`). So the merge command is a **new cluster**
`git-pr-merge`, not a sub of an existing `pr` head; mirror
`src/domains/git/pr/create/command.md` structurally, including its
`## Sub-commands` / `## Dispatch` / `## Rules` sections, since
`check_cluster_patterns.ts` requires them. `visibility: advanced`,
`name: git-pr-merge`, `argument-hint: "[all|<pr-number>] [--no-merge]"`.
The slug's leading token is `git`, which is already on the ADR-041 verb
allowlist — no new verb ADR is needed.

- [x] **3.1 Author the three invocation shapes.** `/pr:merge <N>` — prepare and
      merge exactly PR N. `/pr:merge` — auto-select one PR: green first, then
      infrastructure/tooling before content, then smallest diff, tiebreak
      ascending number. `/pr:merge all` — drain the open-PR list.
      `--no-merge` runs the whole preparation and stops before merging; it is
      the entry point Phase 4 delegates to and it consumes no merge
      authorization.
      verify: the command file declares all three shapes and states which of
      them touch a `BLOCK_OPS` git operation.
- [x] **3.2 Bind every merge to an immutable target.** The queue is snapshotted
      once at invocation as a manifest of `(PR number, head SHA)` pairs. A
      merge refuses when either has changed since the snapshot — PR number
      prevents branch substitution, head SHA prevents a force-push swapping the
      content after authorization. The manifest is never silently refreshed.
      verify: the command states the refusal, and names the recomputation as
      the *only* way to widen the target set.
- [x] **3.3 Encode the semantic conflict classes.** `gh pr checkout` →
      `git merge origin/main --no-edit`, never rebase a pushed branch. Roadmap
      files: union of completions — never un-check a box either side checked,
      never resurrect a roadmap either side archived or parked. Generated
      artifacts (`agents/roadmaps-progress.md`, `src/config/estate-count-budget.json`,
      dashboards, catalogs, census): never hand-merge — take either side and
      regenerate with the repo's own task, commit the regenerated output.
      Archive-move versus edit: the archived end-state wins; re-apply the edit
      at the new path or drop it with a note in the summary. Evidence files:
      append-only, keep both sides. A conflict outside these enumerated classes
      stops the run rather than being resolved by judgement.
      verify: each class is named with the file glob it applies to, and the
      "stop on an unenumerated class" rule is stated as a halt, not a warning.
- [x] **3.4 Post-sync emptiness check.** An effectively-empty diff against
      `main` after syncing means the PR was superseded: close it with
      `Superseded: landed via <PRs>` and record it. Never merge an empty PR to
      make the count fall.
      verify: the command distinguishes "empty" from "only generated-artifact
      churn that regeneration on main would produce anyway".
- [x] **3.5 Bounded CI repair.** Root-cause fixes only, within the PR's own
      scope. A known flake class gets one `gh run rerun --failed` before red
      counts as real. Six fix iterations per PR per pass; exhaustion posts a
      diagnosis comment and moves the PR to the end of the queue once; a second
      exhaustion is terminal. Explicitly out of scope and a halt: dependency
      changes, workflow changes, deleting or skipping tests, loosening a
      threshold, weakening a gate, expected-fail markers, branch-protection
      changes. Green means the **required checks succeeded for the exact head
      SHA being merged**, re-verified on the pushed head — never a local run.
      verify: the command names the halt list verbatim and states the SHA
      requirement for "green".
- [x] **3.6 E1 — cutoff against a concurrently-producing session.** When the
      queue empties, recompute the open-PR list exactly once. PRs that appeared
      during the run are drained as one final straggler batch; after that batch
      the run ends unconditionally. Anything arriving during or after it is
      recorded as `arrived-after-cutoff` and not processed. This is what gives
      `all` a termination bound of (initial queue + one batch) independent of
      other sessions.
      verify: the command states the bound in those terms, and the summary
      artifact has a row class for `arrived-after-cutoff`.
- [x] **3.7 E2 — window-aware scheduling.** A green, waiting PR is spent
      authorization window, because the next merge re-conflicts it. When the
      projected remaining work exceeds the remaining window, stop entering
      CI-fix loops and merge everything already green first. Pre-greening
      several PRs ahead of their merge is forbidden under window pressure.
      verify: the command states the override and the signal it reads to know
      the window is under pressure.
- [x] **3.8 E3 — expiry is a reported state, never a stall.** When the
      authorization window closes with the queue non-empty, the run stops
      cleanly, writes the summary with a `window-expired` disposition per
      unprocessed PR, and names the exact re-authorization needed. It never
      retries the guard, never edits the guard, its source, or its bundles.
      verify: the command carries that prohibition as an Iron Law, and the
      summary schema has the `window-expired` disposition.
- [x] **3.9 Kill-switch list and the no-rollback rule.** Stop before the next
      merge on: target or head-SHA mismatch, `main` advanced by an actor other
      than this run, review dismissal, a change to the required-check set,
      a conflict outside the enumerated classes, guard or bundle verification
      failure, or the first unexplained CI repair failure. A completed merge is
      the commit point — the command never auto-reverts an earlier merge as
      "rollback"; it stops, emits the merge SHAs and the reason, and leaves
      compensation to a separately authorized human decision.
      verify: both rules are in the command's Rules section.
- [x] **3.10 The `all`-mode summary artifact.** On queue empty or terminal-only,
      write `agents/evidence/pr-drain-run-summary.md`: one row per PR with
      queue position, conflict classes hit, CI iterations used, disposition
      (merged SHA / superseded-closed / blocked-external / twice-exhausted /
      window-expired / arrived-after-cutoff), and any edits dropped in conflict
      resolution.
      verify: the command specifies the columns; the disposition set is closed.

## Phase 4 — `/roadmap:process-full --all [--merge]`

Council Q2: a flag on the existing sub, not a new `process-all` command.

- [ ] **4.1 Extend the argument surface** to
      `argument-hint: "[roadmap] [--all] [--merge] [--worktree]"` and document
      each flag's scope in the Scope-delta section.
      verify: the frontmatter line matches and each flag has a paragraph.
- [ ] **4.2 `--all` semantics — the estate loop.** Recompute the live active
      roadmap inventory (never memory, never the dashboard count — the
      live-screen rule `next` § 1 already carries), build the queue, then per
      roadmap: branch from the updated default, run the existing single-roadmap
      loop, then move to the next roadmap against the **new** main. One roadmap
      = one branch = one PR, the existing invariant iterated. Queue order:
      roadmaps at or above 10 % checkbox progress in descending progress;
      roadmaps below 10 % appended after, ascending by declared `complexity:`
      tier, tiebreak ascending total checkbox count. `later/`, `skipped/`,
      `archive/` and `stubs/` are out of scope.
      verify: the ordering rule is stated exactly once and is computable from
      the files alone; the section names the live-screen obligation.
- [ ] **4.3 A blocked roadmap never stalls the estate queue.** Within a
      roadmap the existing terminal outcomes and halt conditions keep full
      authority. Between roadmaps, only queue exhaustion, window expiry, or a
      kill-switch condition stops the run — a `blocked` roadmap is recorded and
      the loop continues.
      verify: the distinction between intra-roadmap halts and inter-roadmap
      continuation is explicit.
- [ ] **4.4 `--merge` semantics.** Delivery: on outcome `complete`, open the PR
      as today, then run the Phase 3 preparation loop on it so the deliverable
      is a **mergeable** PR rather than merely an open one. With `--merge`,
      merge it via the Phase 3 merge step, under the Phase 3 target-manifest,
      SHA and kill-switch rules. Without the flag, stop at mergeable-and-open —
      today's review handoff, unchanged. On outcome `blocked`, `--merge` is
      **ignored**: a partial-progress PR is never auto-merged.
      verify: the ignore-on-blocked rule is stated as an invariant, not a
      default.
- [ ] **4.5 Mergeability is per-PR against a recorded base, not a queue
      property.** With every PR touching the same two generated files, making
      PR *n* mergeable against base SHA `M` says nothing about its state after
      PR *n−1* advances main. The command reports "mergeable against base
      `<SHA>`", never "the queue is mergeable".
      verify: the wording appears in the command and in the summary schema.
- [ ] **4.6 `--worktree` semantics.** Route workspace creation through
      `/worktree:create` in full, including its § 4b seeding allow/deny list;
      one worktree, re-branched per roadmap; `/worktree:cleanup` at end of run.
      verify: the section delegates rather than restating the list.
- [ ] **4.7 Amend the canonical loop's merge sentence.**
      `src/agent-src/contexts/execution/roadmap-process-loop.md:642` reads
      "**Merge is out of scope in every mode — always conversational.**" That
      is a second load-bearing text `--merge` contradicts, and overriding it
      downstream would leave the contract saying the opposite of the command.
      Amend it in place: merge stays out of scope in every mode **except**
      under an explicit `--merge` on the invocation, which is the user's word
      for that run. Add the `--all` cardinality to the § Scope-deltas table
      row for `process-full` in the same edit.
      verify: the sentence names the single exception and cites the ADR from
      5.1; the scope-delta row mentions `--all`.
- [ ] **4.8 Update the Iron-Law and forbidden-non-halt blocks.** Waiting on
      remote CI for the delivery loop is part of the run, not a boundary stop.
      verify: the existing Iron-Law block is amended, not duplicated.

## Phase 5 — Governance record

- [ ] **5.1 Write the merge-authority ADR.** It records: that `--merge` / `all`
      typed by the user in the invocation is the per-turn confirmation the
      Hard Floor requires; that it consumes the **existing** prompt-derived
      authorization and introduces no new grant store; that `/roadmap:next`'s
      "No merge, ever" is unchanged; that the agent never modifies the guard,
      its source, or its bundles; and the hard floor — never force-merge past
      failing required checks, never admin-bypass, never weaken a gate to go
      green. It also records the council's Q1/Q3 reservation and the two
      properties whose absence would make a future *persistent* grant unsafe
      (agent-unforgeable storage, immutable target manifest), so a later
      attempt starts from the objection rather than rediscovering it.
      verify: the ADR exists with a number, is indexed, and cites ADR-237 § 4
      and the `road-to-gate-preauth-authorization` stub by name.
- [x] **5.2 Register the new sub in the locked cluster registry.** A
      `git-pr-merge` row mirroring `git-pr-create`. `--all` needs no row: it is
      a flag on an existing sub, which is the outcome the registry rule asked
      for.
      verify: the cluster linter passes and the row's column count matches the
      table header.
- [ ] **5.3 Sync the cluster head, and regenerate the catalog.** The `roadmap`
      cluster head's `argument-hint` reflects the new flags (no new
      sub-command row — `--all` is a flag, which is the point of the Q2
      verdict). `docs/catalog.md` is auto-generated: run the index generator
      rather than hand-editing it, so the merge command's row and the artefact
      count are both produced by the same pass.
      verify: the documented-commands linter passes and the catalog diff is
      generator output only.

## Phase 6 — Gates, evals, delivery

- [x] **6.1 Eval fixture for the merge command.** The routing linter resolves
      the fixture stem from the command's `name` (or a `replaces` alias), so
      the file is `src/agent-src/commands/evals/git-pr-merge.json`, schema
      `{command, intent, cases[{prompt, expected}]}`, **at least five cases**
      (`MIN_CASES = 5`): the three invocation shapes plus a negative case that
      must route elsewhere.
      verify: `lint_command_routing` reports no missing-eval violation for the
      new command.
- [ ] **6.2 Extend the roadmap cluster's routing eval** —
      `src/agent-src/commands/evals/roadmap.json` gains prompts that must route
      to `roadmap-process-full` for the estate-drain phrasings ("drain every
      roadmap", "arbeite alle Roadmaps ab"), so the flag is reachable by
      intent and not only by flag literal. Its `intent` line is already stale
      (it omits `next`) — fix it in the same edit.
      verify: `lint_command_routing` passes and the fixture still has at least
      five cases.
- [ ] **6.3 New-gate verification: run the Phase 2 content check and both
      fixtures once locally.** <!-- carve-out: new-gate-verification -->
      verify: exit codes recorded in the PR body, including the deliberate red
      from 2.1.
- [ ] **6.4 Run the command, cluster, frontmatter and roadmap gates on the
      changed files** and fix every failure at the root.
      verify: each named gate reports 0 for this branch.
- [ ] **6.5 Update `docs/CLAIMS.md` only if a claim above turns out measurable
      in CI**; otherwise record an honest null in the PR body.
      verify: either a ledger entry exists or the PR body states the null.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | `--merge` becomes a standing licence | implementation | A flag read once at invocation is easy to re-read later in the run, turning one confirmation into unbounded merge authority — the exact failure the council's Q1/Q3 reservation names | No new grant store; `--merge` consumes only the existing prompt-derived ledger entry, and expiry stops the run (3.8) instead of extending itself | Phase 4 — `/roadmap:process-full --all [--merge]` |
| 2 | Target substitution between authorization and merge | implementation | A force-push after the queue snapshot swaps the content that was authorized | Immutable `(PR number, head SHA)` manifest, refusal on either mismatch, never silently refreshed | Phase 3 — `/pr:merge` — prepare one PR or drain the queue |
| 3 | Semantic conflict resolution drifts into judgement | implementation | Every PR touches the same two generated files; an unenumerated conflict class resolved by taste silently loses work | Enumerated classes only; anything outside them halts rather than resolves | Phase 3 — `/pr:merge` — prepare one PR or drain the queue |
| 4 | The content-equivalence check is never seen red | implementation | A gate that only ever passed has unknown sensitivity, which is how the mtime check earned false confidence in the first place | 2.1 requires demonstrating the red on an mtime-preserving edit before the green counts | Phase 2 — The bundle is verified by content, not by timestamp |
| 5 | The flag decision is re-litigated as a new command | product | The operator asked for `/roadmap:process-all` by name; a later reader may add it, splitting the surface the registry rule protects | The council verdict and its reasoning are recorded in the roadmap and the ADR, not only in a PR body | Phase 5 — Governance record |

## Acceptance Criteria

- [ ] AC-1 — `LEDGER_MAX_AGE_MS` is `30 * 60 * 1000` in the guard source, no
      temporary-widening marker remains anywhere in the guard, and a rebuild of
      the hook bundle from that source carries the restored value. The bundle
      itself is untracked, so the source and the rebuild are the checkable
      surface — not a committed artefact.
- [ ] AC-2 — An mtime-preserving edit to a bundled hook source fails the
      content-equivalence gate while passing the mtime check; both outcomes are
      demonstrated, not asserted. The gate's header states that it is
      local-only because `dist/hooks/` is untracked.
- [ ] AC-3 — `/pr:merge` exists at `src/domains/git/pr/merge/command.md`, is
      registered in the locked cluster registry, and specifies the immutable
      target manifest, the enumerated conflict classes, the bounded CI-repair
      halt list, the kill-switch set, the no-rollback rule, and the closed
      disposition set of its summary artifact.
- [ ] AC-4 — `/roadmap:process-full` accepts `--all`, `--merge` and
      `--worktree`; `--merge` is documented as ignored on outcome `blocked`;
      mergeability is expressed per-PR against a recorded base SHA rather than
      as a queue property.
- [ ] AC-5 — No new command named `process-all` exists anywhere in the tree,
      and no new authorization store exists in `src/scripts/hooks/` — the
      merge path consumes the existing prompt-derived ledger only.
- [ ] AC-6 — `/roadmap:next` is byte-identical: it still never merges.
- [ ] AC-7 — An accepted ADR records the merge-authority decision, cites
      ADR-237 § 4 and the `road-to-gate-preauth-authorization` stub, and names
      the two properties a future persistent grant would need.
- [ ] AC-8 — The command, cluster, frontmatter and roadmap gates pass on the
      changed files, and both new eval fixtures load under the existing loader.
