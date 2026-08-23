---
complexity: lightweight
status: done
execution:
  mode: phase-checkpoints
---
# Road to a merge-op split and a negation guard

> **Source:** `agents/tmp.old/auto-merge` — an external draft dropped into the
> inbox on 2026-08-22. It was framed as *"user-final merge authority"*, which is
> the part this tree **already ships**; that framing is deliberately dropped
> here in favour of the narrow defect framing, because a roadmap carrying it
> invites rebuilding a merge policy that exists. Every `file:line` below was
> re-verified against this worktree, and two of the source's paths had drifted —
> the current paths are written here.

## Goal

Four concrete defects in the git-authorization surface are closed, and none of
them is a merge policy. When this is finished: `--auto` and the GraphQL
auto-merge mutation are classified as their own operation rather than as a plain
merge or as nothing at all; a **de-escalating** command stops being blocked as
an escalating one; a prompt that says *"do not merge"* stops authorizing a
merge; and the roadmap-authoring skill stops forbidding the one merge mention it
should permit. The merge-authority question itself is untouched — it is
owner-reserved and already recorded.

## Context — what is already decided, and the source premise that is false

**The source's opening premise does not hold at HEAD.** It assumed a settings
knob named `enablePullRequestAutoMerge`. A tree-wide grep for
`enablePullRequestAutoMerge`, `autoMerge`, `auto_merge` and `mergePolicy` across
`*.ts`, `*.yml`, `*.yaml`, `*.json` and `*.md`, including `dist/`, returns
**0 hits**. No such setting exists and no renamed replacement exists. This is
recorded so the premise is not silently re-proposed.

**Merge policy is already decided, and rebuilding it is out of scope.**
`docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md` is the
canonical record: `:79-97` states that merge authority is not extended and
records the three independent reviews that reached that verdict, `:99-108`
writes down the design the owner would be accepting so a future attempt starts
from the objection rather than from scratch, and `:110-114` forbids widening the
authorization window for a run. Its `review_trigger` at `:10` names the reopen
condition.

**The authorization mechanism is already turn-bound and one-shot.** The ledger
is rewritten on **every** prompt, so a record cannot outlive the turn that
raised it (`src/scripts/git_authorization_hook.ts:457-464`); the pending refusal
is consumed rather than read (`:449`); a ledger older than
`LEDGER_MAX_AGE_MS = 30 * 60 * 1000` is rejected
(`src/scripts/hooks/block_unauthorized_git.ts:509`, enforced at `:562-564`); and
a ledger from another session is refused as another conversation's consent
(`:557-561`). `isAffirmative` is conservative by construction — a 24-character
cap (`src/scripts/git_authorization_hook.ts:255`) and an anchored alternation
(`:262-263`), so a turn that also opens new work is not an answer.

None of that is what this roadmap touches. What it touches is four places where
the classifier gets the **operation** wrong.

### The four defects, re-verified

| # | Defect | Evidence |
|---|---|---|
| D1a | `gh pr merge --auto` classifies identically to a plain merge | The op union has 8 members and no auto variant (`git_authorization_hook.ts:150-158`); the pasted-command pattern is `\bgh\s+pr\s+merge\b` (`:274`) and the block-side classifier is the same shape (`block_unauthorized_git.ts:166-171`). `--auto` is invisible to both. |
| D1b | The GraphQL mutation bypasses the block list entirely | `ghApiWrite()` (`block_unauthorized_git.ts:125-130`) requires **both** a write method (`-X`/`--method` with POST/PATCH/PUT/DELETE) **and** a path matching `/pulls/\d+/merge`. `gh api graphql -f query='mutation{enablePullRequestAutoMerge…}'` matches neither. |
| D2 | Negation authorizes a merge | `git_authorization_hook.ts:189` matches `merge` as an action with a lookahead that excludes only the noun senses (`conflict`, `commit`, `base`, `queue`, `state`, `status`) — never a negator. Probed directly against `classifyAuthorization`: `"nicht mergen"`, `"don't merge this"` and `"never auto-merge"` each return `["pr-merge"]`. `"merge conflict aufloesen"` correctly returns `[]`. |
| D3 | A de-escalating command is blocked as an escalating one — **new, undrafted** | `gh pr merge <n> --disable-auto` *turns auto-merge off*. It matches `\bgh\s+pr\s+merge\b` at `block_unauthorized_git.ts:168`, and `pr-merge` is in `BLOCK_OPS` (`:89-95`). So switching auto-merge **off** requires merge authorization. That is a live deadlock, and it is the reason the D1a fix cannot ship without it. |

### The one doctrine gap — and why it is a blocker, not a step

`src/rules/agent-authority.md:16` puts a prod-trunk merge in the Hard Floor
band, and `src/rules/non-destructive-by-default.md:26` requires explicit
confirmation **on this turn**. Read together with a prompt that *is* the
confirmation — a user typing `merge PR #123` — the two can be read as demanding
a second ceremony for a merge the user just directly ordered.

**This roadmap cannot fix that, and the reason is structural.** Both files are
kernel rules: the nine are listed in
`src/scripts/hooks/block_kernel_rule_writes.ts:10-12` and both appear there, so
every agent write to either is a tool-call-time deny with no agent-accessible
override. `scope-control § Kernel-rule edits` additionally requires an own PR
and a soak window. It is therefore filed as `blocker: kernel-doctrine-line`,
owned by the maintainer, and no step below depends on it.

## Phase 1 — split the merge op

- [x] **1.1 Add `pr-merge-auto` to the op union and to the block list.**
      Extend `GitOp` at `src/scripts/git_authorization_hook.ts:150-158` and
      `ALL_OPS` immediately below it; add the new member to `BLOCK_OPS` at
      `src/scripts/hooks/block_unauthorized_git.ts:89-95`. Enabling auto-merge
      is irreversible in the same sense a merge is — it commits the outcome to a
      condition the agent does not control.
      verify: `grep -c 'pr-merge-auto' src/scripts/git_authorization_hook.ts src/scripts/hooks/block_unauthorized_git.ts`
      is non-zero in both; `git show HEAD:src/scripts/git_authorization_hook.ts | grep -c 'pr-merge-auto'`
      returns `0` (the pre-state assertion).
- [x] **1.2 Classify `--auto` ahead of plain merge.** Order matters in both
      classifiers — the block-side comment at
      `block_unauthorized_git.ts:133-134` states that the most specific pattern
      wins. Place the `--auto` pattern before the `pr-merge` pattern in both
      `PASTED_COMMANDS` (`git_authorization_hook.ts:270-279`) and the
      block-side table.
      verify: a committed test asserts `gh pr merge 12 --auto` classifies as
      `pr-merge-auto` and `gh pr merge 12` as `pr-merge`; both assertions were
      seen red against HEAD before the change landed.
- [x] **1.3 Classify the GraphQL mutation.** `enablePullRequestAutoMerge` in a
      `gh api graphql` body is the same operation by another transport.
      `ghApiWrite()` cannot express it — its two lookaheads are built for REST
      paths and write methods — so this needs its own pattern, not a widening
      of that helper.
      verify: a committed test asserts that a `gh api graphql -f query='mutation{enablePullRequestAutoMerge(...)}'`
      command classifies as `pr-merge-auto`, and that the same test fails
      against `git show HEAD:src/scripts/hooks/block_unauthorized_git.ts`.
- [x] **1.4 Exempt the de-escalating forms — ships with 1.1, never after.**
      `gh pr merge <n> --disable-auto` and
      `disablePullRequestAutoMerge` turn the capability **off** and must not
      require merge authorization. Without this, 1.1 makes the deadlock worse
      rather than better.
      verify: a committed test asserts `gh pr merge 12 --disable-auto`
      classifies as neither `pr-merge` nor `pr-merge-auto`, and that the same
      command is currently classified as `pr-merge` at HEAD.

## Phase 2 — a deterministic negation guard

- [x] **2.1 Add the guard with the mechanism the tree already uses.**
      `src/scripts/hooks/turn_end_gate_hook.ts:330` already carries a
      negative-lookahead negation exclusion over
      `nicht|nichts|kein(e|en|em|er|es)|niemals|nie`, and `:490-491` carries a
      second negated-claim pattern with a line-scoped window helper at `:493`.
      Reuse the shape; do not invent a third.
      verify: the guard cites the existing patterns; `grep -n 'nicht\|niemals' src/scripts/git_authorization_hook.ts`
      returns the new lookahead.
- [x] **2.2 Build a POSITIVE control corpus alongside the negative one.** A
      negation guard that suppresses too much is worse than the defect: it
      silently stops authorizing merges the user did order, and the failure is
      invisible because nothing happens. The positive corpus asserts that
      `merge PR #123`, `merge`, `mergen` and `zusammenführen` still authorize.
      verify: both corpora are committed and both run; the positive corpus
      passes at HEAD **and** after the change — a positive case that only
      passes after is not a control.
- [x] **2.3 Keep the existing noun-sense exclusions intact.** The lookahead at
      `:189` already correctly refuses `merge conflict`, `merge commit`,
      `merge base`, `merge queue`, `merge state` and `merge status`. The
      negation guard is additive.
      verify: `"merge conflict aufloesen"` still classifies as `[]`, asserted in
      the negative corpus.

## Phase 3 — the roadmap-authoring carve-out

`src/skills/roadmap-writing/SKILL.md:337-341` forbids writing merge, push or
commit steps into a roadmap, absolutely. The only carve-out in that list is
`new-gate-verification` at `:349-351`. There is no carve-out for a
**user-directed** merge, so a roadmap cannot record even the fact that the user
ordered one.

**The file is at 400 lines and the skill-line cap is 400**
(`src/scripts/skill_linter.ts:1781`). Any addition must be net-neutral or the
cap trips — this is a hard constraint on how Phase 3 is written, not a
preference.

- [x] **3.1 Add the carve-out with a provenance note and a paste
      discriminator.** The carve-out permits recording a merge the **user
      directed**, and must distinguish that from merge text that arrived by
      paste — a quoted chat log or a pasted roadmap snippet is not an
      instruction, and the same distinction is already drawn for commit phrases
      elsewhere in the tree.
      verify: `wc -l < src/skills/roadmap-writing/SKILL.md` is `≤ 400` after the
      change; `./scripts-run src/scripts/skill_linter src/skills/roadmap-writing/SKILL.md`
      reports no new finding on that file.
- [x] **3.2 Mirror it in the roadmap template.** A carve-out that exists only in
      the authoring skill is not reachable from the artefact it governs.
      verify: the template carries the same discriminator wording;
      `./scripts-run src/scripts/check_references` exits `0`.

## Phase 4 — conformance tests

- [x] **4.1 One regression test per vector, each naming the classifier op it
      asserts.** Five vectors: `--auto`, the GraphQL mutation, `--disable-auto`,
      a negated prompt, and a positive control. A test that asserts "is
      blocked" without naming the op cannot tell D1a from a plain merge, which
      is the whole defect.
      verify: each test names its expected `GitOp` explicitly, and the test
      file's header records the pre-change failure count observed before the
      change landed — at least four of the five.
- [x] **4.2 Sabotage each guard before trusting it.** Neutralise the new
      negation lookahead, watch the negative corpus go red, restore it. A guard
      never seen fail has unknown sensitivity.
      verify: the sabotage result is recorded in the test file's header comment
      with the observed failure count, and the guard is restored — `git diff --stat`
      over the guard path is empty at the end of the step.

## Phase 5 — a static ratchet, and nothing else

- [~] **5.1 Forbid a future `*autoMerge*` / `mergePolicy` settings key.** A
      static check over the settings schema and template, asserting the key
      space stays empty of those names. This is the whole of Phase 5: ADR-239
      already exists, its `review_trigger` at `:10` names the reopen condition,
      and adding a second policy record here would create two.
      verify: the check exits `0` on the current tree and exits non-zero
      against a fixture schema carrying an `autoMerge` key; both are committed.

## What this roadmap will not build

| Excluded | Why |
|---|---|
| A merge policy, a `--merge` flag, or a preauthorized-merge store | `ADR-239:79-97` records the verdict and `:99-108` records the design the owner would be accepting. Rebuilding it here is the framing this roadmap dropped. |
| Widening `LEDGER_MAX_AGE_MS` | `ADR-239:110-114` names this as forbidden practice; the supported answer to a long run is that it stops and reports. |
| Any edit to `agent-authority.md` or `non-destructive-by-default.md` | Both are kernel rules (`block_kernel_rule_writes.ts:10-12`) — an agent write is a tool-call-time deny. Filed as a blocker instead. |
| Loosening `isAffirmative` | Its 24-character cap (`git_authorization_hook.ts:255`) is the safety argument for the whole confirmation path, stated in its own header. |


      **BLOCKED `[~]` 2026-08-22 — and this step was BUILT and then REVERTED,
      which is recorded rather than hidden.** I implemented it in full
      (`check_no_automerge_key.ts` with a 7-case `--self-test`, a committed
      fixture schema, a test, a CI task and a `gate-coverage.yml` entry) before
      noticing that `blocker: owner-reserved-boundary` gates this phase **in
      full**. All of it is removed.

      Shipping it would have been the exact silent-green this run is forbidden
      from reintroducing: a phase past its own gate. And the blocker's own
      wording rules out the shortcut of resolving it myself — *"an agent
      asserting that its own check stays inside a reservation is the shape the
      reservation exists for."* The council that would otherwise route an
      owner-reserved question has had 0 of 2 seats all run.

      The blocker's own "If you do nothing" is the outcome taken: *"Phase 5
      stays blocked. That is a cheap non-decision — the key does not exist
      today, so the ratchet guards against a future nobody has proposed, and
      ADR-239's review_trigger already names the reopen condition."*

      What was learned by building it is worth keeping for whoever unblocks it:
      the scope must be the two settings files and the match must be anchored on
      a **key**, not the word — the gate's own source contains `autoMerge:` in
      its docstring, so a word-matching gate over the tree would refuse the
      decision it protects. And no create-only canary can reach it: both scanned
      files already exist, so a plant lands outside the corpus and the gate
      correctly stays green (measured — it was reported as a dead gate).
## Blockers

### blocker: kernel-doctrine-line

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in Phases 1–5 — recorded so the gap is not lost
- **What to do:** pick exactly one — (a) the maintainer amends
  `src/rules/agent-authority.md:16` and/or
  `src/rules/non-destructive-by-default.md:26` to state that a direct
  `merge PR #123` **is** this turn's confirmation, in its own PR with the soak
  window `scope-control § Kernel-rule edits` requires, or (b) the reconciliation
  is declined and this file records that a second ceremony after a direct order
  is the accepted behaviour.
- **Resolved when:** the choice is recorded in the Context section of this file
  with a date, and — in case (a) — the kernel PR is linked there.
- **Recommendation:** (a). The gap is real and one line wide, and it costs the
  user a second ceremony after a direct order. But it is owner work by
  construction — an agent write to either file is a tool-call-time deny — so
  the recommendation is a request, not a plan.
- **If you do nothing:** A direct `merge PR #123` keeps reading as needing a
  second confirmation on top of itself. Nothing in Phases 1-5 breaks, and the
  gap stays recorded here rather than rediscovered from scratch next time.
- **Disposition 2026-08-22 — left OPEN, and it is unresolvable by an agent by
  construction.** Option (a) is a kernel-rule edit: both files are in the nine
  listed at `src/scripts/hooks/block_kernel_rule_writes.ts:10-12`, so an agent
  write is a **tool-call-time deny** — not a policy I am declining to break, a
  mechanism that refuses. Option (b) declines a maintainer's doctrine
  reconciliation, which is not mine to decline either. The council that would
  otherwise route it has had 0 of 2 seats all run.

  It blocks nothing in Phases 1–4, so the roadmap ships around it, and the gap
  stays recorded here — which is its own stated fallback.

### blocker: owner-reserved-boundary

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 5 in full
- **What to do:** pick exactly one — (a) confirm that a static ratchet
  forbidding an `autoMerge` settings key does **not** touch the open
  merge-authority question that `ADR-239:185-188` and
  `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` leave to the
  owner, or (b) drop Phase 5 entirely, since a ratchet that pre-decides a
  question the owner reserved would be the reservation reimplemented as a
  feature.
- **Resolved when:** the confirmation or the drop is recorded at Phase 5, citing
  `ADR-239:185-188` by line.
- **Recommendation:** (a). A ratchet forbidding a settings key is a static
  check over a name space, not a decision about whether merge authority may
  ever be granted — but the confirmation must come from the owner, because an
  agent asserting that its own check stays inside a reservation is the shape
  the reservation exists for.
- **If you do nothing:** Phase 5 stays blocked. That is a cheap non-decision:
  the key does not exist today, so the ratchet guards against a future nobody
  has proposed, and `ADR-239`'s `review_trigger` already names the reopen
  condition.
- **Disposition 2026-08-22 — the "do nothing" outcome, taken deliberately after
  building Phase 5 and reverting it.** I implemented 5.1 in full before noticing
  this blocker gates the phase, and removed all of it. The blocker's own wording
  forecloses the shortcut: *"an agent asserting that its own check stays inside
  a reservation is the shape the reservation exists for."* Confirming my own
  scope boundary is precisely what (a) reserves to the owner, and the council
  has had 0 of 2 seats.

  Shipping the gate anyway would have been a phase past its own gate — the
  silent-green defect this tree has already had once. What building it taught is
  recorded at 5.1 so the work is not lost, only unshipped.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The negation guard suppresses a real authorization and the failure is silent | implementation | Over-suppression stops authorizing merges the user did order. Nothing happens, so nobody notices — the inverse of D2 and strictly harder to detect than it. | 2.2 requires a positive control corpus that must pass **both** at HEAD and after; a positive case that only passes after is defined as not a control. | Phase 2 — a deterministic negation guard |
| 2 | The `--auto` split ships without the `--disable-auto` exemption | implementation | 1.1 alone deepens the D3 deadlock: turning auto-merge off would then need authorization for two ops instead of one. | 1.4's title states it ships with 1.1 and never after; its verify asserts the de-escalating form classifies as neither op. | Phase 1 — split the merge op |
| 3 | The roadmap grows into a merge policy | product | The source was framed as merge authority, and the framing is easy to reintroduce one step at a time. Every such step is owner-reserved and already decided. | The Goal opens by excluding it, the exclusion table names it first, and `blocker: owner-reserved-boundary` gates the one phase that comes closest. | Phase 5 — a static ratchet, and nothing else |
| 4 | Phase 3 trips the 400-line skill cap | implementation | `roadmap-writing/SKILL.md` is at exactly 400 and the linter fails above it, so any addition must be paid for by a removal in the same change. | The constraint is stated in the phase preamble with the linter line, and 3.1's verify asserts the line count directly. | Phase 3 — the roadmap-authoring carve-out |
| 5 | The GraphQL pattern is bolted onto `ghApiWrite()` and breaks REST classification | implementation | `ghApiWrite()` builds two lookaheads for a write method plus a REST path. Widening it to admit a GraphQL body would loosen every op that uses it, not just merge. | 1.3 states the helper cannot express it and requires a separate pattern; the test asserts the REST cases still classify unchanged. | Phase 1 — split the merge op |

## Acceptance Criteria

- [x] AC-1 — `gh pr merge --auto` and the `enablePullRequestAutoMerge` GraphQL
      mutation are classified as an operation distinct from a plain merge, and a
      regression test names the expected operation for each rather than only
      asserting that it is blocked.
- [x] AC-2 — `gh pr merge <n> --disable-auto` and `disablePullRequestAutoMerge`
      require no merge authorization. The de-escalating deadlock is gone, and it
      was closed in the same change that could have deepened it.
- [x] AC-3 — a prompt saying `do not merge`, `nicht mergen` or
      `never auto-merge` authorizes nothing, while `merge PR #123` still
      authorizes a merge. Both corpora are committed and both run.
- [x] AC-4 — the existing noun-sense exclusions still hold: `merge conflict`
      authorizes nothing, as it does today.
- [x] AC-5 — a roadmap may record a merge the user directed, distinguished from
      merge text that arrived by paste, and `roadmap-writing/SKILL.md` is still
      within its line cap.
- [x] AC-6 — no merge policy, no authorization store and no kernel-rule edit is
      present in the diff. The owner-reserved question is exactly as open as it
      was before.

## Progress note — Phases 1–4 shipped, Phase 5 blocked, NOT archived

17 of 18 steps. 5.1 is `[~]`, blocked by `owner-reserved-boundary`; both
blockers stay **open** because both are unresolvable by an agent — one is a
kernel-rule edit that is a tool-call-time deny, the other reserves to the owner
exactly the confirmation an agent cannot give about its own check. Council: 0 of
2 seats all run.

Not archived: a parked step and two open blockers would be buried, and
converting either to a decision is owner-reserved. `active_roadmaps` unchanged.

### The four defects, closed and measured

Pre-change behaviour, measured against HEAD before anything landed — **4 of 5
vectors were wrong**:

| vector | before | after |
|---|---|---|
| `gh pr merge 12 --auto` | `["pr-merge"]` | `["pr-merge-auto"]` |
| `gh api graphql … enablePullRequestAutoMerge` | `[]` | `["pr-merge-auto"]` |
| `gh pr merge 12 --disable-auto` | `["pr-merge"]` | `[]` |
| `"nicht mergen"` | `["pr-merge"]` | `[]` |
| `"merge PR #123"` (control) | `["pr-merge"]` | `["pr-merge"]` |

The de-escalation exemption ships **with** the split, never after: without it,
1.1 makes the deadlock worse — switching auto-merge *off* would require merge
authorization.

The GraphQL mutation got its **own** pattern rather than a widening of
`ghApiWrite()`. That helper needs both a REST-shaped path and an explicit write
method; widening it to reach a `graphql` body would have loosened every other op
that uses it, which is a bigger change than the defect.

### The positive control corpus is the half that mattered

A negation guard that suppresses too much is **worse** than the defect: it
silently stops authorizing merges the user did order, and the failure is
invisible because nothing happens and nothing says why. The positive corpus
passes at HEAD **and** after — a case that only passes after is not a control.

Both guards sabotage-probed: dropping the negation lookbehind fails 4 cases,
dropping the de-escalation exemption fails 1, restoring gives 20/20.

The lookbehind is **line-scoped** (`[^.!?\n]`), reusing the vocabulary
`turn_end_gate_hook.ts:330` and `:490-493` already carry rather than inventing a
third — two negation vocabularies in one tree drift, and the drift is invisible
until a prompt lands in the gap.

### Three findings beyond the roadmap's scope

1. **The negation defect is not merge-only.** `"Nicht pushen. Merge PR #12."`
   still authorizes `push`. Phase 2 was scoped to the merge action, and widening
   the guard to every op is a change to the authorization surface that deserves
   its own screen — the same reason the merge fix needed a positive corpus first.
   Asserted as **current** behaviour in the test file, so the day someone fixes
   it the test fails and points at the note.
2. **`isInterrogative` reads a leading `"Do "` as a question.**
   `"Do not push. Merge PR #12."` classifies as `[]` — verified **pre-existing**
   at HEAD, not caused by the negation guard.
3. Two of my own first-draft fixtures were wrong, not the code: `"der merge
   commit ist kaputt"` also matches the `commit` op's own prose pattern
   (unrelated to the merge noun-sense), and the REST merge endpoint belongs to
   the **block-side** classifier — `PASTED_COMMANDS` has no `gh api` entry at
   all. Both corrected, with the correction recorded at the assertion.

### Phase 3 fit the cap exactly

`roadmap-writing/SKILL.md` was **at** 400 of a 400 cap, so the carve-out had to
be net-neutral. It is: 400 lines after, `skill_linter` 1 pass / 0 warn, against a
pre-state of 1 pass / 0 warn. Three redundant enumerations were compressed to pay
for it — including a CI-literal list that duplicated the rule it cites.
