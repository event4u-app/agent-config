---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-learning-you-can-see
entry_condition:
  what: >
    The dogfood window reaches its full 30 days and the two thresholds the
    council set on 2026-07-27 both become readable - a non-trivial `preferred`
    count and session-end p95 under 2 s. The fifth reading of 2026-10-06 found
    p95 at 3 ms and `preferred` pinned at 0 for a structural reason, so the
    live question is whether a `preferred` count drawn from a one-origin intake
    is the measurement that condition intended.
  when: >
    On or after 2026-10-31, the wake date the window's own closing condition
    names. Nothing before it can produce the missing days.
  who: >
    The owner. Proposing the flip amends a recorded council decision, which is
    owner-reserved; no agent may make it and no council verdict substitutes.
review_by: 2026-10-31
estate_growth_exempt: >-
  Registers blocker `learning-window-and-owner-amendment`, which raises
  open_blockers by one against a zero allowance. The blocker is the only
  durable record that step 2.3 is gated on an elapsed window AND an owner
  amendment, and open_blockers deliberately spans later/ so that parking
  cannot bury it. Parking without registering it would move the step out of
  the dashboard while leaving the estate gates counting nothing - the exact
  silent-drop this roadmap exists to prevent.
---
# Road to learning you can see — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-learning-you-can-see`](archive/road-to-learning-you-can-see.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-learning-you-can-see deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-learning-you-can-see

- [ ] **2.4 The GUI toggle says what it does.** Added 2026-10-06 from round
      `inbox-2026-10-e`. `src/scripts/memory_learn_hook.ts` records as a KNOWN
      GAP that it reads only the project-local settings file, while the GUI
      writes the user-global file plus its provenance sidecar — so enabling
      `memory.learn_on_session_end` in the GUI does nothing, and the gap's only
      written owner was the archived parent. This step changes no behaviour:
      the field description in `src/server/schemas/settings.ts` states that the
      hook reads the project-local file only. Whether it should read the
      user-global file through `consentVerdict` is part of the owner amendment
      2.3 already carries, not a second blocker.
      verify: `grep -A3 'learn_on_session_end' src/server/schemas/settings.ts | grep -c 'project-local'` -> /^[1-9]/
      Positive control: the same command returns 0 at `a75bb3210`.

- [ ] **2.3 Propose the default flip.** Deferred until the window has 30 days and both <!-- blocked-by: learning-window-and-owner-amendment | asked: no - non-interactive drain lane, surfaced as owner residue in the lane report -->
      thresholds hold; the proposal is an owner amendment to the council decision in
      `src/config/agent-settings.template.yml`, found by
      `grep -n -B3 'learn_on_session_end' src/config/agent-settings.template.yml`
      (comment at `:1392-1394`, key at `:1395` on 2026-10-04).

      **Disposition re-checked 2026-10-02, by reading the window rather than this
      line.** `agents/evidence/analysis/learning-dogfood-2026-Q4.md:5` records
      **Window opened: 2026-10-01**. One day has elapsed of the thirty the
      threshold asks for, so the condition is **live-unmet**, not assumed unmet —
      the distinction this file exists to keep. The step stays `[ ]` rather than
      `[~]` on purpose: its Risk Register entry wants carried work counted as open
      in the dashboard, and a deferral glyph here would read as finished.

      **Wake date: 2026-10-31.** On or after it, re-read the same evidence page for
      the two thresholds the council of 2026-07-27 set — a non-trivial `preferred`
      count, and session-end p95 < 2 s — and only then put the amendment to the
      owner. Both thresholds are the council's; neither is this roadmap's to move.

      **Why no session can close it early.** Thirty days of readings cannot be
      produced inside one run, and the flip itself is an owner amendment to a
      council decision, not an agent edit. Two independent reasons, either alone
      sufficient.

      **Fourth reading, 2026-10-04 — the condition held, and a second obstacle
      surfaced under it.** Re-run rather than re-read:
      `date -u +%Y-%m-%d` → `2026-10-04`, three days of the thirty, so the
      elapsed-time condition is still **live-unmet**.

      The search for a capability-before-role exit came back empty, and the two
      commands that prove it are worth keeping, because an unsearched block and a
      searched one read identically once written down.
      `find . -name '*dogfood*'` returns 274 paths, of which the only session-end
      ledger is the window's own; `internal/evals/.../dogfood-2026-06-16.json`
      shares the word and measures subagent wall-clock for a skill-authoring eval
      (`grep -n wall_ms` → `"wall_ms": 64384`, `"wall_ms": 13456`), not hook
      latency. `grep -rln 'session-end p95' agents/evidence/ docs/` returns 2
      files — this window's page and the settings reference quoting the same
      council line — against a control of 82 files matching `p95` in the same
      root. So no durable evidence already in the repo satisfies either threshold.

      **And the exit would not matter if it existed.** The two blocks are
      independent, and the elapsed-time one is not a role question at all: no
      grant of authority produces 27 missing days. A fifth exit is therefore
      absent on both halves, not merely on the owner-reserved half.

      **The obstacle under it:** the window is on course to be undecidable on its
      own wake date. `wc -l < agents/runtime/state/learning-dogfood.jsonl` → `2`,
      both lines dated 2026-10-01, against a closing condition of ≥ 20. The
      mechanism is wired and armed — concern bound on `session_end`, present in
      `dist/hooks/dispatch.js`, flag `true`, consent granted — and
      `find .claude/worktrees -name 'learning-dogfood.jsonl' | wc -l` → `0`
      across 116 worktrees rules out readings being stranded and discarded.
      Measurement, controls and the honest limit of what they establish:
      `agents/evidence/analysis/learning-dogfood-2026-Q4.md` § Mid-window reading
      — 2026-10-04.

      **What this means for the wake date.** On 2026-10-31 the likely reading is a
      ledger near 2. That is not a threshold failing; it is the window not having
      run, and the two call for opposite responses — the first would settle the
      council's question, the second leaves it exactly where it was. Whoever picks
      this up should check the line count **before** reading any p95 or `preferred`
      figure out of it.

      **Hand-over — the one edit that is agent-doable, and its cost.** Nothing
      here flips the step. The useful preparatory change is to make the ledger
      grow, and it is a one-line default in this checkout's own gitignored
      settings file, not a template change:

      `/Users/…/event4u/agent-config/.agent-settings.yml`, line 15-16, currently

      ```yaml
      memory:
        learn_on_session_end: true
      ```

      — already `true`, so the flag is not the gap and no edit to it helps. The
      same file carries a third stale anchor, in the comment above that key:
      `src/config/agent-settings.template.yml:1379`, which should read `:1395`.
      It is **not fixable in a PR**: `git check-ignore -v .agent-settings.yml`
      → `.gitignore:317`, so the file is per-machine and the correction has to be
      made by hand in the maintainer checkout. Cost: one line, no gate touched.

      The real gap sits one layer down and is owner-shaped rather than
      agent-shaped: why a session end in this checkout does not reach a concern
      that is bound, bundled and enabled. That is a question about host
      termination behaviour, and the tree holds no evidence that answers it.

      **Fifth reading, 2026-10-06 — the prior reading's prediction failed, and
      the block moved.** `date -u +%Y-%m-%d` -> `2026-10-06`, five days of the
      thirty, so the elapsed-time condition is still **live-unmet** and no run
      inside this window can change that.

      What did change: `wc -l < agents/runtime/state/learning-dogfood.jsonl`
      -> **6**, not the "near 2" the 2026-10-04 reading told its successor to
      expect. Four readings landed on 2026-10-05, which answers that reading's
      open question by measurement — a session end in this checkout **does**
      reach the bound concern. The generator is bursty and tracks maintainer
      sessions rather than the calendar, so the wake-date line count is
      **undetermined** rather than doomed, and this roadmap declines to replace
      one projection with another.

      **The threshold that will not be met, and why that is the finding.**
      `preferred` reads 0 on every ledger line. `signals_in` has read `3` since
      day one and
      `stat -f '%Sm' agents/memory/intake/signals-2026-10.jsonl` ->
      `2026-10-01T12:40:09`: the intake has not been written to in five days.
      Its three signals all carry `origin: claude` — none of the three
      producers' origin strings — on three distinct paths, and
      `MIN_CORROBORATIONS` is 2 **distinct** origins, so they cannot corroborate
      each other. An A/B run of the real aggregator over the real intake returns
      `lessons_out=0 preferred=0`, and returns `preferred=1` once a single
      second-origin duplicate is added — so the zero is a statement about the
      data, not a broken instrument.

      The consequence is a validity problem, not a progress problem: on
      2026-10-31 `preferred` will most likely read 0, and its plain reading
      ("the learning produced nothing worth keeping") would be wrong — it
      records that nobody invoked `/bug:fix`, `/judge:on-diff` or
      `/memory:propose` for thirty days. Whether that is the measurement the
      council of 2026-07-27 intended is the owner's question, registered below
      as `blocker: learning-window-and-owner-amendment`. Full reading, controls
      and the honest limits:
      `agents/evidence/analysis/learning-dogfood-2026-Q4.md` § Fifth reading —
      2026-10-06.

## Blockers

### blocker: learning-window-and-owner-amendment
- **Status:** open
- **Owner:** owner
- **Blocks:** Phase 1 — step 2.3 Propose the default flip
- **Class:** 3
- **Recommendation:** Option (c). Let the window run to 2026-10-31, then put the threshold-validity question to the council that set the thresholds, before reading `preferred` at face value. It costs one council round and is fully reversible; reading the number without that step is what is not.
- **If you do nothing:** The window still closes on 2026-10-31 and `preferred` almost certainly reads 0. Read without the 2026-10-06 control, that zero looks like a verdict on whether session-end learning is worth keeping, and the council's condition fails for a reason it was never testing. The step then re-defers on a false negative instead of on a missing measurement.
- **What to do:**
  1. Read the line count FIRST, before any p95 or `preferred` figure: `wc -l < agents/runtime/state/learning-dogfood.jsonl`. Below 20 the window did not run and nothing below is decidable.
  2. At 20 or more, read both thresholds via `agent-config memory:learn --format status`, then check whether the intake ever received a second origin: `grep -o '"origin": "[^"]*"' agents/memory/intake/signals-2026-10.jsonl | sort -u` against the three producer origins `bug-fix`, `do-and-judge` and `propose-memory`. A single origin means `preferred` could not have been non-zero whatever the sessions contained.
  3. Then choose: (a) propose the flip as the council's condition stands, (b) hold it and extend the window with the supply gap named, or (c) put the threshold-validity question to the council first and read `preferred` only after it answers.
- **Resolved when:** This file records which of (a), (b) or (c) the owner chose, with the figures the choice was made on and the command each figure came from.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: drain/learning-you-can-see -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | Superseded 2026-10-06 by a stronger mechanism, because parking removes the dashboard half: the step is now held by `blocker: learning-window-and-owner-amendment`, which `check_estate_count` counts in `open_blockers` across `later/` precisely so parking cannot bury it, plus a `review_by: 2026-10-31` the parked-roadmap gate requires. A dashboard row nobody re-reads was the weaker guard of the two | Phase 1 — Deferred steps carried from road-to-learning-you-can-see |

## Decisions

| Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|
| Park this roadmap in `later/` rather than leave it active | (a) keep it active so it counts as open work in the dashboard, as the Risk Register's original mitigation intended; (b) archive it; (c) convert step 2.3 to `[-]` cancelled | The Active-vs-Later test asks whether an agent can make progress *now, autonomously*. The single open step is gated on 25 missing days AND an owner amendment to a council decision — both outside this roadmap, either alone sufficient. A blocked roadmap left active "silently lies to the dashboard and to `/roadmap:process-*`, which will keep trying to execute it" — which is not hypothetical here: a `/roadmap:process-full --all` drain run picked this file up on 2026-10-06 and could not move it. (b) and (c) both destroy live work and (c) is owner-reserved besides. | Either gate clears: the window reaches 2026-10-31 with a decidable ledger, or the owner amends the council condition earlier. `review_by: 2026-10-31`. |
| Register `blocker: learning-window-and-owner-amendment` even though `lint_roadmap_blockers` does not scan `later/` | Park with the `entry_condition` alone | `entry_condition` records what/when/who but has no field for a recommendation or for the cost of inaction, and those are the two things the owner actually needs. `check_estate_count` counts `open_blockers` across `later/` precisely so parking cannot bury one, so the blocker stays visible to the gates after the dashboard stops showing it. This is a stronger version of the Risk Register's row-1 mitigation, not a retreat from it. | The blocker is resolved, or `later/` is brought into the blocker gate's scope. |
| Publish the fifth reading as a committed evidence section rather than report the numbers in a reply | State the figures in the PR body | Both inputs (`agents/runtime/state/learning-dogfood.jsonl`, `agents/memory/intake/signals-2026-10.jsonl`) are gitignored and per-machine, so a reading that is not committed leaves no durable record and the next session re-derives it from scratch — which is how the 2026-10-04 reading's superseded prediction stayed authoritative for two days. | The inputs become tracked, or the window closes. |

## Acceptance Criteria

- [x] AC-1 — No step carried from `road-to-learning-you-can-see` is still `[ ]` without a recorded disposition.
