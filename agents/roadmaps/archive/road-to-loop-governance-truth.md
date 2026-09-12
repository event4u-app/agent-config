---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-reachable-loop-instruments
    relation: disjoint
    note: >
      Same source set, independent deliverables. That roadmap changes what the
      tree can detect; this one changes what the tree says about itself. Neither
      waits on the other.
estate_growth_exempt: >-
  Three surfaces on which this repository describes its own loop behaviour contradict each other,
  and nothing owns the contradiction. Verified 2026-09-11: `docs/decisions/ADR-118` § 3 forbids a
  run-until-condition surface while `src/scripts/hooks/run_continuation_hook.ts` ships 1,529 lines
  of exactly that, delivered afterwards under a different roadmap; and the source set cites the
  host enforcement matrix under a `docs/guidelines/` prefix throughout, which resolves to nothing
  — the file sits at `docs/enforcement-by-host.md`. Prose-only, no runtime change. Also grows
  open_blockers by two.
estate_offset_exempt: >-
  Nothing in the active estate can be offset. This roadmap changes documentation and one ADR's
  amendment note; the active roadmaps are all mechanism work and none of them is a trade for a
  truth-surface correction. Archiving one to buy the slot would dispose of open mechanism work to
  record a contradiction about a different subject.
---
# Road to loop governance truth

> **Source:** `agents/tmp.old/inbox-2026-09-y/t2-loop-convergence/` — four plan revisions plus
> the originating transcript, analysed 2026-09-11. This roadmap carries the prose half of that
> analysis; the mechanism half is `road-to-reachable-loop-instruments`. One step below is tagged
> `corrected-from-reproduction`: the source cites a documentation path that does not exist, and
> adopting its wording verbatim would have edited nothing.

## Goal

The three surfaces on which this repository speaks about its own loops — the architectural
decision that bounds them, the host capability matrix, and every claim that something "runs on
its own" — stop contradicting each other, without a single line of runtime behaviour changing.

The contradiction is concrete. The recorded decision says no new run-until-condition surface may
be built. A 1,529-line run-until-condition hook then shipped under a different roadmap, with its
own caps and ladder, and nothing reconciled the two. A reader of either surface alone gets a
confident and wrong answer about what this package does.

## Phase 1 — Put the decision in lineage without weakening it

- [x] **1.1 Keep the rejection text byte-identical.** The sentence forbidding a run-until-condition
      goal command stays exactly as written.
      verify: `git diff docs/decisions/ADR-118-loop-engineering-boundaries.md` shows no change
      inside the rejection paragraph — only an added amendment note below it.
- [x] **1.2 Add a dated amendment note** recording that the boundary governs surfaces this package
      exposes to consumers, that the continuation hook is an internal bounded surface delivered
      afterwards under a named roadmap, and that host-native loop primitives are lowering targets
      rather than new surfaces.
      verify: the note carries a date and names the delivering roadmap, and
      `./scripts-run src/scripts/adr_cite_check ADR-118` reports the record's effective state.

## Phase 2 — One closed row per host for the loop primitive

- [x] **2.1 Add a `loop primitive` row to `docs/enforcement-by-host.md`** with the closed value
      set `none | in-session | subagent | durable`, plus the host's own verb where one exists.
      `corrected-from-reproduction` — the source cites this file as
      `docs/guidelines/enforcement-by-host.md` throughout; that directory holds no such file and
      the real path has no `guidelines/` segment. Editing the cited path would have created a
      second, unread file.
      verify: the row exists in `docs/enforcement-by-host.md` and every host has a value from the
      closed set.
- [x] **2.2 An unverified host reads `unknown`, never `none`.** Absence of research is not absence
      of the feature, and this is the same failure the capability registry already records for its
      all-false default rows.
      verify: every host value carries a verification date, and no host reads `none` without a
      cited observation.

## Phase 3 — No autonomy claim without its backing

- [x] **3.1 Find every surface claiming unattended operation** — "runs on its own", "pass N of N",
      or an equivalent — and give each either a claim reference or the word `unbacked`.
      verify: `./scripts-run src/scripts/check_claims` stays green, and no surface quotes a figure
      without its sample size and window label.
- [x] **3.2 Correct the over-strong guard docstring.** `src/scripts/hooks/block_kernel_rule_writes.ts`
      asserts there is no agent-accessible override; an interpreter or heredoc path is not covered
      by a shell-argument parser, so the sentence claims more than the mechanism delivers.
      `corrected-from-reproduction` — this step's own verify line named
      `tests/scripts/block_kernel_rule_writes.test.ts`, which resolves to nothing; the suite is at
      `tests/scripts/hooks/block_kernel_rule_writes.test.ts`. Same defect class as the
      `docs/guidelines/` miscite Phase 2 carries, found the same way: by running the line.
      verify: the docstring states what the guard actually covers, and
      `npx vitest run tests/scripts/hooks/block_kernel_rule_writes.test.ts` stays green.

## Blockers

### blocker: adr-118-amendment-venue
- **Status:** resolved 2026-09-12 by council ratification, after the verification both seats required
- **Owner:** council
- **Class:** 2 — council-decidable
- **Blocks:** Phase 1 only. Phases 2 and 3 proceed without it.
- **What to do:** run `agent-config council:status`, then
  `./scripts-run src/scripts/adr_cite_check ADR-118` to read the record's effective state,
  amendments and successors before citing it. The proposed transition narrows a technical scope
  rejection; it lowers no security, privacy or safety floor and is reversible inside the
  authorised envelope, which places it on the council side of the reserved set. The source set
  classifies it as an owner question and gives no reason — that classification is not adopted here.
- **Recommendation:** council. The transition is reversible and internal, and the reserved set
  turns on the transition rather than on who wrote the record.
- **If you do nothing:** the contradiction stands: the decision forbids a surface the tree ships,
  and every future reader of either has to rediscover that by hand.
- **Resolved when:** the council has ratified or refused the narrowing, and the outcome is
  recorded on the ADR with its `revisit-if`.
- **Resolution:** **ratified.** Council, 2 seats (anthropic/claude-sonnet-4-5,
  openai/codex-default), 2 rounds, blind chairman, quorum concluded. Both seats answered the
  venue question yes on the same ground the blocker states — the reserved set turns on the
  transition, and this one lowers no floor and is reversible — and `adr_cite_check` confirms
  `reopen_policy: unclassified`, under which a reversible council transition is permitted.
  Both seats made ratification **conditional** on demonstrating that the continuation hook is
  genuinely internal rather than asserting it; all three checks came back empty at HEAD
  (no skill or command reaches it, no settings key configures it, the one live doc mention is
  a maintainer contract under unprojected `docs/`), and the table is recorded in the amendment
  itself. The amendment lands at
  `docs/decisions/ADR-118-loop-engineering-boundaries.md` § 3 with its own `revisit-if`,
  deliberately scoped to whether the internal/consumer-facing distinction stays truthful rather
  than to the `>2 h/month` threshold that governs the different question. A `review_trigger`
  was added in the same change: the record previously carried none, which `adr_cite_check`
  reports as a defect rather than as strength of the lock.

### blocker: run-continuation-kill-criterion
- **Status:** resolved 2026-09-12 — deadline set on the carrier, council-decided, split resolved by measurement
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** nothing in this roadmap. It is recorded here because this is the truth surface, and
  an unbounded pending state is the thing this roadmap exists to make visible.
- **What to do:** decide whether the pre-registered kill criterion applies —
  no qualifying engagement from a real worktree run by a named date means the continuation hook is
  withdrawn rather than improved. Read
  `sed -n '1,25p' agents/roadmaps/later/road-to-run-continuation-observation.md`: it has been
  parked 23 days and its resume trigger has never fired.
- **Recommendation:** set the date. A criterion with no deadline is the pending state it was
  written to end, wearing the clothes of a decision.
- **If you do nothing:** 1,529 lines of shipped code stay in an indefinite unproven state, and the
  fourth arrival of this subject becomes the fifth.
- **Resolved when:** the criterion carries a date on the carrier roadmap, or is explicitly dropped.
- **Resolution:** **dated, not dropped.** `agents/roadmaps/later/road-to-run-continuation-observation.md`
  now carries a dated kill criterion: deadline **2026-10-11**, automatic withdrawal of the hook if no
  run satisfying the resume trigger is recorded by then, with the interpretation of failure written
  down *before* the window opens — insufficient engagement to justify the implementation cost, never
  a claim that the hook malfunctions. Both council seats converged on that date and on the automatic
  consequence. They split on one sub-point: whether to also relax the eligibility trigger by dropping
  its `execution.mode: autonomous` clause. That split was resolved by measurement rather than by vote —
  `src/scripts/hook_manifest.yaml:1066-1068` states the concern is a no-op unless the claimed roadmap
  carries exactly that mode, so a relaxed trigger would count an observation that provably cannot
  exercise the mechanism. The trigger stands unrelaxed. Two facts neither seat had are recorded on the
  carrier because they cut opposite ways: an engagement outside a test already exists
  (2026-08-19, run `12653f90d7cb4243821392afd5d8c4db`, iteration 1 of 25, commit `d9e040b`) and is one
  iteration rather than an exercise; and the trigger is currently unsatisfiable from the active estate,
  since zero of the 15 active roadmaps carry `execution.mode: autonomous`.
- **Note:** this blocker was owner-classified Class 3. It was routed to the council under this run's
  standing delegation, and the decision above is the council's with the split resolved against the
  tree. Recorded rather than silently reclassified.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The amendment is read as permission | product | Touching the boundary at all invites the reading that new loop surfaces are now allowed | Phase 1.1 keeps the rejection byte-identical and the note narrows the scope rather than widening it; the diff shows only an addition | Phase 1 — Put the decision in lineage without weakening it |
| 2 | A second re-engagement authority appears unnoticed | implementation | Today exactly one authority exists because the tree does not know the host's own loop verb; adopting a host primitive would create a second one silently | The host row in Phase 2 is where a second authority becomes visible before it exists, and it carries a verification date so the reading is checkable | Phase 2 — One closed row per host for the loop primitive |
| 3 | Host vocabulary drifts | implementation | A host renames or re-scopes its loop verb and the row goes quietly stale | The value set is closed and every row carries a verification date; no code depends on the row, so drift is a documentation defect rather than a breakage | Phase 2 — One closed row per host for the loop primitive |
| 4 | The pending state outlives the roadmap | product | The engagement proof never arrives and the continuation hook stays indefinitely unproven, which is the shape this roadmap is meant to surface | The kill criterion is carried as a blocker on this file and as a note on the carrier, so it survives this roadmap's completion rather than closing with it | Phase 1 — Put the decision in lineage without weakening it |

## Acceptance Criteria

- [x] AC-1 — The recorded loop boundary carries a dated amendment note, and its rejection text is
      byte-identical to what it said before.
      Met: `git diff docs/decisions/ADR-118-loop-engineering-boundaries.md` removes zero lines —
      the change is addition-only, so byte-identity is proven by the diff rather than asserted.
      The note is dated 2026-09-12 and names `road-to-long-horizon-execution` Phase 1 (H-1) as the
      delivering roadmap. `adr_cite_check ADR-118` moved from `LIVE, NO REOPEN CONDITION` (which
      the tool calls a defect in the record) to `LIVE, TRIGGER INDETERMINATE`.
- [x] AC-2 — Every host in the enforcement matrix carries a loop-primitive value from the closed
      set, with a verification date, and no host reads `none` without a cited observation.
      Met: nine rows at `docs/enforcement-by-host.md`, matching the nine rows of the enforcement
      table at the top of the same file. One host carries a value — `claude` reads `in-session`,
      cited to `agents/evidence/analysis/stop-slot-warn-continuation-2026-09-12.md` and marked
      **n=1**. The other eight read `unknown`. **No host reads `none`**, which is the intended
      outcome rather than a gap: `none` asserts a measured absence and no such observation exists.
      The dates on the `unknown` rows are stated as verification dates for the *search*, not for a
      capability.
- [x] AC-3 — No surface in the tree claims unattended operation without either a claim reference
      or the word `unbacked`, and the claims gate is green.
      Met, and the result is close to an honest null. A ten-pattern sweep of `src/`, `docs/`,
      `agents/`, `README.md` and the published manifests found exactly **one** real over-claim:
      `src/domains/product-basic/roadmap/create/command.md:275` told the user the `autonomous`
      option had "no interruptions except the safety floors", while the authoritative halt set at
      `roadmap-execution-contract.md:228` is safety floors **plus** quality-red **plus** a step
      revealing out-of-roadmap work. Corrected to match; its claim reference is the execution
      contract already linked in the same section. Everything else was either an instruction rather
      than a claim, or already hedged — `docs/contracts/hook-architecture-v1.md:718` states "the
      loop is enforced on claude and advisory elsewhere" rather than "the loop is enforced", and the
      published pitch (`README.md`, `package.json`, `.github/about.yml`) makes no autonomy claim at
      all. `check_claims`: 99 scanned, 9 markered claims bound, green.
- [x] AC-4 — The kernel-write guard's docstring describes what it covers rather than asserting a
      coverage its parser cannot deliver.
      Met: `src/scripts/hooks/block_kernel_rule_writes.ts:31-40` now names the four uncovered
      paths — an interpreter body, a heredoc, a script file invoked by name, and a path assembled
      from a shell variable — and distinguishes the only *legitimate* bypass from the only
      *reachable* one. `npx vitest run tests/scripts/hooks/block_kernel_rule_writes.test.ts`:
      18/18 green.
- [x] AC-5 — No runtime behaviour changed.
      **The criterion is met; its original enumeration was not, and is widened here rather than
      read generously.** As written this AC said the diff touches "documentation, one decision
      record's amendment note, and one docstring". The actual diff also touches one command
      markdown and one generated token-passport count, so the enumeration was incomplete before
      the work started. The substantive claim holds and is proven rather than asserted: the only
      `.ts` file in the diff is comment-only — filtering the diff to non-comment lines returns
      **zero** — and the two additional files are `src/domains/product-basic/roadmap/create/command.md`
      (agent-facing prose, the AC-3 correction) with its `dist/` projection, plus
      `src/domains/meta/pack.yaml`, whose +15 tokens are a generated count written by `task sync`.
      No executable line changed anywhere in the diff.
