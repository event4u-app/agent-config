---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to the billing-cliff gate

> **Source:** `agents/tmp.old/agent-cost-limits.txt` — maintainer session,
> 2026-08-22, harvested via `/analyze:inbox`. The inbox draft was written
> against `ed311d703dc9ea8ecc06f942fc42e8a479f4f2af`, which is this roadmap's
> base commit, so its eight ledger claims were re-verified rather than
> re-derived. Two corrections came out of that pass and are marked
> `corrected-from-reproduction` at the step that carries them.

## Goal

A council round that would silently move a seat from subscription billing to
metered API billing stops and asks instead, once per run, and carries the
human's answer to every subagent it dispatches. When this is finished
`ai_council.fallback.api_on_quota` accepts a third value `'ask'`; a round under
that policy parks the quota-hit seat and ends with a Human Gate line naming the
parked seats, the estimated retry cost, and the exact grant command; and a
run-scoped grant issued on the human's yes is readable by every spawned worker
and revoked at run end. The Claude-Code-side detection of the same cliff is
**not** delivered here — it depends on a signal nobody has shown exists, and it
lives in
[`later/road-to-billing-cliff-detection.md`](later/road-to-billing-cliff-detection.md)
until a falsification spike says whether that signal is real.

## Context

A plan-billed Claude Code session that crosses its included quota does one of
two things, decided by an account-level toggle the running agent cannot read:
with *Extra Usage* off it dies with a rate-limit error, with it on it keeps
working and is metered at API rates from that moment, announced only by a CLI
banner. Neither posture is a decision the operator makes at the moment it
matters. An interactive session sees the banner; an autonomous drain does not.

The account-level spend cap remains the only control that holds when every
mechanism in this roadmap is bypassed. This gate is additive and fails closed
toward it, never the reverse.

**What is in this repo's own hands** is narrower and is the whole of Phases 1
and 2: our own council CLI→API fallback performs exactly the silent
billing-class switch described above, mid-round, with no question asked. That
half needs no spike.

## What is NOT in scope

- Reading or changing the account-level Extra Usage toggle or spend cap.
- Any unofficial usage endpoint as a shipped dependency. The Phase 3 spike may
  probe one to establish whether a signal exists; a gate may not rely on it.
- Re-opening `agents/roadmaps/later/road-to-council-api-quota-source-split.md`.
  Its resume trigger is unchanged by this roadmap.

## Blockers

### blocker: billing-cliff-signal-existence

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap any more
- **Class:** 3
- **What to do:** pick exactly one — (a) the maintainer runs the surface probes
  on a live Pro/Max account driven to its quota boundary and records one
  verdict file per surface, or (b) the detection phases are moved to
  `agents/roadmaps/later/` with the verdict files named as the resume trigger,
  and this roadmap closes on the deliverable half.
- **Recommendation:** (b).
- **If you do nothing:** the detection phases sit in the active estate as steps
  nobody can start, and the roadmap can never reach zero open steps.
- **Resolved when:** either the verdict files exist, or a `later/` roadmap
  holds the detection phases with the verdict files as its documented resume
  trigger.
- **Outcome:** (b) was taken. The three detection phases and this blocker were
  carried into
  [`later/road-to-billing-cliff-detection.md`](later/road-to-billing-cliff-detection.md),
  created in the same change, with the complete five-file verdict set as its
  resume trigger and a named owner plus a 2027-02-22 review date. The
  deliverable half — the council-side gate — shipped here. Note the outcome
  state is written in this prose line and NOT in the `Status:` field: `resolved`
  is the only token every roadmap gate reads as closed, and a descriptive
  `transferred` there would read as still-open to all of them.
- **Decided by:** AI council, 2026-08-22, 2/2 convergent on (b) over (a) keep
  open and (c) cancel. Both seats reached it independently and both named the
  same counter-argument — a parked roadmap can become indefinite debt — which
  is why the follow-up carries an owner and a review date rather than only a
  trigger. One seat added the refinement the trigger now encodes: the complete
  named verdict set, not any single probe result, because resuming on one
  positive would start the conditional phases against a signal whose
  alternatives were never measured. Council-routed rather than owner-routed
  because the carry disposition keeps the item alive in the estate, which is
  the discriminator `roadmap-progress-sync` § Iron Law 3 uses; a cancellation
  would have been the owner's to make. Cost $0.0253, both seats on
  subscription CLI transport.

## Phase 1 — Council: `api_on_quota` gains a third value

- [x] **1.1 Widen `api_on_quota` from `boolean` to `false | true | 'ask'`.**
      Today it is a two-state boolean, so the billing-class decision is taken
      once at configuration time and never mid-flight with the actual remaining
      scope in view. Touch points, all verified at the base commit:
      `src/server/routes/wizard.ts:333` (the view type),
      `src/scripts/council_cli.ts:888` (`_pyBool` → a tri-state parser),
      `src/scripts/council_cli.ts:2293` (`?? false` default),
      `src/scripts/_lib/council_settings_block.ts:121`,
      `src/scripts/_lib/council_fallback_wiring.ts:81`,
      `src/scripts/ai_council/mid_flight_fallback.ts:34` and `:45`. Existing
      booleans keep their exact meaning; `'ask'` is new and is never the
      default.
      verify: `npx vitest run tests/scripts/ai_council/ --reporter=dot` green,
      and a unit test asserts each of `false`, `true`, `'ask'` round-trips
      through the parser while an unknown value is rejected rather than
      coerced.

- [x] **1.2 Park the seat instead of losing it when policy is `'ask'`.** In
      `establishTwin` (`src/scripts/ai_council/mid_flight_fallback.ts:102`),
      when the policy is `'ask'` and no run-scoped grant is present, return a
      new outcome `'awaiting_grant'` rather than a twin. Today the two
      available outcomes are a twin (silent metered spend) or a lost seat; a
      parked seat is neither, and it is what makes the question answerable
      after the round rather than only before it.
      verify: a test drives a quota failure under `'ask'` with no grant and
      asserts the outcome is `'awaiting_grant'`, the seat is retained in the
      round's seat map, and no api client was constructed.

- [x] **1.3 End the round with a Human Gate line, not a telemetry event.**
      Today a fallback emits `action: 'transport_fallback'` to a sink
      (`src/scripts/_lib/council_fallback_wiring.ts:98`) — an event for
      telemetry, not a question for a human. Render the question through the
      existing `renderPostureLines` path
      (`src/scripts/_lib/council_fallback_posture.ts:60`): which seats parked,
      the estimated api cost of a retry taken from the spend gate's
      `next_estimate` (`src/scripts/ai_council/spend_gate.ts`, `OverrunEvent`),
      and the exact grant command to re-run.
      verify: a test renders the posture block for a round with two parked
      seats and asserts all three elements are present in the output string.

- [x] **1.4 Surface the policy in `council:status`.** Extend the posture
      string at `src/scripts/_lib/council_fallback_posture.ts:76`, which today
      renders only `on` / `off`, so a third value cannot be read back from the
      status output at all.
      verify: `./scripts-run src/scripts/council_cli status` prints
      `api_on_quota: ask` when the resolved config carries `'ask'`, and the
      existing `on` / `off` output is unchanged for the two boolean values.

## Phase 2 — Run-scoped billing grant

- [x] **2.1 Issue and store `AC_BILLING_GRANT=<run-id>` on the human's yes.**
      Store it under `agents/runtime/` keyed by run id. The TTL is bounded by
      the run, never by wall clock alone — a wall-clock TTL is the bottleneck
      the git-guard grant already hit, and a drain outliving its own grant
      would re-ask mid-run, which is the thing this roadmap exists to stop.
      verify: a test issues a grant, reads it back by run id, and asserts that
      clearing the run's continuation state removes it.

- [x] **2.2 Pin the `AC_` pass-through with a regression test.**
      `corrected-from-reproduction` — the inbox draft carried this as an open
      question ("verify the `AC_` family is passed through, and if it is
      scrubbed add an explicit pass-through"). Reproduced at the base commit
      with a control: `hardenedSpawnEnv()`
      (`src/scripts/_lib/spawn_env.ts:113`) denies by family, and the family
      list (`isDeniedByFamily`, line 95) covers only `LD_`, `DYLD_`,
      `GIT_*_COMMAND` and `GIT_CONFIG*`; `DENY_EXACT` contains no `AC_` entry.
      A probe with `AC_BILLING_GRANT=run-xyz LD_PRELOAD=/evil.so` returned the
      grant intact and `LD_PRELOAD` undefined. So there is no pass-through to
      add — only a test that keeps it true, since a future family entry would
      silently break the grant chain.
      verify: a test asserts `hardenedSpawnEnv()` preserves an `AC_`-prefixed
      variable and, as the control, scrubs `LD_PRELOAD` in the same call.

- [x] **2.3 Read the grant at the consumer sites.** Council seats under
      `'ask'` treat a present grant as "the human already said yes for this
      run" and behave as `true`; absence means park. The dispatcher already
      resolves grants against trusted config and refuses unregistered ones
      (`src/scripts/runtime_dispatcher.ts:191–227`) — that refusal is the
      property being reused, not a new mechanism.
      verify: a test drives the same quota failure as 1.2 with a grant present
      and asserts a twin is established, plus a test asserting that a grant for
      a different run id does not satisfy the check.

- [x] **2.4 Revoke the grant at run end.** Use the path that already clears
      run-continuation state (`src/scripts/hooks/run_continuation_hook.ts`,
      the state-cleared event described in its docblock at line 74).
      `corrected-from-reproduction` — the inbox draft cited this file as
      `src/scripts/run_continuation_hook.ts`, which does not exist; the file
      is under `src/scripts/hooks/`. Its line numbers were correct.
      verify: a test asserts the grant is absent after the state-cleared path
      runs, and that a second run cannot read the previous run's grant.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The gate reads as complete while the cliff it was named for is untouched | product | Phases 1–2 close the council fallback, which is one silent billing switch among two. A reader seeing the roadmap done may believe an autonomous Claude Code drain now stops at its quota boundary. It does not, and cannot until Phase 3 finds a signal. | The Goal paragraph states the boundary in its own last sentence, and the roadmap does not close as done while Phases 3–5 are unstarted — the blocker's option (b) moves them to `later/` and the closing note says which half shipped. | Goal |
| 2 | Tri-state widening silently coerces an existing boolean | implementation | Five call sites read `api_on_quota`, one through a `_pyBool` helper. A parser that maps an unknown value to a truthy default would turn a configured `off` into metered spend — the exact failure the roadmap exists to prevent, introduced by its own first step. | Step 1.1's verify requires an explicit rejection test for unknown values alongside the three round-trip cases, and step 1.2's verify asserts grant absence never becomes `true`. | Phase 1 — Council: `api_on_quota` gains a third value |
| 3 | A grant outlives its run and authorises spend nobody approved | implementation | A grant keyed only by wall clock, or not cleared on the run-end path, lets a later run inherit an earlier human's yes. | Step 2.1 bounds the TTL by the run rather than the clock; step 2.4 revokes on the existing state-cleared path and its verify asserts a second run cannot read the first run's grant. | Phase 2 — Run-scoped billing grant |
| 4 | The banner detector is built on a string that changes upstream | implementation | S-3 is a regex over unversioned English marketing copy. If it is ever promoted past warning-grade it becomes a gate that goes quietly wrong rather than loudly absent. Carried, with the phases it belongs to, into the `later/` follow-up — recorded here because the risk was identified by this roadmap and a register that silently loses a row on a carry is a register nobody can audit. | The follow-up's own register holds the live mitigation: warning-grade signals are fixed as non-blocking in the concern docblock, and the verdict files record the grade per surface so an upgrade contradicts a written record. | Context |

## Acceptance Criteria

- [x] AC-1 — `ai_council.fallback.api_on_quota` resolves `false`, `true` and
      `'ask'` across all five call sites, an unknown value is rejected rather
      than coerced, and neither boolean has changed meaning.
- [x] AC-2 — A quota-hit seat under `'ask'` with no grant is parked rather than
      lost or silently switched, and the round's closing output names the
      parked seats, the estimated retry cost, and the grant command.
- [x] AC-3 — A run-scoped grant issued on the human's yes is readable by a
      spawned worker through `hardenedSpawnEnv()`, is not satisfiable by a
      different run's id, and is absent after the run-end state-cleared path.
- [x] AC-4 — A regression test pins `AC_`-prefixed pass-through with
      `LD_PRELOAD` as the scrub control, so a future deny-family entry that
      would break the grant chain fails a test rather than a run.
- [x] AC-5 — The billing-cliff detection half is held in
      [`later/road-to-billing-cliff-detection.md`](later/road-to-billing-cliff-detection.md)
      with the complete five-file verdict set named as its resume trigger, an
      owner and a review date; this roadmap's Goal states in its own last
      sentence that the detection half is not delivered here.
