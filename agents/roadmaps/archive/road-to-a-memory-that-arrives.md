---
complexity: lightweight
status: ready
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Pulled active by the owner's own invocation (/analyze:inbox inbox-2026-10-bi, then /roadmap:process-full in the same run) -- the one exception the WIP-5 directive names. Owner search (grep -rlF for memory_lookup _isStale, quota_notice_hook claimOnce, memory_recall_hook store.dir, install-scopes default over agents/roadmaps, later, stubs) found no owner for these five correctness defects; the owned findings went to their owners instead. Closed and archived in the same PR, so the active estate returns to its floor."
relates:
  - slug: road-to-a-memory-the-consumer-owns
    relation: disjoint
    note: "Owns recall timing, the arrival record and the bench; this file fixes reachability and noise defects it does not cover. Its new Phase 9 carries the recall-quality residue of the same round."
  - slug: road-to-a-fill-the-session-sees-coming
    relation: extends
    note: "Parked sibling in later/: the owner-gated half of the fill warning (bands, end-of-reply ask, record on early /clear)."
---
# Road to a memory that arrives

> **Source:** `agents/tmp.old/inbox-2026-10-bi/` (topics T2 recall, T3 restore,
> T4 worker memory, T5 context fill). Claims verified at `58d43073b7`.

## Goal

What the memory layer holds reaches the turn, and what it cannot deliver it
says out loud: a lookup reports how many entries it skipped as stale instead of
answering `ok` over an emptied store, a clipped entry is flagged, the
context-fill notice repeats on every prompt while the session stays over its
band (the owner's own demand), a consumer without a memory store sees no recall
noise, and the install-scope docs name the default the installer actually uses.
Measured at the pin: 85 of 86 curated memory entries are past their review
window and silently filtered; the fill notice fires once per session and a
test pins "a second turn none".

## Phase 1 — Memory that is skipped says so

- [x] **1.1 `memory_lookup` reports stale skips.** Additive `skipped_stale` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/memory_lookup.ts -->
      count in the v1 envelope and the legacy JSON; `check_memory` raises a
      **warning** `store-reachability` when at least half the curated entries
      are stale (today an `info` per entry).
      verify: a fixture with three stale and one fresh entry asserts
      `skipped_stale === 3` and the warning; both fail at the pin.
- [x] **1.2 `check_memory` flags a clipped body.** Warning <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_memory.ts -->
      `truncated-at-limit` when a content field is exactly the one-fact limit
      long and does not end in sentence punctuation or a closing quote.
      verify: a 600-char fixture ending mid-word warns; a 600-char fixture
      ending in a full stop does not.

## Phase 2 — The fill notice keeps saying it

- [x] **2.1 One context line per prompt while over the band.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/quota_notice_hook.ts -->
      `src/scripts/hooks/quota_notice_hook.ts`: the context line no longer
      claims once per session; it fires on every `user_prompt_submit` while
      `context_used_pct` is at or over the band, at most once per prompt.
      verify: `tests/scripts/quota_notice_hook.test.ts` "a second turn none"
      becomes "a second turn again" (red first); a second hook run for the same
      prompt emits nothing.
- [x] **2.2 The line names both exits with real numbers.** Text: context N % <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/quota_notice_hook.ts -->
      (used / size) — new task → `/clear`, same task → `/compact`; values from
      the ledger, never an estimate.
      verify: a test asserting `/clear`, `/compact` and the absolute size.
- [x] **2.3 Pin the binding.** A test that `quota-notice` stays bound to <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      claude `user_prompt_submit` with a notification effect, so the axis that
      retired the warning once cannot retire it silently again.
      verify: the test fails against a manifest copy with the binding removed.

## Phase 3 — Quiet where there is nothing to recall, true where it is documented

- [x] **3.1 No recall WARN without a store.** `memory_recall_hook.ts`: when <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/memory_recall_hook.ts -->
      the store resolves to nothing, return allow and write the diagnostic to
      stderr only, without setting the latch.
      verify: a consumer fixture with an ADR file, an Edit call and no memory
      store produces empty stdout (a WARN at the pin).
- [x] **3.2 Install-scope docs name the real default.** `README.md` and <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/rule_inject_hook.ts -->
      `docs/contracts/install-scopes.md` say global is the default, as
      `src/install/detect.ts` does; the stale hook-header claims that no hook
      reaches a subagent are corrected to the measured SubagentStart delivery.
      verify: a test that the default the contract names equals the default
      `detect.ts` exports.

## Decisions

| # | Question | Verdict |
|---|---|---|
| C1 | Is 1.2's verify falsifiable? | Yes — two fixtures with opposite expected outcomes; the mid-word one warns, the full-stop one does not. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Per-prompt notice becomes noise | product | A line on every prompt is ignored, or annoys more than it helps | It fires only above the band, once per prompt, and names a concrete action; the band itself is owned by the bands stub | Phase 2 — The fill notice keeps saying it |
| 2 | Envelope consumers break | implementation | A new field in the lookup envelope trips a strict reader | The field is additive; existing envelope tests stay green | Phase 1 — Memory that is skipped says so |

## Acceptance Criteria

- [x] AC-1 — A lookup over a mostly stale store reports the skip count and
      `check_memory` warns; neither stays silent.
- [x] AC-2 — While the session stays over the fill band, every prompt shows the
      notice with `/clear` and `/compact`, and a test fails if the binding goes.
- [x] AC-3 — A consumer without a memory store sees no recall warning, and the
      install-scope contract matches the installer default.
