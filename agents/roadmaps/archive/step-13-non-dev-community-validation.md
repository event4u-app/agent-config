---
complexity: lightweight
---

# Roadmap: non-dev community validation (post-step-12, 90-day window)

> Owns the seven external-recruit / 90-day-window acceptance gates that
> `step-12-universal-os-reframe.md` deferred. Closes only via real human
> action (recruits, case studies, dev-user poll). The maintainer triggers
> closure manually; no autonomous path exists.

**Measured-vs-claimed disclaimer:** The recruit / cohort / case-study targets in this roadmap are **aspirational gates**, not measured outcomes. Closure requires real external humans completing the loop; every percentage and count in the acceptance gates stays `[!]` until human-confirmed by the maintainer. No autonomous path closes this — and no benchmark substitutes for it.

## Closure decision (2026-05-16, maintainer override)

This roadmap closes via the **Phase 4 OR-gate sunset path** explicitly defined in the original draft ("sunset note merged into README … and step-12 reopens with a Phase 8 revision"). The maintainer has elected sunset over pivot:

- No external recruits / case studies / dev-user polls were executed. All Phase 1–3 checkboxes are flipped `[-]` cancelled, not `[x]` done. Fabricating completion would violate the explicit "no autonomous path closes this" notice in the original disclaimer.
- The non-dev expansion track is **shelved** as a structural decision, not paused for a window. If a non-dev recruit ever volunteers organically (issue, discussion, MCP-Registry referral), step-12 reopens with a fresh Phase 8 revision that re-scopes against real demand.
- Step-14 Phase 3 (blocked on this roadmap's Phase 1) is sunset-cascaded in lockstep.

**Rationale:** The 90-day external-validation window predates the universal-OS pivot landing in [`step-15`](step-15-product-refinement.md). With the wizard, profile system, and cross-audience README already shipped, organic non-dev demand is the cheaper signal than synthetic recruiting. The sunset preserves the contract (parent step-12 L157 stays explicitly unsatisfied; this is not a stealth `[x]`) while freeing the dashboard to focus on shipped-not-shelved work.

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
- [x] Eval-finding schema shipped at [`agents/evidence/eval-findings/_template.md`](../eval-findings/_template.md)
  *(Phase 1 / 2 / 4 readiness — anchors which roadmap row each finding closes)*

## Phase 1 — Non-dev MCP setup validation

- [-] **Recruit 1 non-developer tester** via Indie Hackers / ContentWritingJobs
  *(step-12 L60 deferred here)*. _Cancelled 2026-05-16 (sunset override)._
- [-] **Validate MCP setup time < 10 minutes** — recruit completes install
  + first useful invocation; result logged in `agents/evidence/eval-findings/`.
  _Cancelled 2026-05-16 (sunset override)._
- [-] **Pass gate:** result published, recruit consents to public attribution
  (full name, role, screenshot OK) OR remains anonymized with consent record.
  _Cancelled 2026-05-16 (sunset override)._

## Phase 2 — README A/B validation

- [-] **Recruit 3 non-dev visitors** to read the new non-dev-framed README
  cold *(step-12 L114 deferred here)*. _Cancelled 2026-05-16 (sunset override)._
- [-] **Poll 10 existing dev users** — pass gate: ≥ 8 / 10 approve, no
  perceived regression in dev-facing clarity *(step-12 L114 deferred here)*.
  _Cancelled 2026-05-16 (sunset override)._
- [-] **Re-poll if first round fails** — iterate messaging once; second
  failure → halt + reopen with the AI Council *(step-12 L115 deferred here)*.
  _Cancelled 2026-05-16 (sunset override)._

## Phase 3 — Case studies (5 over 90 days)

- [-] **Recruit 5 case-study subjects** covering ≥ 3 distinct user-types
  (≥ 2 content / creator, ≥ 1 consulting, ≥ 1 founder / ops). Each subject
  consents to before / after metrics publication *(step-12 L128)*.
  _Cancelled 2026-05-16 (sunset override)._
- [-] **Publish in `docs/case-studies/`** with anonymized metrics where
  consent limits attribution (e.g., "brief drafting: 90 min → 25 min, 73 %")
  *(step-12 L129)*. _Cancelled 2026-05-16 (sunset override)._
- [-] **Top-10 audit:** Verify ≥ 3 of 5 case studies show top-10 skill
  invocations contain zero `test` / `deploy` / `ci` (proof of non-dev
  workflow, not disguised dev work) *(step-12 L130)*.
  _Cancelled 2026-05-16 (sunset override)._
- [-] **Final acceptance row:** ≥ 5 case studies merged covering ≥ 3 distinct
  user-types — closes `step-12-universal-os-reframe.md` L157 *(step-12 L157)*.
  _Cancelled 2026-05-16 (sunset override); step-12 L157 stays explicitly unsatisfied._

## Phase 4 — 90-day pivot / sunset gate

- [-] **At 90 days from step-12 merge:** if < 5 case studies, run 10
  user interviews with non-dev visitors who did not install. Decision gate
  logged in `agents/evidence/eval-findings/` — pivot messaging vs. sunset non-dev
  expansion *(step-12 L131)*. _Cancelled 2026-05-16 — sunset chosen directly,
  90-day window collapsed via maintainer override._
- [x] **Decision artifact:** Either pivot-messaging-iteration plan logged
  (re-attempt) OR sunset note merged into README ("non-dev expansion
  shelved, see <findings>") and step-12 reopens with a Phase 8 revision.
  _Sunset chosen 2026-05-16; closure decision above is the decision artifact._

## Acceptance criteria

- [-] Phase 1 finding logged in `agents/evidence/eval-findings/` _(sunset; not applicable)_
- [-] Phase 2 poll results published; dev-user approval ≥ 8 / 10 _(sunset; not applicable)_
- [-] Phase 3: 5 case studies in `docs/case-studies/`, ≥ 3 user-types covered _(sunset; not applicable)_
- [x] Phase 4 gate hit (pivot OR sunset decision logged) — sunset path chosen

## Done

- [x] All phases complete OR Phase 4 sunset decision merged.
  Either outcome closes this roadmap. _Phase 4 sunset path chosen 2026-05-16._

## Notes

- This roadmap is **external-only**. No autonomous agent action closes
  any checkbox here. The maintainer flips boxes after real-world
  evidence lands.
- Phase 4 is an OR-gate: pivot reopens the work, sunset closes the
  expansion track entirely.
