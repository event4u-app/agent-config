---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: >-
  A published contract that cannot be false on the path most consumers take. Verified 2026-09-11:
  `src/scripts/_cli/cmd_conformance.ts:109-115` returns `status: 'ok'` with the message
  "no install transaction log — nothing to recover" when the log is absent, and `appendTxLog` has
  exactly one call site repository-wide — `src/server/routes/install.ts:442`, the browser route.
  Every headless install therefore passes that check by construction, while the surface publishes
  "green means installed and firing". The same function offers a remedy that reverse-applies an
  aborted tail; nothing in the tree reverse-applies anything. Also grows open_blockers by two.
estate_offset_exempt: >-
  No offset is available. The prior disposition for this subject reads "Shipped" in an archived
  roadmap, which is why nothing active owns it — the module exists and the path does not call it,
  and that distinction is what closed it prematurely. Archiving another roadmap to buy the slot
  would dispose of open work to reopen a wrongly-closed one.
---
# Road to a conformance check that can fail

> **Source:** `agents/tmp.old/inbox-2026-09-y/t1-typed-state-routing/` — two large plans, a
> two-member revision set and the originating transcript, analysed 2026-09-11. Claim verification
> at HEAD: 41 of 54 claims still true, 3 overtaken, 8 never true at drafting, 2 unverifiable. The
> eight never-true were all already false at the source's own pin, which is a fact about the
> source rather than about the gap.

## Goal

The install-conformance surface can go red on the install path most consumers take, and it stops
offering a recovery this tree cannot perform.

Both halves are measured, not inferred. The transaction-log check returns green when the log is
absent, and the only writer of that log is the browser install route — so a headless install
satisfies the check by having produced nothing. The check's own test file names the branch
explicitly, and its sabotage fixture writes a log first, which means the fixture exercises a path
a headless install never reaches. Meanwhile the failure remedy tells the operator that re-running
init reverse-applies the aborted tail, and no reverse-apply exists: the only rollback writer in
the tree is a dismiss marker with an empty path and a null hash.

## Phase 1 — Make the false green visible, without breaking anyone

- [x] **1.1 Return a distinct non-green status when the log is absent** on a path where a log was
      expected. Not a failure yet — an explicit unknown.
      verify: a fixture root with no transaction log yields a non-`ok` row for that check and the
      conformance run names it; the row is not `fail`.
- [x] **1.2 Keep the genuinely-nothing-to-do case green.** A tree that was never installed is not
      a degraded install.
      verify: the two cases are distinguishable in the output and a test asserts each.

## Phase 2 — Ground the remedy or remove it

- [x] **2.1 Make the failure remedy name an action this tree performs.** Either implement the
      reverse-apply, or say what re-running init actually does.
      verify: `grep -rn 'reverse-appl' src/` names nothing the tree cannot do, and a test asserts
      the remedy string resolves to real behaviour.
- [x] **2.2 Do not widen the scope to make the sentence true.** Implementing a reverse-apply and
      correcting the wording are different-sized changes and the choice is the blocker's.
      verify: whichever is chosen, the other is recorded as declined with its reason.

### Phase 2 decision — 2026-09-13

**Chosen:** correct the wording. The `txlog-clean` failure remedy now names what
re-running `agent-config init` actually does (re-apply the plan over the partial
tail), and the two source-tree claims that said otherwise
(`src/install/txlog.ts`, `src/install/types.ts`) were corrected with it.
`grep -rn 'reverse-appl' src/` now returns nothing, and
`tests/scripts/_cli/cmd_conformance.test.ts` asserts both halves: the verb the
remedy names resolves through `src/cli/registry.ts`, and no remedy this check
emits promises a recovery the tree cannot perform.

**Declined:** implementing the reverse-apply. Reason — un-writing a partial
install is a new consumer-visible mechanism, not a correction of an existing
one: it needs a durable record of pre-write file state that no writer emits
today (the only rollback-shaped entry in the tree is the wizard's dismiss
marker, carrying an empty path and a null hash), and it is a data-destroying
operation on the user's tree. That is an owner decision about install behavior,
which this phase's own 2.2 exists to keep separate from the wording fix. It is
not scheduled here; the blocker below records it as the open half.

## Phase 3 — Write the log from the path that does the install

- [ ] **3.1 Call the log writer from the headless apply path**, through one writer module with two
      callers.
      verify: a headless install into a fixture root produces at least one write entry, and a test
      asserts both callers emit an identical entry shape.
- [ ] **3.2 The existing sabotage fixture now fires on that path.**
      verify: the fixture reddens the check after a headless install, which it could not do before.

## Phase 4 — The negative fixture for the branch that was always green

- [x] **4.1 Write the absent-log fixture and observe it red before the fix.**
      verify: the red reading is recorded in the commit or the change description; a test never
      seen red has unknown sensitivity.
- [x] **4.2 Prove it does not over-fire.** A never-installed tree and a clean installed tree both
      pass.
      verify: both negative cases are in the same test file and green.

## Phase 5 — Three-state ownership instead of path membership

- [ ] **5.1 Distinguish recorded-unchanged, recorded-modified and unknown** in the install conflict
      matrix, fed by a real hash comparison rather than by path-set membership.
      verify: a user-modified managed file survives a refresh and appears in the report; the matrix
      carries a recorded-unchanged column whose value comes from a hash.
- [x] **5.2 Land the hash plumbing separately from the matrix change.**
      verify: two commits, and the matrix commit's diff contains no hash computation.

### Phase 5 state — 2026-09-13

**Landed:** the recorded-unchanged / recorded-modified / unknown split, fed by
the per-file SHA-256 the manifest records, in two commits with the hash
plumbing separate from the matrix change (5.2, AC-7). A user-modified managed
file is now **named in the report**, where path-set membership dropped it.

**5.1 and AC-6 stay open, and were un-flipped after a completion review**
(`agents/evidence/reviews/drain-conformance-check.findings.md`, findings 1-2).
Their first half — *a user-modified managed file survives a refresh* — is not
delivered and was never true. `src/install/conflict.ts` is the PLANNER; the
single writer is `src/scripts/install.ts`, whose `_resolve_file_conflict`
returns `write` unconditionally for deployed files, whose header records that
a run refreshes every deployed file with package content, and which reads
neither `conflicts` nor `ConflictResolution`. The branch briefly published the
opposite in a preflight remedy, a contract page and two docstrings — the same
unbacked-claim class this roadmap exists to remove — and those are corrected,
with a sensitivity-checked guard test against the class returning.

**What closing 5.1 would take:** the writer consulting the matrix, i.e. a
change to what `agent-config init` does to a file the user edited. That is an
install-behaviour decision of the same shape as the headless-log blocker, so
it is recorded as one below rather than taken here.

## Blockers

### blocker: the-installer-does-not-consult-the-conflict-matrix
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the first half of 5.1 and of AC-6 (*survives a refresh*). The
  reporting half is landed.
- **What to do:** decide whether `agent-config init` may stop overwriting a
  managed file the user has edited. Read `src/scripts/install.ts:556` —
  `_resolve_file_conflict` returns `write` unconditionally for deployed files,
  and the module header at line 23 records `--force` as an accepted no-op
  because installs always overwrite. Nothing in that writer reads the
  `ConflictEntry` list the planner produces.
- **Recommendation:** none offered. The current behaviour is documented and
  deliberate ("a run always refreshes every deployed file with the current
  package content"), and changing it trades a data-loss surface for a
  staleness surface. That trade is the owner's.
- **If you do nothing:** the report names the edited file and the next install
  replaces it, which is at least honest — the surfaces now say so, where a
  week ago they said the opposite.
- **Resolved when:** the writer consults the matrix, or this roadmap records
  the refusal and the reporting half becomes the whole of 5.1.

### blocker: headless-log-write-is-a-consumer-visible-default
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 3, and Phase 4's fix arm. Phases 1, 2 and 5 proceed without it.
- **What to do:** decide whether the command-line install may write a transaction log. It creates
  a new on-disk artefact under the user's home directory and changes install behaviour for every
  consumer, which is a consumer-facing default. Read `src/install/txlog.ts` for what the log
  contains and what its rotation costs — 10 MB or 30 days, whichever comes first.
- **Recommendation:** write it. The check already assumes it exists, publishes a contract that
  depends on it, and offers a recovery premised on it; the log is the missing half of a mechanism
  that already ships, not a new mechanism.
- **If you do nothing:** Phase 1 makes the gap visible as an explicit unknown and Phase 2 stops the
  surface from promising a recovery it cannot perform. That is a smaller but honest outcome.
- **Resolved when:** the headless path writes an entry, or this roadmap records the refusal and
  Phase 1's unknown becomes the permanent answer.
- **State (2026-09-13):** neither. The "if you do nothing" arm has shipped —
  Phase 1 makes the gap an explicit `unknown` and Phase 2 stopped the surface
  promising a recovery the tree cannot perform — and the decision itself is
  untaken, so this stays open. Phase 3 (3.1, 3.2) is unstarted for that reason,
  and so is AC-3 / AC-4. Nothing here forecloses either arm: `unknown` becomes
  `ok` for a headless install the moment that path writes an entry, and becomes
  the permanent answer if the refusal is recorded.

### blocker: the-remedy-string-is-a-published-claim
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 2 only.
- **What to do:** choose between implementing the reverse-apply and correcting the wording. Read
  `src/server/routes/install.ts:442` — the only rollback-shaped entry in the tree is a dismiss
  marker carrying an empty path and a null hash, so there is nothing to reverse today.
- **Recommendation:** correct the wording now and record the reverse-apply as separate work. A
  remedy that names a real smaller action beats one that names a larger imaginary one.
- **If you do nothing:** the surface keeps telling operators that a recovery will happen, and it
  will not.
- **Resolved when:** the remedy string names an action a test can resolve to real code.
- **Resolution (2026-09-13):** the wording was corrected and the reverse-apply
  declined — see § Phase 2 decision above. The remedy now names `agent-config
  init` and describes re-application, not recovery; three tests in
  `tests/scripts/_cli/cmd_conformance.test.ts` resolve it to real code. The
  reverse-apply remains unbuilt and unscheduled.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The check flips red for every existing install at upgrade | product | Turning an always-green branch into a failure reddens every consumer who installed before the log existed | Phase 1 emits an explicit unknown rather than a failure; failure becomes possible only after Phase 3 gives the log something to be clean about | Phase 1 — Make the false green visible, without breaking anyone |
| 2 | A second log writer diverges from the first | implementation | Two call sites emitting different entry shapes makes the log unreadable and the check wrong in a new way | One writer module with two callers, and a shape-equality test across both | Phase 3 — Write the log from the path that does the install |
| 3 | Adding a hash changes install-plan behaviour silently | implementation | Feeding a hash into the conflict matrix changes which files are written on a refresh, and that is a data-loss surface | Phase 5.2 separates the plumbing commit from the matrix commit so each is reviewable on its own; the user-modified-file case is an acceptance criterion | Phase 5 — Three-state ownership instead of path membership |
| 4 | The prior disposition recurs | product | This subject was closed once as shipped, which was true of the module and false of the path, and the same reading would close it again | The change description states which of the three recurrence outcomes applies — here the disposition was wrong, not merely unrecorded — so the distinction is in the record rather than in someone's memory | Phase 4 — The negative fixture for the branch that was always green |

## Acceptance Criteria

- [x] AC-1 — An absent transaction log on a path where one was expected yields an explicit unknown,
      never green, and a never-installed tree still passes.
- [x] AC-2 — The failure remedy names an action the tree performs, proven by a test that resolves
      it to real code.
- [ ] AC-3 — A headless install produces at least one log entry, and both writers emit an identical
      entry shape.
- [ ] AC-4 — The existing sabotage fixture reddens the check after a headless install.
- [x] AC-5 — The absent-log fixture was observed red before the fix, and the reading is recorded.
- [ ] AC-6 — A user-modified managed file survives a refresh and is named in the report.
- [x] AC-7 — The hash plumbing and the matrix change are separate commits.
