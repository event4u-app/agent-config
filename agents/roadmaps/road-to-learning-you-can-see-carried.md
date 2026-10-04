---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-learning-you-can-see
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

- [ ] **2.3 Propose the default flip.** Deferred until the window has 30 days and both
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-learning-you-can-see |

## Acceptance Criteria

- [x] AC-1 — No step carried from `road-to-learning-you-can-see` is still `[ ]` without a recorded disposition.
