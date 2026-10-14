---
complexity: lightweight
status: draft
estate_offset_exempt: "Draft added for owner review; it counts +0 active until promoted. Rejected instead: merging into road-to-an-installed-layer-that-is-thinned (it owns only the global rule layer, one of six measured causes) or road-to-a-cold-start-paid-once (it owns worker spawning, not lane waiting, decision asks or gate misfires); archiving or parking a neighbour, because no active roadmap covers run throughput and none is finished."
execution:
  mode: phase-checkpoints
depends: [road-to-an-installed-layer-that-is-thinned]
relates:
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: depends
    note: "Owns thinning ~/.claude/rules. Phase 5 here does not re-plan it; it measures the cost the unthinned layer has on run throughput and asks for that file's stranded owner answer to be unblocked."
  - slug: road-to-a-setup-that-decides-itself
    relation: disjoint
    note: "Owns making loading default and dynamic. Its blocker instruction-load-observer-has-no-scheduled-owner is the same stall Phase 5.2 here reports; no step here edits that file."
  - slug: road-to-a-cold-start-paid-once
    relation: disjoint
    note: "Owns re-tasking warm workers and avoiding cold spawns into a rate-limit event. Phase 2 here changes when a lane waits, not how a worker is spawned."
---
# Road to agent throughput recovery

> **Source:** owner question of 2026-10-14 — autonomous night runs used to close
> about 20 roadmaps, now they close few and stop often. Measured in
> `agents/evidence/analysis/agent-throughput-decline-2026-10-14.md` (62 host
> transcripts, git history since 2026-05, CI API since 2026-07).

## Context

Throughput on `main` fell about 4× between the August drain weeks and October
(1,898 vs 500 non-merge commits per comparable window; 80 vs 18–26 roadmaps
archived per week). The evidence names six causes, ordered by measured size:

1. **Serial lanes.** 27 % of wall-clock is foreground CI waiting and 8 % is the
   pre-push hook; since W41 no `drain/*` lane runs beside another, so waits add
   up instead of overlapping.
2. **Shrunken workable backlog.** Parked roadmaps grew 14 → 104; the active set
   carries 62 owner-question mentions.
3. **Decision asks that buy nothing.** 269 numbered-option stops; the owner's
   commonest replies are `1` and `mach weiter`.
4. **Turn-end gate misfires.** 123 refusals, 64 of them a wrong `en` language
   pin against German prompts.
5. **Standing context.** Every session opens at 210–245k tokens; 104 of 106
   globally installed rules load unconditionally on Claude Code; ~40 usage-limit
   pauses in four weeks, several overnight.
6. **Heavier gates.** `tests.yml` p50 5 → 14 min since July; gate scripts
   167 → 334; hook files 8 → 67.

This roadmap does not relax a Hard Floor, a kernel rule or a safety floor.
Every change below either removes waiting, removes a misfire, or moves a
decision to the venue the rules already allow (council, recorded default).

## Goal

A night run on this repository can again carry several roadmaps to merged PRs
without owner input, and the reason it stops is visible in one report. Finished
means: the throughput instrument from Phase 1 shows lane overlap, turn-end
refusal rate, decision-ask rate and first-turn context size against the
2026-10-14 baseline, and each of those four moved in the direction the Acceptance
Criteria name.

## Phase 1 — Make the decline re-measurable

- [ ] **1.1 Port the session-throughput measurement into the tree.** Add a
      TypeScript instrument under `src/scripts/` that reads host transcripts
      and git history and prints the six tables of the evidence file (lane
      overlap, wall-clock by activity, turn-end classes, decision asks, refusal
      classes, first-turn context). The 2026-10-14 numbers came from throwaway
      scripts outside the tree; a figure nobody can regenerate gets re-argued.
      verify: running it against the transcripts present on 2026-10-14
      reproduces the evidence file's totals within 5 %.
- [ ] **1.2 Record the baseline.** Commit one run's output beside the evidence
      file as the reference later phases are judged against.
      verify: the baseline file exists and names the commit and transcript
      window it was taken on.

## Phase 2 — Overlap the waiting again

- [ ] **2.1 Never wait on CI in the foreground of the only lane.** After a push,
      the lane hands the PR to a background waiter (`ci_settle` under the host's
      background primitive) and starts the next independent roadmap; the
      notification resumes the first. Today 584 foreground `ci_settle` calls
      hold the lane for 23 h.
      verify: on a two-roadmap test run, the transcript shows work on roadmap B
      between the push and the CI verdict of roadmap A.
- [ ] **2.2 Restore N-lane drains as the default night shape.** `/roadmap:next`
      and `/roadmap:process-full` accept a lane count, pick that many roadmaps
      that pass the existing feasibility screen and touch disjoint paths, and run
      each in its own worktree. The August peak (106 drain merges in W34) came
      from exactly this shape; it stopped being used, not stopped working.
      verify: a dry run with lane count 3 prints three disjoint roadmaps and
      three worktree paths.
- [ ] **2.3 Bundle trivially small roadmaps.** Roadmaps the screen sizes as one
      commit share one PR, so they share one CI cycle and one pre-push run
      (467 pushes at ~1 min each in four weeks).
      verify: the instrument shows pushes per archived roadmap below the
      baseline.

## Phase 3 — Stop asking what the recommendation already answers

- [ ] **3.1 Under an autonomous mandate, take the recommendation on reversible
      decisions and record it.** A decision that the owner-reserved table in
      `decision-revisit-gate` routes to the council, and that is reversible
      inside the envelope, is decided by the council (or, with no council,
      by the stated recommendation) and logged in the roadmap's `## Decisions`;
      the run continues. Owner-reserved decisions keep stopping. Measured: of 269
      asks the commonest replies were `1` (46) and `mach weiter` (29).
      verify: on a replayed decision set, reserved items still reach the owner
      and reversible ones are recorded without a stop.
- [ ] **3.2 Queue owner questions instead of ending the run on them.** An
      owner-only question is appended to one per-run question file and the run
      moves to the next workable roadmap; the run ends with one numbered block
      per open question, one question per turn as `ask-when-uncertain` already
      requires when the owner is back.
      verify: a run that meets two owner questions finishes its other roadmaps
      and presents the questions afterwards.
- [ ] **3.3 Triage the parked estate for work that is no longer blocked.** Run
      `/roadmap:resolve-blockers` over `later/` (104 files) and re-execute each
      blocker's resolution condition against the tree instead of trusting its
      recorded status.
      verify: every parked roadmap has a dated re-check line; the count of
      roadmaps returned to active is reported.

## Phase 4 — Remove turn-end and guard misfires

- [ ] **4.1 Fix the language pin.** 64 refusals pinned `en` while the owner
      wrote German. Find why the pin read English (a hook continuation, a
      subagent hand-back or a pasted English block are candidates), add the
      failing transcript turn as a fixture, and fix the detector.
      verify: the fixture is red before the fix and green after; the instrument
      shows no `pinned "en"` refusal on German prompts in the next window.
- [ ] **4.2 Measure the verification detector's false-positive rate.** 49
      refusals said "file changed, no recorded verification". Sample them and
      classify which were real omissions and which were docs-only edits,
      generated output or verification the detector did not recognise.
      verify: a table with every sampled refusal and its class is committed.
- [ ] **4.3 Stop `block-no-verify` reading `grep -n` as `git -n`.** 12 refusals
      in the window. Add the denial-side and the near-miss fixtures
      (`git commit -n` stays blocked, `git grep -n` and `grep -n` pass).
      verify: both fixtures pass and a test that neutralises the fix goes red.
- [ ] **4.4 Put the "always armed" lock before the council.** The per-detector
      switches were removed; while a detector misfires there is no way to stop
      it short of a code change. Per `decision-revisit-gate`, bring the lock,
      the 123-refusal measurement and the option of a per-detector shadow mode
      (record, do not refuse) to the council.
      verify: the council verdict and its `revisit-if` are recorded in this
      roadmap's Decisions section.

## Phase 5 — Shrink the standing context on Claude Code

- [ ] **5.1 Break the 210–245k first-turn tokens down by source.** Rules, memory
      index, skill listing, tool schemas, MCP instructions, hook injections —
      measured, not estimated.
      verify: the breakdown sums to the measured first-turn input within 5 %.
- [ ] **5.2 Put the stalled thinning in front of the owner with its run cost.**
      Thinning the global layer is already planned in
      `road-to-an-installed-layer-that-is-thinned` and
      `road-to-a-setup-that-decides-itself`; both wait on the instruction-load
      observer that no active file owns (blocker
      `instruction-load-observer-has-no-scheduled-owner`, its seventh arrival).
      Add the 5.1 breakdown and this file's usage-limit count to that blocker as
      new evidence, so the owner decides scheduling against a measured run cost.
      verify: the blocker carries a dated evidence line citing this file's
      figures; no step here edits either roadmap's plan.
- [ ] **5.3 Re-measure usage-limit pauses once the thinned layer is installed.**
      Compare pauses per active hour before and after over a two-week window.
      verify: both rates are in the baseline file with their windows.

## Phase 6 — Pay less per PR for the same gates

- [ ] **6.1 Path-filter the heavy workflows.** A docs- or roadmap-only change
      (41 % of commits since 2026-09-28) should not run the full `tests.yml`
      suite; gates keep running where their inputs changed.
      verify: a roadmap-only PR shows the heavy suites skipped by path filter and
      every required check still reporting.
- [ ] **6.2 Scope the pre-push hook to the diff.** Measure which pre-push steps
      dominate the ~1 min per push and run the rest only when their inputs are
      in the pushed range.
      verify: p50 push duration in the instrument drops below the baseline with
      no gate removed from CI.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Phase 5 depends on the existing thinning roadmaps instead of re-planning the global rule layer | `road-to-an-installed-layer-that-is-thinned` and `road-to-a-setup-that-decides-itself` already own the change; duplicating it would split one stall across three files | both files are archived or cancelled without thinning the layer |
| D2 | reversible-technical | evidence | The roadmap stays `draft` until the owner has read the evidence file | the causes are measured, but steps 3.1 and 4.4 touch rule text and a locked decision, which the council takes at those steps | the owner promotes it or narrows its scope |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Parallel lanes collide | implementation | Two lanes edit the same generated tree or ratchet line and conflict at merge | Lanes are picked on disjoint paths; generated files regenerate on the merged base, not by hand | Phase 2 — Overlap the waiting again |
| 2 | Fewer stops means a wrong default lands | product | A reversible decision taken without the owner turns out unwanted | Only council-decidable, reversible decisions; each is recorded with its `revisit-if` | Phase 3 — Stop asking what the recommendation already answers |
| 3 | Thinning the global rules hides an obligation | implementation | A rule moved to on-demand injection fails to load when it should | Routing probe per moved rule before and after; kernel rules stay resident | Phase 5 — Shrink the standing context on Claude Code |
| 4 | Path filters skip a gate that mattered | implementation | A docs-only change can still break a doc-reading gate | Filters are derived from each gate's inputs, and the docs gates keep running | Phase 6 — Pay less per PR for the same gates |

## Acceptance Criteria

- [ ] AC-1 — The throughput instrument is in the tree and its baseline is
      committed; the evidence file's figures can be regenerated.
- [ ] AC-2 — In a measured night run, at least two lanes have overlapping
      CI waits, and foreground `ci_settle` time per archived roadmap is below
      the baseline.
- [ ] AC-3 — Decision asks per archived roadmap are below the baseline, with
      every owner-reserved decision still reaching the owner.
- [ ] AC-4 — No language refusal pins `en` on a German prompt, and
      `block-no-verify` passes `grep -n` while still blocking `git commit -n`.
- [ ] AC-5 — The first-turn context breakdown is recorded, and the stalled
      thinning blocker carries it as evidence; the before/after usage-limit rate
      is recorded once the thinned layer is installed.
