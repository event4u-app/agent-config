---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
entry_condition:
  what: Windsurf or Devin Desktop is installed on a machine that can run a hook probe, or the owner decides whether Devin Local is a host this package binds
  when: whichever comes first; re-checked at review_by
  who: owner
review_by: 2027-02-07
estate_offset_exempt: >-
  Carries the two questions PR #2896 (issue #2805) left open; no archive move is available,
  and it is parked rather than active because every step waits on a host install or an owner
  decision.
estate_growth_exempt: Parked follow-up of issue #2805; adds one later roadmap, no active one.
---
# Road to Windsurf hooks after the Cascade move

> **Source:** issue #2805, PR #2896 (merged 2026-11-07), the council verdict
> `agents/evidence/council/windsurf-hooks-row-20261107.verdict.md` and the windsurf row
> comment in `src/scripts/hooks/host_lowering.yaml`.

## Where it stands

Windsurf's agent is now "Cascade (legacy)" inside Devin Desktop. The live vendor docs name
only `post_setup_worktree` (in `.windsurf/hooks.json`), so `pre_user_prompt` and
`post_cascade_response` were withdrawn: on windsurf this package binds `session_start`
only, and `self-repair-loop` and `session-canary` report windsurf as a frequency gap.
Withdrawing a claim did not establish that Cascade stopped running those events — no probe
has ever run on this host.

## Phase 1 — does the remaining binding mean what `session_start` consumers assume?

- [ ] **1.1 Probe `post_setup_worktree` on an installed host.** Bind a recording hook,
      start a Cascade task with and without a new worktree, and record when the event
      fires (per worktree, per task, per session) and on which build. Write `probe_at`
      and `host_version` into the windsurf row.
- [ ] **1.2 Decide the mapping from that evidence.** If the event fires per new worktree
      only, list the `session_start` concerns in `hook_manifest.yaml`'s windsurf block that
      rely on per-session timing and either drop them or state the narrower meaning in the
      row comment. A change to the row is a gated edit and takes a ratification record.

## Phase 2 — the two withdrawn events

- [ ] **2.1 Probe `pre_user_prompt` and `post_cascade_response`** on the same host. If both
      still fire and a vendor source documents them again, restoring the two slots needs
      that source in the row and its own ratification; the upgrade cleanup in
      `src/scripts/_lib/host_hook_merge.ts` (`WITHDRAWN_EVENTS`) must then be removed in the
      same change.

## Phase 3 — Devin Local as its own host

- [ ] **3.1 Owner decision:** is Devin Local (`.devin/hooks.v1.json`, Claude-style events
      `PreToolUse`, `UserPromptSubmit`, `Stop`, `SessionStart`, …) a host this package
      binds? Both council seats named it a separate host, not a migration of the windsurf
      row.
- [ ] **3.2 If yes:** a `devin-local` row in `host_lowering.yaml` read off
      `docs.devin.ai/cli/extensibility/hooks/overview.md`, an installer writer, a bridge
      golden, and a probe before any `block_exit` is set.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Re-binding from documentation alone | product | A vendor page reappearing could tempt a re-bind without a probe, repeating the claim-without-evidence the withdrawal removed | 2.1 requires a probe and a source, plus ratification | Phase 2 — the two withdrawn events |
| 2 | Devin Local folded into the windsurf row | implementation | Different config file, event vocabulary and blocking semantics hidden under one host id | 3.2 creates its own row; the windsurf row is not edited for it | Phase 3 — Devin Local as its own host |
