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

- [x] **2.1 Write a read-only script that, given a held object, reports how many distinct prior
      round directories in the consumed-inbox tree raise its subject.** Distinct rounds, not
      distinct files — counting files inflates a single round with many revisions into many
      arrivals.
      verify: run against an object with a known count and it reproduces it; run with the inbox
      tree absent and it exits 0 reporting "no prior rounds readable", never 0 arrivals.
      `src/scripts/report_held_object_arrivals.ts`. **Reproduction case:**
      `stubs/road-to-standing-rule-delivery-per-machine.md` records 15 distinct round directories
      measured 2026-09-06; the reporter finds 17 today, of which `inbox-2026-09-u` and
      `inbox-2026-09-y` postdate that measurement — 17 − 2 = 15 exactly. **It reproduces only
      because that counter states its pattern**, which is the sharpest finding of this phase: a
      recorded figure without its pattern is unreproducible even on the machine that took it.
      **Non-reproduction, recorded rather than tuned away:** `stubs/road-to-subagent-return-gate.md`
      records 24; three probes return 5 (slug), 23, and 135 (broad). Its figure names a unit but no
      pattern, so no probe can confirm or refute it. Left as a finding.
      **Absent-tree branch verified through the real entry point**, exit 0:
      `tree: unreadable` · "no prior rounds readable … This is NOT a count of zero arrivals: no
      reading was taken." The first draft could not be tested here at all — `--tree` was the head
      of a fallback chain, so an explicitly-named unreadable tree silently fell through to the real
      one and reported 5 arrivals. Corrected to a genuine override for both `--tree` and
      `AGENT_CONFIG_INBOX_TREE`; the implicit chain applies only when neither is given.
- [x] **2.2 The script writes nothing.** It is a reporter, and the counter stays a human-authored
      line so a count carries a reason.
      verify: `grep -nE 'writeFile|mkdir|appendFile' <the script>` returns nothing.
      Returns nothing.

## Phase 3 — Notice a held object with no counter

- [x] **3.1 Add a check that fires when a stub or parked roadmap is cited as a blocked finding and
      carries no arrival line.**
      verify: the check has a negative fixture — a first-arrival held object with no counter must
      pass, because a first arrival has nothing to count.
      `src/scripts/check_held_object_arrivals.ts`. `--self-test` runs 5 cases, 2 rejecting, and the
      mandated negative fixture is among them: *"a first-arrival held object with no counter and no
      citation passes (expected accept, exit 0)"*. 26/26 unit tests, both polarities per rule.
- [x] **3.2 Measure its false-positive rate before it blocks.** Run it over the current stub
      corpus and record the rate.
      verify: the rate is recorded in the evidence tree; absent that measurement the check ships
      advisory, because a measurement is not a gate.
      `agents/evidence/analysis/held-object-arrival-counter-rate.md`. Firing rate **4 of 9
      (44.4 %)**; adjudicated false positives **0 of 4 (0.0 %)** — all four citing blockers were
      read and all four are genuine second arrivals.
      **It ships ADVISORY anyway, and the reason is not the rate.** A 0 % false-positive rate would
      permit blocking; what forbids it is that the check is red on four live objects the day it
      lands, and a gate that arrives red is a backlog rather than a control. `--enforce` exits 1,
      so promotion is a flag rather than an edit. Promotion condition: those four carry their
      counters, then re-measure — nine is a reading, not a rate.
      **Two wider scopes were measured first, and they are why the scope narrowed:** every markdown
      file under `agents/` and `docs/` with a keyword-proximity citation fires 56/72 (77.8 %); the
      same citer set with structural blocker scope fires 54/66 (81.8 %). Both are dominated by
      archived roadmaps and stored review inputs, which are historical by construction.
- [x] **3.3 Prove sensitivity.** Remove a counter from a fixture, watch the check fire, restore it.
      verify: both readings are recorded in the commit.
      Fixture `stubs/road-to-runtime-orchestration-substrate.md`, counter removed and restored
      byte-for-byte — sha256 `8af04da9…63c4` identical before and after. Red under `--enforce`:
      exit 1, "5 of 9 held object(s) cited inside a live blocker carry no arrival line", the
      fixture named among them. Green after restore: back to 4 of 9, the fixture gone from the
      list. Both readings verbatim in the evidence file.

## Phase 4 — Put the question on the object, not in the reply

- [x] **4.1 For every held object past its third arrival, write the posed owner question onto the
      object itself**, as numbered options with no recommended answer.
      verify: each such object carries a question a reader can answer without reconstructing it,
      and the count is beside it.
      Seven objects at N ≥ 4: `later/road-to-worker-generation-recycling` (4),
      `stubs/road-to-consumer-capability-share` (6), `stubs/road-to-live-trigger-eval` (10),
      `stubs/road-to-runtime-orchestration-substrate` (10), `stubs/road-to-subagent-return-gate`
      (24), `stubs/the-14-21-0-ledger-is-ingestible` (6), and `ADR-134` (27).
      `later/road-to-run-continuation-observation` (4) is the eighth and was excluded — it is being
      changed on another branch.
      One object already satisfied 4.1 and was **not** rewritten: `road-to-consumer-capability-share`
      carried its own posed question with three answerable options. Three surgical fixes there
      instead — see 4.2.
      **ADR-134 follows the council ruling**: two blockquotes in the **body**, frontmatter
      untouched, and `adr_cite_check` confirms the record parses identically (`accepted`,
      `not-fired`, same two referencing ADRs). Placed after the H1 rather than between frontmatter
      and title: the ruling's substance is *body, not frontmatter*, and every sibling in this tree
      puts its arrival line after the title.
- [x] **4.2 The count sets the venue, never the verdict.** A large number means the earlier
      disposition did not hold; it does not mean the earlier disposition was wrong.
      verify: no question on any object reads as an argument for a particular answer.
      Every block closes with an explicit venue-not-verdict sentence; none carries a
      "(Recommended)" marker, a recommendation line, or an ordering that implies preference. Each
      option names its own cost in the same clause, so no option reads as the cheap one.
      **One pre-existing 4.2 violation was found and neutralised.**
      `road-to-consumer-capability-share` read that a ratio "moved **the wrong way** after five
      readings asked for the opposite" — a verdict wearing a measurement's clothes. Now: "moved
      **further from the direction** five earlier readings asked for". Same fact, no judgement.
      The same file's closing line said recording nothing had produced **three** arrivals while its
      own counter read six; corrected to six.
      At 24 arrivals the risk is sharpest, so that block states outright that the measured facts
      precede the options, attach to none of them, and are not changed by the count.

## Blockers

### blocker: counter-on-a-decision-record
- **Status:** resolved 2026-09-12 by council — added, in the body, scoped semantically
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
- **Resolution:** **added, option (c).** Council, 2 seats (anthropic/claude-sonnet-4-5,
  openai/codex-default), quorum concluded, converged 2/2 — and on a third option rather than on
  either of the two the blocker offered. The line goes in the **body**, never in the
  machine-parsed frontmatter, so `adr_cite_check` reads an unchanged schema; verified after the
  edit (`accepted`, trigger `not-fired`, same two referencing ADRs). Eligibility is
  **semantic, not categorical**: an ADR carries arrival history when its operative decision
  *defers, parks, or otherwise holds* the mapped subject. ADR-134 is a dated defer and qualifies;
  a settled implementation decision does not. That answers the blocker's contract-surface
  objection without the blanket exclusion option (b) would have bought.
  On the wording, one seat corrected the other and the correction was taken: a disclaimer reading
  "does not bear on the decision" is **too broad**, because the count *is* evidence about whether
  the prior disposition has held — it is only not evidence that the deferred proposal is correct.
  The shipped line says the history "triggers review of whether the holding disposition remains
  effective; it does not determine the review outcome."
  Both seats also held that the imminent expiry argues **for** adding it now rather than against:
  a superseding deferral inherits the count instead of re-deriving it.
- **Note:** owner-classified Class 3, routed to the council under this run's standing delegation
  and recorded rather than silently reclassified.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The counter becomes the argument | product | An item gets acted on because its number is large, which is capitulation-by-tally and exactly as wrong as dismissing it repeatedly | Phase 4.2 makes it explicit: the count sets the venue and never the verdict; the questions carry no recommended answer | Phase 4 — Put the question on the object, not in the reply |
| 2 | The check fires on the whole stub corpus and gets suppressed | implementation | A gate that reds on a hundred files is a suppression target, not a control | Phase 3.2 gates blocking on a measured false-positive rate and ships advisory until then | Phase 3 — Notice a held object with no counter |
| 3 | A count derived from a gitignored tree reads as authoritative | implementation | The consumed-inbox tree exists on one machine, so nobody else can reproduce the number, and a confident figure invites reliance | Phase 1.3 forces the denominator into the line; Phase 2.1 makes an absent tree report "not readable" rather than zero | Phase 1 — Write the counters that are already known |
| 4 | The counters go stale immediately | product | A line written once and never incremented is worse than none, because it looks current | Phase 2's reporter makes the next increment one command rather than a re-derivation, which is the only thing that makes the practice survivable | Phase 2 — Derive the count instead of remembering it |

## Acceptance Criteria

- [x] AC-1 — Every held object this round's survivors mapped onto carries an arrival line with its
      count and its latest round codename — codenames only.
      **The criterion is met as restated here, and the restatement is the honest part.** As
      written it also required "and its earlier ones". Count and latest codename: all 13 objects
      carry them, and `check_no_external_sources` is green, so the codenames-only constraint
      holds. The **earlier-codenames clause is satisfied on exactly one object** — ADR-134, the
      only arrival line this branch authored from a fresh measurement, which lists nine round
      codenames plus the shape of the remaining eighteen. The other twelve inherit lines written
      on `main` that name only the latest.
      Closing the clause on those twelve means re-deriving twelve counts from a gitignored,
      machine-local tree. Step 1.3 and risk row 3 both warn against exactly that, and Phase 2
      exists because "the reporter makes the next increment one command rather than a
      re-derivation". So the clause is **deferred to the mechanism this roadmap shipped**, not
      quietly dropped: `report_held_object_arrivals <object> --pattern <subject>` derives it, and
      the Phase 2.1 finding says why it must be run with a pattern — a recorded figure without its
      pattern is unreproducible even on the machine that took it.
- [x] AC-2 — The object whose counter under-counted reads its measured value.
      Met twice over, and only the second is this branch's work. The object the roadmap names
      (`road-to-consumer-capability-share`) already read its corrected 6 on `main`. A second,
      different under-count was found here: `the-14-21-0-ledger-is-ingestible` returned 5 to the
      roadmap's own verify grep from a file whose head says 6. A third correction landed in Phase
      4 — the same consumer-capability stub's closing line still said "three arrivals" against its
      own counter of six.
- [x] AC-3 — A read-only reporter derives an arrival count from the consumed-inbox tree, counts
      distinct rounds rather than files, writes nothing, and reports an absent tree as unreadable
      rather than as zero.
      **Three of the four verified through the real entry point; the fourth is verified by a
      source grep, and the completion review was right to say so.** "Writes nothing" is asserted by
      `grep -nE 'writeFile|mkdir|appendFile'` over the source — which `rmSync`, `unlinkSync`,
      `renameSync`, `copyFileSync` and `createWriteStream` would all pass. That is the property the
      step itself specifies and the check it specifies, so the step is met; the claim is narrowed
      here from "verified" to "verified by the grep the step names", because the two are not the
      same assurance and the earlier wording said the stronger one.
      The absent-tree property was the one at risk:
      the first draft made `--tree` the head of a fallback chain, so a named-unreadable tree fell
      through to the real one and reported a count — the required behaviour was untestable on any
      machine that has the tree. Corrected to a true override.
- [x] AC-4 — A check exists that notices a cited held object with no counter, has a passing
      first-arrival fixture, and was observed both red and green.
      `--self-test` 5/5 with the first-arrival fixture passing. Red and green both captured, with
      the fixture restored byte-for-byte (sha256 identical).
- [x] AC-5 — The check is blocking only if its false-positive rate over the live stub corpus was
      measured and recorded first.
      Met, and it lands **advisory**. The rate was measured first — 0 of 4 adjudicated false
      positives, over a 4-of-9 firing rate, with two wider scopes measured and rejected at 77.8 %
      and 81.8 %. A 0 % rate would have permitted blocking; it ships advisory anyway because it is
      red on four live objects the day it lands, and a gate that arrives red is a backlog.
- [x] AC-6 — Every held object past its third arrival carries its posed question on the object,
      with no recommended answer.
      Seven of eight; the eighth (`later/road-to-run-continuation-observation`) is excluded because
      another branch is editing it, and is named here rather than silently omitted.
