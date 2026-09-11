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
  of exactly that, delivered afterwards under a different roadmap; and the source set cites
  `docs/guidelines/enforcement-by-host.md` throughout, a path that does not exist — the file is
  `docs/enforcement-by-host.md`. Prose-only, no runtime change. Also grows open_blockers by two.
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

- [ ] **1.1 Keep the rejection text byte-identical.** The sentence forbidding a run-until-condition
      goal command stays exactly as written.
      verify: `git diff docs/decisions/ADR-118-loop-engineering-boundaries.md` shows no change
      inside the rejection paragraph — only an added amendment note below it.
- [ ] **1.2 Add a dated amendment note** recording that the boundary governs surfaces this package
      exposes to consumers, that the continuation hook is an internal bounded surface delivered
      afterwards under a named roadmap, and that host-native loop primitives are lowering targets
      rather than new surfaces.
      verify: the note carries a date and names the delivering roadmap, and
      `./scripts-run src/scripts/adr_cite_check ADR-118` reports the record's effective state.

## Phase 2 — One closed row per host for the loop primitive

- [ ] **2.1 Add a `loop primitive` row to `docs/enforcement-by-host.md`** with the closed value
      set `none | in-session | subagent | durable`, plus the host's own verb where one exists.
      `corrected-from-reproduction` — the source cites this file as
      `docs/guidelines/enforcement-by-host.md` throughout; that directory holds no such file and
      the real path has no `guidelines/` segment. Editing the cited path would have created a
      second, unread file.
      verify: the row exists in `docs/enforcement-by-host.md` and every host has a value from the
      closed set.
- [ ] **2.2 An unverified host reads `unknown`, never `none`.** Absence of research is not absence
      of the feature, and this is the same failure the capability registry already records for its
      all-false default rows.
      verify: every host value carries a verification date, and no host reads `none` without a
      cited observation.

## Phase 3 — No autonomy claim without its backing

- [ ] **3.1 Find every surface claiming unattended operation** — "runs on its own", "pass N of N",
      or an equivalent — and give each either a claim reference or the word `unbacked`.
      verify: `./scripts-run src/scripts/check_claims` stays green, and no surface quotes a figure
      without its sample size and window label.
- [ ] **3.2 Correct the over-strong guard docstring.** `src/scripts/hooks/block_kernel_rule_writes.ts`
      asserts there is no agent-accessible override; an interpreter or heredoc path is not covered
      by a shell-argument parser, so the sentence claims more than the mechanism delivers.
      verify: the docstring states what the guard actually covers, and
      `npx vitest run tests/scripts/block_kernel_rule_writes.test.ts` stays green.

## Blockers

### blocker: adr-118-amendment-venue
- **Status:** open
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

### blocker: run-continuation-kill-criterion
- **Status:** open
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The amendment is read as permission | product | Touching the boundary at all invites the reading that new loop surfaces are now allowed | Phase 1.1 keeps the rejection byte-identical and the note narrows the scope rather than widening it; the diff shows only an addition | Phase 1 — Put the decision in lineage without weakening it |
| 2 | A second re-engagement authority appears unnoticed | implementation | Today exactly one authority exists because the tree does not know the host's own loop verb; adopting a host primitive would create a second one silently | The host row in Phase 2 is where a second authority becomes visible before it exists, and it carries a verification date so the reading is checkable | Phase 2 — One closed row per host for the loop primitive |
| 3 | Host vocabulary drifts | implementation | A host renames or re-scopes its loop verb and the row goes quietly stale | The value set is closed and every row carries a verification date; no code depends on the row, so drift is a documentation defect rather than a breakage | Phase 2 — One closed row per host for the loop primitive |
| 4 | The pending state outlives the roadmap | product | The engagement proof never arrives and the continuation hook stays indefinitely unproven, which is the shape this roadmap is meant to surface | The kill criterion is carried as a blocker on this file and as a note on the carrier, so it survives this roadmap's completion rather than closing with it | Phase 1 — Put the decision in lineage without weakening it |

## Acceptance Criteria

- [ ] AC-1 — The recorded loop boundary carries a dated amendment note, and its rejection text is
      byte-identical to what it said before.
- [ ] AC-2 — Every host in the enforcement matrix carries a loop-primitive value from the closed
      set, with a verification date, and no host reads `none` without a cited observation.
- [ ] AC-3 — No surface in the tree claims unattended operation without either a claim reference
      or the word `unbacked`, and the claims gate is green.
- [ ] AC-4 — The kernel-write guard's docstring describes what it covers rather than asserting a
      coverage its parser cannot deliver.
- [ ] AC-5 — No runtime behaviour changed. The diff touches documentation, one decision record's
      amendment note, and one docstring.
