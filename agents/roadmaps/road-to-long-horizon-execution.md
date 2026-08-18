---
complexity: structural
execution:
  mode: autonomous
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

- [ ] **0.0** Re-verify every AC file:line in § 1 against branch HEAD
      before executing any phase (the external rows re-verify against the
      pins — external trees move; a moved line re-opens the row, not the
      phase).
      `verify:` `./scripts-run src/scripts/lint_hook_manifest`
- [ ] **0.1** Read the current `interruption_report` window (UOTL Phase 0
      shipped it): record the two pre-registered baselines
      (`user-out-of-loop-baseline`, `roadmap-wall-clock-baseline`) as the
      numbers this roadmap is measured against.
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
- [ ] **1.2** Eval — the pure surface (mode gate, scan vocabulary incl.
      `[~]`/`[-]`/`blocked-by`, all six ladder rungs both directions,
      duplicate-fire key, refusal defer) is pinned by 21 tests in
      `tests/scripts/hooks/run_continuation.test.ts`. OPEN half: the same
      sequence through the LIVE dispatcher chain (`dispatch_hook.ts`)
      asserting turn-end-gate precedence end-to-end, as a test the suite
      runs.
      `verify:` `npx vitest run tests/scripts/hooks/run_continuation.test.ts`
- [x] **1.3** Kill criterion in this file: if the held-defect rate over
      the conformance window rises above baseline while `run-continuation`
      is bound, the concern's default flips to off in the same PR that
      reports the number. (The switch exists: registration is the binding,
      `AGENT_CONFIG_NO_RUN_CONTINUATION=1` is the immediate off.)

### Phase 2 — Question ladder closure

- [ ] **2.0** Land `road-to-council-api-fallback.md` Phases 1–3 (transport
      resilience is a precondition for "council as reliable resolver").
      `verify:` `npx vitest run tests/scripts/ai_council/orchestrator.test.ts`
- [ ] **2.1** UOTL Phase 4.1 verbatim: schema-gated `medium_impact` route
      to a second-model rung; `high_impact`/`user_required` remain
      schema-rejected for anything but `user`.
      `verify:` `npm run typecheck`
- [ ] **2.2** Decision-memo channel (UOTL Phase 4.3 verbatim): resolutions
      below the locked classes write memos; the PR links the directory.
      `verify:` `npm run typecheck`
- [ ] **2.3** Confirm in the ladder text: no self-adversarial fallback —
      without council AND second rung, the ambiguity halt stands (UOTL
      Phase 4.5 verbatim; a naked "continue working" imperative is the
      anti-pattern this line exists against).

### Phase 3 — Session immortality

- [ ] **3.0** UOTL 6.1: session-eol writes deterministic checkpoint +
      auto-handoff above the recycle threshold inside a running contract.
      `verify:` `npm run typecheck`
- [ ] **3.1** Supervisor à la row 11, scoped down: a local watcher (not a
      daemonized service in v1 — a foreground supervise loop is enough to
      falsify the design) with PID-liveness over session-register claims,
      relaunching a fresh headless session from handoff-plus-resume
      marker. Budgets verbatim from UOTL 6.2: ≤3 relaunches per run, daily
      token cap, emergency-halt stops the watcher. **No auto-merge, ever**
      (H-2 rejection).
      `verify:` `npm run typecheck`
- [ ] **3.2** Crash-resume honesty: a relaunched session's first act is
      re-verifying the checkpoint's claimed state against the worktree
      (row 13 resumes by PID bookkeeping; AC resumes by evidence).
      `verify:` `npm run typecheck`

### Phase 4 — Unattended backlog

- [ ] **4.0** Headless invocation primitive: spawn the coding agent
      non-TTY against one roadmap in a dedicated worktree + profile, no
      production remotes in that worktree's git config (UOTL 7.1), with a
      global USD/token budget file and a job-dedup key (row 9 shape;
      budget file format follows the council `cost_budget` conventions).
      `verify:` `npm run typecheck`
- [ ] **4.1** Scheduler entry + morning digest instead of permission
      prompts (UOTL 7.2 verbatim).
      `verify:` `npm run typecheck`
- [ ] **4.2** Demotion gate pre-registered BEFORE first unattended run:
      14-day rework-rate threshold vs attended PRs; breach returns the
      scheduler default to off (UOTL 7.3 verbatim). The pre-registration
      is the deliverable here; the 14-day measurement is not, and cannot
      be, produced in the same change.
      `verify:` `./scripts-run src/scripts/check_claims`
- [~] **4.3** Team-loop gate (H-5): run the pre-registered
      build-review-fix benchmark; positive → team loop activates for
      unattended runs, null → gate closes, published. Blocker for any
      multi-agent variant of 4.0. **Deferred** — see
      `blocker: team-loop-benchmark-spend`; the single-agent 4.0 primitive
      is unaffected and ships without it.

### Phase 5 — Standing measurement

- [ ] **5.0** Extend `interruption_report` with: re-engagements per run,
      stall-halt rate, relaunches per run, unattended-vs-attended rework
      rate, and memo revisit rate. Release-cycle cadence (UOTL Phase 8).
      `verify:` `./scripts-run src/scripts/interruption_report`
- [ ] **5.1** Every default flipped in Phases 1–4 carries its kill
      criterion in the same phase text.
      `verify:` `./scripts-run src/scripts/lint_roadmap_complexity`

## Blockers

### blocker: team-loop-benchmark-spend

- **Status:** open
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

## Done means

- [ ] A `process-full` contract run finishes a 3-phase roadmap with zero
      synchronous contacts, re-engaging across turns, and opens the PR.
- [ ] A killed session resumes via the watcher and completes without a
      contact; the resumed run's first commit shows the re-verification.
- [~] One roadmap is delivered fully unattended (scheduler → digest → PR)
      inside the pre-registered budget, and its rework rate is recorded.
      **Deferred** — this is an observation of a live multi-day run, not a
      change any single change-set can contain.
- [ ] The locked classes still reach the user, pinned by the existing
      UOTL eval (a `high_impact` question never resolves autonomously).
- [~] Both § 0.1 baselines have at least one post-change measurement.
      **Deferred** — a post-change measurement requires a conformance
      window that has not elapsed at authoring time.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A re-engagement loop overrides a quality refusal | product | The whole value of the stop slot is that it can refuse; a continuation concern that outranks the refusal converts a safety gate into noise. | The concern registers LAST on the chain and defers on any quality-gate block this turn; the defer rung is a named event, and the ordering is asserted by the Phase 1.2 dispatcher test. | Phase 1 |
| 2 | The agent loops forever on a roadmap it cannot finish | implementation | Without a termination ladder a stuck run burns budget indefinitely. | Six rungs, each an event: max-iterations 25, wall-clock 4h, stall at 3 engagements with no checkbox delta, plus an environment kill switch. | Phase 1 |
| 3 | A supervisor that relaunches sessions merges work nobody reviewed | product | The external reference this design borrows from auto-merges ready worktrees; inheriting that would break the merge-stays-human anti-goal. | The auto-merge is a named rejection in H-2, restated in 3.1; the supervisor may open a PR and never merges one. | Phase 3 |
| 4 | Unattended runs spend without a ceiling | implementation | A headless primitive with no budget file converts a scheduling mistake into unbounded cost. | 4.0 carries the global budget file and a job-dedup key as part of the primitive rather than as a follow-up; 4.2 pre-registers the demotion threshold before the first unattended run. | Phase 4 |
| 5 | A relaunched session trusts a checkpoint that no longer describes the tree | implementation | Resuming by bookkeeping alone re-enters a run on stale claimed state. | 3.2 makes re-verification against the worktree the relaunched session's first act, which is the deliberate departure from the borrowed shape. | Phase 3 |
| 6 | The benchmark stays pending forever and the gate is neither open nor honestly closed | product | D-5 is exactly this shape already; a second indefinite pending would reproduce the defect the roadmap names. | The gate is a declared blocker with two mutually exclusive resolutions, one of which is a published null. | Phase 4 |
| 7 | A continuation prompt that names no next step degrades into "keep going" | product | A bare imperative is the anti-pattern the harvest section rejects by name, and it produces work with no verifiable target. | The continuation must name the next unchecked step AND its `verify:` line; 2.3 restates the no-self-adversarial-fallback rule in the ladder text. | Phase 1 |
