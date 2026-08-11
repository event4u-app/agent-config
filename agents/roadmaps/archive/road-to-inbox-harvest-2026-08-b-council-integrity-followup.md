---
complexity: lightweight
parent_roadmap: archive/road-to-inbox-harvest-2026-08-b-council-integrity.md
---

# Roadmap: Follow-up to council-pass integrity

> Decide the solo-attendance floor against real attendance data, now that the
> `quorum_result` event exists to accumulate it — or publish the null.

## Context

This roadmap collects the one item deferred from
[`agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-council-integrity.md`](road-to-inbox-harvest-2026-08-b-council-integrity.md).
See the parent's archive entry for the original rationale.

The parent closed 8 of its 9 non-cancelled steps. Its Phase 1 shipped the
`quorum_result` event (1.1) and Phase 2 shipped the verdict-vs-tally check; 1.6
is the one item that could not be closed there, because it asks for a **rate
over real passes** and no event existed to accumulate one.

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

Execution starts when the blocker below clears; until then this roadmap is
visible and idle.

## Prerequisites

- [x] Read `AGENTS.md` and the parent archive entry.
- [x] Confirm `quorum_result` rows are actually accumulating —
      `grep -c quorum_result agents/runtime/council/events.log`. A zero here
      means the condition has not cleared and the phase below does not start.
      **20 rows at 2026-08-11T09:30Z — the condition has cleared.** The log is
      append-only and concurrently written: it grew from 18 to 20 during the
      measurement, which is why every figure below carries its read timestamp.

## Phase 1 — The solo-attendance floor (carried from parent Phase 1)

- [x] **1.1 Decide the solo-attendance floor against real data.** Carried
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

      **Outcome — (b), recorded in
      [`ADR-224`](../../../docs/decisions/ADR-224-gate-scoped-solo-attendance-floor.md).**
      Rate read at 2026-08-11T09:30Z with the definition pre-registered in
      `src/config/quorum-attendance-budget.json` (share of `post_run` +
      `command=run` passes with `solo: true`, degraded case only): **1 of 8 =
      12.5 %**, the one solo pass having lost `anthropic` as `unavailable`. Zero
      `--single` solos, zero one-member-council solos, zero roster shortfall.

      Why the two rejected options lost, as the acceptance criteria require:
      **(a) a third CLI member** is spend-free on this host (binary verified at
      `/opt/homebrew/bin/gemini`, `['gemini', false]` = vendor-official under the
      user's own subscription) and would remove the case through the existing
      `ceil(3/2)=2`, but it **degrades silently exactly where it should protect**
      — without the binary `total` falls back to 2 and `threshold` to 1, with no
      signal — and the roster lives in the user-global `.ai-council.yml`
      (ADR-104), so it is an operator instruction rather than a change this repo
      can ship. **(c) publish a null** requires a rate under 5 %; 12.5 % does not
      meet it, and re-reading the threshold against the confidence interval's
      lower bound *after* seeing the data would be the post-hoc rationalisation
      the pre-registration exists to prevent.

      Stated because it is load-bearing rather than buried: at n=8 the 95 %
      interval around 1/8 runs roughly 0.3 %–53 %, so the rate establishes
      **urgency, not certainty**. What decides now is procedural — two prior
      deferrals on silence, and (b) is narrow and reversible. Option (c) stays
      live under ADR-224's review trigger, which fires at n=40.

      Decided with the AI council (2 members, 2 rounds, $0.0629, converged 2/2
      on (b)). Its correction is adopted rather than summarised away: a
      gate-scoped floor **is** a branch on `isSoloConcluded`, which `quorum.ts`
      forbids "without its own decision record" — so ADR-224 is that record, and
      the predicate's docstring now points at it.

      **Implementation is deliberately not in this step.** Step 1.1 asks for an
      outcome "chosen … and recorded"; the mechanism first has to invent a
      gate-class concept that does not exist in the tree (`QuorumSetting` is
      `'majority' | number`; "release gate" appears only in comments and one
      render string), audit every call site, and add a third telemetry outcome
      for "met threshold but held by the floor". That is roadmap-sized, and it
      is carried by
      [`road-to-council-solo-floor-implementation.md`](../road-to-council-solo-floor-implementation.md)
      so the chosen outcome does not become a fifth deferral by silence.

**Exit:** one of (a), (b), (c) is chosen against a rate that was actually read,
and the outcome is recorded — including the null, which is a result and not a
silence. — **Met:** (b) chosen against 1/8 = 12.5 % and recorded in ADR-224.

## Blockers

### blocker: quorum-solo-floor
- **Status:** resolved 2026-08-11 — 20 `quorum_result` rows had accumulated, the
  rate was read (1/8 = 12.5 %, degraded case) and outcome (b) was chosen against
  it in ADR-224. The data-accumulation half cleared on its own, as this blocker
  predicted; the choice half was settled by the AI council 2/2.
- **Owner:** maintainer
- **Blocks:** 1.1 only — which is this roadmap's single step, so in practice the
  whole file. Nothing else here is gated; the parent's Phases 1.1–1.5, 2 and 3
  shipped and are useful without it.
- **What to do:** wait for `agents/runtime/council/events.log` to carry enough
  `quorum_result` rows to read a solo-conclusion rate, then pick one of the
  three pre-registered outcomes in 1.1. This is **data accumulation, not a
  human decision** — no one has to act for the condition to clear; the check is
  `grep -c quorum_result agents/runtime/council/events.log`. The maintainer owns
  the *choice* once the rate exists.
- **Resolved when:** the rate has been read from real rows and one of (a), (b),
  (c) is chosen against it — or 1.1 is cancelled against the published null.

The structured section above is not decoration. A bare `> Blocked until …`
blockquote is what this file carried first, and the dashboard generator turned
it into a blocker with the id `legacy` owned by `user`, replacing a
`maintainer`-owned blocker that had a precise resolution criterion — and counted
it as one more roadmap that "needs you", for a gate that needs only time. The
carried-forward parent blocker keeps the owner, the scope and the criterion the
generator cannot infer from prose.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-11 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | This file becomes the fourth deferral it was created to end | product | The ask has already survived two deferrals on silence (`b-quorum-n2`, then parent 1.6); a READY roadmap whose condition nobody checks is the same outcome with a filename | The blocked-until condition is machine-checkable in one command (`grep -c quorum_result`), the prerequisite makes checking it step zero, and an acceptance criterion forbids a quiet drop — publishing the null is a required outcome, not an allowed one | Acceptance Criteria |
| 2 | The outcome is fitted to the rate after seeing it | product | Three outcomes with a free choice after reading one number is post-hoc rationalisation wearing a decision's clothes — and the 5 % figure sits in option (c) where it can be reinterpreted | The three outcomes are carried **pre-registered** from the parent blocker rather than re-derived here, and the acceptance criteria require naming why the two rejected ones lost, so the choice is auditable against what was written before the data existed | Phase 1 — The solo-attendance floor (carried from parent Phase 1) |
| 3 | The floor is read as licence to reopen `ceil(n/2)` | implementation | A "solo-attendance floor" and the quorum threshold are one edit apart, and `quorum.ts:13-19` records the ceil-vs-floor divergence as a decision — 1-of-2 is "the deliberate choice, not an off-by-one" | Step 1.1 names the exclusion in its own body with the citation, so reopening it is visibly a separate argument rather than a side effect of this one | Phase 1 — The solo-attendance floor (carried from parent Phase 1) |
| 4 | Option (a) is taken as spend-free when it is not | implementation | `gemini` is already wired in three places, which makes "add a third member" look free; it is spend-free only where the vendor CLI binary exists under the user's own subscription, and the alternative is an API key | The option carries the `environment_detector.ts:127-133` citation for exactly what the `false` flag means, so the condition travels with the option instead of being re-derived at decision time | Phase 1 — The solo-attendance floor (carried from parent Phase 1) |

## Acceptance Criteria

- [x] The solo-conclusion rate is read from real `quorum_result` rows and
      stated as a number, never estimated. **1 of 8 post_run/command=run passes
      = 12.5 %**, read 2026-08-11T09:30Z with the pre-registered definition.
- [x] One pre-registered outcome is chosen, and the two rejected ones are named
      with the reason they lost. **(b) chosen; (a) lost on silent host-dependent
      degradation plus a user-global roster this repo cannot ship, (c) lost
      because 12.5 % does not meet its "under 5 %" condition.**
- [-] If the outcome is (c), the null is published rather than the item quietly
      dropped — this ask has already survived two deferrals on silence.
      **Not applicable — the outcome is (b).** The clause's intent is honoured
      anyway: the sample-size limit is recorded in ADR-224 rather than dropped,
      and (c) stays live under a review trigger that fires at n=40.
- [x] All quality gates pass — see `quality-tools`. **Remote CI on the PR is the
      gate** (per `quality.local_auto_run: false` and `roadmap-ci-steps-policy`);
      `task preflight` ran green locally before the push.
