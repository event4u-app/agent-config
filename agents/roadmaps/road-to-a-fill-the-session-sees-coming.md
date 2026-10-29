---
complexity: lightweight
status: ready
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-10-29 (\"ziehe die 3 von later in den normalen ordner\"): promoted from later/ with its two siblings of round inbox-2026-10-bi once OQ-32..OQ-35 were answered; this takes the active estate from 5 to 8, over the WIP cap of 5, by the owner's explicit instruction."
estate_offset_exempt: "Promoted from later/ on owner instruction (2026-10-29); no active roadmap is archived to offset it. Owner search at 58d43073b7 (grep -rlF for quota-notice, context_used_pct, statusline:tap, compact-instructions over agents/roadmaps, later, stubs): only stubs/road-to-a-quota-notice-that-earned-its-bands (owns the band VALUES, not these surfaces) and stubs/road-to-compaction-survival-census (live-host census)."
relates:
  - slug: road-to-a-memory-that-arrives
    relation: extends
    note: "Needs its per-prompt notice (Phase 2)."
  - slug: road-to-a-quota-notice-that-earned-its-bands
    relation: disjoint
    note: "Owns the band values; nothing here changes them."
---
# Road to a fill the session sees coming

> **Source:** `agents/tmp.old/inbox-2026-10-bi/` (topic T5).
> **Arrivals:** 1 — `inbox-2026-10-bi` (2026-10-29). Owner demand: warn the
> user on every message while the context is (nearly) full, or ask at the end
> for `/clear` or a new chat.

## Goal

The fill state is visible outside the reply too (status line, doctor), and the
continuity record no longer depends on reaching the 800k recycle threshold.

## Decisions

| # | Question | Disposition |
|---|---|---|
| 1 | Bands (one at 80 %, two at 50/70, three at 70/85/95) | Keep one band; the bands stub adjusts the value. Council-decidable, reversible. |
| 2 | End-of-reply ask gated by `turn-end-gate` | No gate; the per-prompt notice already satisfies the owner's "or". |
| 3 | Mute | The existing env kill switch only; no persistent opt-out. |

## Phase 1 — Visible outside the reply

- [ ] **1.1 Context segment in the status-line tap.** `cmd_statusline.ts`
      adds a context segment at or over the band.
      verify: `tests/scripts/statusline_tap.test.ts` case at 85 %.
- [ ] **1.2 Doctor line.** `hooks:status` / `doctor` print "fill warning: live
      | no status-line tap | not bound on this host".
      verify: a fixture without the tap prints "no status-line tap".
- [ ] **1.4 Correct the manifest comment.** `src/scripts/hook_manifest.yaml`
      still describes `quota-notice` as "one per session at 80 % context fill";
      since `road-to-a-memory-that-arrives` 2.1 it repeats every prompt. The
      manifest is hook plumbing, so the edit ships with a ratification artifact.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified --base origin/main` -> 0 with the artifact in the diff.
- [ ] **1.3 Drop the ×1,500 estimate.** `context-hygiene-mechanics.md` points
      at the measured notice instead of a message-count estimate.
      verify: reference check green.

## Phase 2 — Continuity without the 800k threshold

- [ ] **2.1 Record at the band or on an early `/clear`.** `session_eol_hook.ts`
      writes the continuity record at the band, not only at 800k.
      verify: a fixture at the band and below 800k writes one record.
- [ ] **2.2 Pointer instead of body after `/clear`.** `handoff_context_hook.ts`
      injects a pointer and digest after `/clear`, not the record body.
      verify: a `/clear` fixture emits the pointer and no body.

## Phase 3 — Credentials in the history expire (OQ-34)

- [ ] **3.1 Placeholders in the history, originals for 7 days.** Owner answer
      OQ-34 (2026-10-29): chat history stores placeholders for credentials; the
      original values go to a separate local, untracked store the agent can
      resolve while it works, and a purge deletes them after 7 days, leaving
      only the placeholders. Reuse the existing egress rules and placeholder view.
      verify: `npx vitest run tests/scripts/chat_history_secret_ttl.test.ts` -> 0 —
      with a fixture where a key is resolvable on day 6 and only its placeholder
      remains on day 8.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Records pile up below the threshold | implementation | Writing at the band multiplies continuity records | One record per session id, overwritten | Phase 2 — Continuity without the 800k threshold |

## Acceptance Criteria

- [ ] AC-1 — A user with the status-line tap sees the fill state without
      reading a reply, and `doctor` says whether the warning is live.
- [ ] AC-2 — A session cleared early still leaves a continuity record.
