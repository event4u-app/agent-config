---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-the-question-only-the-owner-can-answer
entry_condition:
  what: the next run resolves blocker(s) intake-band-shift-needs-a-baseline, ledger-change-needs-hook-bundle-headroom
  when: whenever the owner takes the next step
  who: agent
review_by: 2027-01-25
estate_growth_exempt: concern_count +1 for the `intake-pass` hook concern, the owner's own choice in OQ-25 (2026-10-28) of a shipped default-on concern over a personal hook, which no existing concern can carry; earlier reason, kept — Owner-chosen archive of road-to-the-question-only-the-owner-can-answer — its deferred steps wait on owner blocker(s) interview-suffix-form-is-an-owner-decision, intake-band-shift-needs-a-baseline, ledger-change-needs-hook-bundle-headroom and are parked here instead of left active. The parent is archived in the same change, so the active count drops by one.
---
# Road to the question only the owner can answer — carried

> **Source:** carried by the archival sweep on 2026-10-27 from
> [`road-to-the-question-only-the-owner-can-answer`](../archive/road-to-the-question-only-the-owner-can-answer.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-the-question-only-the-owner-can-answer deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-the-question-only-the-owner-can-answer

- [x] **3.1 Append the interview sentence automatically (owner demand).** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/intake_pass_hook.ts --> Done 2026-10-28 per OQ-25: the `intake-pass` concern (`src/scripts/hooks/intake_pass_hook.ts`), on by default on every host's `user_prompt_submit`, names the intake pass on task prompts and leaves the owner-gap judgement to the agent.
      verify: `npx vitest run tests/hooks/intake_pass_hook.test.ts` -> 0
- [x] **3.2 Interview reachable outside the maintainer workspace (D2).** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Done 2026-10-28 per OQ-26: `workspaces:` widened to `engineering` and `product` on the five consumer-safe interview artefacts; `challenge-me closure` stays maintainer-only (it runs `./scripts-run`).
      verify: `./scripts-run src/scripts/lint_discovery_vocabulary` -> 0 once OQ-26 is answered and applied.
- [ ] **3.3 Absence scored as unknown, plus a taste dimension (D5).** <!-- blocked-by: intake-band-shift-needs-a-baseline -->
      verify: G4 fixtures — "make it better", a taste-gap prompt and a full prompt land on three distinct outcomes.
- [ ] **3.4 Skill-level `effort` lowering, benched on ≤ 3 skills (D13).** <!-- blocked-by: intake-band-shift-needs-a-baseline -->
      verify: a CLAIMS row stays `unbacked` until the bench lands.
- [ ] **3.5 The contact ledger counts native picker calls (D9).** <!-- blocked-by: ledger-change-needs-hook-bundle-headroom -->
      verify: a transcript with a picker `tool_use` records class `native`.

## Blockers

### blocker: interview-suffix-form-is-an-owner-decision

- **Status:** resolved — 2026-10-28, OQ-25 and OQ-26 answered and applied (3.1, 3.2).
- **Class:** 3 — owner-reserved: product reach and a possible new settings key.
- **Owner:** user — `agents/owner-questions.md` OQ-25 and OQ-26.
- **Run:** `grep -n 'OQ-25\|OQ-26' agents/owner-questions.md`
- **Blocks:** 3.1, 3.2.
- **What to do:** answer OQ-25 (options a / b / c) and OQ-26 (options a / b / c) in `agents/owner-questions.md`.
- **Resolved when:** both rows sit under `## Answered`.
- **Recommendation:** OQ-25 (a) the personal hook, zero package change; OQ-26 (a) widen.
- **If you do nothing:** the suffix stays a manual tool; Phase 1 still routes it.

### blocker: intake-band-shift-needs-a-baseline

- **Status:** open — raised 2026-10-27.
- **Class:** 1 — a measurement, no decision owed.
- **Owner:** the next run of this roadmap's carry.
- **Run:** `ls agents/evidence/analysis/ | grep owner-question-baseline`
- **Blocks:** 3.3, 3.4.
- **What to do:** freeze a before-baseline of band outcomes, then change the scorer or bench `effort`.
- **Resolved when:** a baseline file exists and the change is compared against it.
- **Recommendation:** do 3.3 first; 3.4 only after the step-cost work.
- **If you do nothing:** vague and taste-open prompts keep sharing one score.

### blocker: ledger-change-needs-hook-bundle-headroom

- **Status:** open — raised 2026-10-27.
- **Class:** 1 — a size budget, no decision owed.
- **Owner:** the next run of this roadmap's carry.
- **Run:** `./scripts-run src/scripts/check_hook_bundle_freshness`
- **Blocks:** 3.5.
- **What to do:** edit `src/scripts/hooks/interruption_ledger_hook.ts`, rebuild with `./scripts-run src/scripts/rebuild_hook_bundle`, and land it only when the bundle-size test stays green.
- **Resolved when:** the change is bundled and the size gate is green.
- **Recommendation:** pair it with a byte-saving change in the same bundle.
- **If you do nothing:** native asks stay uncounted, which flatters the contact metric.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-the-question-only-the-owner-can-answer |

## Acceptance Criteria

- [ ] AC-1 — No step carried from `road-to-the-question-only-the-owner-can-answer` is still `[ ]` without a recorded disposition.
