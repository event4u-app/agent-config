---
complexity: lightweight
status: ready
estate_offset_exempt: "Revision of the draft merged in #2359 (2ad637acb6), rewritten in place; no new file. Rejected instead: folding it into road-to-a-setup-that-decides-itself (that file owns the loading default, one of six measured costs) or road-to-local-gates-wired-while-they-are-green (it owns wiring gates, not lane waiting, misfires or decision asks), and archiving a neighbour, because none is finished."
estate_growth_exempt: "Promoted draft -> ready on the owner's instruction of 2026-10-15 to land inbox-2026-10-s as ready roadmaps; the promotion raises active_roadmaps by one and offsets nothing, because the only candidate dispositions (park in later/, merge into a dependency) were rejected in estate_offset_exempt."
execution:
  mode: phase-checkpoints
depends: [road-to-a-setup-that-decides-itself]
relates:
  - slug: road-to-a-setup-that-decides-itself
    relation: depends
    note: "Owns the blocker instruction-load-observer-has-no-scheduled-owner. Step 2.2 here adds dated evidence to it; no step here edits that file's plan."
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: depends
    note: "Owns thinning ~/.claude/rules. Not re-planned here."
  - slug: road-to-local-gates-wired-while-they-are-green
    relation: disjoint
    note: "Its batches add ~20 gates per change to a required job with no paths filter (standing-payload-delta.yml:497, :555-563). Step 1.4 here asks it to report each batch's duration delta; it does not stop the drain."
  - slug: road-to-a-cold-start-paid-once
    relation: disjoint
    note: "Owns warm workers and spawning into a rate-limit event. Phase 2 here decides whether tokens or wall-clock bind a night; that verdict is an input to it, not a re-plan of it."
---
# Road to agent throughput recovery

> **Source:** owner question of 2026-10-14 (night runs used to close many
> roadmaps, now few, and they stop often), the draft merged as #2359, and the
> source set `agents/tmp.old/inbox-2026-10-s/` (one transcript, two three-loop
> revisions of that draft), re-verified against `main` @ `085ec41ff` on
> 2026-10-15. Figures the owner's local transcripts or the CI API carry, and
> this revision could not re-read, are marked *(local)*.
>
> **Arrivals:** 2 — latest `inbox-2026-10-s` (2026-10-15); earlier: the draft
> merged as #2359 (2026-10-14). The subject's earlier carriers closed rather
> than dismissed it: `archive/road-to-agent-turnaround.md`,
> `archive/road-to-blocking-time-by-cause.md`,
> `archive/road-to-turnaround-followups.md`.

## What this revision changes against the merged draft

Re-read against the tree, **three of the draft's six causes were already this
size during the high-throughput weeks** (first-turn context, pre-push time,
`tests.yml` duration — the 2026-08-30 baseline and the evidence file's own CI
table), so they are costs to cut, not causes of the decline. **One cause rests
on a measurement artifact** (the `drain/*` column reads zero once merges are
squashed). **One is contradicted by the estate** (528 of 576 open active steps
carry no `blocked-by` marker on 2026-10-15). **The draft re-plans an instrument,
a baseline, a council decision and two mitigations that exist**
(`probe_turnaround`, `src/config/turnaround-budget.json`, the 2026-10-01 and
2026-10-07 readings, decisions D6–D8 of the archived blocking-time roadmap). This
revision extends instead of duplicating, and puts first the question the draft
skipped: **is a night bound by wall-clock or by tokens?** More lanes only help in
the first case.

## Context — the decline, re-measured

**Size.** First-parent commits on `main`, night window 22:00–08:00 Berlin,
re-counted 2026-10-15 (nights with activity): **11.1** per night 2026-08-10..23,
**7.7** 2026-08-24..09-06, **7.7** 2026-09-28..10-13. Merges per night are flat
against the two weeks before the trough; the draft's "about 4×" compares against
one peak week and counts non-merge commits, which squashing collapses. The
merged revision's ticked-steps series (56.7 → 30.0 → 19.1 per night) says what
fell is **work per merge**, not merges. No night archived 20 roadmaps inside
22–08; the 20–24 days were whole-day counts.

**Causes, ranked by what the tree supports:**

1. **Blocking time grew and its regression signal had no reader.**
   `probe_turnaround --against-baseline` exits 1 today exactly as on 2026-10-01:
   blocking share 0.7975 > 0.6202, context floor 244,472 > 230,705 (run
   2026-10-15 over the last 10 sessions). The 2026-10-01 reading recorded the
   direction "for whoever owns that number next" (`turnaround-reading-2026-10-01.md:100`);
   nobody does. In the 2026-10-15 window the largest blocking cause is
   `sleep-poll` (216 min), then `network` (102), then `ci-wait` (88) — not the
   `user-wait`/`ci-wait` pair of the 2026-10-07 reading.
2. **The foreground CI wait is prescribed.** `push_settle_hook.ts:198-199`
   ("Before this turn ends: 1. Settle it") and `git-workflow` SKILL.md:109 say so
   on every push; `ci_settle` already names the background form on its last line
   (`ci_settle.ts:300`). The agent follows the louder instruction.
3. **Work per merge fell.** Most active roadmaps come from inbox harvest rounds;
   10 of 20 `ready` roadmaps sit at 0 ticked steps while small ones close.
4. **Turn-end refusals and guard misfires** *(local counts)*. Reproducible in the
   tree: `block_no_verify` refuses `git grep -n`, `git log -n 5`, `git branch -n`,
   `git push -n` and `git merge -n` (`block_no_verify.ts:342-355` reads short
   `-n` as `--no-verify` on every subcommand); plain `grep -n` and
   `git status; sed -n …` pass since the 2026-08-20 fix. The language pin still
   follows an English paste under a short German lead when the paste carries no
   heading (`stubs/road-to-language-pin-short-lead.md`, re-probed 2026-10-15).
5. **Decision asks** *(local counts)*. `no-cheap-questions` Iron Law 4 already
   bans continuation prompts under a mandate, and a dominant option is a cheap
   question by definition; replies of `mach weiter` are a compliance gap, not a
   missing rule. D8 of the archived blocking-time roadmap closed `user-wait` as
   holding no avoidable minutes on four calls — this owner complaint reopens
   that disposition on a larger sample (step 5.1), never on the repetition.
6. **Standing context and usage-limit pauses** *(local counts for pauses)*. 106
   rule files sit in `~/.claude/rules/` on the measuring machine, 104 without a
   `paths:` key. The floor was 218,705–230,705 tokens on 2026-08-30 — not a cause
   of the decline, but if nights hit the usage limit it is the binding
   constraint and outranks everything above.

**Ruled out:** CI duration (`tests.yml` p50 14 min on 2026-08-17..24 and 13–14
min in W41/W42); pre-push (67 s median on 2026-08-30, ~1 min now); "no parallel
lanes" (drain branches interleave commits within minutes on 2026-10-13/14); "the
workable backlog shrank" (528 unblocked open steps). **Unresolved confounder:**
the co-author model moved from Opus 5 to Opus 5.5 from W40; nothing here
separates its effect.

**Arithmetic the evidence file leaves open** (verified 2026-10-15): its
activity rows sum to 84.8 h against a stated 92.2 h; its refusal classes sum to
124 against a stated 123; its turn classes sum to 1,558 against a stated 1,560.

This roadmap relaxes no Hard Floor, kernel rule, safety floor or verification
step. Claim `turnaround-blocking-by-cause-targets` (5) binds every phase: a
mitigation that removes a verification step, or only moves a question out of
the instrument's view, is out of scope. No change here merges a PR without an
explicit go, and none turns a background **wait** into a background **merge**.

## Goal

A night run carries more finished, merged work, and the reason it stopped is
visible in one reading. Finished means: the extended turnaround probe shows net
ticked steps per night and merges per night above the 2026-09-28..10-13
baseline over two consecutive two-week windows, with every guard criterion in
the Acceptance Criteria held.

## Phase 0 — Correct the record

- [ ] **0.1 Append a correction to the evidence file.** Add `## Corrections
      (2026-10-xx)` to `agents/evidence/analysis/agent-throughput-decline-2026-10-14.md`
      — never rewrite the body: the night-window table above, the squash
      switch behind the `drain/*` column, the three causes flat since
      2026-08-30, the 528 unblocked steps, the three open sums (84.8 / 92.2 h,
      124 / 123, 1,558 / 1,560) each as an `unknown` row or a reconciled
      figure, `block_no_verify`'s real false-positive set, and the prior art
      the file did not cite.
      verify: each correction cites a commit or `file:line`, and
      `lint_evidence_artifacts` passes.
- [ ] **0.2 Own the two orphaned regressions.** Record in
      `src/config/turnaround-budget.json` `subsequent_readings` that
      `blocking_share` and `context_floor_max` (exit 1 since 2026-10-01, still
      on 2026-10-15) are owned by this roadmap.
      verify: the entry names this roadmap and both figures.
- [ ] **0.3 Review the correction independently.** The #2359 review artefact
      reads `Skipped` (no-code diff), so its causal claims reached `main`
      unreviewed. The correction PR gets a review that checks denominators,
      windows and sums, by an instance that did not write it.
      verify: the correction's review artefact names findings or an honest
      null over those three axes, not a skip.

## Phase 1 — One instrument, extended

- [ ] **1.1 Extend `probe_turnaround`, do not add a second reader.** Add the
      figures it lacks: turn-end refusals by detector (read through
      `_lib/turn_end_refusals.ts`, not re-parsed), structured and plain-text
      asks per session, usage-limit pauses split night/day, and a `--git`
      section for merges, archived roadmaps and net ticked steps per night
      window. Output stays aggregate: no transcript body, prompt text or path
      leaves the run. A row that does not classify is printed as `unknown`;
      per-class rows must sum to the printed total.
      verify: one run prints every figure of the Context section; a fixture with
      overlapping labels fails the sum check; tests pin each new classifier rule
      red-first.
- [ ] **1.2 Register the throughput baseline in the existing budget.** Add the
      2026-09-28..10-13 reading as a `subsequent_readings` entry with its window
      shape; no new baseline file.
      verify: the entry's figures recompute from its own corpus block.
- [ ] **1.3 Let a red reading reach a person.** `--against-baseline` stays out of
      CI by design (an empty store would read green). Run from a lane worktree
      its default store resolves to that worktree's empty project directory and
      it fails as an empty corpus (reproduced 2026-10-15), so the scheduled run
      passes `--store` for the main checkout's project directory and routes an
      exit 1 into the self-repair queue as one dated line, so the next
      regression has a reader within a day.
      *corrected-from-reproduction*
      verify: a planted regression in a fixture store produces one queue line,
      and a run from a worktree without `--store` is reported as empty, not green.
- [ ] **1.4 Price the gates the estate is adding.** Ask
      `road-to-local-gates-wired-while-they-are-green` to record, per batch, the
      change in the required job's duration. Do not stop the drain.
      verify: the next batch PR carries a before/after duration line.

## Phase 2 — Decide what binds a night, before adding lanes

- [ ] **2.1 Pre-register the rule, then read it.** Before reading: if at least
      one night in three ends in a usage-limit pause, tokens bind, step 3.2 is
      deferred and the observer blocker is the lever; otherwise wall-clock binds
      and Phase 3 runs in order. Read the two windows after Phase 1 lands.
      verify: the rule's commit predates the reading's commit; the verdict is a
      Decisions row.
- [ ] **2.2 Put the stalled thinning in front of the owner with its run cost.**
      Add the 2.1 verdict, the floor figures and a `config_cost_report` run
      (delivered payload per asset) to blocker
      `instruction-load-observer-has-no-scheduled-owner` in
      `road-to-a-setup-that-decides-itself` as dated evidence.
      verify: the blocker carries the line; neither depended roadmap's plan moves.

## Phase 3 — Take the CI wait out of the foreground, keep the settle

- [ ] **3.1 Put the archived blocking-time roadmap's D7 to the council.** The 2026-10-07 target for
      `ci-wait` ("no foreground wait ends without a verdict") was met; the new
      evidence is a different cost, a lane held while CI runs. Bring the
      foreground minutes per merged step, the 2026-10-15 cause split (where
      `sleep-poll` outranks `ci-wait`) and the carrier below, under
      `decision-revisit-gate`.
      verify: verdict and `revisit-if` recorded in Decisions.
- [ ] **3.2 Turn "settle before the turn ends" into a settle obligation.** If
      the council agrees: `push_settle_hook.ts` and `git-workflow` SKILL.md tell
      the agent to start `ci_settle` in the background and record an open settle
      obligation; a completion or delivery claim still needs the settled read
      (detector D unchanged); the run takes the next workable step meanwhile.
      The obligation reuses `ci_settle`'s head/branch-tip check
      (`ci_settle.ts:116-152`) and never re-implements it. The hook ships to
      consumers, so the change carries a CHANGELOG line, and reverting the
      reminder text restores today's foreground behaviour.
      verify: a two-roadmap fixture run shows work on B between A's push and A's
      verdict; a claim over an unsettled PR is still refused; an obligation
      resumed after a force-push to A reads the new head, never the old verdict.

## Phase 4 — Remove the misfires, from the classes that actually fired

- [ ] **4.1 Classify the 64 language refusals by pin source before fixing.** The
      pin state records `source: prompt | system-locale`. Split the refusals by
      source and by the language the prompt was written in. Candidates: an
      English paste without a heading under a short German lead (the stub's
      defect, still live on 2026-10-15), a first turn that is a slash command
      and pins from the locale (`language_mirror_hook.ts:566`), a terse `1`
      inheriting a wrong pin, a subagent hand-back or quoted English markdown
      read as the owner's turn, and prompts that really were English — a correct
      refusal, not a misfire. Fix only the misfire class, with its turn as a
      fixture in `tests/fixtures/self-repair-detector-corpus.yml`; if it is the
      stub's class, the fix promotes and closes
      `stubs/road-to-language-pin-short-lead.md`.
      verify: the split table is committed; the fixture is red before the fix.
- [ ] **4.2 Measure detector C's false positives by edited-path class** with
      `measure_turn_end_gate`, splitting `agents/**` and `docs/**` markdown from
      code.
      verify: a table with every sampled refusal and its class; a docs-only
      exemption, if proposed, goes to 4.4.
- [ ] **4.3 Scope short `-n` to the subcommands where it means `--no-verify`.**
      In git that is `commit` and `am`; for `grep`, `log`, `branch`, `push`
      (`--dry-run`), `merge` (`--no-stat`), `rebase`, `revert` and
      `cherry-pick` it is unrelated. Long `--no-verify` stays blocked on every
      subcommand (it bypasses `pre-push` and `pre-merge-commit` too).
      *corrected-from-reproduction*
      verify: `git commit -n`, `git commit -nm x`, `git am -n` and every
      `--no-verify` form stay blocked; `git grep -n`, `git grep -nE`,
      `git log -n 5`, `git branch -n`, `git push -n` pass; neutralising the fix
      turns the blocked set green in `tests/scripts/hooks/block_no_verify.test.ts`.
- [ ] **4.4 Run B and C through the existing demotion contract.** The shadow
      record and the demotion contract exist (`turn_end_refusals.ts:18-28`); the
      "always armed" decision (`settings_removed_keys.ts:84-87`) is not
      reopened. Feed them the 4.1/4.2 counts.
      verify: the contract's verdict for each detector is recorded.

## Phase 5 — Make the existing no-cheap-question law visible

- [ ] **5.1 Count violations, not asks.** With 1.1, classify each ask as
      owner-reserved, council-decidable, or cheap under `no-cheap-questions`
      (Iron Law 4 continuation prompt; one option dominates). Count how often
      the recommended option is the one taken — the draft asserted it without a
      count.
      verify: the three-way table with its denominator.
- [ ] **5.2 One fix for the largest cheap class.** Only after 5.1, and only if
      the cheap class holds most ask minutes. Owner-reserved questions keep
      stopping. A queue of owner questions is allowed only if the instrument
      reads it as `user-wait`, per claim (5).
      verify: replayed asks — reserved ones still reach the owner; cheap ones do
      not stop the run.
- [~] **5.3 Owner: an intake limit for harvest roadmaps.** Human-gated. The
      question: does a new inbox roadmap land `draft` while more than N `ready`
      roadmaps sit at 0 ticked steps (10 of 20 on 2026-10-15)? Options: (a) yes,
      N = 8; (b) yes, another N; (c) no limit, inbox roadmaps land as the
      operator says per round. Owner-reserved, because it changes what reaches
      the estate.
      verify: the owner's answer is a Decisions row.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Extend `probe_turnaround` instead of adding an instrument | it already reads transcripts, classifies blocking by cause and carries a baseline | the extension needs a store the probe cannot read |
| D2 | reversible-technical | evidence | Throughput is judged by net ticked steps and merges per night; roadmaps archived are reported, not targeted | roadmaps differ 5–47 steps, so an archive count rewards picking small ones | a window shows ticked steps rising while merged work per step falls |
| D3 | reversible-technical | evidence | No lane-count change before Phase 2's verdict; the cap, if any, is set there | the draft names usage-limit pauses as a cause and more lanes as a fix; both cannot hold if tokens bind | Phase 2 reads wall-clock-bound |
| D4 | product-owned | owner | Lands `ready` | owner instruction of 2026-10-15 to land this round's roadmaps as ready; supersedes the draft's "stay draft until read" | the owner narrows or parks it |
| D5 | contested-technical | evidence | Step 4.3 is a precision fix to a hook-bypass guard, not a lowered floor: the blocked set after the change is a superset of every form that bypasses a hook (`commit -n`, `am -n`, any `--no-verify`, `-c core.hooksPath`); it ships only with a council or independent review of that set, per `decision-revisit-gate` (an equivalent swap above a floor is council-decidable) | `git <sub> -h` on 2026-10-15: `-n` is `--dry-run` for push, `--no-stat` for merge/rebase, `--no-commit` for revert/cherry-pick; the probe in Context reproduced the false positives | a short flag outside `commit`/`am` is found to skip a hook |
| D6 | reversible-technical | evidence | The closure scan's typed-op hits on "merge", "push" and "merged" in Context, Goal, 3.2 and 4.3 are measurement prose or guard names, not operations: no step here merges, pushes or force-pushes, and 3.2 waits on the council in 3.1 | `closure_scan` run 2026-10-15, eight `typed-op` hits, each read | a step is added that merges or pushes on its own authority |
| D7 | reversible-technical | evidence | `/roadmap:next` keeps one invocation = one roadmap = one branch = one PR; no composite drain command and no bundling here | `roadmap/next/command.md:28`; merges per night are flat, work per merge fell | Phase 2 reads wall-clock-bound and lane conflicts are measured |

## Kill register

| ID | Killed | Why | Reopen if |
|---|---|---|---|
| K1 | a new transcript instrument (`measure_agent_throughput.ts`) | `probe_turnaround` exists | D1 revisited |
| K2 | an N-lane default or adaptive lane controller for `--all` | lanes already run; `--all` is serial by design over shared generated files (`process-full/command.md:85`); Phase 2 decides first | D3's revisit fires |
| K3 | a new "take the recommendation" rule | `no-cheap-questions` and the autonomy setting cover it | 5.1 shows the cheap class is not covered |
| K4 | adding a `tests.yml` path filter | already filtered (`tests.yml:4-19`) | — |
| K5 | scoping pre-push to the diff | declined 2026-08-30 (drift reaches CI); cost unchanged since | pre-push median doubles |
| K6 | re-triaging all 104 parked roadmaps from this file | `/roadmap:triage-parked` owns `later/`; 528 unblocked active steps mean the parked estate does not bound a night | the active estate runs dry |
| K7 | a council on the "always armed" lock | shadow records and a demotion contract exist; misfire cost is capped at one turn (`turn_end_gate_hook.ts:119`) | the demotion contract cannot run |
| K8 | bundling small roadmaps into one PR | merges per night are flat; work per merge fell | — |
| K9 | a new `throughput:queue` CLI and job state machine | `ci_settle` already settles by head SHA and names the background form; 3.2 adds an obligation, not a scheduler | 3.2's fixture cannot be met without persisted state |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Metric gaming | product | Fewer asks or refusals by deciding reserved questions or weakening detectors; more ticks by splitting steps | Claim (5) binds; AC-5 and AC-6 guard the gates; median steps per created roadmap is reported beside every tick count | Phase 5 — Make the existing no-cheap-question law visible |
| 2 | Background settle leaks red PRs | implementation | A run moves on and never reads the verdict, or reads a verdict for a superseded head | The obligation blocks completion claims; detector D unchanged; the head check is reused, not rewritten | Phase 3 — Take the CI wait out of the foreground, keep the settle |
| 3 | Moving windows mislead | implementation | mtime windows differ in shape, and a worktree run reads an empty store | Every reading records its window shape and store; two windows before a verdict | Phase 1 — One instrument, extended |
| 4 | Confounded attribution | product | The model change from W40 overlaps every window | No reading attributes a delta to one cause; Phase 2 reads binding, not blame | Phase 2 — Decide what binds a night, before adding lanes |
| 5 | Narrowing the guard opens a bypass | implementation | Scoping short `-n` lets a hook bypass through | Every long `--no-verify` and every `commit`/`am` short form stays blocked, pinned red-first | Phase 4 — Remove the misfires, from the classes that actually fired |

## Acceptance Criteria

- [ ] AC-1 — Phase 0's correction is on `main` with an independent review, and
      the two orphaned regressions have an owner.
- [ ] AC-2 — The extended probe reproduces the Context figures from the tree,
      its class rows sum to its totals, and a planted regression reaches the
      self-repair queue.
- [ ] AC-3 — Phase 2's verdict is recorded before any lane or settle change
      lands.
- [ ] AC-4 — Net ticked steps and merges per night exceed the baseline over two
      consecutive two-week windows, with the share of merged PRs needing a
      follow-up fix commit not above its baseline.
- [ ] AC-5 — No refusal of a misfire class identified in 4.1/4.2 in the next
      window, the detector corpus still green, and `block_no_verify` still
      blocks every `git commit -n` form and every `--no-verify`.
- [ ] AC-6 — Every owner-reserved question in the window still reached the
      owner, and no PR merged without an explicit go.
