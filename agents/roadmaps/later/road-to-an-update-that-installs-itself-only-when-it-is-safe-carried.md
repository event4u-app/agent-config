---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-an-update-that-installs-itself-only-when-it-is-safe
entry_condition:
  what: agents/evidence/analysis/ring-0-unattended-record-2026-10-20.md reads ring-0-exit yes over four consecutive clean rows (blocker ring-0-exit-pending)
  when: after the fourth release on the next dist-tag installed unattended on maintainer machines; the registry carries no next tag today
  who: the repository owner writes the ring-0-exit line; then an implementer registers update-auto-invite under a council ratification and closes 4.3
review_by: 2026-11-26
estate_growth_exempt: >-
  Parked carry of road-to-an-update-that-installs-itself-only-when-it-is-safe,
  archived in the same change by orchestrator decision D-carry (D17 in the
  parent, 2026-10-27): step 4.3 and AC-10 wait on a ring-0 exit that needs four
  real releases, which no run can produce. The active count drops by one while
  the later count rises by one; the open blocker moved with the steps and was
  closed in the parent, so open_blockers is unchanged.
---
# Road to an update that installs itself only when it is safe — carried

> **Source:** carried by the archival sweep on 2026-10-27 from
> [`road-to-an-update-that-installs-itself-only-when-it-is-safe`](../archive/road-to-an-update-that-installs-itself-only-when-it-is-safe.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-an-update-that-installs-itself-only-when-it-is-safe deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Context carried with the steps

- **D17** (2026-10-27, orchestrator decision D-carry): 4.3 and AC-10 are
  carried here with `ring-0-exit-pending`. The ring-0 record read
  `ring-0-exit: no` and `npm view @event4u/agent-config dist-tags` returned
  `latest` only. AC-10's `task ci` was red at `check-reach-staleness`
  (`channels[youtube]` `last_verified` 95 days old), outside this roadmap.

The parent's full Decisions table (D1-D17) stays in the archived parent.

## Phase 1 — Deferred steps carried from road-to-an-update-that-installs-itself-only-when-it-is-safe

- [ ] **4.3 Ask once, at a moment that earned it.** After the ring-0 exit, one <!-- blocked-by: ring-0-exit-pending -->
      host-native question in the `stop` slot, after a turn that ended on a
      verified success. It carries a permanent "never". Existing installs are
      **asked**, never flipped.
      verify: a fixture asserts zero prompts under CI, non-TTY, headless, `--json` output and a subagent run.
      Dated notes moved verbatim: `agents/evidence/analysis/update-installs-itself-dated-notes-2026-10-25.md`.
      Open on `### blocker: ring-0-exit-pending`.

## Blockers

### blocker: ring-0-exit-pending

- **Status:** open — raised 2026-10-25 by a `/roadmap:process-full` run that
  found 4.3 the only open step and could not close it in a change.
- **Class:** 3 — human-only, and time-gated rather than a decision: the exit
  needs four consecutive releases installed unattended, which no single change
  can produce, and the `ring-0-exit:` line is written by a human after reading
  the table, by 4.2's own design.
- **Owner:** repository owner
- **Ownership:** product-owned — when `auto` reaches anyone beyond maintainer
  machines is a rollout decision, and ADR-291 already ruled an existing install
  is asked only after this exit.
- **Blocks:** step 4.3 only, and through it AC-10's reading on the PR that
  closes this file. Every other step is closed.
- **What to do:** in order —
  1. publish a release on the `next` dist-tag (`.github/workflows/publish-npm.yml:154-168`);
     the registry carries none today;
  2. on each maintainer machine set `update.mode: auto` in the user-global
     settings and let `agent-config upgrade --unattended` install each release;
  3. append one row per release to
     `agents/evidence/analysis/ring-0-unattended-record-2026-10-20.md`, and after
     four consecutive clean rows change its line to `ring-0-exit: yes`;
  4. re-ratify the `update-auto-invite` registration (the effect term
     `interaction` and the `stop` binding) in a council round, then register it
     and close 4.3.
- **Resolved when:** the ring-0 record reads `ring-0-exit: yes` over four
  consecutive rows with zero rollbacks and zero swap errors, and
  `update-auto-invite` is registered in `src/scripts/hook_manifest.yaml` under
  a recorded ratification.
- **Recommendation:** none needed beyond the order above — the gate is a count
  of real releases, and the one way to shorten it would be to lower 4.2's exit
  condition, which ADR-291 makes an owner question, not an agent one.
- **If you do nothing:** the invitation never fires and every install stays on
  `notify` unless a human hand-edits `update.mode` — the conservative outcome
  ADR-291 already names as complete, so waiting costs only the unasked users.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-an-update-that-installs-itself-only-when-it-is-safe |

## Acceptance Criteria

- [ ] **AC-10** `task ci` green. <!-- blocked-by: ring-0-exit-pending -->
