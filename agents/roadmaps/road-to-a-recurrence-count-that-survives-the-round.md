---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-the-substrate-stub-meeting-its-open-gate
    relation: disjoint
    note: >
      That roadmap re-adjudicates one held object whose gate has opened. This one
      is about the counting practice across all of them. Neither waits on the
      other; this one writes the counter that one reads.
estate_growth_exempt: >-
  Three independent readings of three unrelated topic folders in one inbox round each found the
  same defect, which is what makes it structural rather than incidental: the arrival-counter
  practice is live — 28 files under `agents/roadmaps/` carry an `Arrivals:` line — and it reaches
  almost none of the objects that absorb repeat arrivals. Verified 2026-09-11: of the thirteen
  held objects this round's survivors map onto, twelve carry no counter and the thirteenth
  under-counts. No stub carries one at all. Also grows open_blockers by one.
estate_offset_exempt: >-
  There is nothing to offset against. This roadmap exists because the estate's own parked and
  stubbed objects lose their arrival history between rounds, so archiving one of them to buy the
  slot would delete an instance of exactly the record this work is trying to preserve. The active
  estate is mechanism work on unrelated surfaces.
---
# Road to a recurrence count that survives the round

> **Source:** `agents/tmp.old/inbox-2026-09-y/` and `agents/tmp.old/inbox-2026-09-w/` — five topic
> folders analysed 2026-09-11. Three of the five, reading unrelated subjects, independently
> reported the same finding: the arrival count is computed, written into the round's own evidence
> file, and lost when the round is consumed. One subject in this round is arriving for at least
> the twenty-seventh time and the object holding it carries no number.

## Goal

A held object — a stub, a parked roadmap, a blocker, a decision record — carries its own arrival
count, so the next round that raises the same subject meets a number instead of a fresh argument.
The count is derived rather than remembered, and a held object cited as blocked without one is
visible rather than silent.

The failure this closes is precise and was measured. The count is not missing because nobody
computes it: every round computes it correctly and writes it into a round-scoped evidence file
that the next round does not read. One subject has been recorded as "the ninth identical finding",
another as the twenty-seventh, and the objects holding them have no number on them at all.

## Phase 1 — Write the counters that are already known

- [x] **1.1 Put the arrival line on every held object this round's survivors mapped onto.** One
      line directly under the object's `Source:` header or frontmatter, naming the count, the
      latest round codename, and the earlier ones by codename.
      verify: each named file carries a line matching `^> \*\*Arrivals:\*\* [0-9]`, and
      `./scripts-run src/scripts/check_no_external_sources` stays green — codenames only, never a
      source identity.
      **Mostly already true when this branch started, and that is the finding.** Eleven of the
      twelve unblocked objects were counted on `main` by commit `2dc60dc5f` (2026-09-11); this
      branch closed the twelfth. 30 arrival lines now exist across 29 held files.
      `check_no_external_sources` green. **One clause of this step is NOT satisfied and is not
      claimed** — see the note under AC-1.
- [x] **1.2 Correct the one object whose counter under-counts.** It records three arrivals against
      a measured six.
      verify: the corrected number is on the file with the round codenames that justify it.
      **Satisfied on `main`, not by this branch.** `stubs/road-to-consumer-capability-share.md`
      already reads 6, justified by `inbox-2026-09-y`, `inbox-2026-09-q` and `inbox-2026-09-e`.
      Recorded rather than re-claimed.
      **A second, different under-count was found and fixed here.**
      `stubs/the-14-21-0-ledger-is-ingestible.md` carried its only `Arrivals:` line buried at
      line 133 inside a historical arrival-5 block, reading **5**, while the same file's head says
      "owner decision after arrival 6" and its own count line reads "6 arrivals, 5 instance fixes,
      0 mechanism fixes". The roadmap's own verify grep returned 5 from a file that says 6. A
      canonical line at 6 was added at the head; the historical block, which declares itself kept
      as written, was left untouched. The prior lane skipped this file because it "already carried
      a counter" — true, and the counter was stale against the file's own content.
- [x] **1.3 Say where each number came from.** The inbox tree is gitignored, so a clone cannot
      re-derive these counts; the ordering is the finding, not the exact figure.
      verify: the line names the denominator it was counted over, so a later reader can tell a
      measured count from a remembered one.
      Every line names its denominator. The eleven pre-existing ones use *distinct prior round
      directories under the consumed-inbox tree*, marked as a subject-matched floor with
      "(at least)". The one added here uses a **different** denominator — distinct release cycles
      in which the ledger went missing, one arrival block per cycle in the file itself — and says
      so explicitly, including that the two figures are therefore not comparable. A denominator
      that silently differed would have been worse than a missing one.
      **Environment fact this step depends on, recorded because it is not obvious.** The
      consumed-inbox tree is absent from this worktree and lives only in the parent checkout. The
      counts were read from there and nothing was written there. This is the same asymmetry the
      run-continuation ledger hit, and it is why Phase 2.1 must distinguish an unreadable tree from
      a zero count.

## Phase 2 — Derive the count instead of remembering it

- [ ] **2.1 Write a read-only script that, given a held object, reports how many distinct prior
      round directories in the consumed-inbox tree raise its subject.** Distinct rounds, not
      distinct files — counting files inflates a single round with many revisions into many
      arrivals.
      verify: run against an object with a known count and it reproduces it; run with the inbox
      tree absent and it exits 0 reporting "no prior rounds readable", never 0 arrivals.
- [ ] **2.2 The script writes nothing.** It is a reporter, and the counter stays a human-authored
      line so a count carries a reason.
      verify: `grep -nE 'writeFile|mkdir|appendFile' <the script>` returns nothing.

## Phase 3 — Notice a held object with no counter

- [ ] **3.1 Add a check that fires when a stub or parked roadmap is cited as a blocked finding and
      carries no arrival line.**
      verify: the check has a negative fixture — a first-arrival held object with no counter must
      pass, because a first arrival has nothing to count.
- [ ] **3.2 Measure its false-positive rate before it blocks.** Run it over the current stub
      corpus and record the rate.
      verify: the rate is recorded in the evidence tree; absent that measurement the check ships
      advisory, because a measurement is not a gate.
- [ ] **3.3 Prove sensitivity.** Remove a counter from a fixture, watch the check fire, restore it.
      verify: both readings are recorded in the commit.

## Phase 4 — Put the question on the object, not in the reply

- [ ] **4.1 For every held object past its third arrival, write the posed owner question onto the
      object itself**, as numbered options with no recommended answer.
      verify: each such object carries a question a reader can answer without reconstructing it,
      and the count is beside it.
- [ ] **4.2 The count sets the venue, never the verdict.** A large number means the earlier
      disposition did not hold; it does not mean the earlier disposition was wrong.
      verify: no question on any object reads as an argument for a particular answer.

## Blockers

### blocker: counter-on-a-decision-record
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the one item in Phase 1.1 that would edit a decision record's header. The other
  twelve objects are stubs and parked roadmaps and are unblocked.
- **What to do:** decide whether an arrival counter may be added to a decision record's header.
  Adding a line is authoring scope and changes no decision, but a decision record is a contract
  surface and its header shape is not this roadmap's to set. Read
  `docs/decisions/ADR-134-launch-decision-dated-defer.md` and run
  `./scripts-run src/scripts/adr_cite_check ADR-134` for its effective state — it carries an expiry
  four days out at the time of writing and its own text reserves the decision to the owner. Two
  options: (a) add the line to the record's header; (b) keep decision records out of the counting
  practice and record that exclusion here.
- **Recommendation:** add it. The line records how many times the subject arrived, which is a fact
  about the rounds and not a claim about the decision; withholding it means the twenty-eighth
  arrival meets the same silence the twenty-seventh did.
- **If you do nothing:** twelve of the thirteen objects get their counter and the decision record
  does not, which is the one where the count is largest.
- **Resolved when:** the record carries the line, or this roadmap records the refusal and its
  reason.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The counter becomes the argument | product | An item gets acted on because its number is large, which is capitulation-by-tally and exactly as wrong as dismissing it repeatedly | Phase 4.2 makes it explicit: the count sets the venue and never the verdict; the questions carry no recommended answer | Phase 4 — Put the question on the object, not in the reply |
| 2 | The check fires on the whole stub corpus and gets suppressed | implementation | A gate that reds on a hundred files is a suppression target, not a control | Phase 3.2 gates blocking on a measured false-positive rate and ships advisory until then | Phase 3 — Notice a held object with no counter |
| 3 | A count derived from a gitignored tree reads as authoritative | implementation | The consumed-inbox tree exists on one machine, so nobody else can reproduce the number, and a confident figure invites reliance | Phase 1.3 forces the denominator into the line; Phase 2.1 makes an absent tree report "not readable" rather than zero | Phase 1 — Write the counters that are already known |
| 4 | The counters go stale immediately | product | A line written once and never incremented is worse than none, because it looks current | Phase 2's reporter makes the next increment one command rather than a re-derivation, which is the only thing that makes the practice survivable | Phase 2 — Derive the count instead of remembering it |

## Acceptance Criteria

- [ ] AC-1 — Every held object this round's survivors mapped onto carries an arrival line with its
      count, its latest round codename, and its earlier ones — codenames only.
- [ ] AC-2 — The object whose counter under-counted reads its measured value.
- [ ] AC-3 — A read-only reporter derives an arrival count from the consumed-inbox tree, counts
      distinct rounds rather than files, writes nothing, and reports an absent tree as unreadable
      rather than as zero.
- [ ] AC-4 — A check exists that notices a cited held object with no counter, has a passing
      first-arrival fixture, and was observed both red and green.
- [ ] AC-5 — The check is blocking only if its false-positive rate over the live stub corpus was
      measured and recorded first.
- [ ] AC-6 — Every held object past its third arrival carries its posed question on the object,
      with no recommended answer.
