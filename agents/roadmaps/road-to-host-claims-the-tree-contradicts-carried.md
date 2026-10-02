---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-host-claims-the-tree-contradicts
---
# Road to host claims the tree contradicts — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-host-claims-the-tree-contradicts`](archive/road-to-host-claims-the-tree-contradicts.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-host-claims-the-tree-contradicts deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-host-claims-the-tree-contradicts

- [ ] **2.4 Observe a reached timeout on the slot.** Deferred, and named rather
      than dropped: the fourth return condition the 2026-09-29 refusal set — a
      session in which the `user_prompt_submit` timeout is actually reached and
      its effect on the 13 concerns recorded. It is the only thing that turns
      row 2's `read-from-host-documentation` into a measurement this tree holds,
      and it cannot be manufactured from the tree: it needs a real session that
      crosses 30 s on that slot, with host, host version, transcript reference
      and date. Until then no cell in the new table may be cited as evidence
      this package collected. Same shape as 3.3, and for the same reason.
- [ ] **3.3 Write the observed row.** Deferred, and named rather than dropped:
      the row `_lib/structured_ask.ts` asks for needs a real session on a host
      delivering a question picker, with host, host version, transcript reference
      and date. That is an observation, not a tree edit, and it is the only thing
      that turns 3.1's "not observed" into a measurement. It is also the input the
      parked decision below is waiting on.

      **Disposition re-checked 2026-10-02, against the tree rather than against
      this line.** Both carried steps ask for the same class of input: a row whose
      cells are *host, host version, transcript reference, date* taken from a real
      session that crossed a condition this repository cannot create. 2.4 needs a
      session in which the `user_prompt_submit` timeout is actually reached; 3.3
      needs a session on a host that delivered a question picker. Neither is a tree
      edit, and no command in `src/scripts/` produces either — which is why
      `src/agent-src/contexts/execution/host-capability-manifest.md:115-121` already
      records that such rows come from a real session and never from a script (kill
      register K22 of `road-to-leading-every-row` is the same finding reached
      independently).

      **They stay `[ ]`, not `[~]`.** The Risk Register below wants carried work
      counted as open in the dashboard; a deferral glyph would read as finished and
      is exactly the laundering this file was created to prevent.

      **Wake condition, for both:** a session that meets the condition is observed
      and its four cells are written into the row the parent names. Until one is, no
      cell in the new table may be cited as evidence this package collected — the
      parent's own constraint, restated here so it travels with the steps.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-host-claims-the-tree-contradicts |

## Acceptance Criteria

- [x] AC-1 — No step carried from `road-to-host-claims-the-tree-contradicts` is still `[ ]` without a recorded disposition.
