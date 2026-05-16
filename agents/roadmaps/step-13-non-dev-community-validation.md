---
complexity: lightweight
---

# Roadmap: non-dev community validation (post-step-12, 90-day window)

> Owns the seven external-recruit / 90-day-window acceptance gates that
> `step-12-universal-os-reframe.md` deferred. Closes only via real human
> action (recruits, case studies, dev-user poll). The maintainer triggers
> closure manually; no autonomous path exists.

**Measured-vs-claimed disclaimer:** The recruit / cohort / case-study targets in this roadmap are **aspirational gates**, not measured outcomes. Closure requires real external humans completing the loop; every percentage and count in the acceptance gates stays `[!]` until human-confirmed by the maintainer. No autonomous path closes this — and no benchmark substitutes for it.

## Source

- **Council verdict:** `agents/council-responses/2026-05-15-step12-closure-run2.json` <!-- council-ref-allowed: roadmap source-trail -->
  D2 ACCEPT with amendment ("rewrite L153 to allow step-12 closure while
  deferred work tracks here, not blocks it").
- **Parent roadmap:** [`archive/step-12-universal-os-reframe.md`](archive/step-12-universal-os-reframe.md) *(archived on closure run #2)*.

## Prerequisites

- [x] `step-12-universal-os-reframe.md` Phases 1–7 closed for the in-branch portion
  (autonomous-feasible work done) *(see step-12 closure run #2)*
- [x] Launch posts drafted in `docs/announcements/2026-05-non-dev-launch.md` *(prerequisite)*
- [x] Case-study template shipped at `docs/case-studies/_template.md` *(prerequisite)*
- [x] Recruit intake template shipped at [`docs/recruits/_template.md`](../../docs/recruits/_template.md)
  *(Phase 1 readiness — consent, session log, friction inventory, outcome verdict)*
- [x] Eval-finding schema shipped at [`agents/eval-findings/_template.md`](../eval-findings/_template.md)
  *(Phase 1 / 2 / 4 readiness — anchors which roadmap row each finding closes)*

## Phase 1 — Non-dev MCP setup validation

- [ ] **Recruit 1 non-developer tester** via Indie Hackers / ContentWritingJobs
  *(step-12 L60 deferred here)*.
- [ ] **Validate MCP setup time < 10 minutes** — recruit completes install
  + first useful invocation; result logged in `agents/eval-findings/`.
- [ ] **Pass gate:** result published, recruit consents to public attribution
  (full name, role, screenshot OK) OR remains anonymized with consent record.

## Phase 2 — README A/B validation

- [ ] **Recruit 3 non-dev visitors** to read the new non-dev-framed README
  cold *(step-12 L114 deferred here)*.
- [ ] **Poll 10 existing dev users** — pass gate: ≥ 8 / 10 approve, no
  perceived regression in dev-facing clarity *(step-12 L114 deferred here)*.
- [ ] **Re-poll if first round fails** — iterate messaging once; second
  failure → halt + reopen with the AI Council *(step-12 L115 deferred here)*.

## Phase 3 — Case studies (5 over 90 days)

- [ ] **Recruit 5 case-study subjects** covering ≥ 3 distinct user-types
  (≥ 2 content / creator, ≥ 1 consulting, ≥ 1 founder / ops). Each subject
  consents to before / after metrics publication *(step-12 L128)*.
- [ ] **Publish in `docs/case-studies/`** with anonymized metrics where
  consent limits attribution (e.g., "brief drafting: 90 min → 25 min, 73 %")
  *(step-12 L129)*.
- [ ] **Top-10 audit:** Verify ≥ 3 of 5 case studies show top-10 skill
  invocations contain zero `test` / `deploy` / `ci` (proof of non-dev
  workflow, not disguised dev work) *(step-12 L130)*.
- [ ] **Final acceptance row:** ≥ 5 case studies merged covering ≥ 3 distinct
  user-types — closes `step-12-universal-os-reframe.md` L157 *(step-12 L157)*.

## Phase 4 — 90-day pivot / sunset gate

- [ ] **At 90 days from step-12 merge:** if < 5 case studies, run 10
  user interviews with non-dev visitors who did not install. Decision gate
  logged in `agents/eval-findings/` — pivot messaging vs. sunset non-dev
  expansion *(step-12 L131)*.
- [ ] **Decision artifact:** Either pivot-messaging-iteration plan logged
  (re-attempt) OR sunset note merged into README ("non-dev expansion
  shelved, see <findings>") and step-12 reopens with a Phase 8 revision.

## Acceptance criteria

- [ ] Phase 1 finding logged in `agents/eval-findings/`
- [ ] Phase 2 poll results published; dev-user approval ≥ 8 / 10
- [ ] Phase 3: 5 case studies in `docs/case-studies/`, ≥ 3 user-types covered
- [ ] Phase 4 gate hit (pivot OR sunset decision logged)

## Done

- [ ] All phases complete OR Phase 4 sunset decision merged.
  Either outcome closes this roadmap.

## Notes

- This roadmap is **external-only**. No autonomous agent action closes
  any checkbox here. The maintainer flips boxes after real-world
  evidence lands.
- Phase 4 is an OR-gate: pivot reopens the work, sunset closes the
  expansion track entirely.
