---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to estate drawdown — an agent-run campaign that ends with fewer roadmaps, enforced

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-estate-drawdown.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`.
> Adopted 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `097ab6549`.

> **Sibling.** `road-to-gate-autonomy` provides the mechanics — the classes,
> `gates --execute`, the budget ledger, the delegate path. **This roadmap is the
> campaign that uses them, and the ratchet that makes the outcome stick.** It is
> deliberately a steering roadmap: its deliverable is the state of the estate, not
> a feature.

---

## Outcome — per phase, as of 2026-08-21 · **CLOSED**

**This roadmap is now archived, and archived does NOT mean achieved.** Read this
section before anything else in the file. All eight steps are terminal — four
`[x]`, four `[-]` — and the file closes against the outcome states below, never
against a completion percentage. **The estate did not reach T1's ceiling; T1 never
had a registered ceiling to reach.** One of this campaign's five acceptance
criteria is met, one is narrowed, one is transferred and two are abandoned.

The section header used to read *"This roadmap is NOT archived and must not be:
six of its eight steps are still open."* That sentence was true when it was
written and is kept here in quotation rather than deleted, because the campaign's
own risk 1 is **drawdown by burial** and a reader deserves to see that the file
went from "must not be archived" to archived — and to be able to check, from the
table below, whether anything was buried on the way.

**What closed the six steps, in one line each, so the reader does not have to
trust the table:** two were measured empty and accepted as nulls (1.1, 1.2), two
were moved out verbatim into a stub with a named producer and a measured probe
(2.1, 2.2), one was abandoned because the council declined the path it is defined
over (4.1), and one was already done (0.2, on the prior run). Every one of the six
cites a council decision recorded in
[`drain-estate-drawdown-residue`](../../evidence/council/drain-estate-drawdown-residue.md)
or its batch-A/batch-B predecessors. **No step was closed by executing the work it
describes.** That is the honest headline of this campaign and it is stated at the
top rather than left to be inferred from the table.

| Phase | State | What actually happened |
|---|---|---|
| **0 — one sitting, N answers** | **satisfied** | 0.1 generated the sheet (prior run). 0.2 answered it: option (a), per the council, applied per row over the live 21 — 7 accepted, 1 overridden, 12 transferred, 1 answered. The sheet now records the option because the generator reads it from a non-derived record. **AC-0 narrowed:** maintainer time consumed was zero and the two largest-unblock items are dispositioned, but *"most of the user-owned blockers terminal"* is not met — the criterion conflated *answered* with *terminal*. |
| **1 — execute everything runnable** | **abandoned** (1.1) + **narrowed** (1.2) | Not blocked — **empty**. Re-measured 2026-08-21 at `52cfb4bb8`: 35 open blockers in the active tree and 25 in `later/`, **0 class-0 and 0 class-1 among all 60**. Phase 1 acts only on those two classes, so there was nothing to clear and no tranche to schedule at any budget. **1.1 → `[-]`, disposition `C`, outcome `abandoned`** — its sibling gate has since been discharged (that roadmap is archived with its sweep committed), so the step ended with a delivered precondition and an empty subject; `[-]` not `[x]`, because zero blockers were cleared. **1.2 → `[x]`, disposition `A`, outcome `narrowed`** — the budget mechanism shipped (caps, receipt ledger, schema, tests) and its one named item was already transferred in batch A, so nothing is open; no tranche ever ran. **AC-1 abandoned.** |
| **2 — triage sweep** | **transferred** | Batch 1 (ten files) landed on a prior run and is the only batch that ran. Measured 2026-08-21: **71 of 80** files in the active tree and `later/` carry no verdict row — eight further PRs at 2.1's own ten-file ceiling. **2.1, 2.2 and AC-2 → transferred verbatim** into [`stubs/road-to-estate-triage-remaining-batches.md`](../stubs/road-to-estate-triage-remaining-batches.md), producer the maintainer, probe `untriaged → 0` measured at **71**. Narrowing instead would have dropped 71 files with nothing holding them, which is risk 1 firing on this file. AC-2's ceiling clause is separately unsatisfiable — T1 has no registered ceiling. **AC-2 transferred, not met.** |
| **3 — the ratchet lands** | **satisfied** | 3.1 and AC-3 were met on 2026-08-18: `check_estate_count` plus the budget file, green at the baseline, red against fixtures in both directions. Unchanged by this run except for one baseline walk-**down** recorded below. |
| **4 — the recurring pass** | **abandoned** | 4.1's blocker is `b-delegate-gate-maintainer-profile`, the one default the prior run pulled out of option (a), and the council's batch-B row keeps `allow_delegate: false` — so the delegate path the pass is defined over is **explicitly not authorised, by decision rather than omission**. Escalated 2026-08-21 from `transferred` to **`abandoned`** (disposition `E`), on a **split 1/1 council with the dissent recorded**: a stub whose re-entry probe is "`allow_delegate` became true" re-enters only by reversing the council's own adopted choice, which is the parking lot disposition `E` exists to prevent. Every capability the pass would have composed is hand-invocable today; what is abandoned is the scheduled delegated-write automation. **AC-4 abandoned.** This is a user-reserved drop taken under the run's standing delegation — reverse it by restoring 4.1 to `[ ]`. |

**Estate effect of this run: none on the two counts that matter, and one blocker
closed.** Active roadmaps 32 → 32; `later/` 52 → 52; open blockers 70 → 69, the single
closure being `b-consolidated-decision-sheet` itself. The ratchet baseline is walked
down to match, with a history entry — a tightening that is not re-registered becomes a
ceiling nobody is held to.

**Estate effect of the CLOSING run (2026-08-21), kept separate from the note above
rather than overwriting it.** Active roadmaps **24 → 23** — this file, and nothing
else. `later/` **52 → 52**; open blockers **61 → 61**. The blocker count does not
move even though a roadmap closed, and the reason is worth stating: this file's
only blocker was already resolved on the trunk by PR #1492, so archiving it
removed no open record. The ratchet baseline is walked down to 23 with a
`baseline_history` entry that splits **earned from banked** — this change earned
the entire −1 on active and none of the movement on the other two metrics, which
the trunk had already booked.

**And the −1 is not −1 unit of work, which is the number a reader should distrust
first.** Two of the five closures are **transfers into `agents/roadmaps/stubs/`**,
a directory **neither metric counts**. Steps 2.1, 2.2 and AC-2 left with a probe
measured at **71 untriaged files**; the `draft`-status ratchet hole left with its
own two-clause probe. So 71 files of scope departed the counted estate by being
**renamed, not finished**. The campaign's own risk 1 is drawdown by burial, and
this is the shape it would take here — which is why the stub probes are
falsifiable, the producer is named, and the number is written into the ratchet's
history rather than left in the delta.

**What a reader should take from this.** The campaign's premise was that the estate
carries a large stock of decidable-but-uncourriered blockers. Answering the whole
consolidated sheet moved the open-blocker count by **one**, and the reason is now
visible rather than inferred: of 21 user-owned blockers, twelve need a signature, a
repository, a host session, a human rating or an authority grant that no answer can
supply, and classes 0 and 1 — the agent-executable ones — are empty. That is evidence
for this roadmap's own § Honest-null consequence: on today's distribution the estate
looks **under-resourced rather than over-grown**, and it arrived in Phase 1 instead of
Phase 2. The target belongs to the maintainer either way; nothing here re-registers it.

## 0. The defect, stated first

**The estate carries 37 active roadmaps, 44 in `later/`, and 38 open blockers — and
the count does not go down by itself.**

The failure mode is not laziness, it is structure. Blockers wait for humans to
courier commands. Fired resume-triggers go unseen. Decision-ready gates sit inside
files nobody re-reads — the autonomy-defaults gate carries its full recommendation
*in the tooling output* and still blocks a large step count. And new roadmaps
arrive faster than old ones terminate.

The requirement is explicit and becomes this roadmap's only success criterion:
**that the drawdown actually succeeds, rather than the estate continuing to carry
thirty-plus open roadmaps.**

**This roadmap's own adoption is an instance of the defect, and is recorded as
such.** The `/analyze:inbox` run that created this file added **seven** roadmaps to
the active tree in one sitting — from 37 to 44. Every one of them owns verified,
non-duplicated scope, so none is waste; and adding seven at once is exactly the
arrival rate T3 below exists to bound. The honest reading is that the campaign
starts from a *worse* count than the one it was drafted against, and that the seven
are the first cohort its triage sweep must dispose of rather than a set exempt from
it.

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Active and `later/` roadmap counts | **overtaken, direction unchanged** | 37 active and 44 in `later/` at `origin/main`, against the draft's 42 and 44 — archival ran between the pin and adoption. The count then rose to 44 active with this cohort, so the drafted premise understates rather than overstates the problem |
| 2 | 38 open blockers, 13 user-owned; the top items carry large unblock counts | **still-true, exact** | `./agent-config gates --all` prints "13 decisions need you · 25 more with maintainer/external" |
| 3 | Decision-ready gates exist with recommendations already rendered | **still-true** | the gate output's own recommendation blocks |
| 4 | A fired-but-unresumed trigger class exists | **still-true** | `later/road-to-request-scoped-rule-load.md`'s park note against the archived rule-delivery-integrity P2.1 done-note |
| 5 | The estate already has a one-command decision inventory | **still-true** | `roadmap_gates.ts` with its needs-you split |
| 6 | House archive discipline exists — close-with-evidence, migration notes, reject lists | **still-true** | the archival precedents and the roadmap-writing skill's own contract |
| 7 | Batch-disposition precedent exists | **still-true** | the inbox-harvest triage records and their not-adopted register |

## 2. The target, registered before the work

Proposed for maintainer pre-registration. **The numbers are proposals; the *shape*
is the requirement.**

- **T1** — active roadmaps and open blockers each below a registered ceiling within
  a registered window from campaign start. The draft proposed fifteen active and
  twelve blockers over roughly six weeks; both numbers and the window belong to the
  maintainer, and no date is pinned in this file.
- **T2, anti-regrowth** — a CI ratchet on the dashboard counts, the same mechanism
  `preamble-payload-budget` uses: the committed baseline walks **down only**, and
  raising it requires a PR citing evidence in a real sentence rather than a number
  change.
- **T3, one-in-one-out** — while the active count sits above target, a PR adding a
  new active roadmap archives, merges or parks one in the same PR, or carries an
  explicit maintainer exemption tag. **A lint, not an honour system** — and note
  that this cohort of seven would have needed seven offsets or an exemption, which
  is the rule working rather than an argument against it.
- **Quality anchor, so drawdown is not burial** — every closure carries the house
  form: evidence-cited done-notes, a migration note for anything shipped-adjacent, a
  reject or not-adopted register for anything cut, and open steps either executed,
  migrated to a named owner, or parked with a **probe-able** resume condition.
  "Archived to make the number" is detectable: an archive commit missing one of
  these forms fails the lint.

## Phases

### Phase 0 — One sitting, thirteen answers

The human's entire contribution, front-loaded. **This phase needs nothing from the
sibling roadmap — it is runnable with today's tooling.**

- [x] **0.1** Generate ONE consolidated decision sheet from the gate output,
      `owner: user` only — thirteen items: per item the one-line question, the
      rendered recommendation, a default, and what it unblocks, sorted by unblock
      count descending. Items whose entry records no recommendation get one
      **drafted by the agent from the roadmap's own text and marked as
      agent-drafted**, so the provenance of each default is visible.
      `verify:` the sheet contains all thirteen, each with a question, a default and
      its recommendation source labelled.
      - **Done 2026-08-18.** `agent-config gates --sheet` is the generator;
        `agents/decisions/consolidated-decision-sheet.md` is the artefact.
        **The step says thirteen and the estate says 21** — the count grew between
        drafting and execution, which is the arrival rate T3 exists to bound
        rather than a mis-drafted step. The sheet is generated, so the number is
        whatever `Owner: user` currently reports.
      - **The agent-drafted defaults were written into the ROADMAPS, not into the
        sheet**, and that is a deliberate departure from the literal reading. 7 of
        the 21 entries recorded no `Recommendation:`; drafting into the sheet would
        have made it a hand-edited generated file, so the next regeneration would
        silently drop the drafts. Six were written into their own blocker's
        `Recommendation:` field marked `(agent-drafted …)`, and the sheet READS that
        marker — so provenance is visible per row, the sheet stays fully derived,
        and `gates` / `--reply` gained the same recommendations.
      - **The seventh has no field to carry one and the sheet says so.**
        `road-to-gated-reach-followup` states its gate as a legacy
        `> Blocked until …` note rather than a `### blocker:` entry, so it has no
        `Recommendation:` slot. That row is labelled `none — legacy note` and names
        the conversion as what would give it a default; converting another
        roadmap's structure was left out of this change.
      - **By-product:** the drain took `lint_roadmap_blockers:decidability` from a
        **pre-existing red** (28 against a baseline of 26 on `origin/main`) to 22,
        and the baseline was lowered to match. Second recorded instance of that
        ratchet being red on main undetected — it runs in `task ci`, which no
        workflow invokes.
      - `verify:` `./scripts-run src/agent-src/scripts/roadmap_gates --sheet`
        (21 rows, each with a question, a default or a stated reason it has none,
        and a labelled source); 12 renderer cases in
        `tests/scripts/roadmap_gates.test.ts`.
- [x] **0.2** The maintainer answers the sheet once. **Accept-all-defaults is a
      valid answer.** The answers are then appended into each roadmap file at its
      blocker as the decision record — by the agent, not by the human.
      - **Done 2026-08-20.** Answered **option (a)** by the AI council
        ([drain-blocker-dispositions-b](../../evidence/council/drain-blocker-dispositions-b.md),
        row `b-consolidated-decision-sheet | D | satisfied`, both seats convergent).
        Note that (a) is itself an **override of this roadmap's own rendered
        default**, which recommended (c); recorded as such rather than presented as
        agreement. The answer record is
        `agents/decisions/consolidated-decision-sheet-answer.md` — deliberately NOT
        derived, because the sheet is.
      - **Twenty-one rows, not thirteen**, for the reason 0.1 already recorded: the
        estate grew between drafting and answering. The step's own text says
        accept-all is valid, so the count is whatever `Owner: user` reports.
      - **Option (a) was applied per row, and twelve rows are NOT covered by it.**
        The council session that chose (a) carried a dissent that stands — *"blanket
        acceptance of an unseen consolidated sheet is not an informed decision"* — so
        every rendered default was read and audited for whether it is conservative and
        reversible. The decisive input was already in the tree: batch B adopts round
        1's framework by name, and that framework's **Rule 3 is categorical** —
        repository creation, a legal signature, a shipped-default flip, a repo-admin
        setting, a host-env modification or any externally visible / irreversible
        action takes `transferred`, and *"the council may record its preferred choice
        inside the stub; the parent may not record the action as done."* Applying (a)
        blanket would have silently reversed **ten** dispositions the same council
        made in round 1. Split: **7 accepted · 1 overridden · 12 transferred · 1
        answered** (this blocker). Per-row table with the basis for each:
        `agents/decisions/consolidated-decision-sheet-answer.md`.
      - **One default failed the audit on its own content, not merely on Rule 3.**
        `b-delegate-gate-maintainer-profile`'s rendered default (a) enables
        `allow_delegate` — a standing grant of delegated write authority to an agent
        path, which does not undo itself. Pulled out, dispositioned **transferred**
        with the three-point check at its blocker. The council's own batch-B row
        independently narrows that entry to **(b)** — team surface for consultation,
        `allow_delegate: false` — so accept-all would have overwritten a live council
        decision with the option the council declined. This is risk 2 of this
        roadmap's own register (*"the decision sheet front-loads bad defaults"*)
        firing exactly as written, and being caught.
      - **The sheet now records the option.** It could not before: the sheet is
        derived and renders only OPEN `Owner: user` blockers, so an answer written
        into it is lost and — once every row closes — the file would say "nothing to
        answer" with no trace of what was answered. `renderSheet` now READS a
        `<!-- sheet-answer: … -->` marker from the non-derived record and prints it in
        the header, on both the populated and the empty branch.
      - **Recording a decision is not doing the work.** 20 of the 21 blockers stay
        open, because their `Resolved when` asks for an artefact, a signature, a probe
        or a setting that an answer does not produce. Closing them by writing an
        answer beside them would be risk 1 — drawdown by burial.
      - `verify:` `./scripts-run src/agent-src/scripts/roadmap_gates --sheet` header
        carries `ANSWERED 2026-08-20 — option (a)`; 19 `- **Answer:**` fields plus one
        blockquote answer at the legacy note = 20 blocker entries carry their answer;
        the sheet rendered **byte-identical** before and after the 20 insertions,
        which is the evidence that no adjacent blocker field was corrupted; 63 cases
        in `tests/scripts/roadmap_gates.test.ts` (4 new), and the 3 new assertions
        were each shown RED against a sabotaged `answerBanner` / marker regex before
        being accepted as green.
- **AC-0:** a short, bounded amount of maintainer time consumed; most of the thirteen
  user-owned blockers terminal; and the two largest-unblock items dispositioned.
  **Narrowed, not met, 2026-08-20.** Maintainer time consumed: zero — the council held
  the delegated authority, so the sitting never had to happen. The two largest-unblock
  items (49 and 31 steps) are dispositioned. But *"most of the user-owned blockers
  terminal"* is **not** met and was not reachable this way: 20 of 21 stay open because
  Rule 3 or their own `Resolved when` needs something an answer cannot produce. The
  criterion conflated *answered* with *terminal*; they are different states, and the
  gap between them is the honest result of this phase.

### Phase 1 — Execute everything runnable

- [-] **1.1** Once the sibling's classification sweep lands, `gates --execute`
      clears every class-0 blocker: time-window checks, telemetry-count gates, and
      stale-artifact deletions. Where a window is genuinely unfilled, **the blocker
      is re-dated, which is also progress** — an honest "not yet, and here is the
      count" beats an open gate nobody probed.
      `verify:` each cleared blocker carries its evidence append; each re-dated one
      carries the probed count.
      - **Probed 2026-08-20, and the population is EMPTY — this step is not blocked,
        it has no subject.** `roadmap_gates --all --json` over the active tree reports
        **44 open blockers: 25 class-2, 19 class-3, and 0 class-0.** There is no
        class-0 blocker for `gates --execute` to clear, and no unfilled window to
        re-date. Left `[ ]` deliberately: with an empty population both halves of the
        `verify:` clause are *vacuously* true, and marking a step green because it
        scanned nothing is the gate-that-scans-nothing failure this package keeps
        finding. The honest count is the deliverable here, per the step's own "an
        honest 'not yet, and here is the count' beats an open gate nobody probed".
      - **Closed 2026-08-21 — disposition `C` (accept-null), outcome state
        `abandoned`.** Council decision, both seats confirming in round 2:
        [`drain-estate-drawdown-residue`](../../evidence/council/drain-estate-drawdown-residue.md)
        row 1. `[-]` rather than `[x]`, and the distinction is the whole point:
        the criterion says *"clears every class-0 blocker"* and **zero were
        cleared**, so `satisfied` would have been a false claim about work done.
        Disposition `C` because the framework's Rule 4 maps
        instrument-ran-and-answered-zero to `C` categorically, and `E` does not fit
        a mechanism that shipped with 23 fixture tests.
      - **The gate this step opens with has been discharged, which is a change
        since the note above.** 1.1 reads *"Once the sibling's classification sweep
        lands"*. The sibling is `road-to-gate-autonomy`, and it is **archived** —
        its step 1.2 is `[x]` and the sweep artefact is committed at
        `agents/evidence/analysis/gate-class-sweep-2026-08-17.md`. So this step
        was never waiting on a producer at the end; it had a delivered
        precondition and an empty subject.
      - **Four probes, four tree states, one answer.** 49-blocker sweep
        (2026-08-17: twelve classified 0/1, then **reclassified** after each was
        read in full and none could carry an honest `Run:`); 44 (2026-08-20);
        42 (2026-08-20); 35 active + 25 `later/` (2026-08-21, two independent
        instruments). Zero class-0 every time. Measurements and the reconciliation
        of the one-row instrument delta:
        [`estate-drawdown-residue-probe-2026-08-21`](../../evidence/analysis/estate-drawdown-residue-probe-2026-08-21.md).
      - **The claim is bounded to a snapshot, not asserted as an invariant**, and
        that bound is an adopted council objection rather than a hedge. The
        dissenting seat held that twelve entries having been reclassified once
        proves classification is *mutable*, so a zero reading cannot prove future
        class-0 work impossible. Correct. What is claimed: **at `52cfb4bb8` on
        2026-08-21 the class-0 population is empty**, and the sibling's step 1.3
        established the emptiness is the outcome of reading every candidate rather
        than a window that fills. If a future change repopulates class 0, the
        mechanism is shipped and waiting.
- [x] **1.2** Class-1 tranche under the budget ledger, highest-unblock first: the
      live trigger eval — one run, two blockers, three waiting roadmaps — then the
      bench-spend items up to the weekly cap.
      - **`b-consolidated-decision-sheet` no longer blocks this — 2026-08-20 — and
        the step still cannot run, for two independent reasons now measured rather
        than assumed.** First, the class-1 population is **0 of 44** open blockers in
        the active tree (same probe as 1.1), so there is no class-1 tranche to
        schedule. Second, the live trigger eval it names is exactly the pair
        (`skill-activation-window` + `human-gated-live-trigger-eval`) the council
        dispositioned **transferred** into one human-gated stub, so it is not
        agent-runnable at any budget. `b-gate-budget-preauth` is answered — option
        (a), caps USD 5 per run and USD 25 per rolling seven days — but that
        authorises a *shape*: no spend is possible until its settings keys and ledger
        path exist, which is that roadmap's own work. Stays `[~]`.
      - **Closed 2026-08-21 — disposition `A` (re-scope), outcome state
        `narrowed`.** Council decision, both seats confirming in round 2
        ([row 2](../../evidence/council/drain-estate-drawdown-residue.md)). The step
        is recorded as **two halves separately**, which is the adopted instruction
        rather than a presentation choice: one word covering both would hide that
        they ended in different states.
      - **Half one — the mechanism: discharged.** The note above says *"no spend is
        possible until its settings keys and ledger path exist"*. They exist.
        `src/config/agent-settings.template.yml:605-612` carries
        `gate_budget.max_cost_per_run_usd: 5` and
        `max_cost_per_rolling_7d_usd: 25` — exactly the two figures the council
        authorised on `b-gate-budget-preauth`;
        `src/agent-src/scripts/gate_budget.ts:43` writes the append-only receipt
        ledger at `agents/runtime/state/gate-budget-ledger.jsonl`;
        `src/server/schemas/settings.ts:208` carries the schema entry; and
        `tests/scripts/gate_budget.test.ts` covers it. **That sentence in the note
        above is now stale and is left standing on purpose** — it is what was true
        on 2026-08-20, and overwriting it would erase the movement.
      - **Half two — the named work: already transferred, and NOT re-stubbed.** The
        live trigger eval this step names by name is the pair
        `skill-activation-window` + `human-gated-live-trigger-eval`, which the
        council dispositioned **B / transferred** into **one** human-gated stub in
        batch A ([rows 40 and 61](../../evidence/council/drain-blocker-dispositions-a.md)).
        No second stub was created for it here. Both seats reached that
        independently — one citing Rule 5 (duplicate-evidence merging) by name, the
        other saying to reference the existing transfer rather than duplicate it —
        and a second stub over the same evidence gap is precisely what Rule 5
        exists to prevent.
      - **Half three — the population: empty.** Zero class-1 blockers of 60 open
        records across the active tree and `later/`, same measurement as 1.1. So
        even with the mechanism shipped and the caps authorised, there is no
        tranche to schedule at any budget.
      - **What `narrowed` means here, stated so it cannot be read as done:** the
        original criterion asked for a *tranche to run*. No tranche ran, and none
        exists to run. What is discharged is the mechanism plus the disposition of
        the one named item. `[x]` records that nothing about this step is open,
        deferred, or waiting — not that a tranche was executed.
- **AC-1:** open blockers materially below the starting 38; every resolution carries
  its evidence append; the ledger shows spend inside its caps.
  **Not met, and the mechanism it depended on is empty.** 44 open blockers in the
  active tree against a starting 38 — the count rose. Classes 0 and 1, the only ones
  this phase acts on, hold **zero** blockers between them, so no amount of running
  this phase moves the number. That is the honest-null shape this roadmap's own
  § Honest-null consequence describes, arriving in Phase 1 rather than Phase 2.
  **Outcome state `abandoned`, 2026-08-21** — not met, and not meetable by this
  mechanism. Re-measured at `52cfb4bb8`: 35 open blockers in the active tree and
  25 in `later/`, **zero class-0 and zero class-1 among all 60**. The first clause
  did move in the right direction since the note above (44 → 35 in the active
  tree), and **none of that movement is this phase's** — it came from the
  concurrent per-roadmap drain PRs, which is exactly why the clause is recorded as
  not met rather than claimed. The third clause, *"the ledger shows spend inside
  its caps"*, is unreachable for the same reason: the ledger and both caps ship
  (see 1.2), and there was never a class-1 entry to spend on.

### Phase 2 — Triage sweep over the whole estate, in batches, with terminal verdicts

- [-] **2.1** Batches of at most ten roadmaps, one PR each, one verdict per file
      from a **closed vocabulary**: **EXECUTE** (remaining steps are agent-workable
      now — schedule into the recurring pass) · **FINISH-THIN** (nearly done; close
      the tail and ship the closure) · **MERGE-INTO-OWNER** (scope owned elsewhere;
      migrate open steps verbatim, marked moved-not-cancelled) · **DECISION-SHEET**
      (needs one class-2 answer; feeds the next Phase-0-style sitting) ·
      **PARK-PROBEABLE** (legitimately waiting; the resume condition is rewritten to
      be machine-probeable) · **ARCHIVE** (dead or superseded; migration note plus
      not-adopted register).
      `verify:` each batch PR carries one verdict row per file, and no file leaves a
      batch without one.
- [-] **2.2** Sequencing: the active tree first, `later/` second, oldest-untouched
      first within each. **The seven roadmaps this cohort added are in the first
      batch, not exempt from it.** The council may decide MERGE-versus-ARCHIVE calls
      inside its configured reversible class; EXECUTE-versus-ARCHIVE on anything with
      shipped surface stays a maintainer call on the sheet.
      `verify:` the batch order is recorded, and every council-decided verdict names
      the class it was decided under.
      - **Both transferred 2026-08-21 — disposition `B`, outcome state
        `transferred`.** Council decision, both seats confirming in round 2
        ([row 3](../../evidence/council/drain-estate-drawdown-residue.md)). Carrier:
        [`stubs/road-to-estate-triage-remaining-batches.md`](../stubs/road-to-estate-triage-remaining-batches.md),
        which holds 2.1, 2.2 and **AC-2** verbatim.
      - **Why transferred rather than narrowed, in one number.** 71 of the 80 files
        in the active tree and `later/` carry **no verdict row** (24 active, 47
        `later/`), measured 2026-08-21 at `52cfb4bb8`. At 2.1's own ten-file
        ceiling that is **eight further pull requests**, and this change is one.
        AC-2 covers every one of those 71 files, so narrowing the criterion to
        "the batch form was proven" would have dropped 71 files with nothing
        holding them — this roadmap's own **risk 1, drawdown by burial**, firing on
        this roadmap.
      - **A second reason AC-2 cannot close as written, independent of the
        batches.** Its middle clause requires *"the active count reaches T1's
        registered ceiling"*, and **there is no registered ceiling**: step 3.1
        recorded that T1's proposed 15/12 sit in the budget file under `target` and
        are read by nothing, because this roadmap says the numbers and the window
        belong to the maintainer. That clause is unsatisfiable by construction, so
        the stub's probe can reach zero with AC-2 still open, and the stub says so.
      - **The producer is the maintainer, independently of Phase 4** — a binding
        condition the council attached to its confirmation, not a stylistic
        choice. The draft of the stub had named the Phase-4 recurring pass as an
        alternate producer; 4.1 is **abandoned** below, so that naming would have
        pointed at something that no longer exists. It was removed.
      - **The stub's probe can fall without a batch running, and the stub warns
        about it.** Roughly 25 concurrent per-roadmap drain PRs were open against
        `main` on the transfer date, each archiving one roadmap out of the
        denominator. A falling count is not batch progress.
      - **Untouched by this run, deliberately — 2026-08-20.** 2.1 caps a batch at ten
        roadmaps and one PR, and this change is not a triage batch: it answers a
        decision sheet. Adding a second batch on top would break 2.1's own one-PR
        ceiling and collide with the parallel drain runs currently editing several of
        the files a batch would have to select. Both boxes close only when the sweep
        reaches the whole estate, which is unchanged: batch 1 covered ten of 32 active
        files.
- **AC-2:** every file in the estate carries a terminal verdict row; the active count
  reaches T1's registered ceiling; **no closure lands without its house-form
  artifacts.**
  **Outcome state `transferred`, 2026-08-21** — moved verbatim into
  [`stubs/road-to-estate-triage-remaining-batches.md`](../stubs/road-to-estate-triage-remaining-batches.md)
  with 2.1 and 2.2. Clause 1 is **not met**: 71 of 80 files in the active tree and
  `later/` carry no verdict row. Clause 2 is **unsatisfiable as written** — T1 has
  no registered ceiling, because step 3.1 recorded that the proposed 15/12 live
  under `target` and are read by nothing. Clause 3 **holds for the one batch that
  ran** — batch 1's six PARK-PROBEABLE verdicts each carry a resume condition, a
  probe and its verdict-at-parking, and its two DECISION-SHEET rows name their
  blocker ids. The stub's probe covers clause 1 and explicitly cannot discharge
  clause 2.

> **Batch 1 landed 2026-08-19** — `agents/decisions/estate-triage-dispositions.yml`,
> ten verdict rows, the register's first batch. 2.1 and 2.2 stay `[ ]` on purpose:
> they close when the sweep reaches the whole estate, and one PR is one batch by
> 2.1's own ceiling. Selection followed 2.2 exactly — the seven-file
> `/analyze:inbox` cohort plus the three oldest-untouched active files.
> **Result:** 6 PARK-PROBEABLE, 2 DECISION-SHEET, 2 EXECUTE. No ARCHIVE and no
> MERGE-INTO-OWNER, so no council round was needed — 2.2 admits council decision
> only for MERGE-versus-ARCHIVE inside its reversible class.
> **Estate effect:** active 37 → 34, `later/` 43 → 49. The `later/` rise is the
> whole point of the metric being ratcheted, so it is raised with a reason rather
> than absorbed silently — see `src/config/estate-count-budget.json`.
>
> **Three findings the sweep produced, recorded because they change what
> PARK-PROBEABLE means:**
>
> 1. **The verdict's name outran its probe.** `resume_probe` could decide exactly
>    one phrasing — a roadmap slug — so 42 of 44 park notes were `undecidable`
>    before this batch, and six more would have been. A verdict called
>    PARK-PROBEABLE that produces conditions nothing can probe is the
>    gate-that-scans-nothing class this package keeps finding. The probe now also
>    decides a single backticked repo-relative **file** path under an
>    **existence** predicate bound positionally to that path; **1** of the 6 new
>    notes is decidable and reports `unmet`, and the other 5 are recorded with
>    the reason per row rather than smoothed into the same word.
>    **It was 2 until the R2 round said why it should not be.** The second was
>    decidable only because the note had moved its content bar into a sibling
>    bolded field, and `_truncateAtNextField` cuts there — so a bar one field
>    down is invisible to both guards and the probe would have reported FIRED on
>    an empty file. Field placement flipping a verdict is a bypass, and it had
>    been written down as the intended authoring pattern. The bar is back inside
>    the condition, the note reads `undecidable`, and the count went down. A
>    probe that decides fewer notes honestly is worth more than one that decides
>    more of them by an authoring trick.
> 2. **A clause was being cut inside its own backticks.** `conditionClause`
>    stopped at the first `.`, which is the dot in `foo.md` and in a step id like
>    `3.3` — so three of the six notes lost the very path they named. Fixed with
>    a backtick-aware sentence head; the regression is a test.
> 3. **An existence test would have un-parked live work.**
>    `road-to-catalogue-host-fit` waits until `skill-catalogue.jsonl` holds 20
>    observations; the file exists today with 7 lines, so a bare existence probe
>    would have reported FIRED 13 observations early. The path branch is gated on
>    an existence predicate for exactly that reason, and that row is the
>    regression fixture.

### Phase 3 — The ratchet lands

- [x] **3.1** An estate-count gate: read the dashboard, compare against the
      committed baseline, red on growth, with the raise-reason discipline for any
      increase. Plus the one-in-one-out lint per T3.
      `verify:` the gate is green at the registered ceiling, and a fixture PR that
      adds an active roadmap without an offset **fails**.
      - **Done 2026-08-18.** `src/scripts/check_estate_count.ts` +
        `src/config/estate-count-budget.json`. Both halves under one gate id, so
        the registration surface is one row rather than two.
      - **"Read the dashboard" is implemented as reading the dashboard's own
        parser**, not as scraping its markdown: `collect()` from
        `update_roadmap_progress`, imported. Verified that `collect().length` is 38
        and its summed open blockers are 49 — exactly the two numbers the dashboard
        header prints, so the gate cannot disagree with the page it is named after.
        `later/` is counted from the filesystem because parked roadmaps are outside
        that corpus by design.
      - **No ceiling was invented.** T1's proposed 15 / 12 are recorded in the
        budget under `target` and read by nothing, because this roadmap says both
        the numbers and the window belong to the maintainer. T3's "while the active
        count sits above target" therefore has no registered threshold, and
        `one_in_one_out.applies_above_active: null` states that and applies the
        lint. The baseline is the **measured** estate (38/44/49), not a target — a
        hard 15-roadmap gate would be red the day it lands.
      - `verify:` `./scripts-run src/scripts/check_estate_count` green at the
        baseline; `--self-test` 5/5 (3 rejecting); 16 vitest cases over throwaway
        git repos covering growth, the addition-without-offset fixture, the
        paid-for-by-archive fixture, un-parking, the exemption tag, the registered
        ceiling in both directions, and a dead scan root exiting 2 rather than 1;
        `check_gate_coverage --canary` reports "caught the planted
        contract-violation defect (exit 1)", so the gate is verified-not-blind.
- **AC-3:** both gates exist and are red/green against fixtures in both directions.
  **Met 2026-08-18** — the two directions are the `--self-test` accept/reject pairs
  and the vitest fixtures above; the canary proves it against the shipped CLI.

### Phase 4 — The recurring agent pass, so this never regrows

- [-] **4.1** A scheduled agent run over the delegate path executes, in order: the
      fired-trigger probe from the sibling's Phase 4, then `gates --execute` over
      classes 0 and 1, then a draft of the next decision-sheet delta if class-2 items
      accumulated, then a one-paragraph estate report — counts, deltas, spend — the
      maintainer can read in under a minute. The pass is capped by the per-day call
      cap and the budget ledger, and **never touches class 3.** Blocked on the
      sibling's delegate-gate blocker.
      - **Still blocked, and the blocker changed character — 2026-08-20.**
        `b-delegate-gate-maintainer-profile` was the one rendered default this run
        pulled out of option (a): its default (a) would have enabled `allow_delegate`,
        and the council's own batch-B row narrows it to (b) with `allow_delegate:
        false`. So the delegate path this pass is supposed to run on is now
        **explicitly not authorised**, by decision rather than by omission, and the
        step is blocked on a maintainer-owned transfer. Recorded here because it moves
        4.1 from "waiting for a sibling step" to "waiting for a named human", which is
        a different kind of open.
      - **Closed 2026-08-21 — disposition `E` (abandon), outcome state
        `abandoned`. Council SPLIT 1/1; the dissent is recorded and stands.**
        [Row 5](../../evidence/council/drain-estate-drawdown-residue.md). It had to be
        resolved: `[~]` is a deferral, and Iron Law 3 forbids archiving a roadmap
        with one open.
      - **Adopted (openai seat):** *"The council explicitly declined the required
        delegate path, so transferring this specification would create a zombie
        obligation whose re-entry condition reverses an adopted decision."* A stub
        whose re-entry probe is "`allow_delegate` became true" would re-enter only
        by reversing the council's own batch-B choice of (b). That is the parking
        lot the framework created disposition `E` to prevent — *"without it,
        permanently-infeasible work is forced into stubs that become parking lots
        while completion percentages report success."*
      - **Dissent (anthropic seat), recorded:** `B / transferred` — batch B recorded
        the blocker as `narrowed`, not `abandoned`, so the entry stays alive and
        re-enters when a maintainer authorises `allow_delegate`. Not adopted,
        because `narrowed` describes the **blocker's** disposition — option (b)
        adopted instead of (a) — and not this step's viability. The blocker was
        narrowed; the step defined over the option that was **declined** lost its
        subject. Both seats did agree the item is **separate** from the Phase-2
        stub, so no merge was made.
      - **Nothing capable is lost, and that is checked rather than asserted.** Each
        of the four actions the pass would have composed exists today and is
        hand-invocable: `resume_probe` (used by triage batch 1), `gates --execute`
        (shipped, 23 fixture tests — and zero subjects, per 1.1), `gates --sheet`,
        and `check_estate_count` for the one-paragraph count report. What is
        abandoned is the **scheduled delegated-write automation** — precisely and
        only the thing the council declined.
      - **Authority note.** `abandoned` drops an item, so Iron Law 3's preservation
        test routes it to the **user**, never the council. It was taken by the
        council under this drain run's standing delegation, the same delegation
        `drain-blocker-dispositions-a` records for all 44 blockers. Recorded so the
        chain is visible: a maintainer who disagrees reverses this by restoring 4.1
        to `[ ]`, and nothing else in this change depends on it.
- **AC-4:** several consecutive reports exist; the open-blocker count is flat or
  falling across them; maintainer reading time per period is the one report.
  **Outcome state `abandoned`, 2026-08-21** — abandoned with 4.1, which it is
  wholly defined over. **Zero** reports exist and none will, because the pass that
  would emit them runs on a delegate path the council declined. Recorded honestly
  against a temptation worth naming: the open-blocker count **is** falling (44 → 35
  in the active tree since 2026-08-20), so the middle clause could be presented as
  satisfied. It is not — the clause asks for the count to be flat or falling
  *across the reports*, and with no reports there is nothing to measure it across.
  A metric moving for unrelated reasons is not evidence for a criterion about an
  instrument that was never built.

## Blockers

### blocker: b-consolidated-decision-sheet
- **Status:** RESOLVED 2026-08-20 — **option (a)**, accept all rendered defaults, with
  twelve of the twenty-one rows dispositioned `transferred` because Rule 3 or the
  default's own content puts them outside what (a) can accept
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 0 step 0.2, and through it the class-1 tranche in 1.2. Step 0.1
  generates the sheet without it, and Phase 2's triage sweep proceeds independently.
- **What to do:** answer the consolidated decision sheet that step 0.1 produces —
  thirteen user-owned blockers, sorted by unblock count, each with a one-line
  question, a rendered or agent-drafted recommendation, and a default. Options:
  (a) accept all defaults, which is an explicitly valid answer and the fastest path;
  (b) answer item by item, overriding where the default is wrong; (c) answer only
  the two largest-unblock items and defer the rest to a later sitting, which still
  discharges most of the blocked step count. Whichever path, the agent writes the
  answers back into each roadmap at its blocker — that is not maintainer work.
- **Recommendation:** **option (c) — answer the two largest-unblock items, defer the
  rest.** It discharges most of the blocked step count for a fraction of the reading,
  which is the whole point of sorting the sheet by unblock count. Option (a) is
  faster still but accept-all-defaults over thirteen items includes the
  agent-drafted defaults, and those are the ones risk 2 flags as least examined.
  Option (b) is the most careful and the most likely not to happen — this blocker
  exists because thirteen reading assignments already did not happen once.
- **If you do nothing:** thirteen user-owned blockers stay open, the two largest
  unblocks keep holding their step counts, and the campaign starts from a count that
  rose rather than fell — 44 active after this cohort. Phase 2's triage sweep still
  runs, so verdicts land, but every DECISION-SHEET verdict routes back to this same
  unanswered sheet.
- **Answer:** **option (a) — accept all rendered defaults**, decided by the AI council
  in [drain-blocker-dispositions-b](../../evidence/council/drain-blocker-dispositions-b.md)
  (row `b-consolidated-decision-sheet | D | satisfied`, both seats convergent). This
  **overrides** the `Recommendation:` above, which argued for (c); the override is the
  council's, and the reason (c) was preferred — that accept-all includes the
  agent-drafted defaults nobody has examined — was answered by auditing all 21 rows
  individually rather than by taking the option's word for it. Applied per row, not
  blanket: **7 accepted · 1 overridden · 12 transferred · 1 answered.** Twelve rows are
  outside option (a) because the framework batch B adopts by name makes Rule 3
  categorical — an externally gated or irreversible action takes `transferred`, and the
  parent may not record it as done — and blanket acceptance would have reversed ten
  dispositions the same council made in round 1. One row,
  `b-delegate-gate-maintainer-profile`, failed on its own content: its default enables
  `allow_delegate`, a standing grant of delegated write authority, and the council's own
  batch-B row narrows that entry to (b) with `allow_delegate: false`. Per-row basis:
  `agents/decisions/consolidated-decision-sheet-answer.md`.
- **Resolved when:** each of the thirteen carries either an answer or an explicit
  deferral recorded at its own blocker, and the sheet records which option was used.
  **Met 2026-08-20** — on the live count of 21 rather than the drafted thirteen: 20
  blocker entries carry an `- **Answer:**` field, the 21st (a legacy `> Blocked until …`
  note with no field to carry one) carries its answer as a blockquote at the note, and
  the sheet's own header now prints `ANSWERED 2026-08-20 — option (a)` because
  `renderSheet` reads it from the non-derived answer record. It could not have recorded
  the option by being edited: the sheet is regenerated on every run.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Drawdown by burial — real work archived to hit the target | product | A count target creates direct pressure to close files rather than finish work, and an archived roadmap with live open scope is a silent loss of governed intent | The § 2 quality anchor is a **lint, not a norm**: every ARCHIVE needs a migration note and a register entry, and one batch per campaign is spot-audited against the anchor | Phase 2 — Triage sweep |
| 2 | The decision sheet front-loads bad defaults | product | Accept-all-defaults is offered as the fastest path, so a wrong agent-drafted default becomes a decision nobody examined | Every default names its source — rendered recommendation versus agent-drafted — the agent-drafted ones are the first spot-audit targets, and every class-2 call is reversible by definition | Phase 0 — One sitting, thirteen answers |
| 3 | Council overreach on dispositions | product | Letting the council decide MERGE-versus-ARCHIVE moves governance decisions off the maintainer for a class that can contain shipped surface | The council decides only inside its configured reversible class; anything with shipped surface or user-visible behaviour goes on the sheet, and each council verdict names its class | Phase 2 |
| 4 | The recurring pass drifts into feature work | implementation | A scheduled agent run with repo write access will find things to fix, and a janitor that opens feature PRs is no longer a janitor | Its command list is **closed** — probe, execute, draft the sheet delta, report — and a pass that opens a PR beyond blocker-evidence appends violates its own contract, which the orchestration ledger records | Phase 4 — The recurring agent pass |
| 5 | The target number was wrong | product | A ceiling chosen before the triage distribution is known could be unreachable, and an unreachable gate teaches readers to ignore it | The **ratchet direction is the commitment, not the number**: a maintainer PR can re-register the target with a reason, and only silent drift is forbidden | 2. The target |
| 6 | This cohort's own arrival is treated as exempt | product | Seven roadmaps landed in one sitting under the campaign that is supposed to bound arrivals; exempting them would make T3 advisory from day one | § 0 records the cohort as an instance of the defect, and step 2.2 puts the seven in the **first** triage batch rather than outside the sweep | Phase 2 |
| 7 | The estate is under-resourced rather than over-grown | product | If the verdicts come back overwhelmingly EXECUTE-with-real-work, the count is a symptom and cutting it would destroy real plans | The honest-null consequence below publishes the per-verdict distribution and re-registers the target against the measured throughput of the recurring pass, rather than loosening the quality anchor to make the number | Honest-null consequence |

## CUT list — do not re-litigate

- **Auto-merging closure PRs.** Merge stays human — Hard Floor and the inherited
  anti-goals; auto-merge is permanently excluded. Cut.
- **Deleting `later/` wholesale.** Parked-whole is the house discipline;
  PARK-PROBEABLE replaces silent deletion. Cut.
- **A standing roadmap-janitor daemon.** The recurring pass is a one-shot scheduled
  run; residency stays rejected, the same verdict that killed the dispatcher daemon.
  Cut.
- **Counting `archive/` growth as failure.** Archives are the intended terminal
  state; only the active count and open blockers are ratcheted. Cut.

## Honest-null consequence

If after Phase 2 the estate resists — the active count stuck well above target
because the verdicts came back overwhelmingly EXECUTE-with-real-work — then the
finding is that the estate is **under-resourced, not over-grown**. The campaign
publishes the per-verdict distribution, the target is re-registered against the
measured throughput of the recurring pass, and the drawdown claim is downgraded in
public rather than the quality anchor being loosened to make the number.
