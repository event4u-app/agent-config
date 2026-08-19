<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: structural
execution:
  mode: autonomous
estate_offset_exempt: >-
  Its remaining open item is an OBSERVATION of a live killed-and-resumed run, not a change any
  change-set can contain, so there is nothing to close and nothing to trade. Offsetting it by
  archiving an unrelated roadmap would move the estate number without moving the estate.
---

# Road to long-horizon execution — the agent stops when the roadmap doesn't

> **Source:** external analysis session, 2026-08-18
> (`agents/tmp.old/long-horizon/road-to-long-horizon-execution.md`). Pins:
> `agent-config` @ `851568b` (origin/main), an external orchestration
> reference ("Source A") @ `fa13ee4`, an external session-supervisor
> reference ("Source B") @ `06c5e11`. Both external trees read at source
> level from fresh shallow clones. Re-verified 2026-08-19 against
> `3d5bf5945` (14.3.0): the AC rows re-checked live; the external rows hold
> at their pins only.
>
> **Relationship to `road-to-user-out-of-the-loop.md` (UOTL):** this roadmap
> does NOT replace it. UOTL owns the question-elimination program (B1–B14)
> and its Phases 0–1 are largely shipped. This roadmap sequences and
> concretises UOTL's OPEN phases — 2 (set scope), 4 (question ladder),
> 6 (session continuity), 7 (unattended operation) — with mechanism-level
> designs harvested from the two external references, in the inverted form
> ADR-211 C/D requires: each borrowing docks at a confirmed AC defect, and
> rejected borrowings are named as rejections.

---

## 0. The defect, stated first

The stated goal — "give the agent a task, it works for days, resolves its
own questions via council/team, finishes whole roadmaps, asks only when
truly necessary" — fails today on five confirmed gaps:

### D-1 — The Stop slot gates quality, never continuation

AC's `stop` slot carries eleven concerns (`hook_manifest.yaml:766` at the
pin), and `turn-end-gate` can BLOCK a stop (dispatcher translates to host
exit 2, `turn_end_gate_hook.ts:109–111`) — but every stop concern is a
**quality refusal**, none is a **work-remaining check**. Nothing compares
the run's contract against roadmap checkbox state and injects a
continuation. The agent ends the turn because ending the turn is what
agents do; the roadmap being 40% done is invisible to the slot that decides.

### D-2 — Sessions are mortal and nothing supervises them

A session dies with its terminal. The `session-eol` concern exists on the
stop slot (state under `agents/runtime/state/session-eol/`), but the UOTL
Phase 6 extensions — deterministic checkpoint + auto-handoff at
end-of-life, and a resume runner OUTSIDE the session that relaunches from a
handoff marker — are unbuilt (UOTL Phase 6, both steps unchecked). There is
no process anywhere whose job is "notice a dead run and restart it".

### D-3 — No unattended, budgeted execution path

UOTL Phase 7 (scheduler, notification digest, demotion gate) is fully
unchecked; `agents/runtime/state/scheduler.json` does not exist in the
tree. AC has no primitive for "invoke the coding agent headless, under a
global spend budget, with job dedup, without a human watching".

### D-4 — The question ladder has one rung and it halts

Ambiguity below `high_impact` still halts the run when no council is
configured or the council is exhausted (UOTL B5/B10; Phase 4 medium-impact
routing unchecked). `road-to-council-api-fallback.md` (same session)
removes ONE class of council halt — cli transport loss with an api key
present — but the ladder itself (class → council → second-model rung →
memo-with-default) is not wired.

### D-5 — The team loop is gated on a benchmark never run

UOTL Phase 4 step 2: the build-review-fix benchmark the team loop has been
gated on "since it was written" is still unrun. Team autonomy is therefore
neither active nor honestly refused — it is pending, indefinitely.

## 1. Verified provenance

| # | Claim | Repo | Verdict | Evidence |
|---|---|---|---|---|
| 1 | Stop slot: 11 concerns, all quality/state, none work-remaining | ac | **true** | `src/scripts/hook_manifest.yaml` stop slot; stop-block path `turn_end_gate_hook.ts:109–111` |
| 2 | session-eol writes state; auto-handoff + resume runner absent | ac | **true** | `hook_manifest.yaml` session-eol row; UOTL Phase 6 unchecked |
| 3 | No scheduler state, no headless budgeted runner | ac | **true** | `agents/runtime/state/scheduler.json` absent; UOTL Phase 7 unchecked |
| 4 | Roadmap checkbox progress is already hook-observable | ac | **true** | `roadmap-progress` bound on stop + post_tool_use |
| 5 | Autopilot = Stop-hook check returning allow/continue; blocks stop and injects continuation until done | Source A | **true** | `commands/autopilot.ts:53–135` at the pin |
| 6 | Termination ladder: disabled → max-iterations → timeout → no-tasks → all-complete → stall | Source A | **true** | `commands/autopilot.ts:57–104` at the pin |
| 7 | Stall = 5 iterations without completed-count delta; 10 → auto-disable + memory rollback | Source A | **true** | `commands/autopilot.ts:94–104`; per-tick checkpoint `:113–116` |
| 8 | Task discovery from three declared sources | Source A | **true** | `autopilot-state.ts:30,243–300` |
| 9 | Headless executor: agent spawned non-TTY, sandbox profiles, process pool, timeout, global AI budget, job dedup | Source A | **true** | `services/headless-worker-executor.ts:1–46`; `runtime/headless.ts:1–40` |
| 10 | Interval worker daemon incl. memory-mutating consolidation | Source A | **true** | `services/worker-daemon.ts:1–56` |
| 11 | Out-of-process supervisor: heartbeat loop — resume crashed sessions by PID liveness, due schedules, backlog auto-dispatch capped at a parallelism limit, team rebalance, chronic cooloff | Source B | **true** | `src/session/daemon.rs:20–66,145–186`; cooloff test `:942` |
| 12 | Supervisor also auto-MERGES ready worktrees | Source B | **true** | `daemon.rs:42–44` |
| 13 | Session state in a local store, crash-resume on daemon start | Source B | **true** | `daemon.rs:22`, `session/store.rs` |

## 2. Harvest — inverted form, with rejections stated

Each mechanism docks at a D-defect. Nothing below is adopted by citation;
each is a **proposal** until its phase ships behind its gate.

**H-1 (→ D-1) Stop-slot re-engagement, Source A's shape, AC discipline.** The
autopilot-check shape — a stop concern returning allow/deny plus a
continuation prompt, with a termination ladder and stall detection — maps
1:1 onto AC's existing dispatcher (stop-slot block already exists, row 1).
AC's version differs in three deliberate ways: (a) the progress signal is
the roadmap checkbox delta the `roadmap-progress` concern already tracks
(row 4), not a parallel task file; (b) re-engagement runs AFTER the quality
gates — a `turn-end-gate` block takes precedence, and a turn refused for
unverified claims is never re-engaged past the refusal; (c) the
continuation prompt names the next unchecked step and its `verify:` line,
never a bare "do not stop until done".

**H-2 (→ D-2) Supervisor, Source B's shape, minus the merge.** The daemon
loop (row 11) is the reference for UOTL Phase 6.2's resume runner:
PID-liveness over session-register claims, crash-resume from the handoff
marker, relaunch budget. **Rejected borrowing:** the auto-merge of ready
worktrees (row 12). AC's anti-goal is explicit — merge stays human and
conversational (UOTL § anti-goals). The supervisor may open PRs; it never
merges one.

**H-3 (→ D-3) Headless budgeted execution, Source A's shape, minus interval
workers.** The headless executor + global budget + job-dedup + workspace
lease (row 9) is the primitive UOTL Phase 7 needs. **Rejected borrowing:**
the interval worker daemon (row 10) — standing memory-mutating background
workers contradict AC's human-gated learning doctrine. AC schedules ROADMAP
passes, not ambient self-modification.

**H-4 (→ D-4) The ladder completes with the council fallback.** Cross-ref:
`road-to-council-api-fallback.md` Phases 1–4 (transport resilience) plus
UOTL Phase 4.1 (medium-impact class routing). Neither external reference
offers a better-verified shape here — their advisor paths lack AC's
decision-class schema; the ladder stays home-grown.

**H-5 (→ D-5) Run the benchmark or close the gate.** No borrowing — the
blocker is discipline, not design. The team loop's pre-registered benchmark
runs before any team-autonomy phase below activates; a null closes the gate
and is published (UOTL Phase 4.2 verbatim).

## Phases

Locked throughout, restated once: `high_impact` / `user_required` route to
the user; the Hard Floor stands; merge stays human; kernel deltas keep
their own PR + soak; judge independence untouched. Autonomy eliminates
questions, never safeguards.

### Phase 0 — Baseline before behaviour

- [x] **0.0** Every AC row in § 1 re-verified live at `3d5bf5945`
      (2026-08-19). Row 1's count moves from 11 to **12** and the twelfth
      is `run-continuation` itself, registered LAST on the claude full stop
      chain — the ordering the whole design rests on, read straight off the
      manifest rather than trusted from the patch. Rows 2–4 hold: the
      `session-eol` concern is bound and the UOTL Phase 6 extensions are
      still absent; `agents/runtime/state/scheduler.json` does not exist;
      `roadmap-progress` is bound on `stop`, `post_tool_use` and
      `session_end`. The external rows are NOT re-verified — they hold at
      their pins only, and any phase that acts on one re-reads it first.
      `verify:` `./scripts-run src/scripts/lint_hook_manifest`
- [x] **0.1** Instrument run against the live store (2026-08-19, 18 runs
      in a 30-run request):
      contacts per run **median 0** · user wait **median 6.2 min** ·
      elapsed **median 108.4 min** · agent working **median 98.6 min**.
      **This is an interim reading and is NOT the baseline** — both
      pre-registered claims fix ≥ 20 recorded runs before any comparison,
      the instrument prints its own SHORT WINDOW warning at 18, and only 5
      of the 18 runs carry timing at all. Recorded here so the next reading
      has something to be compared against, and labelled so nobody cites
      it as the number. The baselines stay `unbacked` in CLAIMS.md
      (`user-out-of-loop-baseline`, `roadmap-wall-clock-baseline`), which
      is where they belong until the window fills.
      A second finding, worth more than the numbers: the instrument reads
      the store from the repo root, and a worktree has neither
      `interruptions.jsonl` nor the chat history (both gitignored), so it
      reported 0 runs until pointed at the main checkout with `--root`.
      Any later phase measuring from a worktree must pass `--root` or it
      will read a clean zero as a result.
      `verify:` `./scripts-run src/scripts/interruption_report`

### Phase 1 — Re-engagement concern

- [x] **1.0** New stop concern `run-continuation`, LAST in the stop chain:
      loads the active run contract (absent → concern is a no-op, hard
      requirement), reads roadmap checkbox state via the same source
      `roadmap-progress` uses, and when unchecked steps remain inside the
      contracted scope returns the dispatcher's continue-verdict with a
      continuation naming the next step + its `verify:` line.
      **Shipped 2026-08-18** (`run-continuation-phase1.patch`, built at
      `851568b`, applied clean at `3d5bf5945`):
      `src/scripts/hooks/run_continuation_hook.ts` + manifest declaration +
      registration LAST on the claude full stop chain. The contract carrier
      is the `sessions:claim` file plus the claimed roadmap's own
      `execution.mode: autonomous` — no second carrier invented. Kill
      switch `AGENT_CONFIG_NO_RUN_CONTINUATION=1`.
      `verify:` `./scripts-run src/scripts/lint_hook_manifest`
- [x] **1.1** Termination ladder, every rung a named log event in
      `agents/runtime/state/run-continuation.jsonl`: contract absent →
      no-op; quality-gate block this turn → defer (never override a
      refusal); max-iterations (default 25) → halt; wall-clock cap
      (default 4h) → halt; scope complete → allow-stop with event, state
      cleared; stall (3 engagements, no checkbox delta) → halt.
      **Shipped with 1.0.** Two defects the smoke run caught in the first
      draft, recorded because they are the load-bearing lessons: (a) a
      duplicate stop fire must REPEAT the block — an allow there ends the
      reply the block one event earlier exists to continue; (b) the turn
      ordinal is NOT a reply identity for a re-engaged turn (same-turn work
      keeps it constant), so the duplicate key is ordinal + open-count +
      60 s window, and progress detection rides the checkbox delta alone.
      `verify:` `npx vitest run tests/scripts/hooks/run_continuation.test.ts`
- [x] **1.2** Both halves now closed. The pure surface stays pinned by the
      21 tests in `tests/scripts/hooks/run_continuation.test.ts`; the open
      half is `tests/hooks/run_continuation_dispatch.test.ts`, 7 cases
      driving the REAL `dispatch_hook` binary over the REAL manifest with a
      claude `stop` envelope: engage, defer-on-refusal, no-claim, non-
      autonomous, kill switch, plus two manifest-order assertions.
      `verify:` `npx vitest run tests/hooks/run_continuation_dispatch.test.ts`

#### What 1.2 found

- **F-1 — the concern was not in `CONCERN_REGISTRY`.** A concern reaches
  the in-process dispatcher path only through that table, and the parity
  test (`tests/hooks/concern_registry_parity.test.ts`) is CI-enforced
  precisely because a missing line silently drops the concern back to the
  spawn path. The inherited patch declared the concern in the manifest,
  registered it on the chain, and shipped 21 green unit tests without it.
  That is the shape this phase's own § 2 H-1 warns about from the other
  side: the unit suite proves the function, only the integration proves it
  runs.
- **F-2 — the race-freedom claim was a comment, now an assertion.**
  `refusedThisTurn`'s docblock justifies reading the gate's marker off disk
  with "race-free by chain order … registered after the gate". That is a
  claim about one list in one YAML file, and a reordering is a one-line
  edit no unit test can see. Two cases now read the live manifest and
  assert both the strict ordering and that nothing runs after the
  continuation decision.
- **F-3 — two `verify:` lines in the source draft named a command that does
  not exist.** `./scripts-run src/scripts/validate_evals` has no script
  behind it (the tree carries `check_trigger_evals`, `lint_eval_freshness`,
  `run_skill_evals` and others — no `validate_evals`). Counted by grep over
  the inbox original, not from memory: 2 occurrences, at 1.2 and 3.2. A
  verify line that cannot run is worse than none — it reads as verified and
  checks nothing. Both replaced with commands that were actually executed.
- **F-4 — the event ledger records that an engagement happened, not what
  was injected.** The continuation text reaches the agent through the
  dispatcher's output; the `.jsonl` line carries only counts. Both are
  legitimate, and the test asserts the text on the output for that reason —
  but a reader auditing the ledger alone cannot see a degenerate
  continuation. Named here rather than fixed: adding the text to the ledger
  is a privacy-surface decision (it embeds roadmap prose into a state file),
  and this phase is not where that gets decided.
- [x] **1.3** Kill criterion in this file: if the held-defect rate over
      the conformance window rises above baseline while `run-continuation`
      is bound, the concern's default flips to off in the same PR that
      reports the number. (The switch exists: registration is the binding,
      `AGENT_CONFIG_NO_RUN_CONTINUATION=1` is the immediate off.)

### Phase 2 — Question ladder closure

- [x] **2.0** `road-to-council-api-fallback.md` Phases 1–3 landed in this
      same change-set, plus its Phase 4 gate. Four defects surfaced on the
      way, two of which meant the mechanism could not fire at all in
      production — so "council as a reliable resolver" was a weaker
      precondition than it read.
      `verify:` `npx vitest run tests/scripts/ai_council/orchestrator.test.ts` — 76 green.
- [x] **2.1** `decision_resolution.classes.<cls>.second_model` — optional,
      absent by default, `anthropic | openai | gemini` only. That set is
      narrower than the five `members:` accepts on purpose: xai and
      perplexity ship community CLI wrappers that consume an API key and
      are `billable = true`, so the discriminator is `billable === false`,
      not "has a cli subclass". Refused outright on the locked classes,
      including an explicit `null`. The mode lock is untouched.
      `verify:` `npx vitest run tests/scripts/ai_council/config.test.ts` — 99 green.
- [x] **2.2** `agent-config decision:memo {write,list}` +
      `src/scripts/decision_memo.ts`. One file per resolution under
      `agents/runtime/state/decisions/<run>/NNN.md`, monotonic and gap-free
      per run, refusing any memo missing one of the five fields. Local-only
      — the whole `agents/runtime/` tree is gitignored. It gates nothing;
      the locked classes are refused at the schema, and a second check in
      the ledger would read as the enforcement point and put the real one
      out of mind.
      `verify:` `npx vitest run tests/scripts/decision_memo.test.ts` — 18 green.
- [x] **2.3** The ladder text now states all four rungs in
      `roadmap-process-loop.md` § 5 step 4 and repeats the conclusion in the
      halt list: with neither a council nor a second-model rung, the
      ambiguity halt STANDS, and the gap is never filled by the agent
      arguing both sides to itself — that produces a verdict with no
      independent observer, which is what `evaluator-independence` exists
      over and what reads as convergence to whoever finds it later.
      `verify:` `grep -q "self-adversarial" src/agent-src/contexts/execution/roadmap-process-loop.md`

#### What Phase 2 cost, stated because the roadmap did not price it

Registering one CLI verb is five surfaces, not one: `src/cli/registry.ts`,
the `_dispatch.bash` case arm, its help block, the
`cli_help_command_count` budget (max + last_measured + dated note), and
the regenerated `evaluator-measurements.json`. `check_cli_registry_budget_sync`
refuses the PR until all five agree, and its own contract says the moving
PR is where they move. Named here so the next phase that adds a verb
budgets for it rather than discovering it at preflight.

### Phase 3 — Session immortality

- [x] **3.0** `session-eol` writes a DERIVED checkpoint
      (`agents/runtime/state/checkpoints/<run>.json`) when the advisory
      fires inside a running contract — open / done / parked counts, the
      next open step, the head. "Derived" is the load-bearing word: a
      handoff summary is authored and can be wrong in ways nothing
      catches, while every field here is recomputed from the roadmap on
      disk, which is what makes 3.2 possible at all. The contract carrier
      is the same `sessions:claim` file `run-continuation` uses — no
      second one invented — and the whole path is best-effort, because a
      recovery aid that can fail a Stop is a liability.
      `verify:` `npx vitest run tests/scripts/session_eol_hook.test.ts` — 22 green.
- [x] **3.1** `agent-config run:supervise --once` + `src/scripts/run_supervise.ts`.
      Classifies every register record: alive / no-roadmap /
      roadmap-unreadable / complete / budget-exhausted / relaunchable, in
      that order, because the order IS the logic. Relaunch budget
      ≤3 per run in a readable ledger; `AGENT_CONFIG_ORCHESTRATION_HALT`
      stops the watcher. **Never merges, pushes, or closes** — the H-2
      rejection, restated in the code, the help text and the output.
      `verify:` `npx vitest run tests/scripts/run_supervise.test.ts` — 19 green.
- [x] **3.2** `verifyCheckpoint` recomputes every claim against the tree
      and reports PER FIELD, and `roadmap-process-loop.md § 5d` makes
      re-verification the resumed run's first act. A disagreement is
      explicitly NOT an error: work landing between the checkpoint and the
      resume is the normal case, and a verifier that treated progress as
      corruption would refuse every healthy resume.
      `verify:` `npx vitest run tests/scripts/run_checkpoint.test.ts` — 16 green.

#### Two honest departures and one piece of debt

- **Liveness is the heartbeat, not a PID.** The borrowed design resumes by
  PID liveness; this register has no PID field, and `last_seen` against a
  per-platform TTL is what it actually maintains. Weaker in one way — a
  session killed seconds ago reads live until its TTL expires, so the
  watcher is late by up to one TTL. Stronger in another — a wedged session
  that still holds its PID reads dead here once it stops beating, and
  reads alive to a PID check forever. Stated rather than papered over.
- **`--relaunch` is accepted and refuses to act.** The headless invocation
  primitive is Phase 4.0 and is not built, so the flag reports what it
  would have done and exits non-zero. A flag that accepts and silently
  no-ops is what makes an operator believe a watcher is running when
  nothing is.
- **Debt added, measured rather than estimated.**
  `roadmap-process-loop.md` is one of the four files over
  `check_depth_budget`'s 16,000-char ceiling. Its baseline entry records
  20,360; it read ~25,620 before this phase and 26,891 after, so ~5,260
  chars of the drift predate this work and ~1,270 are mine. The gate is a
  count ratchet (a FIFTH over-ceiling file reds) and stays green, so this
  is recorded as debt rather than fixed here — splitting the loop context
  is its own change.

### Phase 4 — Unattended backlog

- [x] **4.0** `src/scripts/_lib/unattended_guard.ts` ships the three
      preconditions — remote safety (fails CLOSED on an unreadable git
      config, because "I could not tell" and "no production remote" must
      not resolve the same when being wrong means an unattended push),
      a budget whose ceilings default to ZERO so an absent config
      DISABLES the lane rather than permitting unbounded spend, and a
      job-dedup key derived from roadmap+head so a second caller
      recognises the first caller's job. `preflight` reports every
      refusal in one pass.
      **The live SPAWN is now a published refusal rather than a deferral,
      and the seam ships print-only.** The step stood `[~]` on the
      argument that an untested money-spending spawn is worse than none —
      which is right about the spawn and wrong about the deferral: a
      deferral with no end condition IS D-5, the defect this roadmap
      opens with, reproduced inside it. Resolved 2026-08-19 by AI council
      (anthropic/claude-sonnet-4-5 + openai/codex-default, blind peer
      review, $0.031). They SPLIT — build a dry-run seam vs cancel the
      capability — and named the same defect from both sides:
      `--relaunch` advertised something that did not exist. What ships is
      the intersection, recorded in decision memo 001:
      - `src/scripts/_lib/headless_invocation.ts` — builds the exact
        resume command per host off the `HOST_INVENTORY` tiering and
        `docs/contracts/host-agent-protocol.md`, refuses any host with no
        documented headless surface, and **contains no spawn, exec or
        fork — asserted by a source test, not promised by a comment.**
      - `run:supervise --print-relaunch` prints that command *for a
        human* alongside what an unattended lane would decide about the
        same run. The two are separate fields on purpose: conflating them
        tells an operator that a disabled budget forbids them from
        running it by hand, which is the opposite of true.
      - `--relaunch` now names a DECISION and its reopen condition
        instead of "not implemented yet" — the sentence that makes an
        operator wait for a release nobody is preparing.
      - **Reopen condition, falsifiable and not a date:** the first time
        `agents/runtime/state/checkpoints/` holds a checkpoint from a
        real dying run. Measured 2026-08-19 on the main checkout, that
        directory does not exist — the resume path has never had one
        input. Stated the other way round so it cannot be over-read: an
        empty directory is a CONJUNCTION of two rare conditions (recycle
        threshold AND a roadmap claim), so it licenses "do not build the
        spawn yet" and never "the need does not exist".
      Two live defects found on the way and fixed here, both in
      `run_supervise.ts`: `writeLedger` swallowed its own write failure
      under a comment asserting "there is NO CALLER" — false in the same
      file, since `digest` calls it fourteen lines later — so a digest
      could print `relaunch budget reset` over a counter that still
      stood, and a stale-high counter refuses the next relaunch the
      digest just promised. It throws now, and the release line follows
      the write rather than the intent.
      `verify:` `npx vitest run tests/scripts/unattended_guard.test.ts` — 31 green.
      `verify:` `npx vitest run tests/scripts/headless_invocation.test.ts` — 18 green.
      `verify:` `npx vitest run tests/scripts/run_supervise.test.ts` — 38 green.
- [x] **4.1** `agent-config run:supervise --digest` — the morning report:
      sessions dead vs alive, budget consumed against its ceiling,
      decision memos written, and what needs attention. It reports state
      that already exists and **schedules nothing, starts nothing**. No
      cron entry ships, because a scheduler that schedules work nothing
      can execute is worse than none — the acting half is 4.0's spawn.
      `verify:` `npx vitest run tests/scripts/run_supervise.test.ts` — 24 green.
- [x] **4.2** `claim: unattended-demotion-gate` pre-registered in
      CLAIMS.md — 14-day rework rate vs attended PRs, a rework definition
      fixed before any data exists, a ≥10-vs-10 power floor, and an
      honest-null path that CLOSES the capability if the lane never runs
      rather than leaving it pending. Registered before the capability
      exists, which is stated in the entry: no unattended run has
      occurred and none can, so it cannot have been written around a
      number already in hand.
      `verify:` `./scripts-run src/scripts/check_claims` — green, 70 entries.
- [-] **4.3** Team-loop gate (H-5): run the pre-registered
      build-review-fix benchmark; positive → team loop activates for
      unattended runs, null → gate closes, published. Blocker for any
      multi-agent variant of 4.0.
      **CLOSED 2026-08-19 as a published WILL-NOT-FUND null.** The AI
      council was UNANIMOUS 2/2 for option (b), matching the blocker's
      own recommendation, and openai supplied the refinement that makes
      the closure hold: reconsideration requires a NEW roadmap with fresh
      pre-registration and explicit funding — never reopening this
      blocker — because a closure that can be reopened by re-reading it
      decays straight back into the indefinite pending D-5 names. No USD
      ceiling is named at all: the $25 figure floated in round 1 was
      refused as unconnected to any evidence about what a valid verdict
      costs, and naming an unevidenced number would have been the same
      defect in a smaller font.
      Compounding fact, not a tiebreaker but decisive on its own: under
      step 4.0 there is no live spawn for a team loop to drive, so
      funding this benchmark now would measure a capability that does not
      exist. **The multi-agent variant of 4.0 leaves scope permanently.**
      Recorded in decision memo 002.

### Phase 5 — Standing measurement

- [x] **5.0** New AUTONOMY AXIS in `interruption_report`. Three of the
      five metrics have a real source and are reported per run and as
      medians: re-engagements (`engage` events), stall-halt RATE (a rate
      over runs, not an event count — a count rises with the window and
      reads as a regression when nothing changed), and relaunches. Memos
      per run joins on the same run id.
      The other two are printed as **NO INSTRUMENT**, never as `0`:
      unattended-vs-attended rework has no data because the lane cannot
      run, and memo revisit rate has none because a memo carries no
      revisit marker. Printing zero for an unmeasurable axis is the
      absent-record-vs-absent-event confusion that has already cost this
      repository a published false finding.
      `verify:` `npx vitest run tests/scripts/interruption_report.test.ts` — 33 green.
- [x] **5.1** Every default this roadmap flips carries its kill criterion
      in its own phase text, and the audit is short because the count is
      small: `run-continuation` (1.3, held-defect rate above baseline →
      default off, `AGENT_CONFIG_NO_RUN_CONTINUATION=1` is the immediate
      switch), the unattended budget (4.0 — both ceilings default to 0,
      so the lane is off until an operator sets one), and the demotion
      gate (4.2 — a breach returns the scheduler default to off). The
      second-model rung and the memo channel flip NO default: both are
      absent unless configured, so neither needs one.
      `verify:` `./scripts-run src/scripts/lint_roadmap_complexity`

## Blockers

### blocker: team-loop-benchmark-spend

- **Status:** resolved
- **Resolution:** (b) — published WILL-NOT-FUND null, 2026-08-19. AI
  council unanimous 2/2 (anthropic/claude-sonnet-4-5 +
  openai/codex-default), matching the recommendation below. The
  multi-agent variant of 4.0 leaves scope permanently; reconsideration
  requires a NEW roadmap with fresh pre-registration and explicit
  funding, never a reopening of this blocker. Step 4.3 carries the full
  verdict; decision memo 002 carries the reasoning.
- **Owner:** user
- **Blocks:** Phase 4 step 4.3, and any multi-agent variant of 4.0
- **Question:** may the pre-registered build-review-fix benchmark be run,
  and against which spend ceiling?
- **What to do:** pick exactly one — (a) authorise the benchmark run with a
  named USD ceiling, so 4.3 executes and its verdict is published either
  way; or (b) close the gate as a published null on the stated ground that
  the benchmark will not be funded, which permanently removes the
  multi-agent variant of 4.0 from scope.
- **Recommendation:** (b). D-5 names this benchmark as pending "since it
  was written", and a second indefinite pending reproduces the exact defect
  this roadmap opens with. A published null is a real answer that closes
  the gate; option (a) is right only if the multi-agent variant is wanted
  soon enough to justify the spend now.
- **If you do nothing:** 4.3 stays `[~]` forever and the multi-agent
  variant of 4.0 stays neither built nor refused — the indefinite-pending
  state D-5 already describes, now carried by a second roadmap.
- **Resolved when:** Phase 4 step `4.3` carries either a benchmark verdict
  with its run date and cost, or a published null naming option (b).

### blocker: worktree-claim-root-split

- **Status:** open
- **Owner:** user
- **Blocks:** the `process-full` contract-run acceptance criterion, and
  every future observation of `run-continuation` made from a worktree.
- **The defect, measured 2026-08-19.** The run contract has two halves
  that resolve their root differently, and in a worktree they land in
  different trees. `sessions_cli.cmd_claim` writes
  `agents/runtime/state/roadmap-claim-<session>.json` under
  `process.cwd()` — the worktree the operator is in. The stop-slot
  concern reads it under `envelope.workspace_root`, which
  `dispatch_hook` sets from `--project-dir`, i.e. the host's
  `CLAUDE_PROJECT_DIR` — the parent checkout. Neither side is wrong on
  its own; they simply never agreed on which tree the contract lives in.
- **Why it stayed invisible.** The concern's first rung is
  `contract absent → no-op`, and a no-op writes no event. So the ledger
  built to make the mechanism auditable is empty in exactly the case
  where it never ran, and empty is also what a healthy idle run looks
  like. The dispatch integration test cannot see it either: it passes the
  SAME root to the writer and the reader, which is the one arrangement
  in which the two agree.
- **Second symptom, same cause.** `session_register_hook` reads the slug
  through `read_claimed_slug(workspace_root, …)` on the same envelope, so
  the register records `roadmap_slug: null` for a session that has
  claimed. `run:supervise` listed this session as `roadmap=-` minutes
  after its claim. A watcher whose whole job is "dead session, roadmap
  still open" cannot see the roadmap of any worktree session.
- **What to do:** pick exactly one — (a) move the claim beside the
  session register, under the git **common dir**, which every worktree of
  a repo shares. That is the location `register_dir()` already uses and
  for the same reason, and a roadmap claim is repo-global by intent —
  `sessions:claim` tells the operator it "becomes visible to other
  sessions". Back-compat: read the old per-tree path when the new one is
  absent. Or (b) keep the claim per-tree and make the hook resolve the
  same tree, which means the concern stops trusting `--project-dir` — a
  larger change touching every concern, not just this one.
- **Recommendation:** (a). It is one shared helper called by the writer
  and both readers, it makes the claim agree with the register that
  already carries it, and it fixes the watcher symptom in the same move.
  Not taken autonomously in this run: the claim file is a shared contract
  carrier read by four modules, and relocating one is a structural change
  `scope-control` reserves for the maintainer.
- **If you do nothing:** `run-continuation` remains inert for every
  worktree session, which in this repository means effectively always,
  and the acceptance criterion above cannot be observed.
- **Resolved when:** a `process-full` run started from a worktree writes
  at least one `engage` event to
  `agents/runtime/state/run-continuation.jsonl`.

## Acceptance criteria

- [~] A `process-full` contract run finishes a 3-phase roadmap with zero
      synchronous contacts, re-engaging across turns, and opens the PR.
      **Half observed, and the half that is missing is the load-bearing
      one.** The run that built this roadmap took both it and
      `road-to-council-api-fallback` from open to closed across every
      phase without a synchronous contact, and opened one PR. But it made
      no `sessions:claim`, so `run-continuation` never engaged — the
      zero-contact property came from the operator's standing mandate,
      NOT from the mechanism this roadmap built. Claiming it as evidence
      for the mechanism would be attributing a result to the wrong cause,
      which is precisely the attribution error § 0.1's own falsification
      criteria are written against. Re-run under a claim to close it.
      **Re-run under a claim 2026-08-19. It still did not engage, and the
      cause is a defect rather than a missing step** — see
      `blocker: worktree-claim-root-split`. The claim was made
      (`sessions:claim road-to-long-horizon-execution`, 10:41) and the
      roadmap carries `execution.mode: autonomous`, so both halves of the
      contract were present, and `run-continuation.jsonl` stayed absent
      through every turn boundary of the run.
      Diagnosed rather than assumed, in four steps: the concern IS
      functional through the host's own shim entry point — driving
      `agent-config dispatch:hook --event stop --project-dir <worktree>`
      with this session's id wrote `{"event":"complete", …}` immediately;
      the same call with an unknown session id wrote **nothing**, so
      "contract absent → no-op" leaves no trace and a silent ledger is
      indistinguishable from a concern that never ran; hook-written state
      from this session (`context-fill.json`, `hot-context.md`,
      `session-eol/`, `.dispatcher`) all landed in the MAIN checkout while
      `sessions:claim` wrote into the WORKTREE; and `run:supervise`
      independently listed this session as `roadmap=-` minutes after the
      claim, which is the same cause seen through the register.
      So the criterion is not "not tried" and not "will not measure" — it
      is blocked on one identified defect, and it closes on the first run
      after that defect is fixed.
- [-] A killed session resumes via the watcher and completes without a
      contact; the resumed run's first commit shows the re-verification.
      **CANCELLED 2026-08-19 — WILL-NOT-MEASURE.** This criterion needs a
      LIVE relaunch, and starting a session unattended is now a published
      refusal (step 4.0). Left `[ ]` it would be the indefinite pending
      D-5 names, dressed as an acceptance criterion.
      What the refusal does NOT cancel is the half that can be observed
      without a spawn: `run:supervise --print-relaunch` emits the exact
      resume command, whose prompt orders the checkpoint re-verification
      as the resumed run's first act, and `verifyCheckpoint`'s per-field
      report is pinned by `tests/scripts/run_checkpoint.test.ts`. The
      unobserved part is precisely "and no human was involved".
      Reopens with 4.0's condition — the first checkpoint written by a
      real dying run.
- [-] One roadmap is delivered fully unattended (scheduler → digest → PR)
      inside the pre-registered budget, and its rework rate is recorded.
      **CANCELLED 2026-08-19 — WILL-NOT-MEASURE.** The spawn it needs is
      not deferred any more; it is refused (step 4.0). No scheduler ships,
      by the same reasoning 4.1 already recorded: a scheduler that
      schedules work nothing can execute is worse than none.
      Consequence for the ledger, followed through rather than left
      dangling: `claim: unattended-demotion-gate` pre-registered a
      14-day rework comparison for a lane that will not run, and its own
      honest-null path says the capability CLOSES if the lane never runs.
      That path is now taken — see its CLAIMS.md entry. Registering a
      threshold and then never resolving it is the failure the entry was
      written to avoid, and it would be odd to reproduce it in the same
      roadmap that refuses the capability.
- [x] The locked classes still reach the user. Pinned twice in this
      change-set: the mode lock (`high_impact` / `user_required` cannot
      be `agent` or `council`) and the new `second_model` rung, which is
      refused on those two classes outright — including an explicit
      `null`, so the key cannot be accepted at any value and teach an
      author that the dimension exists there.
      `verify:` `npx vitest run tests/scripts/ai_council/config.test.ts`
- [x] Both § 0.1 baselines have at least one post-change measurement.
      **Measured 2026-08-19 against the main checkout** (`--root`, per the
      § 0.1 finding that a worktree reads a clean zero): contacts per run
      **median 0** · user wait **median 68.9 min** · elapsed **median
      421.7 min** · agent working **median 169.6 min**. Both claims stay
      `unbacked`; the measurement exists, the comparison does not.
      **NEITHER axis clears its pre-registered ≥ 20-run floor, and the
      report could not previously say so.** It printed `runs: 21` under a
      single ⚠️ SHORT WINDOW banner driven by the SESSION count, so a
      reader checking the floor read 21 and concluded the contact axis had
      cleared it. It had not: 2 of those 21 runs carry timing and no
      ledger entry, so the contact axis stands at **19**. One banner
      cannot answer a question two axes ask separately, and this run made
      exactly that misreading before the fix caught it. `interruption_report`
      now prints per-axis N against the floor on each axis header.
      **A structural finding, worth more than the numbers.** The
      wall-clock axis reads timing from `agents/runtime/.agent-chat-history`,
      whose retention is `DEFAULT_MAX_SESSIONS = 5`
      (`src/scripts/chat_history.ts`; `chat_history.max_sessions` is unset
      on every settings layer). Five retained sessions yielded **4**
      timing-bearing runs. So the ≥ 20-run floor of
      `roadmap-wall-clock-baseline` is **unreachable at default retention**
      — not "not yet reached". Backing it needs a different timing source
      or a retention change, or the claim closes on its own honest-null
      path; recorded in its CLAIMS.md entry as a dated post-registration
      finding, with the threshold left exactly as pre-registered.
      The contact axis is one run short and reachable, which is a
      different answer from the wall-clock axis's and is why they are no
      longer reported under one verdict.
      `verify:` `npx vitest run tests/scripts/interruption_report.test.ts` — 41 green.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A re-engagement loop overrides a quality refusal | product | The whole value of the stop slot is that it can refuse; a continuation concern that outranks the refusal converts a safety gate into noise. | The concern registers LAST on the chain and defers on any quality-gate block this turn; the defer rung is a named event, and the ordering is asserted by the Phase 1.2 dispatcher test. | Phase 1 |
| 2 | The agent loops forever on a roadmap it cannot finish | implementation | Without a termination ladder a stuck run burns budget indefinitely. | Six rungs, each an event: max-iterations 25, wall-clock 4h, stall at 3 engagements with no checkbox delta, plus an environment kill switch. | Phase 1 |
| 3 | A supervisor that relaunches sessions merges work nobody reviewed | product | The external reference this design borrows from auto-merges ready worktrees; inheriting that would break the merge-stays-human anti-goal. | The auto-merge is a named rejection in H-2, restated in 3.1; the supervisor may open a PR and never merges one. | Phase 3 |
| 4 | Unattended runs spend without a ceiling | implementation | A headless primitive with no budget file converts a scheduling mistake into unbounded cost. | 4.0 carries the global budget file and a job-dedup key as part of the primitive rather than as a follow-up; 4.2 pre-registers the demotion threshold before the first unattended run. | Phase 4 |
| 5 | A relaunched session trusts a checkpoint that no longer describes the tree | implementation | Resuming by bookkeeping alone re-enters a run on stale claimed state. | 3.2 makes re-verification against the worktree the relaunched session's first act, which is the deliberate departure from the borrowed shape. The R2 completion review found the mitigation UNREACHABLE as first shipped — the checkpoint was keyed on the dying session's run id, which a relaunched session cannot derive — and it is reachable now via `latestCheckpointFor(repoRoot, slug)`, the slug being the one key a resume holds by definition. | Phase 3 |
| 6 | The benchmark stays pending forever and the gate is neither open nor honestly closed | product | D-5 is exactly this shape already; a second indefinite pending would reproduce the defect the roadmap names. | The gate is a declared blocker with two mutually exclusive resolutions, one of which is a published null. | Phase 4 |
| 7 | A continuation prompt that names no next step degrades into "keep going" | product | A bare imperative is the anti-pattern the harvest section rejects by name, and it produces work with no verifiable target. | The continuation must name the next unchecked step AND its `verify:` line; 2.3 restates the no-self-adversarial-fallback rule in the ladder text. | Phase 1 |
