---
complexity: lightweight
status: archived
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-10-29 (\"ziehe die 3 von later in den normalen ordner\"): promoted from later/ with its two siblings of round inbox-2026-10-bi once OQ-32..OQ-35 were answered; this takes the active estate from 5 to 8, over the WIP cap of 5, by the owner's explicit instruction. 2026-11-04: open_blockers +1 for b-history-credential-store-vs-egress-contract — step 3.1 was not new work but an owner answer (OQ-34) that conflicts with the egress-placeholders contract's never-stored floor; recording the conflict is the carry made visible, and without it 3.1 would read as unblocked."
estate_offset_exempt: "Promoted from later/ on owner instruction, agents/evidence/owner-directives/2026-10-29-promote-memory-roadmaps.md (2026-10-29); no active roadmap is archived to offset it. Owner search at 58d43073b7 (grep -rlF for quota-notice, context_used_pct, statusline:tap, compact-instructions over agents/roadmaps, later, stubs): only stubs/road-to-a-quota-notice-that-earned-its-bands (owns the band VALUES, not these surfaces) and stubs/road-to-compaction-survival-census (live-host census)."
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

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | One band at 80 %, as today; the bands stub adjusts the value. Options considered: one band / 50-70 / 70-85-95 | `quota_notice_hook.ts` reads one band; stubs/road-to-a-quota-notice-that-earned-its-bands owns the value | the bands stub measures a better band |
| D2 | reversible-technical | agent | No end-of-reply ask gated by `turn-end-gate`; the per-prompt notice already meets the owner's "or ask at the end". Options: gate / model hint / none | owner demand of round inbox-2026-10-bi topic T5 is "warn on every message, or ask at the end" | users miss the per-prompt line |
| D3 | reversible-technical | agent | Mute only through the existing environment kill switch, no persistent opt-out. Options: env switch / "weiter" mutes to the next band / config opt-out | a persistent opt-out is the axis that retired the warning once | a user reports the notice as noise with no way out |

## Phase 1 — Visible outside the reply

- [x] **1.1 Context segment in the status-line tap.** `cmd_statusline.ts` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/pressure.ts -->
      adds a context segment at or over the band.
      verify: `tests/scripts/statusline_tap.test.ts` case at 85 %.
      Done: `contextSegment` and the shared `CONTEXT_NOTICE_PCT` / `contextFigure` now live in `_lib/pressure.ts`, so the tap and the per-prompt notice read one band and one figure format; the segment joins the single AC line (`AC 5h window 64 % … · context 91 % (182,000 / 200,000 tokens)`). `npx vitest run tests/scripts/statusline_tap.test.ts` -> 0, five new cases (85 %, band edge 80 / 79.4, joined line, no size, chained line), all seen red first.
- [x] **1.2 Doctor line.** `hooks:status` / `doctor` print "fill warning: live <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: tests/hooks/surface_envelope.test.ts -->
      | no status-line tap | not bound on this host".
      The same row carries a cache column, `cache notice: live | fallback
      (no tap) | not bound` (folded in from `road-to-a-return-that-names-its-price`
      3.2, round `inbox-2026-11-b`; one row, never two).
      verify: a fixture without the tap prints "no status-line tap" and
      "fallback (no tap)".
      Done: `hooks:status` gives every non-fallback row `fill_warning` / `cache_notice` (JSON) and one table line `fill warning → <state> · cache notice: <state>`; "live" needs `quota-notice` bound on `user_prompt_submit` AND the tap as Claude's `statusLine` (`tapInstalled` in `_cli/cmd_statusline.ts`, honouring `CLAUDE_CONFIG_DIR`). `npx vitest run tests/scripts/hooks_status.test.ts` -> 0, four new cases (no tap, a chained non-tap line, tap installed, unbound hosts), all seen red first.
- [x] **1.4 Correct the manifest comment.** `src/scripts/hook_manifest.yaml` <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hook_manifest.yaml -->
      still describes `quota-notice` as "one per session at 80 % context fill";
      since `road-to-a-memory-that-arrives` 2.1 it repeats every prompt. The
      same edit corrects the turn-end-gate comment from "FIVE detectors" to six
      (`untested` joined; round inbox-2026-10-bm aligned every other surface).
      The
      manifest is hook plumbing, so the edit ships with a ratification artifact.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified --base origin/main` -> 0 with the artifact in the diff.
      Done: both comments corrected (comments only; `hook_manifest.json` unchanged). AI council round 1 of 2026-11-04, anthropic + openai, both `confirmed-non-expanding`; artifact `agents/evidence/ratifications/fill-session-manifest-comments-20261104.md`, prompt `agents/evidence/council/fill-session-manifest-comment-ratification-r1-20261104.question.md`. `./scripts-run src/scripts/check_kernel_edit_ratified --base origin/main` -> 0.
- [x] **1.3 Drop the ×1,500 estimate.** `context-hygiene-mechanics.md` points <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      at the measured notice instead of a message-count estimate.
      verify: reference check green.
      Done: the freshness template now quotes the measured `AC: Context <pct> % (<used> / <size> tokens)` figure and says "unmeasured" where neither the notice nor the tap exists, pointing at `hooks:status` for which case applies. Sibling sweep (`1,500 tokens|N×1500|×1500` over `src/`, `docs/`): 3 other hits — `agent-status` (a table that declares itself "Estimates only", so no contradicted claim), and two worker-payload budgets in `lint_spawn_payload.ts` / `orchestration-telemetry.md` (a different quantity) — none changed. `./scripts-run src/scripts/check_references` -> "No broken references found."

## Phase 2 — Continuity without the 800k threshold

- [x] **2.1 Record at the band or on an early `/clear`.** `session_eol_hook.ts` <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/session_eol_hook.ts -->
      writes the continuity record at the band, not only at 800k.
      verify: a fixture at the band and below 800k writes one record.
      Done: `atContextBand` reads the fill the status-line tap recorded for this session (hashed id) against the shared `CONTEXT_NOTICE_PCT`; `writeContinuityRecord` fires at the threshold OR the band, and the `0` override still switches both off. The early `/clear` is covered by the band — the record already exists when the user clears at the warning — so no `session_end` binding was added. Without the tap there is no measured fill and the threshold lane alone decides, unchanged. `npx vitest run tests/scripts/session_eol_hook.test.ts` -> 0, five new cases (band below 800k writes one, a second Stop supersedes, below band none, a peer session's fill does not count, 0-override still off), the two positive ones seen red first.
- [x] **2.2 Pointer instead of body after `/clear`.** `handoff_context_hook.ts` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/handoff_context_hook.ts -->
      injects a pointer and digest after `/clear`, not the record body.
      verify: a `/clear` fixture emits the pointer and no body.
      Done: `recordDelivery(source)` returns `pointer` for `clear` and `body` for every other injecting source; in pointer mode `consume_recycle_envelope` injects `{pointer, summary, task, next, remaining_count, sha256, read}` under kind `recycle-envelope-pointer`, with drift and directive warnings still leading, and the consumed file at the pointer keeps the full body. `npx vitest run tests/scripts/handoff_context_clear_pointer.test.ts` -> 0 (4 cases, 3 seen red first); the eight neighbouring handoff/recycle suites stay green (145 tests).

## Phase 3 — Credentials in the history expire (OQ-34)

- [x] **3.1 Credential placeholders in the history.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/chat_history.ts --> Owner answer
      OQ-34 (2026-10-29) asked for placeholders in the history plus the
      originals in a local store resolvable for 7 days; the store conflicts with
      the egress contract's never-stored floor, and the owner resolved the
      blocker below with option 1 on 2026-11-04: placeholders only, no original
      anywhere. Reuse the existing egress rules.
      verify: `npx vitest run tests/scripts/chat_history_credential_placeholders.test.ts` -> 0 —
      a credential appended, reset or prepended is a placeholder on disk and no
      sibling file holds the value.
      Done: `redact_credentials` (`_lib/chat_history_redact.ts`, kept out of `chat_history.ts` for the source-size budget) runs in `chat_history.ts` on `append` and on `_normalize_entries` (reset, prepend): every string leaf but `t`/`ts`/`s` goes through `replaceValues(text, scope, 'credential')` — a new optional class filter in `egress_token.ts` — under one scope per entry whose key is never persisted, so no placeholder resolves. A leaf whose extent cannot be proven, or every leaf when the engine chunk cannot load, is withheld whole. Identifiers stay as written. The engine loads through `egress_engine_loader` (sibling chunk when bundled), so the `chat_history` chunk measured 224,320 B under its 232,000 ceiling and the engine chunk 32,360 B under 33,000; `check_hook_bundle_composition` -> 0. `npx vitest run tests/scripts/chat_history_credential_placeholders.test.ts` -> 0 (6 cases, the 4 positive ones seen red first); `chat_history_credential_engine_missing.test.ts` pins the fail-closed path; `chat_history` joins the pattern-grade consumers of `egress_drift_matrix.test.ts` (every credential row). The `docs/contracts/egress-placeholders-v1.md` placeholder-view paragraph names the new consumer. Residue: entries written before this change stay plaintext until a reset rewrites them.

## Blockers

### blocker: b-history-credential-store-vs-egress-contract

- **Status:** resolved — 2026-11-04, owner picked option 1 (placeholders only) in session.
- **Owner:** owner — the step stores credential values, and the recorded floor says none may be stored.
- **Blocks:** 3.1.
- **Conflict:** `docs/contracts/egress-placeholders-v1.md` line 38 defines the `credential`
  class as "Never restored, never stored. The value is not written anywhere — not in a mapping,
  a log, a cache or a record", and `TokenScope` (`src/scripts/_lib/egress_token.ts:112-199`)
  implements that: its key is never persisted and it keeps no credential value, so a credential
  placeholder can never be resolved. OQ-34 asks for the opposite on one surface — the originals
  in a local store the agent can resolve for 7 days. "Reuse the existing egress rules and
  placeholder view" therefore cannot be done as written: the reusable part detects and replaces;
  the resolvable part is exactly what the contract forbids.
- **What is true today:** `src/scripts/chat_history.ts` runs no detection at all, so a pasted
  credential sits in the history file in plaintext with no expiry. Either option below is a
  strict improvement over that.
- **Options:**
  1. Placeholders only — the history stores egress placeholders and no original anywhere.
     Inside the contract as written; drops OQ-34's "resolvable for 7 days".
  2. Placeholders plus the 7-day store as OQ-34 asks, with a contract amendment naming the
     history store as the single exception (0600 file, 0700 dir, user-global and untracked,
     purge on every read and write, no resolve after expiry), threat-modelled first per
     `security-sensitive-stop`.
- **Recommendation:** option 1 — it closes the plaintext-forever exposure without opening the
  first surface that persists a credential; a resolvable copy can follow as option 2 if the
  agent demonstrably needs it.
- **If you do nothing:** credentials pasted into a session stay in the history file in
  plaintext, indefinitely, exactly as at the pin.
- **Why the run stopped here:** `/roadmap:process-full` halt 3 (security-sensitive surface) —
  and the step would lower a recorded data-handling floor, which `decision-revisit-gate` reserves
  to the owner.
- **Resolved when:** the owner picks an option; option 2 additionally needs the contract
  amendment and a threat model committed before the first line of the store.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Records pile up below the threshold | implementation | Writing at the band multiplies continuity records | One record per session id, overwritten | Phase 2 — Continuity without the 800k threshold |

## Acceptance Criteria

- [x] AC-1 — A user with the status-line tap sees the fill state without
      reading a reply, and `doctor` says whether the warning is live.
- [x] AC-2 — A session cleared early still leaves a continuity record.
