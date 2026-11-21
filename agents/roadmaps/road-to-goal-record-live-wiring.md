---
complexity: structural
status: ready
review_by: 2026-12-21
estate_growth_exempt: "Owner decision of 2026-11-21 (option 2, chosen in-session) on the goal-record ratification blocker of later/road-to-mandates-scoped-to-the-goal: land that roadmap's features without growing the live hook bundle and carry the hook wiring in a follow-up of its own. That roadmap was added under the owner record agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md and is parked in later/ in the same change, so the active count does not grow. Growth: +1 open blocker (goal-record-ratification, moved here from its parent)."
execution:
  mode: autonomous
relates:
  - slug: later/road-to-mandates-scoped-to-the-goal
    relation: extends
    note: "Carries exactly the live wiring that roadmap withdrew: the session-register and subagent-constraints call sites of the goal record, the hook-process tests that came with them, and the hook bundle raise they need. The recognizer, the store, the reader, the re-ask counter and the PR-command order landed there."
---

# Road to goal record live wiring

> **Source:** `later/road-to-mandates-scoped-to-the-goal`, blocker
> `goal-record-ratification`. Its branch wired the goal record into two hooks and
> raised two ceilings in `src/config/hook-bundle-budget.json`; 18 ratification
> rounds did not converge on the raise. On 2026-11-21 the owner chose option 2:
> land the features without the raise, and carry the wiring here.

## Goal

The goal record that `src/scripts/_lib/goal_mandate.ts` and
`src/scripts/_lib/goal_mandate_store.ts` already implement reaches the live hook
path: the `session-register` `user_prompt_submit` beat records the owner's goal
sentence and renders the `<session-goal>` line, `subagent-constraints` hands it
to every subagent, and the hook bundle stays inside a ceiling a ratification
round has passed.

## Context

**What landed without wiring** (on `later/road-to-mandates-scoped-to-the-goal`): the
DE + EN phrase set (`_lib/goal_phrases.ts`), the recorder
(`_lib/goal_mandate.ts`), the store reader and rendered line
(`_lib/goal_mandate_store.ts`), their library tests
(`tests/scripts/goal_mandate.test.ts`, `goal_mandate_race.test.ts`). The PR
commands take the session PR from the one OPEN row of the existing
`<session-prs>` block; the `default_pr_target` selector and its block line were
withdrawn (parent commit `7462c4b87c`).

**What the wiring costs.** Measured on the parent branch: dispatch bundle
1,605,934 B against the 1,595,300 ceiling (+10.6 kB, of which the
`Default PR target` block line is about 440 B), subagent chunk 33,617 B against
28,500 (+5.1 kB). The hook call sites themselves are the parent branch's
commits `c8d3190b99` (session-register), `e3614551e0` (subagent-constraints) and
the ratification-round fixes after them; the hook-process tests were in
`tests/scripts/goal_mandate.test.ts` and `tests/hooks/subagent_constraints_hook.test.ts`
at `b189bad6f1`.

**The constraint.** `hook-bundle-budget.json` is on the ratification gate's
watched set: a raise needs a passing verdict from two distinct providers
(ADR-268 § 4), or the owner's ruling on `goal-record-ratification`. Making room
first, so no raise is needed, needs neither.

## Phase 1 — Room or a ratified raise

- [ ] **1.1 Measure the room the wiring needs.** Re-apply the two call sites on a
      branch off `main` and read `./scripts-run src/scripts/check_hook_bundle_composition`;
      record both overshoots in the Done note.
      verify: the Done note names both readings and the ceilings they exceed.
- [ ] **1.2 Make room, or route the raise.** Shrink the dispatch bundle and the
      subagent chunk by at least the 1.1 overshoot (for example by lazy-loading
      the recognizer as its own chunk, decision A9's pattern), or, when that is
      not reachable, hand `goal-record-ratification` to the owner with the 1.1
      figures.
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0 with the wiring applied, or the blocker carries the owner's ruling.

## Phase 2 — Wire the call sites

- [ ] **2.1 Failing hook-process tests first.** Restore the session-register beat
      tests (goal block after a goal prompt and on the next prompt; a stalled goal
      hook loses to a later stop) and the two subagent-constraints goal cases.
      verify: `npx vitest run tests/scripts/goal_mandate.test.ts tests/hooks/subagent_constraints_hook.test.ts` -> /failed/
- [ ] **2.2 Wire `session-register`.** Call `goal_mandate_block` on the
      `user_prompt_submit` beat with `beat_time()` and join it with the PR block,
      as on the parent branch.
      verify: 2.1's session-register cases pass.
- [ ] **2.3 Wire `subagent-constraints`.** Put `goal_mandate_for_subagent` ahead
      of the pins in `digestFor`.
      verify: 2.1's subagent cases pass; `./scripts-run src/scripts/lint_hook_manifest` -> 0 with no manifest change.
- [ ] **2.4 Restore the default line, if it fits.** Restore `default_pr_target`
      and its tests from `7462c4b87c`, render `Default PR target for PR commands:`
      in `pr_watch_block`, and point the three PR commands' source 2 at it again.
      verify: `npx vitest run tests/scripts/session_pr_watch.test.ts tests/scripts/pr_command_target.test.ts` -> 0 and the composition gate exits 0.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | 2026-11-21, option 2: the parent roadmap lands without the hook bundle raise; the wiring and any raise live here | the owner's in-session choice on `goal-record-ratification`; owner record `agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md` | the owner rules the raise acceptable as it stood |

## Blockers

### blocker: goal-record-ratification
- **Status:** open
- **Owner:** owner
- **Routed:** council 2026-11-21 ESCALATE — split verdict across 18 ratification rounds on the parent branch (anthropic `ratified` or `confirmed-non-expanding` in 17 of 18; openai a new landing blocker each round from round 7). The owner chose option 2 the same day: the parent lands unwired, this blocker moves here.
- **Blocks:** Phase 2 — Wire the call sites, when Phase 1 cannot make room.
- **Question:** If the wiring cannot fit under the current ceilings, raise them on the anthropic seat's `ratified` plus an owner ratification, or keep the goal record unwired? <!-- md-language-check: ignore -->
- **Recommendation:** Make room first (1.2); ask only with the 1.1 figures in hand.
- **If you do nothing:** the goal record stays a library; no prompt records a goal and no subagent sees one.
- **What to do:** say the ruling in one sentence; the agent writes `agents/evidence/owner-directives/<date>-<id>.md` from it.
- **Resolved when:** the composition gate passes with the wiring applied, either by room made or by a ratified raise.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Ratification loop repeats | product | Another unbounded series of ratification rounds on a raise | Room first (1.2); at most three rounds before the owner is asked | Phase 1 — Room or a ratified raise |
| 2 | Library drift | implementation | The unwired library changes on `main` and the restored hook tests no longer match | Library tests stay on `main`; 2.1 restores the hook tests before any wiring | Phase 2 — Wire the call sites |

## Acceptance Criteria

- [ ] AC-1 — A goal prompt yields the session-goal line on that prompt and every later one, and at subagent start (2.1 tests green).
- [ ] AC-2 — `./scripts-run src/scripts/check_hook_bundle_composition` exits 0 with no unratified raise.
