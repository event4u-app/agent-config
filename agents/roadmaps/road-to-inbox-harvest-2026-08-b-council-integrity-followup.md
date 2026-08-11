---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b-council-integrity.md
---

# Roadmap: Follow-up to council-pass integrity

> Decide the solo-attendance floor against real attendance data, now that the
> `quorum_result` event exists to accumulate it — or publish the null.

## Context

This roadmap collects the one item deferred from
[`agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-council-integrity.md`](archive/road-to-inbox-harvest-2026-08-b-council-integrity.md).
See the parent's archive entry for the original rationale.

The parent closed 8 of 8 steps. Its Phase 1 shipped the `quorum_result` event
(1.1) and Phase 2 shipped the verdict-vs-tally check; 1.6 is the only item that
could not be closed there, because it asks for a **rate over real passes** and
no event existed to accumulate one.

**Why this is a follow-up and not a fourth deferral.** The parent records that
the ask was already deferred once before, as `blocker: b-quorum-n2` in
`agents/roadmaps/archive/road-to-feedback-9-29.md:365-373`, whose
"Resolved when: attendance data exists" is the same unpaid precondition and
whose "watch council attendance telemetry" presumed exactly the telemetry the
parent's 1.1 then built. The parent's own words: *"It is not a new idea; it is
an unpaid one — which is the argument for 1.1 rather than for another
deferral."* 1.1 has now landed, so the precondition is **reachable for the
first time** — it is not yet met. That is the difference between this file and
another deferral, and it is the condition below.

> Blocked until `agents/runtime/council/events.log` carries enough
> `quorum_result` rows to read a solo-conclusion rate. Execution starts when
> the condition clears; until then this roadmap is visible and idle.

## Prerequisites

- [ ] Read `AGENTS.md` and the parent archive entry.
- [ ] Confirm `quorum_result` rows are actually accumulating —
      `grep -c quorum_result agents/runtime/council/events.log`. A zero here
      means the condition has not cleared and the phase below does not start.

## Phase 1 — The solo-attendance floor (carried from parent Phase 1)

- [ ] **1.1 Decide the solo-attendance floor against real data.** Carried
      verbatim from the parent's 1.6: *"Solo-attendance floor. Deferred behind
      `blocker: quorum-solo-floor` — the rate cannot be read before 1.1
      accumulates it. 1.1–1.5 ship and are useful without it."* Read the
      solo-conclusion rate from the accumulated `quorum_result` rows, then pick
      one of the parent's three **pre-registered** outcomes — pre-registered so
      the choice is not fitted to the number after seeing it:

      - **(a) add a third CLI member.** `gemini` is already in
        `ai_council/cli_hints.ts:40-43` and `ai_council/config.ts:78`, and
        `_lib/environment_detector.ts:138` records it as `['gemini', false]`
        where the boolean is the community-wrapper flag documented at
        `:127-133` (`false` = vendor-official CLI under the user's own
        subscription), so this option is spend-free on a host that has the
        binary.
      - **(b) scope a `min_present: 2` floor to gate-class passes only.**
      - **(c) publish a null** if the rate is under 5 %, and cancel the floor
        against it.

      Tightening `ceil(n/2)` itself stays **out of scope** — `quorum.ts:13-19`
      records that divergence as a decision, and reopening it is a separate
      argument from this one.
      <!-- verify: grep -c quorum_result agents/runtime/council/events.log -->

**Exit:** one of (a), (b), (c) is chosen against a rate that was actually read,
and the outcome is recorded — including the null, which is a result and not a
silence.

## Acceptance Criteria

- [ ] The solo-conclusion rate is read from real `quorum_result` rows and
      stated as a number, never estimated.
- [ ] One pre-registered outcome is chosen, and the two rejected ones are named
      with the reason they lost.
- [ ] If the outcome is (c), the null is published rather than the item quietly
      dropped — this ask has already survived two deferrals on silence.
- [ ] All quality gates pass — see `quality-tools`.
