---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-stop-that-holds
entry_condition:
  what: the owner resolves blocker(s) kill-switch-owner-decision, d1-stop-ladder-after-reading
  when: whenever the owner takes the next step
  who: owner
review_by: 2026-12-31
estate_growth_exempt: >-
  Owner-chosen archive of road-to-a-stop-that-holds: its deferred steps wait on owner
  blocker(s) kill-switch-owner-decision, d1-stop-ladder-after-reading and are parked here instead of left active. The parent
  is archived in the same change, so the active count drops by one.
---
# Road to a stop that holds — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-a-stop-that-holds`](../archive/road-to-a-stop-that-holds.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-a-stop-that-holds deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-a-stop-that-holds

- [ ] **1.4 Kill-switch table.** <!-- blocked-by: kill-switch-owner-decision | asked: no — the question is already open and already put, as `daemon-host-kill-switch` in `road-to-adversarial-verification-and-long-runs.md`; re-asking it from a second file would duplicate a live decision rather than advance it --> Add `## Kill switches` to
      `docs/contracts/hook-architecture-v1.md` listing every
      `AGENT_CONFIG_[A-Z_]+` the hooks read (bracket form —
      `run_continuation_hook.ts:1018`, `state_io.ts:42`, …), with owner class;
      resolve blocker `daemon-host-kill-switch` in the adversarial roadmap by
      pointing its `Resolved when` at the table.
      verify: `./scripts-run src/scripts/check_kill_switch_table` -> 0
      (carried 2026-10-02: the original clause was a raw grep piped into a line
      count with no expectation, which cannot fail; this gate compares the switch
      set against the table's rows every run, as the note below records.)
      <!-- TABLE HALF DONE AND VERIFIED 2026-09-29, `b9e9d9e34`; STEP STAYS OPEN on
      its second half. `docs/contracts/hook-architecture-v1.md` § Kill switches
      carries 28 rows with an owner class each (`maintainer` / `harness` /
      `orphan`), and the published grep returns 28.
      THE PLAN'S VERIFY COMMAND DOES NOT REPRODUCE, and the corrected one is
      published above the number with its measurement unit. `grep -v
      __AGENT_CONFIG_BUNDLE__` cannot remove that token: `grep -o` emits the match
      without its leading underscores, so the `-v` literal never matches. The
      command also excludes nothing for `__AGENT_CONFIG_CLI_DELEGATE__`, its
      sibling. Both are esbuild `--define` identifiers, not environment variables,
      so neither is a switch; the corrected filter is anchored on the emitted
      token. Raw grep: 30. Unit-corrected: 28.
      TWO FURTHER FINDINGS, in the table rather than silently fixed.
      `AGENT_CONFIG_NO_EVENTS_LOG` is read only OUTSIDE both directories the unit
      covers (`ai_council/events_log.ts`, `ai_team/review_gate.ts`); its row says
      so. `AGENT_CONFIG_TRANSCRIPT_HOME` is read by NOTHING anywhere — the name
      survives in one comment recording a widening the switch used to cause. It
      keeps a row classed `orphan` so the count stays reproducible and nobody sets
      it expecting an effect.
      BLOCKER HALF REFUSED, and the refusal is the finding. The step instructs an
      agent to resolve `daemon-host-kill-switch` by pointing its `Resolved when` at
      this table. That blocker is `Class: 3 — human-only`, `Owner: maintainer`, and
      asks a maintainer to DECIDE the autonomy fallback for a host with no
      process-level stop; a table of environment switches does not answer it, and
      redirecting the condition at a document about a different subject would close
      it on invented evidence. The table is linked in the blocker as one INPUT,
      with that reasoning recorded there; `Status` and `Resolved when` are
      unchanged. Closing this step needs the owner's decision. -->
      <!-- DEFERRED 2026-10-01 — OWNER-OWNED, re-executed and re-affirmed.
      `daemon-host-kill-switch` in `road-to-adversarial-verification-and-long-runs.md`
      was read live rather than its `Status:` trusted. Its own `Resolved when`
      has two halves: `docs/enforcement-by-host.md`'s `destructive:` column
      filled for all eight hosts from measurement, AND each `manual-only` row
      recorded as a decision rather than an unmeasured default. First half met
      (eight rows, each with a `Measured from` cell). Second half untaken, and
      it is a DECISION about whether autonomy is permitted on a host that cannot
      refuse — not a measurement, not a document edit.
      THIS IS THE OWNER-RESERVED CASE AND NOT THE SCHEDULING CASE, tested
      against capability rather than role as this file's own blocker requires.
      The agent can edit both files; what it cannot do is supply the decision.
      Reading `manual-only` off a table that derives it from the absence of a
      `pre_tool_use` binding would infer a decision from a default — which the
      condition's wording rules out in terms, and which is a safety-floor
      question an agent does not settle for an owner in any case.
      NOTHING ELSE IN THIS STEP IS OPEN. The table half closed 2026-09-29 and
      AC-5 closed on it; `check_kill_switch_table` now compares the two SETS
      every run, which is why the count moving from 28 to 30 by merge did not
      silently invalidate the criterion. -->
- [ ] **2.2 Q1 in the detector report.** <!-- blocked-by: q1-shadow-reading-window --> `measure_turn_end_gate.ts` prints
      Q1 = `would_refuse_again` rows / eligible initial refusals per detector;
      the contract's § Q1 loses the word "inert" and names the reader.
      verify: report shows a non-null Q1 after one week of sessions; contract
      diff in the same PR.
      <!-- PER LAYER, NOT POOLED — a constraint the step's own wording does not
      carry, added 2026-09-30 after an independent review found that following
      this line literally writes the defect the record is shaped to prevent.
      `would_refuse_again` rows carry a `layer`, because a `stop_hook_active`
      retry follows ANY stop concern's block and not only this gate's; dividing
      pooled rows by "eligible initial refusals" reads another concern's
      retries against this gate's refusals. Group by `layer` first, then by
      detector. `retries_observed` is keyed the same way so the denominator can
      be split too.
      TWO BOUNDS ON WHATEVER THIS PRINTS, both properties of the instrument
      rather than of the reading: a retry with an unreadable or oversized
      transcript records nothing, so the denominator shrinks and Q1 is an UPPER
      bound; and on a host that sends no `session_id` every session shares one
      record. Both are stated on `ShadowRecord` and belong beside the number
      when 2.3 publishes it. -->
      <!-- PARTLY LANDED 2026-10-01 AND DELIBERATELY NOT CLOSED. It was flipped
      `[x]` earlier that day and reopened the same day by an independent review
      of the pushed branch. The review was right and the reopen is the finding:
      a reader shipped, and it does not print the number this step names.
      WHAT SHIPPED. `collectShadowStats` / `retryConditionedShare` /
      `DISPATCH_CENSORED_DETECTORS` in `src/scripts/_lib/turn_end_refusals.ts`;
      `renderQ1` and the `--q1` / `--workspace` flags in
      `src/scripts/measure_turn_end_gate.ts`; the contract's § Q1 rewritten in
      the same change. `turn_end_refusals.test.ts` 33 green (23 pre-existing
      untouched, 10 added), `measure_turn_end_gate.test.ts` 28 green (16
      pre-existing untouched, 12 added), `turn_end_gate_hook.test.ts` 146 green
      and untouched. `npm run typecheck` and eslint clean on all four files.
      WHY IT IS NOT CLOSED, which is the review's finding and not a scheduling
      note. This step says `Q1 = would_refuse_again rows / ELIGIBLE INITIAL
      REFUSALS per detector`. Q1's definition conditions BOTH halves on the
      detector — a detector's own refusals, refused again by that same detector.
      The shipped reader conditions NEITHER: it divides rows where D would fire
      by every retry observed on the layer, whatever refusal produced it. Ten
      retries, nine after `verification` refusals and one after a `language`
      refusal, one `language` row → Q1 for B is 1/1 = 100 % while the reader
      prints 1/10 = 10 %. Opposite verdicts, and neither bounds the other, so
      this is not Q1 with a looser denominator — it is a neighbouring quantity.
      It is now named one: `retryConditionedShare`, with the report's own header
      saying it may not be read against a bar.
      THE OBSTACLE IS ONE PRODUCER FIELD, which is why this is `[~]` rather than
      a redesign. `ShadowRecord` never records which refusal produced a retry:
      `retries_observed` is keyed by layer alone, a row says only what WOULD
      fire, and `RefusalRecord` holds whole-session counts rather than a
      per-turn origin. Add the originating detector to the shadow row in
      `recordShadow` and Q1 becomes computable from the same rollup.
      A SECOND PRODUCER FIELD IS OWED TOO, found by the same review. The gate
      skips promissory, completion and untested when a dispatch is open and
      `recordShadow` increments `retries_observed` anyway, so those three would
      absorb silences nobody observed — which the contract's attribution clause
      already forbids reporting. They now print `censored`. A `dispatch_open`
      flag on the row closes it. (That clause said "A and D" until today; the
      gate has gated three since F landed 2026-09-11. Corrected in the contract,
      and `DISPATCH_CENSORED_DETECTORS` is now the one set both sides read.)
      WHAT IS GENUINELY DONE AND NEED NOT BE REDONE: the contract half. § Q1 no
      longer calls the quantity inert, states precisely which half of its
      obstacle fell and which did not, names the reader by path and command, and
      keeps both superseded wordings — including the one written this morning
      and wrong by the afternoon — rather than overwriting them.
      THE READING THIS PRODUCES, recorded here and deliberately NOT as a file
      under `agents/evidence/analysis/turn-end-q1-*`: that path is the artefact
      2.3 owes and `d1-stop-ladder-after-reading` resolves partly on its
      existence, so one landing early is the laundered-evidence trap this
      roadmap has already recorded twice. `--q1` over the package root,
      2026-10-01: **2 shadow records**; layer `stop_hook_active` 2 retries and 1
      row — `language` 50.0 % (1/2), `verification` and `pending-decision` 0.0 %
      (0/2), the other three `censored`; layer `refused_turn` 0 retries, so
      every reportable detector prints `—`. n=2, and not a rate.
      THAT NUMBER MOVED WHILE THIS BRANCH WAS BEING REVIEWED — it read 100 %
      (1/1) a few hours earlier, and a clean retry at 01:14Z made it 50 % (1/2).
      The review caught the staleness, which is the third time this roadmap has
      recorded a figure ageing inside its own change. Taken last this time.
      SABOTAGE, six times across the two rounds, each restored from a copy.
      Pooling the denominator across layers → exactly 2 (layer-split,
      null-vs-zero). Globbing `*.json` rather than the shadow suffix → exactly 1
      (mixed-directory). Collapsing `null` to `0.0%` in the renderer → exactly 1
      (em-dash). Removing the empty-timestamp guard → exactly 1
      (absent-timestamp). Removing the censoring branch → exactly 1
      (censored-detectors). Dropping the workspace echo → exactly 1
      (resolved-workspace). No collateral in any of the six.
      TWO OF THE FIRST-ROUND FIXTURES WERE RED BEFORE THEY WERE GREEN, and the
      reds were real rather than arranged: both wrote their shadow file from a
      raw object instead of the record-shaping helper, `parseShadowRecord`
      rejected it, and `files` read 0 where the case expected 1.
      COST TO THE HOOK BUNDLE: **+0 bytes, 0.000 %**, measured rather than
      argued. `npm run build:hooks` at the merge base and at HEAD in this
      worktree both produce `dist/hooks/dispatch.js` at **1,565,516 bytes**,
      byte-identical (digest `bc62ee1a…`), and `grep -c collectShadowStats` over
      the bundle returns **0** — esbuild tree-shakes the whole rollup, because
      the hook path imports `turn_end_refusals` for the record types and never
      for the reader. Worth stating rather than skipping: § Cost this branch
      added records a LIVE `pre_tool_use` cap red whose own `revisit_if` has
      fired, every concern shares one bundle, and a reader arriving there should
      know this pass contributed nothing to it.
      WHAT A FUTURE SESSION NEEDS TO CLOSE THIS, in order, with no decision from
      anyone: (1) add the originating `detector` and `dispatch_open` to the
      shadow row in `recordShadow`; (2) extend `ShadowRecord` /
      `parseShadowRecord` / `foldShadow` to carry them, keeping existing rows
      readable; (3) add a Q1 function beside `retryConditionedShare` that
      conditions both halves on the detector, and uncensor A, D and F for rows
      carrying `dispatch_open: false`; (4) amend the contract's § The two
      quantities and § The two instruments, both of which already name these two
      fields as the obstacle. The retry-conditioned share stays — it is a real
      reading over the same corpus and the two answer different questions. -->
- [ ] **2.3 Publish the reading** <!-- blocked-by: q1-shadow-reading-window --> to `agents/evidence/analysis/turn-end-q1-<date>.md`
      and open programme blocker `d1-stop-ladder-after-reading`.
      verify: file exists; the blocker's `What to do` cites it.
      <!-- DEFERRED 2026-10-01 on elapsed calendar time, and on nothing else.
      ITS STATED BLOCKER IS DISCHARGED: the 2026-09-29 note read "blocked on
      2.2", and 2.2 closed today. What remains is the window, which is six days
      away and which no work inside a session shortens.
      EXACTLY WHAT A SESSION ON OR AFTER 2026-10-07 NEEDS — no re-derivation,
      and no decision from anyone:
        1. `find agents/runtime/state/turn-end-gate -name '*.shadow.json' | wc -l`
           — at the package workspace root, NOT a worktree. Measured 2026-10-01:
           1 file in the main checkout, 0 in the worktree. A worktree reading is
           a reading of the wrong directory and will say zero.
        2. `./scripts-run src/scripts/measure_turn_end_gate --q1 --workspace <package root>`
        3. Write its output verbatim into
           `agents/evidence/analysis/turn-end-q1-<that date>.md`, with the record
           count first and BOTH instrument bounds beside the number — an
           unreadable transcript records neither row nor retry, so every share
           is an upper bound; and a host sending no `session_id` pools sessions
           into one file, so the count is FILES. `renderQ1` already prints both,
           so the obligation is to not strip them.
        4. Open `d1-stop-ladder-after-reading` in the programme and cite that
           file from its `What to do`. The local mirror in this file is resolved
           FROM the programme entry, not instead of it.
      A Q1 OF ZERO IS A COMPLETE OUTCOME, per the blocker's own recommendation,
      and so is a sample that never grew past n=1. Publish what the command
      says. The one thing that is not available is publishing n=1 as though it
      were the reading, which is why this step did not close alongside 2.2. -->
- [ ] **3.3 Carried verbatim** <!-- blocked-by: obligation-shadow-bar-window --> **— 6.1 Arm it only after the pre-registered bar
      holds.** Flip `obligation-settle` to `severity: blocking` only when the
      `CLAIMS.md` reading meets all four parts; the flip PR carries the
      reading and extends `BLOCKING_ALLOWLIST` in
      `tests/hooks/concern_severity.test.ts:42-47`. A human-authorised
      discharge is a `DischargeRow` with `by: ratification:<artifact-id>`
      (`_lib/ratification_artifact.ts`, `agents/evidence/ratifications/`) —
      one authorisation channel, never a second "override" object.
      verify: manifest diff, reading and allowlist change in one commit.
      <!-- OPEN — NOT AGENT-CLOSABLE, and further from closable than before this
      pass. The flip is conditional on the `docs/CLAIMS.md` reading meeting all
      four parts of the pre-registered bar, and step 3.2 RESET that window to
      `5c9415258` on 2026-09-29 — correctly, because until 3.1 the detector could
      not produce a row at all. Clause (3) requires >= 30 calendar days AND >= 50
      affected sessions, both, and clause (2) requires >= 100 shadow rows over >=
      50 sessions. The sample is empty as of the reset. Earliest possible arming
      is 2026-10-29, and only if the rows accumulate and the false-positive rate
      holds at <= 5 %. Clause (4) fixes the alternative now: above 5 %, or a floor
      unmet, the detector is NOT armed and the result is filed `resolved-null`. -->
      <!-- DEFERRED 2026-10-01, condition re-executed live rather than inherited.
      `check_claims` exits 0; all four floors read 0 / 0 / 2 days / 0 against
      100 / 50 / 30 / 50. Clause (5) governs: underpowered settles nothing and
      may be cited for neither direction, so neither arming nor `resolved-null`
      is available today. Full table under
      `### blocker: obligation-shadow-bar-window`.
      WHAT A SESSION ON OR AFTER 2026-10-29 NEEDS, so none of it is re-derived:
        1. `./scripts-run src/scripts/check_claims` — must exit 0.
        2. Read clauses (1)-(3) of `obligation-settle-shadow-bar` in
           `docs/CLAIMS.md` against the live row count (the corrected probe is
           on `obligation-shadow-rows-live`, NOT the `grep -c '"shadow"'` line
           that entry used to carry — it counts keys and read 10 against 0).
        3. All four met and FP <= 5 % → flip `obligation-settle` to
           `severity: blocking` in `src/scripts/hook_manifest.yaml` (it sits at
           `:959`, currently `severity: advisory`, `fail_closed: false`), extend
           `BLOCKING_ALLOWLIST` in `tests/hooks/concern_severity.test.ts`, and
           carry the reading in the same commit.
        4. Any part unmet at the END of the window → clause (4), file
           `resolved-null`. That is a completion, not a failure.
      THE LIKELY BRANCH IS (4), and saying so now is a prediction rather than a
      decision: the sample has been empty for two days of a thirty-day window
      and the live investigation on `obligation-shadow-rows-live` has not yet
      found a path by which a row gets written at all. If that investigation
      closes and rows start accruing, 28 days is enough for 100 of them. If it
      does not, (4) fires on the date and this step closes as a null. -->
- [ ] **3.4 Carried — AC-6 of the parent:** <!-- blocked-by: obligation-shadow-bar-window --> the armed detector refuses a turn
      that wrote files under an undischarged obligation and allows one that
      discharged it, on this repository's own sessions.
      verify: two fixture sessions; `report_obligation_settle` (existing reader
      of the ledger, or `measure_turn_end_gate` if it is the reader) shows one
      refusal and one allow; deleting the referenced `DischargeRow` in the
      allowed fixture reopens settlement and the detector refuses.
      <!-- OPEN — blocked on 3.3. "Once armed" is the step's own precondition and
      nothing is armed; a fixture asserting a refusal the concern cannot emit would
      be asserting the fixture. The discharge-deletion half is testable today and
      is deliberately NOT split out ahead of the arming, because a green test named
      for an armed detector is exactly the artifact a later reader would mistake
      for the arming evidence. -->
      <!-- DEFERRED 2026-10-01. 3.3's blocker re-executed live and all four of
      its floors read zero or near-zero against the bar; nothing is armed, so
      this step's own precondition is unchanged.
      THE 2026-09-29 REFUSAL ABOVE IS RE-AFFIRMED RATHER THAN REVISITED, and
      that matters because this run's mandate was to close what is closable.
      The discharge-deletion half IS writable today. It is still not written,
      for the reason already recorded: a green test carrying this step's name
      would be read by the next session as the arming evidence, and this file
      has twice recorded that a laundered artifact is the most expensive
      mistake it can contain. Deliberate omission, not an oversight.
      WHAT THIS NEEDS, and it is work rather than a decision: 3.3 armed (or
      filed `resolved-null`, in which case this step closes as carried-null
      alongside it). Then two fixture sessions through
      `report_obligation_settle`, plus the deletion case — remove the referenced
      `DischargeRow` from the allowed fixture and assert settlement reopens. -->
- [ ] **4.1 Only if D1 is "yes":** <!-- blocked-by: d1-stop-ladder-after-reading | asked: no — D1 is a decision ON the Q1 reading, and the reading does not exist; putting it now would be asking for a guess, which is what step 2.3 exists to prevent --> replace Layer 2's boolean with the
      contract's ladder — refuse a retry that still carries no
      `PASS_EVIDENCE_OK` record, allow unconditionally at the third
      consecutive refusal (`turn-end-detector-demotion.md:330-336`), write a
      `third_strike` row. Replace the pinned test
      `turn_end_gate_hook.test.ts:962` ("LAYER 2 … stops a second refusal")
      with the ladder cases, naming this step in the test title; amend the
      contract section in the same PR.
      verify: second stop without record refused; third allowed with row;
      second stop with record allowed.
      <!-- OPEN — gated, by its own first clause, on programme blocker
      `d1-stop-ladder-after-reading`, which 2.3 opens and 2.2 feeds. Not started.
      The record half its ladder needs now exists (steps 1.1-1.3), so when D1 is
      answered "yes" the work is the ladder and the contract amendment, not the
      evidence source. -->
      <!-- DEFERRED 2026-10-01 — OWNER-OWNED, two layers deep, and the chain was
      re-executed rather than assumed. `d1-stop-ladder-after-reading`'s
      `Resolved when` is "`agents/evidence/analysis/turn-end-q1-<date>.md`
      exists and records D1 as answered". Checked live: **no file matches that
      glob**, so the condition is unmet on its first clause before the decision
      is even reached.
      THE CHAIN, STATED ONCE SO NOBODY WALKS IT AGAIN: 2.2 shipped the reader
      today, so the chain is one link shorter than it was; 2.3 publishes the
      reading on or after 2026-10-07; D1 is then a maintainer decision ON that
      reading; only a "yes" starts this step. Two of those three links are not
      available to an agent — one is elapsed time, one is an owner's judgement
      — and the blocker refuses a recommendation by design: *"A recommendation
      written before the reading is the guess the reading exists to replace."*
      WHAT IS ALREADY DONE FOR IT, so a "yes" starts on code and not on
      research: the evidence source exists (1.1-1.3), the record carries
      `PASS_EVIDENCE_OK` with placement against the turn's last edit, and the
      contract's § The non-termination valve already registers the three-strike
      ladder this step would implement — including, since 2026-09-30, the note
      that its unreachability and Q1's parted company and have different
      causes. The work on "yes" is the ladder, the test replacement at
      `turn_end_gate_hook.test.ts:962`, and the contract amendment. -->

## Blockers

### blocker: kill-switch-owner-decision
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 1 — step 1.4's second half. Its table half is done
  (`b9e9d9e34`, 28 rows, grep 28) and AC-5 is closed on it.
- **Question:** what is the autonomy fallback on a host with no process-level
  stop — `destructive: manual-only`, or no autonomous mode there at all?
- **What to do:**
  1. Read `docs/contracts/hook-architecture-v1.md` § Kill switches — one
     input to the decision, not the decision.
  2. **Already done — do not redo it.** `docs/enforcement-by-host.md`'s
     `destructive:` column is filled for all eight hosts from measurement,
     each row carrying a `Measured from` cell (verified 2026-09-30; see
     `Resolved when` below). What remains is the other half: recording each
     `manual-only` as a DECISION rather than leaving it as the default the
     measurement produced.
  3. Flip `daemon-host-kill-switch` in
     `road-to-adversarial-verification-and-long-runs.md` to
     `Status: resolved`, then this entry.
- **Today's reading, so nobody re-derives it:** `check_kill_switch_table`
  reports **30 == 30** across 430 files (2026-09-30). AC-5 closed on 28 == 28
  and that number stays as the dated reading it was — two switches arrived by
  merge since, and the count moved WITHOUT anyone touching the criterion,
  which is the gate the review round added doing exactly its job. The
  EQUALITY is what AC-5 asserts, not the number. Recorded here rather than
  under AC-5 because the Acceptance-Criteria body is a tracked feature of
  `lint_plan_risk_register`'s staleness check, and a freshness note does not
  justify re-reviewing the whole register.
- **Recommendation:** `manual-only`, which is the recommendation that blocker
  already carries. Not re-argued here — a second file restating it would give
  one opinion the appearance of two.
- **If you do nothing:** step 1.4 stays open on a half that is not about
  kill switches at all, and the daemon ships observation-only on seven of
  eight hosts.
- **Resolved when:** `daemon-host-kill-switch` in
  `road-to-adversarial-verification-and-long-runs.md` reads `Status: resolved`.
  That blocker's own `Resolved when` is the condition; this entry deliberately
  does not restate it, because two copies of a condition drift and the other
  file owns it.

  **Executed live 2026-09-30, rather than read off that blocker's `Status:`,
  and the reading moved.** A merge from `main` the same day filled
  `docs/enforcement-by-host.md` § `destructive:` — eight hosts, eight rows,
  each with a `Measured from` cell citing `src/scripts/hooks/host_lowering.yaml`.
  So the condition's FIRST half is now met and nothing had recorded that.
  The second half is not: it asks that each `manual-only` row be **a recorded
  decision rather than an unmeasured default**, and every one of the seven is
  derived from the absence of a `pre_tool_use` binding. That is a measurement
  of what the configuration says, which the section states about itself — *"a
  cell says what has been written down about a host, never what the host
  does"*. The question the blocker asks is the other one: on a host that
  cannot refuse, is autonomy permitted with the weaker guarantee made visible,
  or refused outright? The table does not answer it, and reading `manual-only`
  as the answer would be inferring a decision from a default — the exact
  substitution the condition's own wording rules out.

  **Why this is not agent-closable, tested against capability rather than
  role.** The agent CAN edit both files, so the refusal is not "an agent may
  not write here". It is that the condition names a DECISION — which fallback —
  and the tree carries no measurement that settles it. Step 1.4 instructed an
  agent to resolve the other blocker by pointing its `Resolved when` at the
  switch table; that was refused on 2026-09-29 and the refusal is recorded
  inside the blocker itself. The table inventories environment switches; the
  question is about autonomy on unwatchable hosts. Redirecting a `Class: 3`
  condition at a document about a different subject closes it on invented
  evidence. **The refusal names no return condition an agent can meet** — it
  ends "the decision is untaken" — so this is the owner-reserved case, not the
  scheduling case.

  **RE-EXECUTED LIVE 2026-10-01 and the reading has not moved.**
  `daemon-host-kill-switch` in `road-to-adversarial-verification-and-long-runs.md`
  still reads `Status: open`, `Owner: maintainer`, `Class: 3 — human-only`, and
  its own `Resolved when` is unchanged: the `destructive:` column filled for
  all eight hosts from measurement AND each `manual-only` row recorded as a
  decision rather than an unmeasured default. First half met since 2026-09-30;
  second half untaken. That blocker's body also carries the 2026-09-29 refusal
  of step 1.4's redirect, verbatim and unamended, so the two files agree.

  **What is left is one sentence from the owner, and the options are already
  written down in both files**, so the ask costs no preparation: either
  `destructive: manual-only` on a host with no process-level stop — making the
  weaker guarantee visible — or no autonomous mode on such a host at all. The
  recommendation on both sides is `manual-only`, offered once and deliberately
  not re-argued here.

### blocker: q1-shadow-reading-window
- **Status:** open
- **Owner:** implementer
- **Class:** 1 — agent-executable
- **Run:** `find agents/runtime/state/turn-end-gate -name '*.shadow.json' 2>/dev/null | wc -l`
- **Budget:** one command, no spend.
- **Blocks:** Phase 2 — steps 2.2 and 2.3, and AC-2.
  **Narrowed and then un-narrowed on 2026-10-01, which is worth recording
  because the first move was wrong.** It was narrowed to 2.3 alone on the
  grounds that 2.2's deliverable is a reader and a reader needs no week. An
  independent review then found that the reader does not compute Q1 at all —
  it conditions on the retry rather than on the detector — so 2.2 is blocked by
  something this entry never named: a missing producer field, not a window.
  Both now sit here, because splitting them again would hide the second.
- **What to do:**
  1. Run the probe above. Zero files means no session has retried since step
     2.1 landed, and there is nothing to read yet.
  2. **Partly done 2026-10-01 — a reader shipped and it is not a Q1 reader.**
     Closing 2.2 additionally needs the originating detector and a
     `dispatch_open` flag recorded on each shadow row; step 2.2's own note
     carries the four-step procedure. The spec below is what that session was
     built to and is kept verbatim. When rows exist and the date is on or after 2026-10-07, do 2.2: teach
     `measure_turn_end_gate.ts` to divide `would_refuse_again` rows by
     eligible initial refusals, **grouped by `layer` first and then by
     detector**, reading the shadow records through `readShadowRecord` /
     `parseShadowRecord` (`src/scripts/_lib/turn_end_refusals.ts`). Pooling
     the two layers reads another stop concern's retries against this gate's
     refusals — `retries_observed` is keyed by layer so the denominator
     splits the same way. Publish the two instrument bounds beside the number:
     an unreadable transcript records nothing (so Q1 is an upper bound), and a
     host with no `session_id` pools sessions into one record.
  3. Then 2.3 publishes the reading and opens `d1-stop-ladder-after-reading`.
- **Recommendation:** read it once the window closes and publish whatever it
  says, including a Q1 of zero. A zero here is a finding about the gate, not
  a failed measurement.
- **If you do nothing:** Q1 stays inert, the contract keeps calling it inert,
  and Phase 4's ladder has no evidence to be gated on — which is the state
  `turn-end-detector-demotion.md` registered as unfalsifiable.
- **Resolved when:** the probe above returns at least one file, the current
  date is on or after **2026-10-07** (one week from step 2.1 landing
  2026-09-30), and at least one of those files carries a non-zero
  `retries_observed`.

  **The producer exists as of 2026-09-30 and the numerator is no longer
  structurally zero** — that was 2.2's stated reason for being unclosable and
  it is now half-answered. What remains is genuinely elapsed time: 2.2's own
  verify line reads "after one week of sessions", and no work inside one
  session produces a week. An agent arriving after the date can close 2.2 and
  2.3 without asking anyone.

  **EXECUTED LIVE 2026-10-01, all three parts, rather than read off `Status:` —
  and two of the three are already met.**

  | Part of `Resolved when` | Reading | Met |
  |---|---|---|
  | probe returns >= 1 file | 1 (`b04ff73c….shadow.json`) | yes |
  | date on or after 2026-10-07 | 2026-10-01 | **no** |
  | >= 1 file with non-zero `retries_observed` | `{stop_hook_active: 1, refused_turn: 0}` | yes |

  So the entry stays open **on the date alone**, and the date is the one part
  no session can act on. The file carries one `would_refuse_again` row
  (`detector: language`, `layer: stop_hook_active`, turn 32, 2026-09-30T22:32Z).

  **Run the probe at the PACKAGE ROOT, not in a worktree.** The same command in
  this change's worktree returns 0, because `agents/runtime/` is gitignored
  machine-local state that lives in the main checkout. A future session reading
  zero from a worktree would conclude no session has ever retried, which is the
  opposite of what the tree holds. Recorded here because the probe line above
  cannot carry it and a wrong reading here is silent.

  **A SECOND LIVE READING THE SAME DAY, because the first one aged inside its
  own change.** At 01:14Z a clean retry landed: the probe now returns **2**
  files and the layer reads 2 retries / 1 row, so the share for `language` moved
  from 100.0 % (1/1) to 50.0 % (1/2). Nothing was wrong with the first figure
  when taken; it was stale within hours, which is this roadmap's recorded lesson
  for the third time. Neither figure is a rate — n is 2.

### blocker: d1-stop-ladder-after-reading
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 4 — step 4.1, by that step's own first clause.
- **Question:** given the published Q1 reading, does Layer 2's boolean become
  the contract's three-strike ladder?
- **What to do:**
  1. Wait for `q1-shadow-reading-window` to resolve and for step 2.3 to
     publish `agents/evidence/analysis/turn-end-q1-<date>.md`.
  2. Decide D1 against that reading, and record the decision there.
  3. On "yes", step 4.1 is the ladder plus the contract amendment — the
     evidence source it needs already exists (steps 1.1-1.3).
- **Recommendation:** none offered, deliberately. A recommendation written
  before the reading is the guess the reading exists to replace.
- **If you do nothing:** Layer 2 stays a boolean, a retry that still carries
  no passing record still ends the turn, and the non-termination valve stays
  unreachable.
- **Resolved when:** `agents/evidence/analysis/turn-end-q1-<date>.md` exists
  and records D1 as answered.

  This entry exists here rather than being opened by 2.3, because 4.1 needs a
  marker that resolves in its own file today and a programme blocker nobody
  has opened yet cannot carry one. Step 2.3 still owns opening it in the
  programme; when it does, this entry becomes the local mirror of that one and
  is resolved from it.

  **EXECUTED LIVE 2026-10-01: no file matches
  `agents/evidence/analysis/turn-end-q1-*.md`.** So the condition fails on its
  FIRST clause — the file's existence — before the decision it asks about is
  reached. Both clauses are unmet and the entry is correctly open.

  **One link of the chain shortened today and the entry is otherwise
  unchanged.** Step 2.2 shipped the reader, so the obstacle between here and a
  decidable D1 is now (a) the 2026-10-07 window and (b) 2.3 publishing. The
  recommendation stays deliberately absent for the reason this entry already
  gives, and nothing in this run supplies one: a Q1 of 100 % on a sample of one
  retry is an instrument proof, and reading a ladder decision off it would be
  precisely the guess the reading exists to replace.

### blocker: obligation-shadow-bar-window
- **Status:** open
- **Owner:** implementer
- **Class:** 1 — agent-executable
- **Run:** `./scripts-run src/scripts/check_claims`
- **Budget:** one command, no spend.
- **Blocks:** Phase 3 — steps 3.3 and 3.4, and AC-4.
- **What to do:**
  1. Run the command above and read clause (9) of
     `obligation-settle-shadow-bar` in `docs/CLAIMS.md` — it records the
     qualification reset at `5c9415258` (2026-09-29).
  2. Check all four parts of the pre-registered bar: clause (3) needs >= 30
     calendar days AND >= 50 affected sessions; clause (2) needs >= 100 shadow
     rows over >= 50 sessions; the false-positive rate must hold at <= 5 %.
  3. All four met → step 3.3 flips `obligation-settle` to
     `severity: blocking`, carrying the reading and extending
     `BLOCKING_ALLOWLIST` in `tests/hooks/concern_severity.test.ts` in one
     commit. Then 3.4's fixtures.
  4. Any part unmet → clause (4) already fixes the alternative: the detector
     is NOT armed and the result is filed `resolved-null`.
- **Recommendation:** run the check on the date and take whichever branch it
  gives. Clause (4) makes the negative outcome a completion, not a failure,
  so there is nothing here that wants to be argued into an arming.
- **If you do nothing:** the settle detector stays advisory, and the parent
  roadmap's AC-6 stays carried rather than closed.
- **Resolved when:** `check_claims` exits 0 AND clause (2) and clause (3) of
  `obligation-settle-shadow-bar` both report their floors met — or clause (4)
  fires and the result is filed `resolved-null`. Either outcome resolves this
  entry; only an unread window leaves it open.

  **Earliest possible date is 2026-10-29**, 30 days from the reset. The sample
  was empty at the reset by construction: until `5c9415258` the reader could
  not produce a row at all. This is elapsed calendar time, which no amount of
  work inside a session shortens.

  **EXECUTED LIVE 2026-10-01, every clause, rather than read off `Status:`.**
  `./scripts-run src/scripts/check_claims` **exits 0** — 102 ledger entries,
  61 backed, 33 unbacked inventory, 9 markered claims bound. So the first half
  of `Resolved when` holds. The floors do not, and not marginally:

  | Clause | Floor | Reading 2026-10-01 | Met |
  |---|---|---|---|
  | (2) shadow rows | >= 100 | 0 | no |
  | (2) sessions | >= 50 | 0 | no |
  | (3) calendar days since reset | >= 30 | 2 | no |
  | (3) affected sessions | >= 50 | 0 | no |
  | (1) false-positive rate | <= 5 % | undefined (no rows) | n/a |

  **Clause (4) has NOT fired and must not be made to fire early.** It settles
  the window `resolved-null` on a floor unmet *at the end of the window*, and
  the window ends 2026-10-29. Filing the null today would read as a measured
  negative outcome and would be a measurement of two days. Clause (5) is the
  line that governs right now and it is explicit: *underpowered is neither a
  pass nor a null* — the window settles nothing and may be cited for neither
  direction. So both of this entry's branches are shut, which is the correct
  state and not an omission.

  **The zero-row half is the same zero `obligation-shadow-rows-live` reads, and
  that entry carries the live investigation** — installed bundle current, stop
  event dispatched, refusable rows delivered, both settle-written arrays empty.
  Whatever explains it will move this entry's numerator too, three weeks
  earlier than this date. Worth knowing here, and deliberately not duplicated:
  the two entries stay separate because they come due three weeks apart.

### blocker: obligation-shadow-rows-live
- **Status:** open
- **Owner:** implementer
- **Class:** 1 — agent-executable
- **Run:** `node -e 'let n=0;for(const f of require("fs").readdirSync("agents/runtime/state/obligations").filter(x=>x.endsWith(".json")))n+=(JSON.parse(require("fs").readFileSync("agents/runtime/state/obligations/"+f,"utf8")).shadow??[]).length;console.log(n)'`
- **Budget:** one command, no spend.
- **Blocks:** AC-3.
- **THE PROBE WAS WRONG AND IS CORRECTED ABOVE, 2026-10-01.** It read
  `cat …/*.json | grep -c '"shadow"'`, which counts the `"shadow"` KEY once per
  ledger and never a row. Executed live that day it returned **10** against
  **0 actual rows** across 10 ledgers. The old line does not under-report, it
  reports the ledger count as though it were the row count — so a session
  executing this entry's `Resolved when` literally ("returns a count greater
  than zero") would have closed AC-3 on a false positive, in a roadmap whose
  sibling records a laundered `[x]` as the most expensive mistake such a file
  can contain. The replacement parses each ledger and sums `shadow.length`.
- **What to do:**
  1. Run the probe. It sums shadow ROWS across this repository's own
     obligation ledgers.
  2. A non-zero shadow row closes AC-3. A zero after 2026-10-06 is itself the
     finding — the fixture proves the mechanism through `main()`, so a live
     zero would mean the INSTALLED bundle is not the one carrying the 3.1 fix,
     and that is what to investigate rather than the join.
  3. **Item 2's hypothesis is already FALSIFIED — do not spend the 2026-10-06
     reading on it.** The installed `dist/hooks/dispatch.js` (built
     2026-09-30T23:57, after `5c9415258` landed 2026-09-29) carries the 3.1
     join verbatim, comment included: the bundle holds `env["CLAUDE_CODE_SESSION_ID"]`
     as the LAST resort of the envelope-first chain, beside the "adding a name
     the writer never keys on would address a ledger that cannot exist" note
     that fix introduced. So a zero is not a stale bundle. Start instead at the
     settle hook's verdict path — see the live reading below for where.
- **Recommendation:** read it on the date. Do not re-open the 3.1 join on a
  zero before checking which bundle the sessions ran.
- **If you do nothing:** AC-3 stays open on a mechanism that is already proven
  by fixture, and nobody learns whether the installed bundle carries it.
- **Resolved when:** the probe above returns a count greater than zero, or the
  date is past 2026-10-06 and the zero is published with the installed
  bundle's version beside it.

  Separate from `obligation-shadow-bar-window` although both watch the same
  ledgers, because the two come due three weeks apart and gate different
  things: this one asks whether ANY row appears within seven days of
  `5c9415258`; that one asks whether a pre-registered statistical bar is met.
  Merging them would hold AC-3 closed until 2026-10-29 against its own
  seven-day condition.

  **EXECUTED LIVE 2026-10-01 at the package root, five days before the date, so
  the 2026-10-06 session starts from evidence rather than from this paragraph.**

  - **Rows: 0**, across 10 ledgers under `agents/runtime/state/obligations/`.
    The corrected probe; the old one said 10. Neither part of `Resolved when`
    is met — the count is zero and the date has not passed — so the entry
    stays open, correctly.
  - **The hook is bound and the ledgers are live.** `obligation-settle` is
    registered in `src/scripts/hook_manifest.yaml`
    (`severity: advisory`, `fail_closed: false`), the installed bundle carries
    it, and one ledger was written **during this very session** at 03:12 on
    2026-10-01. So this is not a dormant carrier writing nothing.
  - **The zero is not explained by class composition either, which was the next
    cheap hypothesis and it fails.** That live ledger's `delivered` array holds
    10 rows, and two of them are refusable classes —
    `roadmap-progress-sync` (`class: hook`) and `secret-vcs-guard`
    (`class: validator`), both members of `REFUSABLE_CLASSES` in
    `_lib/obligation_frequency.ts:204`. The remaining eight are `class: none`
    and are correctly out of scope.
  - **`discharged` is empty too, and that is the sharp end of the finding.**
    The ledger carries `{"discharged": [], "shadow": [], "session_id": "…",
    "delivered": [10 rows]}`. Both settle-written arrays are empty while the
    injector-written one is full, on a session that delivered two refusable-
    class rules. Either the settle path never reached a write, or it reached
    one and computed "nothing to record" on both arms.

  **What this does NOT establish, stated because the reading is suggestive and
  five days early.** It is ONE session on ONE machine; the detector may be
  correct here — a turn that discharged its obligations legitimately produces
  neither array. Nothing above distinguishes "the hook ran and found nothing"
  from "the hook never ran on a stop event", and that is exactly the question
  the 2026-10-06 reading should put first. What it does rule out is a stale
  bundle and an empty refusable population, which were the two hypotheses this
  entry and AC-3 had already written down.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-stop-that-holds |

## Acceptance Criteria

- [ ] AC-2 — <!-- blocked-by: q1-shadow-reading-window --> `measure_turn_end_gate` prints a non-null Q1 per detector and the
      contract no longer calls Q1 inert.
      <!-- SPLIT 2026-10-01, because its two clauses are in different states and
      a single box would misreport whichever it did not describe. Revised the
      same day after an independent review; the first version of this note
      overstated both halves and the corrections are kept visible.
      SECOND CLAUSE — CLOSED, and on narrower terms than first claimed.
      `docs/contracts/turn-end-detector-demotion.md` no longer calls Q1 inert
      anywhere. What it says instead is NOT "readable" — that was the first
      wording and the review refuted it. It says the re-entrancy obstacle has
      fallen and a different one has not: the shipped reader conditions on the
      retry, Q1 conditions on the detector, and one producer field separates
      them. The criterion asks only that the contract stop calling Q1 inert, and
      it has, with the reason stated precisely rather than optimistically.
      FIRST CLAUSE — NOT MET, and the earlier note was wrong about why. It said
      Q1 was printed on one layer and absent on the other, with the gap "a fact
      about the sample rather than about the instrument". Two errors there.
      (a) What is printed is not Q1 — it is the retry-conditioned share, which
      disagrees with Q1 in direction, so the clause is unmet on BOTH layers
      rather than met on one. (b) The sample-versus-instrument claim carried no
      evidence: layer 2 is reached only when the payload lacks `stop_hook_active`,
      which on this host is set on the retry a block triggers, so that layer may
      be close to structurally unreachable — an instrument fact, if true. It is
      not established either way here and is no longer asserted.
      THREE DETECTORS ARE NOW CENSORED OUTRIGHT — promissory, completion and
      untested — because the gate skips them when a dispatch is open and the
      shadow record carries no dispatch flag. So "a non-null Q1 per detector"
      cannot be satisfied for half the set until a second producer field lands.
      SO THIS CLOSES WHEN both producer fields are recorded (step 2.2's note
      carries the procedure) and a reading over a real window is published by
      2.3. n at 2026-10-01 is 2 records / 2 retries, which is not a rate. -->
- [ ] AC-3 — <!-- blocked-by: obligation-shadow-rows-live --> The obligation ledger in this repository's own sessions gains
      shadow rows within seven days of 3.1.
      <!-- DEFERRED 2026-10-01 on elapsed time: 3.1 landed 2026-09-29 at
      `5c9415258` and the seven days end 2026-10-06. Read five days early
      anyway, so the deferral carries evidence rather than only a date.
      ROWS AT 2026-10-01: **0**, across 10 ledgers. The criterion is not met and
      is also not yet due, which are different things and are both true.
      ONE SENTENCE OF THIS CRITERION'S OWN REASONING IS NOW FALSIFIED. It read
      that a live row "additionally needs a dispatched stop event from a session
      running the INSTALLED hook bundle rather than this worktree's source" —
      implying the likely cause of a zero is a bundle that predates the fix. The
      installed bundle was built 2026-09-30T23:57, after the fix, and carries
      the 3.1 envelope-join verbatim including the comment that landed with it.
      A ledger was written by it during this session. So the stop event is
      dispatched, the bundle is current, and the zero needs another explanation.
      WHERE THE 2026-10-06 READING SHOULD START, with the two cheap hypotheses
      already eliminated: not the bundle (current), and not an empty refusable
      population (this session delivered `roadmap-progress-sync`/`hook` and
      `secret-vcs-guard`/`validator`, both in `REFUSABLE_CLASSES`). Both arrays
      the settle path writes — `shadow` AND `discharged` — are empty while the
      injector-written `delivered` array holds 10 rows. Either the settle path
      never reached a write, or it reached one and computed "nothing to record"
      on both arms — that is the thing to establish first. Full reading under
      `### blocker: obligation-shadow-rows-live`. -->
- [ ] AC-4 — <!-- blocked-by: obligation-shadow-bar-window --> (carried AC-6) once armed, the detector refuses an undischarged
      write and allows a discharged one.
      <!-- OPEN — blocked on 3.3's arming, whose window resets to 2026-09-29. -->
      <!-- DEFERRED 2026-10-01. Condition re-executed: `check_claims` exits 0,
      every floor unmet (0 rows / 0 sessions / 2 of 30 days), clause (5) says an
      underpowered window settles nothing in either direction. Nothing is armed,
      so the criterion's own "once armed" precondition is unreached.
      EARLIEST SETTLEMENT 2026-10-29, on either branch — armed and demonstrated,
      or filed `resolved-null` under clause (4), which this criterion then
      closes as carried-null rather than unmet. -->
