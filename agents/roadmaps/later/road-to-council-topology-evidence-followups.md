---
complexity: structural
status: later
parent_roadmap: road-to-inbox-harvest-2026-08-e-council-topology-evidence
review_by: 2026-12-08
entry_condition:
  what: "A DISJUNCTION — any one branch reactivates its own phase, and none of them waits on the others. PHASE A: `agent-config council:status` reports `5 enabled` or more AND a verified 20-consecutive-UTC-day reservation of that capacity exists, the applicable pre-registered floor (`>= 5` or `>= 10`) being read item by item. PHASE B: two consecutive UTC days on which the per-provider cap is free in both are reserved, AND a production caller exists for `collectGuesses` and `scoreRecognition` in `src/scripts/ai_council/provider_leakage_bench.ts`. PHASE C2: a qualifying live run exists whose provenance is sufficient for the seven guards — the tested commit, the configuration and the run identity, not merely an artefact. PHASE C3: the comparison method was frozen BEFORE collection AND at least ten qualifying real analysis runs exist. Phase C1 carries no branch: it is closed. THE FLAT THREE-PART SHAPE IS DELIBERATE AND IS NOT THE PHASE-NESTED SHAPE THE 2026-09-08 DEGRADED RULING ASKED FOR — `entryConditionParts` in `src/scripts/lint_roadmap_later_disposition.ts` parses indented `key: value` lines with no phase awareness, so a nested per-phase mapping is FLATTENED LAST-WINS and three of the four branches would disappear from the recorded condition with no error. Both seats of the 2026-09-08 full-strength council refused that shape outright."
  when: "Whenever a branch above becomes true. Not calendar-driven: Phase A and Phase B turn on capacity that no instruction can create, and Phase C2 and C3 turn on runs nobody has allocated. The `review_by` date is a re-read obligation, never a wake condition."
  who: "Phase A and Phase B: the maintainer alone — configuring seats and reserving UTC days are acts outside any agent's reach. Phase C2 and Phase C3: the maintainer allocates the runs; an agent may then execute and score them. Reactivation itself is MANUAL AND WHOLE-ROADMAP: no consumer of `entry_condition` other than the linter exists today, nothing parses phase identity, and no automation moves or reactivates a parked roadmap. If a second consumer that reads phase identity ever lands, this flat shape stops being sufficient and the schema change the 2026-09-08 council called Option C becomes required."
estate_growth_exempt: "Claimed 2026-09-08 for the PARK, and it authorises exactly one dimension: later_roadmaps 84 -> 85. The same change takes active_roadmaps 9 -> 8, so the file moved and the estate did not grow -- but the two metrics ratchet independently and a drawdown on one does not pay for a rise on the other, which is why the claim is written rather than assumed from the arithmetic. No work was created: Phase C1 CLOSED in this change (3 items, verified against a full-strength council run of 2026-09-08), and the remaining 38 items are the same 38 obligations this file already carried, now parked behind a four-branch disjunctive entry_condition instead of sitting in the active backlog for every drain run to re-read. open_blockers is unchanged at 41 because that metric sums the active and later corpora and the three blockers moved with the file. The 38 deferral edges from the archived parent are unaffected: lint_deferral_integrity resolves a destination by logical slug and accepts later/ as live, verified by its own accept self-test, and the one literal markdown link into this file was re-depthed in the same commit. PRIOR ENTRY, preserved verbatim because it records the estate accounting of the change that wrote it: Neither metric grew — both counting rules changed in this commit and the files are the same files on both sides. ADR-262 deleted `status: carrier`, so `collect()` now sees three roadmaps it previously dropped, and two of those had no `## Phase` headings, which is why the floor recomputed with the new code over the base tree reads 7 where the pre-change code read 9 over that same tree; the drop is an artefact of measuring a migration mid-flight, not a disposal anyone performed. The four new open_blockers are the same capacity constraints these roadmaps already carried as body prose (three provider seats short of the pre-registered n >= 5, and a 50-call-per-provider-per-UTC-day cap at `src/scripts/ai_council/cli_call_budget.ts:60`) — moving a constraint out of prose into the machine-readable place a gate reads is the whole point of ADR-262, and counting that move as new obligation would price the fix higher than the defect. No work was created by this change and none was hidden."
---

# Road to the deferred council-topology evidence

> **Deferral receiver.** The 38 `[~]` items deferred out of
> `road-to-inbox-harvest-2026-08-e-council-topology-evidence` on 2026-09-01 live
> here, so `lint_deferral_integrity` can verify the carry from both ends. That is
> a property of the deferral edges, not of this file's status — see ADR-262.

## Goal

Answer, with measurement rather than argument, whether multi-seat council
topology improves decision quality enough to justify its cost — and if it does,
route to it deterministically instead of by default. Until the measurement
exists, the package claims nothing about topology.

The three stubs hold the design detail, the pre-registrations and the forbidden
claims. They are not duplicated here:

- [`stubs/road-to-council-topology-benchmark-execution.md`](../stubs/road-to-council-topology-benchmark-execution.md) — Phase A
- [`stubs/road-to-provider-leakage-bench-execution.md`](../stubs/road-to-provider-leakage-bench-execution.md) — Phase B
- [`stubs/road-to-council-topology-instrumentation.md`](../stubs/road-to-council-topology-instrumentation.md) — Phase C

## Status correction, 2026-09-08

**This file was 796 lines, of which about 700 were six dated sections explaining
why six successive runs did not execute it.** That is a record of runs, not a
plan. It is preserved unedited at
`agents/evidence/analysis/topology-followups-drain-run-record-2026-09-08.md`;
nothing was discarded.

Three corrections, each checkable:

1. **The `status: carrier` human gate is gone.** ADR-262 deleted the status. The
   2026-09-08 ruling that *"a `status: carrier` roadmap is human-gated and an
   autonomous run may not execute, promote, close, or advance it"* is withdrawn.
2. **The cross-reference is fixed.** The struck disposition cited a council
   record under `agents/runtime/council/responses/`, which is gitignored and so
   unresolvable to any reviewer — the defect the release review flagged as
   `ac7811b97113`. Council records for decisions this file rests on are
   transcribed into the tracked tree under `agents/evidence/analysis/`.
3. **The carrier count in the struck text is stale.** It recorded "2 live
   carriers"; there were three, and there are now none.

**What did not change: the reason most of Phase A and all of Phase B cannot run
here.** That reason was never a human gate. It is measured capacity, it is
recorded in `## Blockers` below, and it is the same today as when it was first
measured.

## Phase A — the topology benchmark and its dependents

Every item here needs the benchmark to have *run*. It has not, and cannot at the
seating this environment has.

- [ ] **A2.2** Mandatory baselines per eligible slice <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: no result claims "council improves quality" without a strong
      single-model baseline in the same table
- [ ] **A2.3** Emit the full metric set <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: one run produces every column, or the missing column is recorded
      as a declared gap rather than silently absent
- [ ] **A2.4** Stage ablation <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: an improvement can be attributed to a named stage
- [ ] **A2.5** Separate model quality from topology quality <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: both axes appear in the result table
- [ ] **A2.7** Round-count bias arm <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: the arm reports a result **or** a null; a null is a valid
      published outcome and closes the step
- [ ] **A5.2** Bench identity-blind against identity-visible synthesis <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: both arms are reported side by side
- [ ] **A5.5** Revisit ADR-120 only on results <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: the ADR record cites the benchmark artifact, not this roadmap
- [ ] **A6.5** Pre-registered promotion gate against a fixed-round arm — the
      recorded-gate half is DONE and preserved; only the against-the-arms half
      is carried <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: the gate is recorded before the arms run, and the
      verdict-equivalence figure is reported as context, never as the gate
- [ ] **A7.2** The selector returns an explainable record <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: every field is populated on a real selection
- [ ] **A7.4** Deterministic policy first, interpretable features only <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: the policy is readable end-to-end without executing it
- [ ] **A7.5** Shadow mode first <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: shadow runs change no observable behaviour
- [ ] **A7.6** Promote per task slice on benchmark evidence only <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: each promotion names its slice and its evidence artifact
- [ ] **A8.5** Stop when the next call has low expected value <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: the stop is gated on the Phase A artifact, not on intuition
- [ ] **A9.1** Same-provider host-subagent fan-out lane as a governed exception <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: this roadmap adds no rival implementation; the stub's own gate is
      the promotion condition
- [ ] **A9.4** Benchmark governed bundles after seating is solved <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: a "persona won" result cannot be explained by "provider won"
- [ ] **A10.4** Compute route regret offline <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: the comparison runs offline and never influences a live route
- [ ] **A11.2** Train an offline challenger classifier <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: no runtime path can reach the model
- [ ] **A11.3** Promotion requires a material Pareto improvement <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: the comparison against the deterministic policy is published
- [ ] **A11.5** Model-generation changes mark affected routing evidence stale <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: a simulated model-generation bump invalidates the right slices
- [ ] **A13.1** Shadow rollout stage <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: behaviour diff against the pre-phase baseline is empty
- [ ] **A13.2** Advisory rollout stage <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: no run costs more than today's default under advisory mode
- [ ] **A13.3** Adaptive rollout stage <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: each enabled slice names its holdout artifact
- [ ] **A13.4** Default-on per slice <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: all six conditions are recorded per slice before the flip
- [ ] **A13.5** Re-evaluate on model-generation changes <!-- blocked-by: council-seats-below-five | asked: yes -->
      verify: a stale-evidence slice blocks its own default-on state

## Phase B — the provider-recognition leakage bench

Both arms are design-complete and pre-registered. The assembler, the pattern
list and the 1,402-body corpus census exist. What is missing is a production
runner and two clear UTC days.

- [ ] **B3.3** Build the runner and run both arms <!-- blocked-by: leakage-bench-two-day-window | asked: yes -->
      verify: recognition rate and chance baseline are both published
- [ ] **B3.4** Hold style normalization behind the stronger gate <!-- blocked-by: leakage-bench-two-day-window | asked: yes -->
      verify: no normalization code lands until both conditions are recorded
      met; if it lands, the raw answer is retained for synthesis and replay and
      semantic preservation is proven

## Phase C — instrumentation

Split deliberately. **C1 was buildable and is now built.** Its three mechanisms
existed in no form; building them did not require a council run, only running
them did. Blanket-deferring C1 behind "no qualifying live run" was the error the
phase separation corrected, and the three items closed on 2026-09-08 against a
full-strength council run that supplied every population their verify clauses
name.

**The roadmap's own contradiction, named because a 2026-09-08 council seat named
it.** "Buildable now" and three verify clauses that are runtime observations
cannot both be the whole truth. The resolution taken here is the third of the
three that seat listed: the mechanisms were built AND the observations were made,
in one change, so no clause was retroactively relaxed and none was closed on a
build alone. Had the run lacked dissent, corrections or calls, the affected item
would have stayed open — both seats were explicit that an empty population is not
affirmative verification, and that a carried marker with no valid receiver is
another form of premature closure.

### C1 — mechanisms that can be built today

- [x] **C5.4** Final synthesis retains unresolved disagreement. The remaining gap
      was one element of three: no template asked what evidence would resolve the
      disagreement.
      verify: a run with real dissent renders all three elements — EXERCISED
      2026-09-08. `RESOLVING_EVIDENCE_SECTION`
      (`src/scripts/ai_council/synthesis_disagreement.ts:60`) is interpolated into
      all four lens templates at `src/scripts/ai_council/prompts.ts:306`, `:335`,
      `:371` and `:391`, so there is ONE copy of the contract rather than five.
      `auditSynthesisElements` (`synthesis_disagreement.ts:134`) makes the answer
      decidable instead of hoped-for — both 2026-09-01 seats refused a prose-only
      build. A full-strength council run of 2026-09-08 (2/2 present) produced real
      dissent on three named clashes; the synthesis of it reports
      `complete=true dissentPresent=true source=text`, all three elements present.
      Transcript, synthesis and audit output:
      [`topology-c1-closure-and-park-2026-09-08`](../evidence/analysis/topology-c1-closure-and-park-2026-09-08.md).
- [x] **C10.2** Attribute each useful correction to its first stage. `StageOutput`
      had zero production importers; `StageProduction`
      (`src/scripts/ai_council/deliberation_metrics.ts:89`) is now its first
      producer, filled from a real run rather than from a test.
      verify: the emitter exists and is reachable from the live path; one
      recorded run yields a per-correction stage attribution — BOTH EXERCISED
      2026-09-08. `measureDeliberation` runs unconditionally in `cmd_run`
      (`src/scripts/council_cli.ts:2790`) over `runCallsFrom`'s six labelled
      stages, so the emitter is on the live path by construction, not by a caller
      remembering. One recorded run yielded **28** attributions, each carrying
      `firstStage`, `firstMember` and `firstCallIndex`, across two stages
      (`deliberation` 26, `peer-review` 2). SCOPE: it decides ATTRIBUTION, never
      USEFULNESS — whether a correction improved the verdict is a benchmark
      question and the benchmark has not run.
      [`topology-c1-closure-and-park-2026-09-08`](../evidence/analysis/topology-c1-closure-and-park-2026-09-08.md).
- [x] **C10.3** Emit `zero_marginal_value_call_rate`. The metric existed in no
      form; it is defined at
      `src/scripts/ai_council/deliberation_metrics.ts:212` as the share of
      scorable calls whose text near-duplicates something the run had ALREADY
      received, judged by the shipped `is_near_duplicate` bar rather than by a
      second similarity notion.
      verify: the rate is emitted and is non-null on a run that produced calls —
      EXERCISED 2026-09-08. The run made 4 calls, 3 scorable (one peer-review call
      returned `exit_1`), and emitted `zero_marginal_value_call_rate: 0`.
      Non-null, and stronger than non-null: `calls_zero_marginal`, `calls_scored`
      and `novelty_threshold` ship beside it, so the number is re-derivable by
      hand and its domain is `[0, 1]` — the 2026-09-08 council's own objection
      that a literal non-null test would pass a sentinel or a wrong denominator.
      A run with NO scorable call emits `null` with a stated reason, never `0`.
      SCOPE: this measures textual novelty. It does not measure whether a call
      changed the verdict, and no consumer may read it as decision-quality
      evidence. It has no automated consumer yet — C10.6, which would be one, is
      blocked; that is a stated gap, not a silent one.
      [`topology-c1-closure-and-park-2026-09-08`](../evidence/analysis/topology-c1-closure-and-park-2026-09-08.md).

### C2 — guards built and red-proven, waiting on a real population

Every test named here is committed and runs in CI regardless of these
checkboxes. The council was explicit that they are defensive infrastructure, not
blocked work — what is blocked is the live-run evidence that closes the item.

- [ ] **C7.3** Keep the deterministic/probe path above council <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: a probe-resolvable fixture never enters the selector
- [ ] **C10.1** Extend decision replay with the route record <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: a replayed run reproduces the recorded route
- [ ] **C10.6** Track early-stop savings separately from quality <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: cost and quality are never reported as one number
- [ ] **C11.1** Offline training rows without raw prompt content <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: the row schema has no field capable of holding prompt text
- [ ] **C12.1** `/council` stays the user concept <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: the command surface gains no topology argument for normal use
- [ ] **C12.2** A free explain mode <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: explain mode issues zero provider calls
- [ ] **C12.3** A force-topology control cannot override the five named
      authorities <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: one test per prohibition

### C3 — inline findings, gated on allocated run volume

- [ ] **C1B.1** Findings schema as a fenced trailing block, replacing the second
      extraction call. The authorised run of 2026-09-01 reproduced the
      `codex-default` contract miss; n = 2, which is not a rate. <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: a real analysis run parses inline with **zero** extraction calls
- [ ] **C1B.4** Promotion gate across `>= 10` real analysis runs <!-- blocked-by: no-qualifying-live-run | asked: yes -->
      verify: gate met, or the null result is recorded and the change reverts to
      extraction-always

## Parked 2026-09-08 — what moved, and what stayed unresolved

Phase C1 is closed. Everything else is blocked on capacity or on allocated runs
that no instruction can create, so the file is parked under
`agents/roadmaps/later/` rather than left in the active backlog to be re-read by
every drain run. It is parked **intact**: the 38 deferral edges from the archived
parent resolve by logical slug, and `later` is a live destination the resolver
accepts with a dedicated self-test, so nothing is stranded and no edge is
redirected to a stub.

**The council was split on this, and the split is recorded rather than
resolved.** A full-strength run of 2026-09-08 (`anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2/2 present, 2 rounds, depth deep, peer review on, $0 —
all seats subscription-authed) converged that the phase-nested `entry_condition`
the earlier DEGRADED ruling asked for is categorically unsafe, because the gate's
parser flattens it last-wins and silently discards three of the four branches.
It did **not** converge on what to do instead:

- the anthropic seat holds that parking format and C1 closure are separable, and
  that the flat disjunction is the non-destructive choice if parking happens now;
- the openai seat holds that the schema and every consumer should be extended
  first and the roadmap left active until then, and would accept the flat shape
  permanently only against five stated conditions.

The flat shape is adopted **as a documented compatibility bridge**, and the four
of those five conditions that are checkable here hold today: the linter is the
only consumer of `entry_condition`, nothing parses phase identity, no automation
moves or reactivates a parked roadmap, and reactivation is therefore manual and
whole-roadmap — which the `who` field now says out loud rather than leaving to be
discovered. **What would resolve the disagreement:** an inventory of every
consumer of `entry_condition`. One reader and no mutator, and the flat shape is
permanent; a second reader that parses phase identity, and the schema change is
required. That inventory is not performed here and the disagreement stays open.

Full transcript, the synthesis, and the verification evidence for all three C1
items: [`topology-c1-closure-and-park-2026-09-08`](../evidence/analysis/topology-c1-closure-and-park-2026-09-08.md).

## Blockers

### blocker: council-seats-below-five

- **Status:** open — and since 2026-09-08 it gates a PARKED roadmap under `agents/roadmaps/later/`, not an active one. Parking relocates the obligation; it does not discharge it, and it does not change what resolves this blocker. The wake condition for Phase A (24 items) is the branch named for it in this file's `entry_condition`.
- **Owner:** maintainer
- **Blocks:** every item in Phase A (24 items)
- **What to do:** configure at least three further council seats (gemini, xai
  and perplexity are declared and disabled in
  `~/.event4u/agent-config/settings/.ai-council.yml`), then re-run
  `agent-config council:status` and confirm `>= 5` enabled. Then re-emit the
  manifest with `src/scripts/ai_council/topology_bench_manifest.ts --emit`,
  because a configuration change invalidates the frozen pre-registration.
- **Recommendation:** configure the three declared-but-disabled seats. They are
  already in the config with no reason recorded for the disable, so the cheapest
  path to a benchmark that can license a claim is turning them on — not
  redesigning the benchmark around two seats, which is what "run it at `N = 2`"
  amounts to and which the pre-registration already refuses.
- **If you do nothing:** Phase A stays at 0 of 24 indefinitely, and the package
  keeps routing council work by a default it has never measured. The cost is not
  the missing number — it is that the default hardens into an implicit claim
  while the forbidden-claims list keeps anyone from saying so out loud.
- **Resolved when:** `agent-config council:status` reports `5 enabled` or more,
  AND a verified 20-consecutive-UTC-day reservation of that capacity exists.

The measured facts, unchanged since 2026-09-01 and re-read at `0ee772b9d`:
`council:status` reports **2 enabled of 5**. The frozen manifest
(`internal/bench/council-topology/call-manifest.json`) books 46–50 calls per
provider on each of days 1–19 and 15 on day 20, against a hard cap of
`DEFAULT_CLI_CALLS_PER_DAY = 50` (`src/scripts/ai_council/cli_call_budget.ts:60`).
384 cells: 352 pending, 32 not_eligible, **0 complete**. The pre-registered
promotion floors are `n >= 5` and `n >= 10` seats; running the schedule at
`N = 2` spends 1,584–1,804 calls over 20 days and buys a number nobody may act
on. This is a capacity fact, not a permission fact — no instruction can create a
third provider seat.

### blocker: leakage-bench-two-day-window

- **Status:** open — and since 2026-09-08 it gates a PARKED roadmap under `agents/roadmaps/later/`, not an active one. Parking relocates the obligation; it does not discharge it, and it does not change what resolves this blocker. The wake condition for Phase B (2 items) is the branch named for it in this file's `entry_condition`.
- **Owner:** maintainer
- **Blocks:** Phase B (2 items)
- **What to do:** reserve two consecutive UTC days on which the per-provider cap
  is free in both, and confirm the executing run can stay coherent across the
  UTC boundary. Then build the runner — `collectGuesses`
  (`src/scripts/ai_council/provider_leakage_bench.ts:90`) and `scoreRecognition`
  (`:136`) exist and have zero production callers.
- **Recommendation:** build the runner first and validate it on a 3-item subset,
  then reserve the two days. The runner is the half that costs nothing to get
  wrong — a failed 3-item dry run is free, a failed 60-call arm burns a reserved
  UTC day and the anthropic seat ruled partial results INVALID.
- **If you do nothing:** the 1,402-body corpus census, the frozen
  pre-registration and both design forks stay as an unrun design. They do not
  rot, but they also answer nothing, and Phase A's `A5.2` (identity-blind versus
  identity-visible synthesis) has no leakage baseline to sit against.
- **Resolved when:** both arms have run and been scored against the frozen
  pre-registration, and the validity checks in
  `internal/bench/council-provider-leakage/PREREG-anonymisation-and-sampling.md`
  pass.

Each arm is 30 calls per provider against the 50-per-provider-per-UTC-day cap,
so the two arms cannot share a day. The anthropic seat ruled partial results
**INVALID**, so a run that straddles a UTC boundary and loses coherence produces
nothing usable rather than a partial answer.

### blocker: no-qualifying-live-run

- **Status:** open — and since 2026-09-08 it gates a PARKED roadmap under `agents/roadmaps/later/`, not an active one. Parking relocates the obligation; it does not discharge it, and it does not change what resolves this blocker. The wake condition for Phase C2 (7 items) and Phase C3 (2 items) is the branch named for it in this file's `entry_condition`.
- **Owner:** maintainer
- **Blocks:** Phase C2 (7 items) and Phase C3 (2 items)
- **What to do:** allocate representative council runs against the guarded
  population — one run in which every answering seat inlines the findings block
  for C1B.1, and `>= 10` runs with the comparison method frozen beforehand for
  C1B.4. C2's seven guards close when their population enters an integration
  branch or a release candidate.
- **Recommendation:** close C2's seven items opportunistically rather than by
  allocating runs for them — their guards already run in CI, so they close the
  next time the guarded population enters an integration branch. Allocate runs
  deliberately only for C3, where the gate is a count (`>= 10`) that will not
  accumulate by accident.
- **If you do nothing:** C2 stays open indefinitely while its guards keep
  passing, which is the state most likely to be misread as validation — a
  red-proven test proves the test detects a planted violation, never that the
  guarded behaviour holds in production. C3's second extraction call keeps being
  paid on every analysis run.
- **Resolved when:** each item's `verify:` line has been exercised against a real
  run rather than against a fixture.

Phase C1 is deliberately **not** blocked by this. Building a mechanism and
observing it in production are different obligations, and collapsing them is how
three unbuilt mechanisms spent seven months behind a run-volume gate.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The benchmark never runs and the package quietly routes by default anyway | product | Phase A has been blocked since 2026-09-01 on seating that has not changed. The failure is not that the measurement is missing — it is that a default hardens into a claim while nobody is allowed to say so. | The stubs' forbidden-claims lists are explicit: the only permitted claim is "designed, pre-registered, and deferred". No promotion may cite this roadmap in place of a benchmark artifact. | Blockers |
| 2 | A partial benchmark is run and its number is treated as evidence | product | Running the frozen schedule at `N = 2` is procedurally possible and produces a number. The pre-registered floors are `n >= 5` / `n >= 10`, so that number licenses nothing — but a number in a table is read as a result. | A2.2 requires a strong single-model baseline in the same table; A6.5 records the promotion gate before the arms run. The manifest is invalidated by any configuration change, forcing a fresh pre-registration cycle. | Phase A |
| 3 | C1's three mechanisms stay unbuilt because they inherit C2's blocker | implementation | Until this revision all twelve Phase C items sat behind one "no qualifying live run" gate. Three of them need no run at all to be built — `StageOutput` has zero production importers and `zero_marginal_value_call_rate` does not exist in any form. | Phase C is split: C1 carries no `blocked-by` annotation and is executable now. | C1 — mechanisms that can be built today |
| 4 | A defensive test's sabotage-sensitivity is reported as runtime validation | implementation | Seven Phase C2 guards are committed and red-proven against planted violations. That proves the test detects the violation; it does not prove the guarded behaviour holds in production. The stub names this confusion twice. | Each C2 item's `verify:` line demands a real run, not a fixture. The blocker's Resolved-when repeats it. | C2 — guards built and red-proven |
| 5 | The deferral edges rot while the file sits | implementation | 38 carries point here from an archived parent. Deleting or renaming this file strands all 38, and the archived side cannot be re-checked by the ordinary sweep. | `lint_deferral_integrity` walks from the archived side and reds on a missing or non-back-linking destination; the `broken-destination` class carries no baseline and fails at zero. | Goal |
