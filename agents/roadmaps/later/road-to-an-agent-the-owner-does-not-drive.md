---
complexity: structural
status: later
tree_pin: 81788b6e63
review_by: 2026-12-15
estate_growth_exempt: "+1 later_roadmaps, owner-directed 2026-11-03 (analyse the last 100 sessions and create a roadmap to work off later): parked rather than active because the active estate is 8, over the WIP cap of 5; extending an existing roadmap was rejected because the matching ones (road-to-user-out-of-the-loop, road-to-gate-autonomy, road-to-worktrees-that-leave-after-the-merge) are archived and their recurrence is the finding itself."
entry_condition:
  what: "a slot under the active-roadmap WIP cap of 5 is free, or the owner promotes this roadmap explicitly (the owner asked for it to be worked off later, 2026-11-03)"
  when: "at the next estate drawdown or on the owner's promote instruction; no date is promised"
  who: "owner (promotion); any agent run once promoted"
execution:
  mode: phase-checkpoints
---
# Road to an agent that does not need the owner to drive it

> **Source:** [`analysis.md`](../../auto-learnings-1/analysis.md) — 100 sessions, 2026-10-20 → 2026-11-03.
> **Owner directive (2026-11-03):** analyse the last 100 sessions for unwanted
> questions and manual steps the agent should have done, in
> `agents/auto-learnings-1/`, to be worked off later. The analysis lives there;
> this roadmap is parked in `later/` because `check_agent_artifact_location`
> keeps roadmaps under `agents/roadmaps/` and the active estate is over the WIP cap.

## Goal

The owner states a goal once; the agent carries it to the end. Owner questions
only when the council cannot answer.

**Success measure** (re-run the analysis of `analysis.md` over the next 100
sessions; baseline in brackets):

| Metric | Baseline | Target |
|---|---|---|
| Bare option-number replies | 131 | ≤ 30 |
| Resume-sentence prompts | ~55 | ≤ 5 |
| User-run `git push` / `gh pr merge` | 31 | ≤ 3 |
| Cleanup orders | 21 | 0 |
| "merged / CI green, continue" prompts | ~25 | ≤ 3 |

## Phase 0 — Measure before changing

- [ ] **0.1 Friction report as a command.** Promote the session-skeleton
      extraction + the deterministic counts from `analysis.md` into
      `agent-config friction:report [--sessions N]` (reads the host transcript
      dir, excludes bench/scratchpad, prints the metric table above; no prompt
      text leaves the machine).
      verify: a fixture transcript dir yields the exact counts of a hand-built table.
- [ ] **0.2 Baseline pinned.** Commit the baseline numbers as an evidence record
      so Phase 6 compares against a fixed value, not memory.

## Phase 1 — A mandate is per goal, not per operation

- [ ] **1.1 Goal-scoped mandate.** "until merged" / "mit PR und merge" /
      "arbeite die roadmap ab" / an accepted `/roadmap:process-*` contract
      authorises every push, follow-up PR, fix-up commit, merge-when-green and
      post-merge cleanup **that serves that goal**, for the whole goal — not the
      first operation only. Amend `commit-policy` § one-shot and
      `scope-control` § git operations with the goal-scope clause; production
      deploys and prod data stay on the Hard Floor. Owner-reserved change
      (lowers how often a floor asks) — owner directive above is the record;
      kernel-rule soak per `kernel-rule-edits` applies.
      verify: routing/golden fixture — after "mach PR und merge", a second
      fix-up PR is merged without a question; a prod deploy still asks.
- [ ] **1.2 Own unshared branch.** Force-push / amend / message rewrite on a
      branch this session created and nobody else pushed to needs no ask
      (`git-history-discipline` carve-out); a shared or inherited branch still asks.
      verify: fixture pair own-branch (silent) vs inherited-commit (asks).
- [ ] **1.3 Release needs no review gate.** A release the owner ordered runs
      without an owner or council review in front of it (s089).
      verify: the release command path contains no review step.

## Phase 2 — Dominant options are decisions, not questions

- [ ] **2.1 Mechanical dominance check.** Extend
      `check_reply_consistency` (and the `turn-end-gate`) to flag a numbered
      block whose recommended option is the only one that continues the
      already-stated goal (the others are "stop", "not yet", "later",
      "leave it") — the agent takes it and states the assumption in one line.
      verify: corpus of 20 real blocks from `analysis.md` sessions: dominant ones
      flagged, genuine trade-offs (different outcomes the owner cares about) pass.
- [ ] **2.2 No menus for housekeeping.** Worktree location (always a separate
      worktree), release location, deleting the agent's own stale artefacts,
      cleanup after merge: decided, never asked. Session-register collision →
      spawn a worktree silently (amend the session-register text that mandates
      the numbered ask).
      verify: the session-register hook output contains no ask instruction.
- [ ] **2.3 Options carry meaning.** An option that names an internal id also
      says what happens; lint the reply checker for bare ids in option labels.

## Phase 3 — The council answers before the owner is asked

- [ ] **3.1 Council-first is code, not memory.** `/analyze:inbox`,
      `/roadmap:process-*` and `/work` route every open/owner question to
      `council:decide` first; only `high_impact`/`user_required` with a split or
      no quorum reaches the owner. Move the host-memory preference into the
      command contracts so it reaches every session.
      verify: a dry run with a seeded open question produces a council record and
      no owner prompt.
- [ ] **3.2 Bounded ratification.** A ratification/council loop on one subject
      stops after the fix-loop ladder (`execution.fix_loop_max`) and takes the
      majority or the agent's recommendation with the dissent recorded — never
      14 rounds of owner `1` (s003).
      verify: simulated split council converges or escalates once at the bound.
- [ ] **3.3 Owner refusals are terminal.** An owner "keep it" (e.g. the merge
      bypass, s058) is recorded and no rule, council or review re-proposes the
      removal; check `recurring-criticism` is not misread as license to reopen.
      verify: a recorded refusal suppresses the proposal in a fixture run.

## Phase 4 — Runs survive interruptions

- [ ] **4.1 Persisted run state.** Every `/roadmap:process-*`, `/work` and
      `/analyze:inbox` run writes a run-state file (goal, mandate, current step,
      live subagent ids + their task paths) on each step boundary.
      verify: kill mid-run fixture → state file names the last finished step.
- [ ] **4.2 Automatic resume.** `session_start` (and post-compaction) detects an
      unfinished run state and injects the resume instruction itself, so the
      owner's sentence "continue where you were, with the subagents, neither
      restarts" is never needed; subagents are resumed via their ids, not respawned.
      verify: compaction fixture resumes at the recorded step with zero owner text.
- [ ] **4.3 No turn end while work is pending.** The `turn-end-gate` refuses a
      stop while a background subagent of this run is live or a PR of this run
      has CI pending and a mandate covers merging — the agent waits with one
      waiter (`ci_settle`) and continues. Promissory closings ("next turn",
      "when CI is green I will …") are already a refusal reason; extend the
      detector to the measured phrasings.
      verify: fixtures from s003/s009/s013/s090 tails are refused.
- [ ] **4.4 Stuck lane self-heal.** A subagent silent beyond a bound is nudged,
      then stopped and its slice re-dispatched from the run state — no status
      menu to the owner (s064).

## Phase 5 — A compliant path to land a PR

- [ ] **5.1 Pre-push preflight that never needs skipping.** Find why the agent
      reached for `AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT=1` (18 user pushes):
      make the preflight scoped/fast enough, or let it defer to remote CI under
      `quality.local_auto_run: false`, so a plain `git push` succeeds.
      verify: timed push from a fresh worktree passes without the env flag.
- [ ] **5.2 One sanctioned landing command.** `agent-config pr:land <n>` —
      wait for checks, merge per repo convention, delete branch, remove worktree
      — and document its allowlist entry, so the auto-mode classifier sees a
      normal command instead of `--admin` / skip flags. The owner bypass stays,
      used only through this command with its bypass record.
      verify: end-to-end on a throwaway PR in CI-fixture mode.
- [ ] **5.3 Lint fixes without history rewrite.** A red commit-subject check
      is fixed by squash-merge title or a new commit, not force-push.
- [ ] **5.4 Cleanup is part of landing.** Worktree + local + remote branch
      removal runs inside `pr:land`; the archived
      `road-to-worktrees-that-leave-after-the-merge` mechanism is called from it
      (it shipped but nothing reaches it).

## Phase 6 — Done means seen working

- [ ] **6.1 Live-surface proof for UI claims.** A UI/UX completion claim needs a
      running-surface probe (Playwright / screenshot of the real page) in the
      same turn; unit tests alone do not discharge it (s027, s054, s085).
- [ ] **6.2 "Committed" is not "done".** A step reported done under a PR
      mandate must be pushed; the stop gate checks for unpushed commits on the
      run branch (s079, s090).
- [ ] **6.3 Attribution follows the owner.** The owner's `no-attribution-footers`
      rule beats a host attribution reminder; add a `commit-msg` hook check for
      `Co-Authored-By` / "Generated with" lines (s006, s027).
- [ ] **6.4 Language pin covers labels.** Extend the reply-language check to
      `Recommendation:` / `Empfehlung:` labels and inter-tool lines (s008, s091).

## Phase 7 — Leaner long runs

- [ ] **7.1 Run-cost budget.** Report Bash / council / test-run counts per run
      (s077: 1,186 / 58 / 69) and set a per-step budget that switches to targeted
      test filters and batched calls when exceeded.
- [ ] **7.2 Always-loaded weight.** Measure the always-loaded rule/hook text per
      turn and cut what pushes long runs into compaction; ties to 4.1–4.2.

## Phase 8 — Close the loop

- [ ] **8.1 Re-measure.** Run `friction:report` over the 100 sessions after
      Phases 1–5 land and compare to the 0.2 baseline; a target missed by more
      than 2× reopens the matching phase rather than closing this roadmap.
- [ ] **8.2 Auto-learnings 2.** If the report shows a new top friction class,
      open `agents/auto-learnings-2/` with the same method.

## Not in scope

- Lifting the Hard Floor for production deploys, prod data, or irreversible
  external sends — only the per-operation reading inside an owner goal changes.
- Host-side classifier policy (owned by the host); Phase 5 only gives it a
  normal-looking command to allow.
