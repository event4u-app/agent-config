# Session host-capability audit — profile activation

> Phase 0.2 deliverable for the session-profile-activation work. Locks
> what each supported host actually offers for **session identity**,
> **`session_start` firing granularity**, and **mid-session
> command/skill registry refresh** — the three facts that decide whether
> "session-only" deactivation (option b) is buildable and whether hard
> execution-gating (Phase 2) is reachable.
>
> Source of truth for the hook surface: `scripts/hook_manifest.yaml`
> (`platforms:` block) + the per-platform notes in
> [`chat-history-platform-hooks`](chat-history-platform-hooks.md).
>
> Last refreshed: 2026-06-02.

## Findings

| Host | Stable session/conv id? | `session_start` granularity | Mid-session registry refresh? |
|---|---|---|---|
| **Claude Code** | Yes — `session_id` in the hook payload | Per conversation (fires on start + on resume) | **No** — command/skill registry built once at session start; no documented mid-session re-scan |
| **Augment** | Partial — per-IDE-window | Per IDE session | No |
| **Cursor** | Yes (project + CLI) | Per session | No |
| **Cline** | Yes — `taskId`; `TaskStart` + `TaskResume` both map to `session_start` | Per task | No |
| **Windsurf** | Limited — no post-tool-use surface | Per session (no `session_end`) | No |
| **Gemini CLI** | Yes | Per session (advisory, cannot block) | No |
| **Cowork** | Structurally wired, **events do not fire yet** (upstream `anthropics/claude-code#40495`, `#27398`) | n/a until upstream lands | No |

## Implications for the design

1. **`session_start` fires on every primary host** — but it builds the
   registry **before** any dispatched hook runs. A `profile-reset` hook
   on `session_start` therefore cannot *narrow* session N+1: by the time
   it clears the overlay the surface has already been built unfiltered.
   This is the **registry-refresh Catch-22** that rules out option (b)
   for true session-scoped deactivation. → 0.1 locks option (a) explicit
   `/profile deactivate`, plus a `session_start` **staleness notice**
   (surface-only, no reset).

2. **No mid-session registry refresh anywhere** — "switch profile and see
   the surface change instantly without a restart" is not host-supported.
   The recommendation-bias MVP works because the *agent* re-reads the
   overlay each turn and filters what it surfaces; it does not depend on
   the host rebuilding its own registry.

3. **Hard execution-gating (Phase 2) is host-dependent** — refusing an
   inactive-pack command at the router requires either a host pre-exec
   hook with veto power or a mid-session registry the host rebuilds.
   Neither is available today → Phase 2 is cancelled-with-rationale, not
   half-built (its `2.GATE`).

4. **No universal `session_end`** (absent on Windsurf, not firing on
   Cowork) — auto-cleanup on true session end (Phase 3.1) stays deferred;
   the explicit-deactivate + staleness-notice mechanism is the ceiling.

## Re-audit trigger

Refresh this table when any host ships a mid-session registry-refresh or
a pre-execution veto hook — that reopens Phase 2. Until then the MVP is
recommendation-bias only.
