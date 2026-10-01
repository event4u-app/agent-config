---
complexity: structural
status: ready
parent_roadmap: road-to-a-ledger-that-closes-the-loop
execution:
  mode: phase-checkpoints
estate_growth_exempt: "open_blockers rises by five, and every one of them existed before this change as prose inside an HTML comment under its own step. Steps 1.4, 2.2, 2.3, 3.3, 3.4 and 4.1 each recorded a real obstacle in a paragraph no gate reads: scanOpenSteps counted open=7 blocked=0 at the merge base, so the continuation ladder re-proposed a step waiting on a maintainer decision and two waiting on elapsed calendar time. Promoting them to structured entries under ## Blockers with inline blocked-by markers makes the same five obstacles machine-readable; it creates no new debt and disposes of none, which is why neither an archive nor a park is available as the offset. The five are not one: they gate different steps, carry different owners (one maintainer decision, four agent-probeable windows) and come due on four different dates, so merging them would hold an acceptance criterion closed for three weeks past its own condition."
estate_offset_exempt: "Supersedes road-to-a-ledger-that-closes-the-loop, but does not dispose of it: that file is active and ready, and archiving it executes the supersession rather than declaring it. Disposing of it in the same diff that merely adds the plan would retire live work on an inbox round's authority."
relates:
  - slug: road-to-a-ledger-that-closes-the-loop
    relation: supersedes
    note: "carries its 6.1 and AC-6 verbatim (§ Phase 3) under a deferred-resolution annotation; archiving the ledger file is this roadmap's own work, not done in the diff that adds this file"
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: "its open blocker daemon-host-kill-switch receives the kill-switch table of step 1.4"
depends: [road-to-a-kernel-that-guards-its-plumbing]
---
# Road to a stop that holds

> **Source:** ten-package code audit (2026-09-28), rows Episode closure 3,
> Mission persistence 3, Obligation ledger 3, Decision closure 4, Test-first 4
> against S9 at 6/6/6/6/8. Tree facts at `8de8a4c`, re-verified in the second
> pass: Layer 1 allows on `stop_hook_active` (`turn_end_gate_hook.ts:1199`),
> Layer 2 on `alreadyRefusedTurn` (`:1297`, reads `refused_turn === turnOrdinal`,
> `:909-925`); Detector C `detectUnverifiedEdit` (`:731-754`) scans
> `toolCalls` after the last edit against `_VERIFY_RE` (`:709`); the
> PostToolUse recorder `before_complete_hook.ts:387-450` persists
> `last_verification {command, tool, at, vacuous, counted}` and `ci_last` but
> no exit code and no output; `obligation_settle_hook.ts` allows on every path
> and its reading shows **80 delivered rows, 0 shadow rows** across 4 ledgers
> (`road-to-a-ledger-that-closes-the-loop.md:205-216`).

## Context

Carried from `agents/roadmaps/archive/road-to-a-ledger-that-closes-the-loop.md`
(template rule 17): its step 6.1 "Arm it only after the pre-registered bar
holds" and AC-6 are reproduced verbatim in § Phase 3, with the emitter defect
that kept its bar at zero fixed first.

> **corrected-from-reproduction (2026-09-29, /analyze:inbox t06).** The supplied
> file was reproduced against `main` read-only. Every `file:line` in its Source
> block resolved. ONE correction applied: the Risk Register `Risk type` column
> used values outside the enum `lint_plan_risk_register` enforces (`product` |
> `implementation`), which `status: draft` exempts and which reds the file the
> moment it flips to `ready`. The column is normalised; nothing else changed.

## Goal

A turn that changed production code cannot end on a verification the code
did not see pass: the stop gate reads a persisted run record with a command,
an exit code and a parsed test summary, classified by a pure module; the
contract's own Q1 instrument (shadow read on the allow path) makes the
re-refusal share a number; and the obligation ledger's shadow rows exist so
its pre-registered bar can be read — armed only by that reading.

## Prerequisites

- `road-to-a-kernel-that-guards-its-plumbing` Phase 1 landed (the gate's files
  are covered by the ratified-edit path).
- `tests/scripts/turn_end_gate_hook.test.ts`, `turn_end_verify_allowlist.test.ts`,
  `tests/scripts/hooks/before_complete_*.test.ts` green at the start ref.
- Every fixture in this lane is either red at the start ref or marked
  `already_fixed` with a code citation; none is invented to keep a step
  relevant. Sabotage-first: each guard's test is shown red with the guard
  neutralised before the fix lands; a source-string assertion never
  satisfies a primary `verify:` line.

## Phase 1 — Verification is a record, not a regex

- [x] **1.1 Add `src/scripts/_lib/verification_evidence.ts` (new).** Pure
      classifier over a run record `{command, exit_code: number|null,
      stdout_tail, stderr_tail, runner}` → one of
      `PASS_EVIDENCE_OK | FAIL_EVIDENCE | INVALID_RUN(reason)` with reasons
      `zero_tests_discovered | nonzero_exit_without_test_failure |
      fixture_or_load_failure | unreadable_record | not_a_verification_command |
      exit_code_unavailable | timeout_or_killed`. Parsers: vitest/jest summary line, TAP, pytest
      `-q` tail, phpunit/pest summary. `exit_code: null` (a host that omits it)
      → `exit_code_unavailable`, never a pass. No fs, no spawn, no clock.
      verify: `tests/scripts/verification_evidence.test.ts` (new) — one
      fixture per verdict and runner; `echo test` → `not_a_verification_command`;
      0 tests → `zero_tests_discovered`; `exit_code: null` → `exit_code_unavailable`;
      `npm test && exit 1` → `FAIL_EVIDENCE`; `ls build` →
      `not_a_verification_command`; a killed vitest (`exit_code: 137|143`, no
      summary) → `timeout_or_killed`, never a pass.
      <!-- closed 2026-09-29, `d63895955`. `src/scripts/_lib/verification_evidence.ts`;
      `tests/scripts/verification_evidence.test.ts` 43 green (36 at 1.1, 7 added by 1.3).
      Every fixture the verify line names exists and passes, `exit_code: null` and
      an absent field both included. TWO DESIGN CHOICES NOT IN THE PLAN, both
      recorded because a reader will ask: (a) exit 0 with NO parsable summary is a
      PASS — `tsc --noEmit`, `eslint` and `phpstan` print nothing on success, and a
      classifier demanding a summary would reclassify the most common green signal
      in this tree as invalid; (b) `not_a_verification_command` is decided by a
      BLOCK list of executables that assert nothing, not an allow list, because it
      is a REFUSING reason and an allow list would put every runner the module has
      never met — `bash scripts/test.sh`, an in-house wrapper — into it on day one.
      `INSTRUMENT_GAP_REASONS` splits the two reasons that describe the instrument
      from the five that describe the run, which is Risk 1's mitigation made
      readable by the consumer instead of re-derived from a comment.
      SABOTAGE: dropping the `canVerify` guard and turning a missing exit code
      into a pass failed exactly 5 of 36 and no others; restored from a copy. -->
- [x] **1.2 Extend the existing recorder, not the manifest.** In
      `before_complete_hook.ts` (`verify-before-complete`,
      `hook_manifest.yaml:118-123`, `needs_payload_bodies: [input, result]`,
      already bound on every host's `post_tool_use`): read `exit_code` and the
      last 4 KB of `tool_response|toolResponse|output|stdout|result`
      (`:324-335` already resolves the field) and append a per-turn
      `verification_runs[]` entry beside `last_verification` in the existing
      state file (`statePathFor`, `:128`; digest convention `state_io.ts:675`).
      Each entry carries the post-tool ordinal (or `at`) so a record can be
      placed against the turn's edit sequence without a transcript read.
      No new concern id (K16); the `post_tool_use` slot budget is untouched.
      verify: after `npx vitest run tests/scripts/verification_evidence.test.ts`
      in a session, the state file carries one `verification_runs` entry with
      `exit_code: 0` and `runner: vitest`; `tests/scripts/hooks/before_complete_hook.test.ts`
      extended, not rewritten.
      <!-- closed 2026-09-29, `99255cd9f`. No new concern id, no manifest edit, no
      change to the `post_tool_use` slot budget — the existing recorder grew the
      array. `tests/scripts/hooks/before_complete_hook.test.ts` 35 green, extended
      (31 pre-existing cases untouched).
      ONE FIELD BEYOND THE PLAN: `after_edits`, the recorder's edit counter as it
      stood when the command ran. The plan asks for "the post-tool ordinal (or
      `at`)"; an ordinal against the TURN's edit count is what a reader can compare
      without a clock, so the field is the counter rather than a sequence number,
      and `edits_this_turn` is written beside it. `EDIT_TOOLS` carries all twelve
      names the bound platforms use, not the gate's four: a missed edit name makes
      a run look LATER than it was, which is the one direction that could clear an
      unverified edit.
      SABOTAGE: hardcoding the exit code to 0 and neutering the edit counter failed
      exactly 4 of 35 and no others; restored from a copy. -->
- [x] **1.3 Detector C reads records, and keeps a replay mode.** In
      `turn_end_gate_hook.ts` `detectUnverifiedEdit`: when the state file has
      `verification_runs` for this turn, fire iff none classifies
      `PASS_EVIDENCE_OK` **with an ordinal after the turn's last edit** (the
      regex path already scans only after the last edit, `:718-725`; the record
      path must keep that or it regresses); when the file has none (transcript replay through
      `measure_turn_end_gate.ts` / `check_detector_corpus.ts`), fall back to
      the `toolCalls` scan so the false-positive corpus stays replayable. The
      fallback is logged as `mode: transcript`.
      verify: `turn_end_gate_hook.test.ts:1427` ("is silent when a verification
      run follows the edit") rewritten to the record form; a new case:
      `echo test` + edit + no record → refused; edit → pass → edit → refused
      (proof predates the final mutation); `turn_end_verify_allowlist.test.ts`
      unchanged (it pins the selector, which still exists);
      `measure_turn_end_gate` reproduces its last committed corpus reading.
      <!-- closed 2026-09-29, `dcb07e09b`. `turn_end_gate_hook.test.ts` 130 green;
      `turn_end_verify_allowlist.test.ts` 56 green and UNTOUCHED;
      `check_detector_corpus` reports 3 detectors x 3 classes, 22 fixtures, all
      behaving — `measure_turn_end_gate` calls `detectUnverifiedEdit(pendingCalls)`
      with no run state, so its corpus reading is unchanged BY CONSTRUCTION and not
      merely observed to be.
      Every fixture the verify line names exists: `:1427` rewritten to pin the
      transcript MODE alongside its unchanged assertion, `echo test` + edit +
      record → refused, and edit → pass → edit → refused on `after_edits` (1) being
      below the turn total (2).
      THE PLAN'S LIVENESS CONDITION IS TIGHTENED, and this is the one substantive
      deviation. It reads "when the state file has `verification_runs` for this
      turn" — taken literally that key is present in the recorder's EMPTY state, so
      a host binding no `post_tool_use` slot has a file carrying `[]` written by
      the prompt and stop events alone, and reading it as "the turn ran nothing"
      would refuse EVERY editing turn on that host whatever the operator ran. The
      predicate is therefore `edits_this_turn >= 1`, the one field only a post-tool
      event can raise. Ownership is checked as detector D checks `ci_last`: a
      foreign file's passing record would vouch for a run this session never made.
      An instrument gap falls back to the transcript rather than refusing, per
      Risk 1.
      SABOTAGE: making the record path yield to the regex unless the run FAILED,
      and removing the freshness clause, failed exactly 5 — the four record-mode
      refusals and the placement case — and no others; restored from copies. -->
- [~] **1.4 Kill-switch table.** <!-- blocked-by: kill-switch-owner-decision | asked: no — the question is already open and already put, as `daemon-host-kill-switch` in `road-to-adversarial-verification-and-long-runs.md`; re-asking it from a second file would duplicate a live decision rather than advance it --> Add `## Kill switches` to
      `docs/contracts/hook-architecture-v1.md` listing every
      `AGENT_CONFIG_[A-Z_]+` the hooks read (bracket form —
      `run_continuation_hook.ts:1018`, `state_io.ts:42`, …), with owner class;
      resolve blocker `daemon-host-kill-switch` in the adversarial roadmap by
      pointing its `Resolved when` at the table.
      verify: `grep -rhoE "AGENT_CONFIG_[A-Z_]+" src/scripts/hooks src/scripts/_lib | grep -v __AGENT_CONFIG_BUNDLE__ | sort -u | wc -l`
      equals the table's row count.
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

## Phase 2 — Q1 becomes a number (the contract's instrument, no second refusal)

- [x] **2.1 Shadow read on the allow path.** Per
      `turn-end-detector-demotion.md:342-354`: on a retry (Layer 1 or Layer 2
      true), before returning `EXIT_ALLOW`, run the detectors once more and
      record `would_refuse_again: {detector, turnOrdinal}` into the session
      state. Verdict stays `EXIT_ALLOW`; latency budget: the extra transcript
      read happens only on retries (`hook-latency-budget.json` `any_hook_event.p95_ci: 250`).
      verify: fixture retry that still promises → allowed AND a
      `would_refuse_again` row; `bench_hook_latency --gate` green.
      <!-- closed 2026-09-30. The 2026-09-29 note below was a SCHEDULING note, not
      an impossibility, and it said so: "belongs in its own reviewed change with
      its own latency measurement". This is that change — it carries nothing else
      structural. Both halves of its reasoning are answered rather than waived.

      THE RESTRUCTURING IT NAMED IS THE ONE THAT LANDED, and the alternative it
      ruled out stayed ruled out. `main()` now calls `assembleDetectorInputs()`
      once and `runDetectors()` once; the live verdict and the shadow read call
      the same two functions, so there is exactly one detector-assembly and the
      settle hook's rule — "a detector whose shadow measurement and live
      behaviour come from different code measures nothing" — is satisfied by
      construction rather than by care.

      THE VERDICT IS UNCHANGED ON EVERY PATH, and that is the property that made
      this safe to do here. Both layers still `return EXIT_ALLOW` unconditionally;
      the shadow only writes. `turn_end_gate_hook.test.ts` 145 green (131
      pre-existing, all untouched), `turn_end_verify_allowlist.test.ts` 56 green
      and untouched, `turn_end_refusals.test.ts` 21 green,
      `verification_record_roundtrip.test.ts` 16 green, `check_detector_corpus`
      3 detectors x 3 classes / 22 fixtures all behaving.

      THE ROWS DO NOT GO WHERE THE PLAN SAYS, and this is the one deviation. The
      plan says "into the session state", which reads as the refusal record —
      but `refused_turn` there is the re-entrancy WEDGE guard, `parseRecord`
      rejects any record lacking it, and a Layer-1 retry can occur with no
      refusal by this gate at all (another stop concern blocked). Writing there
      meant either synthesising a `refused_turn` this gate never wrote or
      loosening the parser protecting it. The rows go to a sibling,
      `<key>.shadow.json`, in the same directory and owned by the same module;
      a fixture asserts the refusal record is byte-identical across a retry.

      `retries_observed` IS RECORDED BESIDE THE ROWS, beyond the plan's
      `{detector, turnOrdinal}`. Without it an empty row list cannot be told
      apart from "no retry happened" — opposite readings of the same file — and
      Q1 could never read below 1. The fixture that proves it is the clean
      retry.

      ONE DEFECT THIS STEP INTRODUCED AND FIXED IN THE SAME CHANGE, recorded
      because a green suite hid it for one run: `pruneAgedRefusalState` scans the
      directory for `*.json`, and `<key>.shadow.json` matches. `parseRecord`
      rejects it, the unparseable branch KEEPS what it cannot read — correct for
      a corrupt refusal record and exactly wrong here — so every shadow record
      would have lived forever, which is the unbounded growth that pruner exists
      to stop. It now ages shadow records on their own `last_at`; sabotaged, the
      fix fails exactly one test.

      LATENCY, measured rather than asserted. `bench_hook_latency --gate` is
      GREEN on this branch: `pre_tool_use` p95 66 ms against a 175 ms cap, `stop`
      p95 119 ms against the 250 ms `any_hook_event` cap, n=50 per slot, darwin.
      UNIT AND LIMIT: these are local darwin readings, not the CI runner's, and
      CI is the authoritative leg — see § Cost this branch added, whose readings
      were CI's. Bundle delta, measured by building `dist/hooks/dispatch.js` at
      the merge base and at HEAD in the same worktree: 1,555,324 -> 1,560,056
      bytes, **+4,732 B / +0.304 %**, against the +19,110 B / +1.34 % the
      previous pass of this roadmap added.

      THAT NUMBER WENT STALE THREE TIMES BEFORE IT WAS RIGHT, and all three are
      recorded rather than silently overwritten, because a measured figure that
      ages is indistinguishable from a fresh one to every reader. +3,288 B, read
      mid-change before the pruner fix landed. +3,856 B, aged within the hour
      when CI's source-size ratchet forced the transcript extraction. +3,942 B,
      aged again when the independent review's two structural findings were
      fixed. Each reading was correct when taken and wrong by the time anyone
      could act on it.

      THE LESSON IS ABOUT WHEN, NOT ABOUT CARE, and it is the durable half.
      What caught every one of them was a gate on a different subject — the
      pre-push bundle-content check refusing a stale `dist/hooks/dispatch.js`.
      Nothing in this tree compares a number written in a roadmap against the
      thing it measures, and no amount of diligence closes that gap for a figure
      taken before the last edit. Take it last.

      The non-retry path pays NOTHING new — the same
      reads in the same order, relocated — and a retry now pays what a non-retry
      turn already paid, which this bench reads as 0.324 ms of `turn-end-gate`
      concern time.

      SABOTAGE, twice. Neutralising the shadow write failed exactly 5 of 145 and
      no others. Making the fold append a row even when no detector fired — the
      change that would make Q1 read 1 forever — failed exactly 2, the clean
      retry and its pure-fold sibling. Restored from copies both times.

      INDEPENDENTLY REVIEWED, and the review changed the shipped record. A
      fresh subagent on a neutral prompt (committed at
      `agents/evidence/reviews/stop-that-holds-shadow-read.review-input/prompt.md`)
      reviewed the whole branch diff and returned *"mergeable on the code, I
      would not merge the record as it stands"*, with 12 findings. It
      reproduced six sabotages independently and every published number. Two
      of its findings were structural and are fixed here rather than noted:
      `retries_observed` was a POOLED counter, which made the per-layer Q1 the
      rows are shaped for uncomputable — a clean retry adds no row, so it left
      no layer trace anywhere — and step 2.2 instructed exactly the pooling the
      `layer` field exists to prevent. The counter is now keyed by layer and
      2.2 says so. Full dispositions:
      `agents/evidence/reviews/stop-that-holds-shadow-read.findings.md`.

      Q1 IS STILL INERT, and shipping the producer did not change that. Its
      reader is 2.2. `docs/contracts/turn-end-detector-demotion.md` is corrected
      in this same change on three points that this step made false: instrument 1
      no longer "does not ship here", the rows are not on the session record, and
      the non-termination valve's unreachability no longer shares a cause with
      Q1's. The word "inert" is deliberately NOT removed — that is 2.2's work and
      removing it now would claim a reading nobody has. -->
- [~] **2.2 Q1 in the detector report.** <!-- blocked-by: q1-shadow-reading-window --> `measure_turn_end_gate.ts` prints
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
- [~] **2.3 Publish the reading** <!-- blocked-by: q1-shadow-reading-window --> to `agents/evidence/analysis/turn-end-q1-<date>.md`
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

## Phase 3 — The obligation ledger can refuse (carried)

- [x] **3.1 Reproduce the zero-shadow defect before fixing it.** Test: seed a
      ledger with delivered rows (as `rule_inject_hook.ts:281` writes them,
      keyed on the envelope `session_id`, `:390`), run `obligation_settle_hook`
      with `CLAUDE_CODE_SESSION_ID` unset (the dispatcher sets none,
      `dispatch_hook.ts:728`) → expect the early return at `:148` and zero
      shadow rows. Then fix the join: the settle hook resolves the session
      the same way the injector does (envelope, then env fallback). Both
      arrays live in one `agents/runtime/state/obligations/<digest>.json`
      (`_lib/obligations.ts:57-62`); no path change.
      verify: the reproducing test fails before and passes after; a session in
      this repository that edits code without discharging gains a `shadow`
      row.
      <!-- closed 2026-09-29, `5c9415258`. `tests/hooks/obligation_settle.test.ts`
      27 green (21 pre-existing untouched, 6 added).
      RED FIRST, and the red is the defect and not a missing export: with the
      envelope on stdin and `CLAUDE_CODE_SESSION_ID` unset, four of the six new
      cases failed on "expected [] to have a length of 1 but got +0" — the hook ran
      to completion and wrote no shadow row.
      THE PLAN NAMES THE WRONG SIDE OF THE JOIN, recorded because step 3.2 repeats
      the error. The defect is entirely in the READER: `rule_inject_hook.ts`'s
      delivered-row write is byte-unchanged. The settle hook read
      `CLAUDE_CODE_SESSION_ID`, which the dispatcher never sets — it hands each
      concern the envelope on stdin and `AGENT_CONFIG_PACKAGE_ROOT` in the
      environment, nothing else — and returned allow when it was empty. So every
      dispatched stop event was a non-reading. The fix resolves envelope
      `session_id` / `sessionId`, then the nested payload's, then the environment
      as a last resort: the same order and both spellings the injector accepts.
      The env name gains no siblings, because a name the writer never keys on
      addresses a ledger that cannot exist. The ROOT moves with it as one join, not
      a second change: a ledger is addressed by root AND session, and the two
      disagree on hosts whose shim does not chdir.
      THE SECOND HALF OF THE VERIFY IS NOT DISCHARGED HERE. A live shadow row needs
      a dispatched stop event from a session running the INSTALLED hook bundle, not
      this worktree's source, so it cannot be produced inside the change that fixes
      it. The fixture proves the mechanism end to end through `main()`; the live row
      is AC-3's seven-day window.
      SABOTAGE: reversing the precedence so the environment wins failed exactly the
      FALLBACK-ordering case and nothing else; restored from a copy.
      FIGURE THAT DID NOT REPRODUCE — the source block's "80 delivered rows, 0
      shadow rows across 4 ledgers". UNIT: one JSON array element in `delivered[]`
      / `shadow[]` of each `agents/runtime/state/obligations/*.json`, measured
      2026-09-29 on this machine. READING: 187 delivered, 0 shadow, 8 ledgers. The
      zero-shadow half reproduces exactly and is the load-bearing half; the counts
      are a day of growth past the 2026-09-28 audit and nothing here carries them
      forward. -->
- [x] **3.2 Reset the bar window from 3.1's commit** — mandated by clause (2)
      of `docs/CLAIMS.md:1211` on any change to the delivered-row write path
      (the join is that path). Numbers unchanged (K7).
      verify: `check_claims` exits 0; `last_verified` names 3.1's commit.
      <!-- closed 2026-09-29, `ab59f866f`. `check_claims` exits 0 — 102 ledger
      entries, 61 backed, 33 unbacked inventory. `build_proof` re-run in the same
      change per the CLAIMS-edit obligation; it wrote no diff.
      Clause (9) on `obligation-settle-shadow-bar` records the reset at
      `5c9415258`. Numbers unchanged (K7): the bar, the sample floor, the window
      and the demotion condition are exactly as pre-registered 2026-09-13; what
      reset is QUALIFICATION, and every row written before that commit is out of
      the sample.
      THE STEP'S CITATION IS CORRECTED IN THE CLAIM RATHER THAN REPEATED. It
      mandates the reset "on any change to the delivered-row write path (the join
      is that path)". It is not that path, and none of the five surfaces clause (2)
      enumerates was touched either — so a reader checking the enumeration alone
      would find no trigger and conclude wrongly that qualification survived. The
      reset is owed on clause (2)'s LEADING phrase, "anything altering the
      detector's exposure": before `5c9415258` the reader could not produce a row
      at all, which is a larger exposure change than any of the five.
      `last_verified` is the DATE, `2026-09-29`, with the commit in the clause
      body. The step asks for the commit in that field; every other entry in the
      ledger carries a date there, and writing a sha into a date field to satisfy a
      verify line would corrupt the field for every reader of it. The commit is
      recorded, and traceable, one line away.
      CONSEQUENCE the clause also carries: clause (8)'s "179 delivered / 0 shadow"
      first reading is disarmed as a base rate — its zero-shadow half is now
      explained by this defect rather than by clean turns. -->
- [~] **3.3 Carried verbatim** <!-- blocked-by: obligation-shadow-bar-window --> **— 6.1 Arm it only after the pre-registered bar
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
- [~] **3.4 Carried — AC-6 of the parent:** <!-- blocked-by: obligation-shadow-bar-window --> the armed detector refuses a turn
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

## Phase 4 — A refusing ladder (gated on programme blocker d1)

- [~] **4.1 Only if D1 is "yes":** <!-- blocked-by: d1-stop-ladder-after-reading | asked: no — D1 is a decision ON the Q1 reading, and the reading does not exist; putting it now would be asking for a guess, which is what step 2.3 exists to prevent --> replace Layer 2's boolean with the
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

## Phase 5 — Test-first as evidence

- [x] **5.1 `RED_THEN_GREEN` in the record, checked at the stop.** Two
      `verification_runs` entries for the same test file — the earlier
      `FAIL_EVIDENCE` naming a test the later `PASS_EVIDENCE_OK` names as
      passing — classify `RED_THEN_GREEN`. Detector F ("completion claim over
      production code no test accompanies", `:757`) accepts a new test file
      only with that pair present. `check_test_delta.ts` is **not** extended:
      its header (`:9-13`) states it cannot see order and CI cannot reach
      gitignored session state.
      verify: fixture pair red→green allowed; green→green with a new test file
      refused with `no_red_evidence`.
      <!-- closed 2026-09-29, `04bb5ea4a`. `turn_end_gate_hook.test.ts` 130 green;
      both fixtures the verify line names exist — a red→green pair over one target
      is allowed, and green→green with a new test file is refused with
      `no_red_evidence` in the reason.
      THREE CASES BEYOND THE VERIFY, because each is a way the pair could be
      claimed without being observed: a green that PREDATES the last edit, a red
      and a green over DIFFERENT targets, and a whole-suite red pairing with a
      whole-suite green (allowed — it is a legitimate sequence, and pairing it with
      a single-file run would claim one nobody saw).
      `check_test_delta.ts` is NOT extended, per the step. Its header states it
      cannot see order and CI cannot reach gitignored session state; both still
      hold.
      SCOPE NARROWED FROM THE STEP'S WORDING. It asks for "the earlier
      FAIL_EVIDENCE naming a test the later PASS_EVIDENCE_OK names as passing" —
      i.e. matching an individual test NAME across two outputs. The unit here is
      the test FILE the command names (`testTargetKey`), because cross-output
      name matching is fragile in a way that would produce `no_red_evidence` on
      honest work — a refusing verdict — whenever a runner's formatting differs
      from the parser's expectation. File-level is the coarser and safer read of
      the same sequence.
      Without records the escape is UNCHANGED, and an instrument gap is not a
      missing red: a transcript cannot see an exit code, so refusing on a
      transcript-only host would refuse every honest turn there.
      SABOTAGE: letting any pass satisfy the pair — dropping both the target match
      and the placement — failed exactly 3 (green→green, stale green, mismatched
      targets) and no others; restored from a copy. -->

## Review round — 2026-09-30

An independent review was dispatched to a fresh subagent on the pushed branch
with a neutral prompt. **Its verdict was `do not merge on the current
evidence`, and it was right.** Findings and dispositions:
`agents/evidence/reviews/stop-that-holds.findings.md` (20 findings — 2 critical,
7 medium, 11 low; 17 fixed here, 2 accepted, 3 deferred with reasons).

**The two critical findings were reproduced independently before being acted
on**, against 1,077 object-shaped and 11 string-shaped tool results in this
machine's own Claude Code transcripts, and they change what several closed steps
above may be read as claiming:

1. **Step 1.2's verify line was satisfied by a payload shape no host sends.**
   Claude Code's Bash result carries NO exit-code field: success is an object
   `{stdout, stderr, interrupted, isImage, noOutputExpected}`, failure is the
   bare string `Error: Exit code N\n…`. So on the only host that binds the
   turn-end gate, every recorded run carried `exit_code: null`, classified
   `exit_code_unavailable`, became an instrument gap, and the turn ended
   normally — **including a turn whose vitest run had just reported two
   failures, with that count sitting parseable in the record**. The Goal at the
   top of this file was false as first shipped. Fixed in `728259377`: three
   readings with provenance on the row.
2. **The recorder JSON-stringified an object response**, and every parser here
   is line-anchored, so no summary could ever be parsed from the success shape.
   Latent behind finding 1 and live the moment it was fixed — where it would
   have turned detector F into a refusal of honest TDD. Fixed in the same commit.

**Why both were invisible to a green suite, which is the durable lesson.** Every
gate-side fixture hand-wrote `stdout_tail` with real newlines and an explicit
`exit_code`; every recorder-side test asserted only that the stored string
CONTAINED a summary. Nothing crossed the producer/consumer seam, and nothing used
a real host payload shape. `tests/scripts/verification_record_roundtrip.test.ts`
now does: 16 cases through the real recorder into the real classifier, and **13
of them fail against the pre-fix recorder** — which is the measurement of how
much the hand-written fixtures were hiding.

Three further findings were false-refusal paths on a BLOCKING gate, each now a
fixture: a load-failure phrase overriding a clean summary, the canonical TDD
first red (`Cannot find module`) not counting as a red, and detector F firing on
any test edit rather than a new test file. And **AC-5's "28 == 28" was already
false at the merge base** — a merge had brought in one more switch — so
`check_kill_switch_table` now compares the two sets on every run rather than a
reader recounting by hand.

## Cost this branch added, measured rather than asserted

**The hook-latency gate's `pre_tool_use` cap is red on this branch's CI, and the
budget's own `revisit_if` trigger has fired.** Recorded here and in
`src/config/hook-latency-budget.json` because that budget was pre-registered
precisely so it could not be spent silently.

- Three consecutive CI runs: p50 **172 / 175 / 176 ms**, p95 **179 / 176 / 176
  ms** against a 175 ms cap. The budget's `revisit_if` reads *"the p50 — not the
  p95 — of a green run rises above 160 ms"*, and the historical p50 range it
  cites is 111-148. So this is not simply runner variance by the file's own
  discriminator.
- **What this branch contributed**: `npm run build:hooks` produces 1,443,442
  bytes here against 1,424,332 at the merge base — **+19,110 B, +1.34%**. Every
  concern shares one bundle, so that is paid by every slot including
  `pre_tool_use`, which none of this branch's six changed files is bound on. At
  ~149 ms of non-spawn work the proportional share is **~2 ms**: real, and far
  short of the 24-64 ms by which the p50 exceeds its historical range. The
  branch is a contributor, not the cause.
- **`--legal-comments=none` was measured as a mitigation and recovers 635
  bytes.** The growth is code, not prose, so it cannot be given back without
  removing the feature.
- **The 2026-10-01 pass (step 2.2, partial) added +0 bytes**, measured the same way:
  `npm run build:hooks` at the merge base and at HEAD both produce 1,565,516
  bytes, byte-identical. The Q1 rollup is tree-shaken out — the hook path
  imports `turn_end_refusals` for the record types and never for the reader,
  and `measure_turn_end_gate.ts` is a CLI script no bundle entry reaches.
  Recorded here beside the other two deltas so the trend across passes is
  readable in one place: +19,110 B, then +4,732 B, then 0. It does not relieve
  the cap red, which this block already attributes to the first pass; it means
  the third pass is not a contributor to it.
- **The cap is NOT raised.** The budget block states that raising it again
  without a measured distribution beside it is the config-bending the block
  exists to make visible. Its own routing sends a fired trigger to
  `road-to-per-turn-hook-economy` D-2 and to the maintainer.

## Blockers

Promoted 2026-09-30 from prose. Every entry below already existed as a
paragraph inside a closed step's HTML comment, where no gate reads it:
`scanOpenSteps` measured `open: 7, blocked: 0` at the merge base, so the
continuation ladder was free to re-propose a step waiting on a maintainer
decision and two waiting on elapsed calendar time. After this change it
measures `open: 0, blocked: 6`. Nothing here is newly discovered and nothing
newly refused — the obstacles are the same ones, in a shape the ladder, the
dashboard and the archival sweep can act on.

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
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Parser misses a consumer's runner and refuses honest work | implementation | A passing run classifies `INVALID_RUN` | Only absence of any record or `FAIL_EVIDENCE` refuses; every `INVALID_RUN` reason is logged as a finding, never refused on | Phase 1 — Verification is a record, not a regex |
| 2 | Shadow read on retries breaks the stop-slot budget | implementation | Extra transcript read per retry | Retries only; `bench_hook_latency --gate` in the PR | Phase 2 — Q1 becomes a number (the contract's instrument, no second refusal) |
| 3 | The join fix changes the delivered-row semantics the bar was registered on | product | Window must restart | Clause (2) of the claim mandates exactly that; 3.2 does it | Phase 3 — The obligation ledger can refuse (carried) |
| 4 | A reader publishes a number a bar is read against, and it is a different quantity | product | `measure_turn_end_gate --q1` prints a retry-conditioned share while § The bars registers Q1; the two disagree in direction | Renamed `retryConditionedShare`; the report header, the function docstring and the contract all state it is not bar-comparable, and three dispatch-censored detectors print no number at all | Phase 2 — Q1 becomes a number (the contract's instrument, no second refusal) |

**Re-reviewed 2026-10-01, and this time a fourth row WAS added.** All four rows
re-read against the 2.2 pass and its independent review, not only the ones it
touched.

- **Row 1 — carried forward unchanged, and that is a finding rather than an
  omission.** 2.2 added no parser and no new `INVALID_RUN` reason, so nothing
  about its refusing or reporting direction moved. Its open half is still open:
  a passing run whose runner no parser has met classifies `PASS_EVIDENCE_OK` on
  its exit code alone.
- **Row 2 — cost direction MEASURED AND FLAT for this pass.** The row watches
  whether the shadow mechanism spends the stop-slot budget. 2.2 adds a reader
  that no hook imports: `npm run build:hooks` at the merge base and at HEAD
  produce byte-identical bundles (1,565,516 B, digest `bc62ee1a…`), and the
  rollup is tree-shaken out entirely. So this pass is not a contributor to the
  live `pre_tool_use` cap red § Cost this branch added records. The row stays
  open on the earlier passes, whose +19,110 B and +4,732 B are unaffected by
  this reading.
- **Row 3 — still DISCHARGED**, and untouched by 2.2.
- **Row 4 — NEW, and it is the risk the independent review of 2026-10-01
  found realised rather than hypothetical.** The branch shipped a reader, called
  its output Q1, and edited the contract to say Q1 was readable — while the
  number divided by every retry on the layer rather than by the detector's own
  refusals. Ten retries, nine after `verification` refusals and one after a
  `language` refusal, one `language` row: Q1 for B is 100 % and that reader
  printed 10 %. Opposite verdicts against the same bar.

  **Why it is a row rather than a closed defect, which is the opposite call from
  the one 2.1 made for its pruner bug.** That candidate was found and fixed
  inside its change with a test that fails when the fix is removed — a mechanism
  closed it. This one is mitigated by NAMING: the function, the report header
  and the contract all say the number is not bar-comparable, and nothing
  prevents a future reader carrying it to the bars table anyway. A mitigation
  that depends on someone reading a sentence is a live risk, and the file's own
  rule is that a register entry for a closed defect reads as live risk — the
  converse applies here. It closes when the producer records the originating
  detector and the reader computes the registered quantity.

**Disposition after the 2026-09-30 pass**, kept for the record: Row 1's disposition is carried forward unchanged and
that is a finding rather than an omission: 2.1 added no parser and no new
`INVALID_RUN` reason, so nothing about its refusing or reporting direction
moved. Row 3 stays discharged. Row 2 is rewritten below, from NOT YET INCURRED
to incurred-and-measured.

**NO FOURTH ROW WAS ADDED, and the candidate is named so the absence is
readable.** 2.1 puts a second record shape in a directory whose pruner did not
know about it — unbounded growth, which is exactly the shape row 1's sibling
risks take. It is not a row because it was found and fixed inside the same
change, with a test that fails when the fix is removed; a register entry for a
closed defect reads as live risk and dilutes the three that are.

**Disposition after the 2026-09-29 pass**, re-reviewed against the steps that
closed rather than left standing:

- **Risk 1 — MITIGATED as designed, and the mitigation is readable rather than
  asserted.** `INSTRUMENT_GAP_REASONS` in `_lib/verification_evidence.ts` is an
  exported set the consumer reads, so "an instrument gap is never refused on" is
  a branch two detectors take (C and F both fall back on it) instead of a rule a
  comment states. Still live for the OTHER half the row names: a passing run
  whose runner no parser has met classifies `PASS_EVIDENCE_OK` on its exit code
  alone — see step 1.1's note on why exit 0 with no summary is a pass — so the
  refusing direction of this risk is closed and the reporting direction is not.
- **Risk 2 — INCURRED 2026-09-30 AND MEASURED, which is the outcome the row
  asked for rather than an escape from it.** Step 2.1 landed, so a retry now
  does carry the extra transcript read the row names. The mitigation the row
  specifies was executed literally: retries only — the non-retry path performs
  the same reads in the same order, relocated into
  `assembleDetectorInputs()` — and `bench_hook_latency --gate` ran in this PR
  and is green, `stop` p95 119 ms against the 250 ms `any_hook_event` cap and
  `pre_tool_use` p95 66 ms against 175, n=50 per slot.

  **What that reading does NOT establish, stated because the row will be read
  again by someone deciding whether the budget was spent.** It is a darwin
  local measurement, and the § Cost this branch added block above is about CI
  readings, where the same slot read 176-179 ms on the previous pass. Local
  green is a necessary condition and not the authoritative one; CI is. The
  comparable number that IS portable is the bundle delta, measured by building
  `dist/hooks/dispatch.js` at the merge base and at HEAD in one worktree:
  +4,732 B / +0.304 %, against +19,110 B / +1.34 % for the previous pass.
  (Recorded three times before it was right — step 2.1's note carries every
  stale reading and what caught them.)

  **The risk does not close, it narrows.** Its refusing direction — a shadow
  read wedging a turn — is closed by construction and by fixture: both layers
  still return `EXIT_ALLOW` unconditionally and the whole shadow body is
  wrapped, so no failure in it can change a verdict. Its cost direction stays
  live until a CI run of this branch reports the stop slot.
- **Risk 3 — DISCHARGED.** Step 3.2 did exactly what the row's mitigation names:
  clause (9) of `obligation-settle-shadow-bar` resets qualification at
  `5c9415258` with the numbers unchanged. The row's premise turned out to be
  imprecise in the same way the step was — the semantics that changed were the
  READER's, not the delivered-row write's — which strengthens rather than
  weakens the case for the reset, and is recorded in the claim.

## Acceptance Criteria

- [x] AC-1 — A turn that edits a non-doc file with `echo test` as its only
      verification is refused at its first stop naming the missing record; the
      same turn with a `PASS_EVIDENCE_OK` entry ends normally.
      <!-- closed 2026-09-29. Both halves are fixtures in
      `tests/scripts/turn_end_gate_hook.test.ts` § "record mode — step 1.3":
      "refuses `echo test` — the record path reads the run, not the word" asserts
      the refusal AND asserts that the same tool calls WITHOUT a record are
      allowed, which is the before/after in one case; "is silent when a PASSING
      record sits after the last edit" is the second half. The refusal names the
      verdict — `not_a_verification_command` — rather than restating the rule. -->
- [~] AC-2 — <!-- blocked-by: q1-shadow-reading-window --> `measure_turn_end_gate` prints a non-null Q1 per detector and the
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
- [~] AC-3 — <!-- blocked-by: obligation-shadow-rows-live --> The obligation ledger in this repository's own sessions gains
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
- [~] AC-4 — <!-- blocked-by: obligation-shadow-bar-window --> (carried AC-6) once armed, the detector refuses an undischarged
      write and allows a discharged one.
      <!-- OPEN — blocked on 3.3's arming, whose window resets to 2026-09-29. -->
      <!-- DEFERRED 2026-10-01. Condition re-executed: `check_claims` exits 0,
      every floor unmet (0 rows / 0 sessions / 2 of 30 days), clause (5) says an
      underpowered window settles nothing in either direction. Nothing is armed,
      so the criterion's own "once armed" precondition is unreached.
      EARLIEST SETTLEMENT 2026-10-29, on either branch — armed and demonstrated,
      or filed `resolved-null` under clause (4), which this criterion then
      closes as carried-null rather than unmet. -->
- [x] AC-5 — The kill-switch table's row count equals the grep count.
      <!-- closed 2026-09-29. 28 == 28, with the measurement unit published above
      the number in `docs/contracts/hook-architecture-v1.md` § Kill switches and
      the plan's own grep corrected there — it could not remove the token it
      named. See step 1.4's evidence for the three findings. AC-5 is about the
      COUNT and is closed; step 1.4 stays open on its blocker half. -->

## Provenance

Source-derived (template rule 19). Pre-council draft; council notes are
inlined before promotion.

| Descriptor | Token | Drawn in, per defect |
|---|---|---|
| S9 — phase-loop reference | `ENC1:<mint>` | RED-evidence verdict vocabulary (`zero_tests_discovered`, `fixture_or_load_failure`, `nonzero_exit_without_test_failure`) for the defect "Detector C reads command text" |
| S3 — prose-corpus reference | `ENC1:<mint>` | negative control: deny-once keyed on a command hash — the shape 4.1's ladder is not |

Gap-table: KEEP 1.1, 1.3, 1.4, 2.1–2.3, 3.1–3.2, 5.1; FOLD 1.2 (into the
existing recorder), 3.3–3.4 (carried from the parent); CUT "new
verification-record concern" (recorder exists), "retire
verify-before-complete" (feeds Detector D), "native delivery writer" (80
delivered rows exist — wrong root cause). From the parallel proposal
`road-to-observed-completion-kernel` (consolidated by the programme): ADOPTED
`timeout_or_killed`, the record ordinal, the edit→pass→edit fixture, the
delete-discharge fixture, the ratification-backed discharge and the
`already_fixed`/sabotage-first disciplines; CUT its `ToolObservation` record
and completion state machine (second vocabularies beside `RUN_TERMINAL_STATES`
and `JournalEvent.terminal_state|verification_ref`), its
HARD/EVIDENCE_REQUIRED/ADVISORY classes (second taxonomy beside
`REFUSABLE_CLASSES`, `obligation_frequency.ts:185-215`), its "denied for
every N" test (asserts the wedge `turn-end-detector-demotion.md:86-87,333-336`
forbids), and its HEAD-digest freshness (adds a git spawn to the stop slot).
