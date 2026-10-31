---
complexity: lightweight
status: ready
tree_pin: 818dbb3dbe
execution:
  mode: autonomous
review_by: 2026-12-15
estate_offset_exempt: "Owner-invoked inbox round inbox-2026-10-bm with execution in the same change (owner, 2026-10-31: \"danach arbeite die roadmaps ab mit /roadmap:process-full\"); the file closes and archives in the PR that adds it. Owner search at 818dbb3dbe (grep -rlF for readWindow, windowPressure, QuotaParkedMarker, host-rate-marker, statusline tap, installTap over agents/roadmaps, later, stubs): stubs/road-to-a-quota-notice-that-earned-its-bands owns band VALUES only; road-to-a-fill-the-session-sees-coming owns the tap's context segment, not the quota segment or the write order; later/road-to-billing-cliff-detection owns billing evidence."
relates:
  - slug: road-to-a-quota-notice-that-earned-its-bands
    relation: disjoint
    note: "Owns the band values; nothing here changes 50/80/100."
  - slug: road-to-a-fill-the-session-sees-coming
    relation: disjoint
    note: "Its 1.1 adds a context segment to runTap; Phase 2 here only reorders the write and keeps the quota segment visible when chained."
  - slug: road-to-a-limit-the-host-actually-signals
    relation: extends
    note: "The live-host half (observations, Notification alias, stop slot, autoContinue read-check, agents --json) is parked there."
---
# Road to a quota signal that tells the truth

> **Source:** `agents/tmp.old/inbox-2026-10-bm/` (topic T1).
> **Arrivals:** 1 — `inbox-2026-10-bm` (2026-10-31). Owner demand: long
> roadmap runs must not abort at the plan limit, AC warns without setting
> limits itself, and nothing reads credentials.

## Goal

The quota signal AC already ships is correct before anything acts on it: an
implausible percentage, a window past its reset or a non-quota host failure no
longer reads as "exhausted", a parked run says when it can continue, and a user
with their own status line still sees the AC segment.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Values above 101 % or non-finite are dropped; 100–101 % clamp to 100. Options: drop / clamp all / keep | `quota_ledger.ts` `readWindow` takes any finite number; `pressure.ts` turns `fill >= 100` into exhausted | a host documents values above 100 as legitimate |
| D2 | reversible-technical | agent | A window whose `resets_at` has passed reads as unknown until a fresh snapshot arrives; no tombstone row yet. Options: unknown / zero / keep last | `pressure.ts` `windowPressure` reuses a snapshot up to 10 min without a reset check | a fresh-after-reset reading is shown to be needed sooner |
| D3 | reversible-technical | agent | Non-quota host failures (auth, account, org) never write a park marker; classification is a table, unknown classes map to nothing. Options: table / branches | `host_rate_marker_hook.ts` writes only on `rate_limit`; the class list is host documentation not observed here | an observed class is mis-mapped |
| D4 | reversible-technical | agent | No hard limit, no stop, no credential read anywhere in this file (owner directive 2026-10-22 and the host's legal page) | `archive/road-to-a-quota-the-user-sees-coming.md` owner directive | never — owner constraint |

## Phase 1 — The signal is right

- [x] **1.1 Plausibility guard.** `src/scripts/_lib/quota_ledger.ts`
      `readWindow` drops non-finite and > 101 values, clamps 100–101.
      verify: `npx vitest run tests/scripts/quota_ledger.test.ts` with an epoch-sized percentage case.
- [x] **1.2 Reset edge.** `src/scripts/_lib/pressure.ts` `windowPressure` treats
      a window whose `resets_at` is in the past as no reading.
      verify: `npx vitest run tests/scripts/pressure.test.ts` with a case one second past reset.
- [x] **1.3 Reset time on the park marker.** `QuotaParkedMarker` gains an
      optional `resets_at` (epoch s) from the freshest exhausted window;
      `run_supervise` prints "parked until HH:MM".
      verify: `npx vitest run tests/scripts/quota_parked.test.ts tests/scripts/run_supervise.test.ts`.
- [x] **1.4 Non-quota failures never park.** `host_rate_marker_hook.ts` maps
      host failure classes through one table; auth/account/org classes write no
      marker.
      verify: `npx vitest run tests/scripts/host_rate_marker_hook.test.ts` with an `authentication_failed` case.

## Phase 2 — Visible with a chained status line

- [x] **2.1 Snapshot before the user's command.** `cmd_statusline.ts` `runTap`
      writes the snapshot and pressure state first, then runs the chained command.
      verify: `npx vitest run tests/scripts/statusline_tap.test.ts` with a slow chained command that still leaves a snapshot.
- [x] **2.2 Quota segment survives chaining.** When pressure is warm or worse,
      the AC segment is printed on its own, control-character-free line after the
      chained output.
      verify: same test file, chained case at warm.
- [x] **2.3 Install with a backup.** `installTap` backs up `settings.json`
      before writing, as `hostConfigMerge.ts` does, and keeps the original
      `padding` / `refreshInterval`.
      verify: `npx vitest run tests/scripts/statusline_install.test.ts`.

## Phase 3 — A reset prompt is not an authorization

- [x] **3.1 Fixture over every prompt concern.** The host's reset sentence
      (`prompt_shape.ts`) fed through the git-authorization path consumes no
      pending refusal and grants nothing.
      verify: `npx vitest run tests/scripts/git_authorization_hook.test.ts` with a reset-sentence case seen red first if the defect exists.
      <!-- outcome 2026-10-31: the sentence grants nothing and retains no earlier
      authorization; it DOES spend a pending refusal, like any turn. A first fix
      kept the refusal alive across the reset and was withdrawn: the AI council's
      anthropic seat refused it as widening the window in which a later
      affirmative authorizes. The fail-closed behaviour is pinned in
      tests/scripts/git_authorization.test.ts. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-31 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A real 100 % is hidden | implementation | Clamping could mask a true exhausted window | 100–101 clamps to exactly 100, which still classifies exhausted | Phase 1 — The signal is right |
| 2 | Two roadmaps edit runTap | coordination | The fill roadmap's 1.1 also changes the tap output | Write order and quota line only; context segment untouched | Phase 2 — Visible with a chained status line |

## Acceptance Criteria

- [x] AC-1 — An epoch-sized percentage, a passed reset and an auth failure each
      leave pressure below exhausted and no park marker.
- [x] AC-2 — A user with a chained status line sees the AC segment at warm and
      the snapshot is written even when the chained command is slow.
