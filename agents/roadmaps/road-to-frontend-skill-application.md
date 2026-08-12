---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Roadmap: Frontend skills stop being loaded shelfware

> On an ad-hoc UI turn the agent receives an activation signal for the design surface, holds the load-bearing heuristics in context rather than a map to them, and its consultation rate on UI turns is a published number instead of a suspicion.

## Goal

Raise the measured **consultation rate** on ad-hoc UI turns (share of UI-shaped turns where a design surface is actually consulted) from its published baseline, by fixing catalogue delivery and the ownership hole — with the baseline captured before any fix lands, and every enforcement claim matching what the tree can verify.

## Prerequisites

- [x] Read `AGENTS.md` and `src/scripts/report_skill_activation.ts` (the round-6 census — it names most of this and its own falsifier).
- [x] Read `src/skills/fe-design/SKILL.md` § Positioning and `src/agent-src/templates/scripts/work_engine/directives/ui/design.ts` — the reference/executor split this roadmap works around.

## Context

**The symptom.** On frontend tasks the agent opens the design skills and does not apply them; asked afterwards it confirms it did not use them. Reported by the maintainer, sourced from an external analysis artifact (see `## Provenance`).

**Why it happens.** Four verified, stacked causes — verified against `origin/main` on this branch, not carried over from the source:

1. **Catalogue delivery.** The host's injected skill catalogue drops descriptions for most entries. Every design surface (`dashboard-design` #56 … `fe-design` #88 in the sorted 289-skill estate) arrives as a bare name, and a bare name carries no activation signal. Observed twice independently now: once by the round-6 census, once directly in an authoring session for this roadmap.
2. **No runtime routing.** `src/scripts/_lib/router_match.ts` serves router replay, trigger-coverage CI and the two `explain` commands — no session-time consumer. Skill frontmatter carries no usable `triggers:` key (the single `^triggers:` hit in the estate is a documentation example inside `rule-writing`). The two rules that route to the design skills carry Laravel-only path triggers (`resources/views/`, `resources/js/`).
3. **The ownership hole — the core of the symptom.** `fe-design` self-describes as "a universal reference skill, not an executor … it does not own the flow". The actual executor is the UI directive set, and nothing outside the `/implement-ticket` dispatcher imports it. The skill's own trigger evals encode the consequence: `"implement the selected checkout design in React exactly as approved"` → `trigger: false`. Outside the engine **no artefact owns an implementation prompt's design quality**. "Loaded but not applied" is the designed behaviour of a reference skill outside its pipeline.
4. **Indirection depth.** `fe-design/SKILL.md` is a positioning shell; the heuristics are 227 lines away in `references/design-patterns.md` and the grounded corpus two hops away (677 KB of CSV in a different pack). "Loaded" has meant *the map was in context*, never the content.

**Three corrections to the source analysis, verified here.** They change the plan, so they are recorded rather than silently applied:

- **The truncation is not positional.** The source assumed "descriptions for roughly the first forty entries, bare names thereafter" and proposed priority-ordering as a fallback fix. In the authoring session's own catalogue, entries far past position 40 (`using-git-worktrees`, `roadmap-writing`, `md-language-check`) carried full descriptions while `command-routing` (~#45) did not, and all six checked skills carry a `description:` in frontmatter. A fixed head-N budget does not explain that. Phase 1 therefore measures the **selector**, and the priority-ordering option is cut until a selector is known.
- **The pack mismatch is latent, not active.** The two UI rules are `packs: [frontend-design]` while `existing-ui-audit`, `design-review` and `fe-design` are `packs: [engineering-base]`. But `frontend-design` declares `requires: [engineering-base]`, so the asymmetry `design-review-after-ui-write` documents ("frontend-design without engineering-base") cannot occur; the undocumented reverse — an engineering-base-only install carrying the skills with no rule routing to them — is real but only bites once pack-scoped rule projection is active, and its setting ships inactive by default. Scope drops to a documentation fix plus a CI invariant.
- **Delegated workers are not starved of design signal.** The role axis drops `[delegation-nudge, end-review-nudge, council-availability, team-review-gate, self-repair, session-eol]`; `design-slop` is not among them, and in-process subagents cannot be role-marked at all, so they fail open to the full concern chain. The claimed mechanism is dead. What survives is narrower: the dispatch-prompt template for UI work carries no audit findings or brief.

**Related work, not duplicated here.** Model-tier inversion between UI builders and UI graders is already an open, verified finding in [`road-to-ui-track-integrity-followup`](road-to-ui-track-integrity-followup.md) (`status: ready`, unblocked by the `bench:ui` harness). This roadmap adds only a sequencing claim: Phase 1's fixtures and `bench:ui`'s should be shared so one measurement window serves both questions. Skill-description quality is measured by [`road-to-skill-description-measurement`](road-to-skill-description-measurement.md) — a **different instrument**; its non-goals forbid mixing the census invocation share with selection accuracy, and this roadmap honours that separation.

- **Feature:** none
- **Jira:** none

## Gap table

| Item from the source analysis | Verdict | Where it lands |
|---|---|---|
| Catalogue delivery defect (design skills arrive bare) | KEEP — mechanism corrected | Phase 1, Phase 2 |
| Priority-ordering fallback (`catalog_priority` frontmatter) | CUT — rests on a head-N mechanism this tree contradicts | — |
| No runtime routing; Laravel-only path triggers | KEEP | Phase 4 |
| Enforcement gap (`enforced_by: none`, hook default-OFF) | KEEP — evidence-gated | Phase 5 |
| Ownership hole (reference-not-executor, engine-only executor) | KEEP | Phase 3 |
| Indirection depth (shell without content) | KEEP | Phase 3 |
| Corpus format friction (measured at 677 KB CSV, not the source's 439 KB) | FOLD into the inlined-heuristics step | Phase 3 |
| Pack inversion | FOLD — reduced to a doc fix plus one lint | Phase 5 |
| Model-tier inversion | CUT — already tracked; sequencing note only | Phase 1 |
| Anti-slop chain open at every link | FOLD into the baseline framing (there is no pressure to A/B against) | Phase 1 |
| Role axis starves delegated UI writes | CUT — mechanism refuted; residual template gap kept | Phase 4 |

## Phase 1: Measure — capture the catalogue, publish the baseline

No fix lands before this phase publishes. The strongest candidate cause is currently a suspicion with a named falsifier, and there is no active design-quality pressure anywhere in the tree to A/B against — the baseline must record that honestly.

- [x] **Step 1:** Ship a `session_start` concern that logs the injected skill-catalogue block once per session — entry count, per-entry described-vs-bare, byte length, host. Store under the existing feedback-dir state posture; record skill names and descriptions only, never user content. <!-- verify: npx vitest run tests/scripts/catalogue_capture.test.ts --> <!-- landed as a script, not a concern: the dispatcher envelope carries no catalogue (session_id/source/cwd/transcript_path only) and preamble_byte_census verified no local artifact holds the system payload; capture is split into a deterministic projection half and a labelled self-report half — see agents/settings/contexts/skill-catalogue-baseline.md -->
- [x] **Step 2:** Diagnose the **selector**, not the position: for every captured entry, join described-vs-bare against the skill's own frontmatter (`description:` present, description length, `user-invocable`, projected directory) and report which property separates the two sets. A null result here is a publishable finding, not a failure.
- [x] **Step 3:** Define "UI turn" deterministically for the analyzer by reusing and extending `UI_EXT` from `src/scripts/hooks/design_slop_hook.ts` (add `.blade.php`; the constant today covers `.html .htm .css .scss .sass .less .vue .svelte .astro .jsx .tsx`). <!-- verify: npx vitest run tests/scripts/ui_turn_definition.test.ts -->
- [x] **Step 4:** Pre-register two metrics before any fix lands — **consultation rate** (share of UI turns where `fe-design`, `existing-ui-audit`, `design-intelligence` or `design-review` was invoked or a reference file read) and **discharge rate** (share of UI-write turns followed by a review verdict that is render-scoped or explicitly static-scoped, the two shapes `design-review-after-ui-write` defines).
- [x] **Step 5:** Record in the baseline that design-quality pressure is currently **zero on every path** — `lint_design_slop` defaults to exit 0, the hook is default-OFF, and the routing skill is unreached — so the later A/B is not read as an upgrade of existing pressure.
- [x] **Step 6:** Reuse the `bench:ui` fixture set for the UI-turn corpus rather than authoring a second one, so this measurement window also serves the tier question in `road-to-ui-track-integrity-followup`.

**Exit criteria.** The capture concern runs on a hook-capable host; ≥ 20 UI sessions captured; both rates computed and published to the claims ledger with the counting method; the selector diagnosis published (including a null).

**Rollback.** Remove the `session_start` concern registration; the capture is additive and holds no other surface.

**Falsifier.** Captured catalogues show full descriptions for all 289 entries → the delivery hypothesis is dead, Phase 2 is cancelled, publish the null.

## Phase 2: Deliver — design surfaces reach the model with a description

Gated on Phase 1's selector diagnosis. The fix is chosen from what the selector turns out to be; only the first option below is currently supported by evidence.

- [x] **Step 1:** Choose the delivery fix from the Phase-1 selector finding and record the choice with the evidence line that decided it. <!-- decided: NO fix selectable on observation 1 — verdict `no-selector`, all 16 bare entries declare a description, described entries reach #325 while bare start at #45. Recorded in agents/settings/contexts/skill-catalogue-baseline.md; steps 2-4 stay open pending the capture window. -->
- [ ] **Step 2:** If the selector is estate size — project a workspace-scoped skill subset at install, so a frontend-active consumer receives the frontend-relevant set with full descriptions instead of the full estate. Sequence behind the existing estate-reduction target rather than duplicating it. <!-- verify: npx vitest run tests/scripts/scoped_projection.test.ts -->
- [ ] **Step 3:** If the selector is a per-entry property (length, frontmatter shape, projection path) — fix that property on the eight design surfaces and re-capture to confirm the entries flip from bare to described. <!-- verify: npx vitest run tests/scripts/catalogue_capture.test.ts -->
- [ ] **Step 4:** Re-run the Phase-1 capture and assert every design surface is described on a frontend-workspace install.

**Exit criteria.** A post-fix capture shows described entries for all eight design surfaces on a frontend-workspace install.

**Rollback.** Revert the projection or frontmatter change; the capture from Phase 1 stays and re-measures the reverted state.

**Falsifier.** Consultation rate does not move after delivery is fixed → delivery was necessary but not sufficient. Record it and continue; the ownership hole in Phase 3 is the independent cause.

## Phase 3: Own the prompt — an ad-hoc lane for UI work

The engine's loop is sound; its reachability is the defect. This phase gives an ad-hoc UI prompt exactly one owner without touching the engine's ownership model.

- [x] **Step 1:** Add a `ui-quick` entry path that runs audit → brief → apply → review against the same `REQUIRED_BRIEF_KEYS` / `REQUIRED_STATE_KEYS` contract the directive set enforces, without requiring a ticket envelope. The five-condition `ui-trivial` allow-list in `design-review-after-ui-write` is the skip gate, read off the diff. <!-- verify: npx vitest run tests/scripts/fe_design_triggers.test.ts --> <!-- landed as the ad-hoc lane INSIDE fe-design, not as a separate artefact: a new skill would inherit the catalogue-delivery defect Phase 1 just measured as unfixed (verdict `no-selector`), so the lane would be as unreachable as the skills it fronts. The roadmap step named "or skill-invoked protocol" as the alternative; this is it. -->
- [x] **Step 2:** Give `fe-design` an executor-mode preamble for ad-hoc sessions — outside the engine the reading agent runs the loop itself — while the engine path keeps the reference positioning unchanged. <!-- verify: task lint-skills -->
- [x] **Step 3:** Inline the load-bearing heuristics in the `fe-design` body (state coverage, audit-before-write, token reuse, a11y minimums, placeholder ban) so that "loaded" means content in context. Reference files stay for depth. Check the result against the skill's token-budget class before landing. <!-- verify: ./scripts-run src/scripts/lint_token_budget_discipline -->
- [x] **Step 4:** Fix the trigger evals so an implementation prompt routes to a real owner in ad-hoc mode instead of `trigger: false`, and pin the engine/ad-hoc disjunction as should-trigger and should-not-trigger rows. <!-- verify: npx vitest run tests/scripts/fe_design_triggers.test.ts -->

**Exit criteria.** Every path for a "build or change this UI" prompt has exactly one designated owner — the directive set when ticketed, `ui-quick` otherwise — asserted by the trigger evals.

**Rollback.** Revert the SKILL.md sections and remove the `ui-quick` entry path; the trigger evals revert with them.

## Phase 4: Route — a runtime signal that is framework-agnostic

- [x] **Step 1:** Extend both UI rules' path triggers beyond Laravel — `components/`, `src/components/`, `app/`, `pages/` — plus file patterns for `*.vue`, `*.svelte`, `*.tsx`, `*.jsx`. <!-- verify: npx vitest run tests/scripts/ui_rule_triggers.test.ts --> <!-- landed without `app/`: in a Laravel consumer that prefix is the entire backend, so it would fire on every controller, model and job. Next.js router files are caught by extension instead. `pages/api/` is excluded from the shared predicate for the same reason. Both exclusions are pinned by tests. -->
- [x] **Step 2:** Ship a `ui-route-nudge` PreToolUse concern following the `delegation_nudge_hook` / `code_graph_nudge_hook` precedent: on a Write or Edit matching the UI extension set with no audit or consultation marker this session, warn once naming the route. Warn, never block, with the same anti-loop degradation valve `design_slop_hook` carries. <!-- verify: npx vitest run tests/scripts/ui_route_nudge.test.ts -->
- [x] **Step 3:** State the host boundary in the concern's own header — this is the rule triggers' first runtime consumer, and only on hosts carrying the `pre_tool_use` slot; elsewhere the description-driven path from Phase 2 is the only carrier.
- [x] **Step 4:** Make the dispatch-prompt template for UI-shaped work carry the audit findings and brief, or name their absence as a gap, so a delegated worker holds what the orchestrator knows. Lint it against the orchestration records. <!-- verify: npx vitest run tests/scripts/ui_dispatch_brief.test.ts -->
- [ ] **Step 5:** Measure the nudge against no-nudge on the pre-registered consultation rate, with the minimum effect fixed before the run.

**Exit criteria.** The A/B is published with its pre-registered effect size, whichever sign it carries.

**Rollback.** Unregister the concern from the manifest; the rule trigger extension is independent and stays.

**Falsifier.** The degradation valve silences more than half the nudges by session end → the signal is noise; redesign or drop it and publish.

## Phase 5: Reach and enforcement — only where a mechanism exists

Enforcement moves only where the tree can verify it; `enforced_by:` changes because a mechanism appeared, never because the prose got bolder.

- [x] **Step 1:** Correct the pack asymmetry note in `design-review-after-ui-write` — it documents the direction that `requires: [engineering-base]` makes impossible, and omits the real one (an engineering-base install carrying the skills with no rule routing to them). <!-- verify: ./scripts-run src/scripts/check_references -->
- [x] **Step 2:** Add a CI invariant in the shape of `lint_ui_stack_bundles`: no rule routes to a skill that a pack-legal install of that rule's pack set cannot receive. Ship it advisory first; promote to error once its finding set is empty. <!-- verify: ./scripts-run src/scripts/lint_rule_skill_pack_reach -->
- [ ] **Step 3:** Decide the `design-slop` default from the Phase-1 and Phase-4 evidence, and record the decision with the numbers that produced it. Flip to default-ON warn for frontend-workspace installs only if the discharge rate stayed below the pre-registered target. <!-- blocked-by: enforcement-evidence -->
- [ ] **Step 4:** If and only if warn-level pressure proved insufficient, gate a non-trivial ad-hoc UI write on the presence of an audit artifact this session — an artifact-presence check, not obligation semantics — with the `ui-trivial` diff conditions as the escape hatch. <!-- blocked-by: enforcement-evidence -->
- [x] **Step 5:** Update `enforced_by:` in both rules to name the hook id, and only for the obligations that hook actually observes; anything still model-carried keeps saying so. <!-- verify: ./scripts-run src/scripts/check_enforcement_coverage --> <!-- checked, result: stays `none`. The ui-route-nudge is warn-only, capped, and default-OFF; a reminder that can be ignored is not enforcement. Both rules now name the carrier and say why the field did not move. -->

**Exit criteria.** The pack invariant runs in CI with an empty finding set; the enforcement decision is recorded with its evidence; `enforced_by:` in both rules matches what a mechanism observes, checked by the enforcement-coverage join.

**Rollback.** Demote the gate to warn and restore `enforced_by: none`; the pack lint is independent and stays.

## Acceptance Criteria

- [ ] Consultation rate and discharge rate are published numbers with a stated counting method, measured before and after the delivery and ownership fixes.
- [ ] A post-fix catalogue capture shows all eight design surfaces described on a frontend-workspace install, or the null is published and the delivery phase is closed as cancelled.
- [x] An ad-hoc "build this UI" prompt has exactly one owner on every path, asserted by trigger evals rather than by prose.
- [x] `fe-design` carries its load-bearing heuristics in the body and still passes its token-budget class check.
- [ ] The pack-legality invariant runs in CI and reports an empty finding set.
- [x] `enforced_by:` in both UI rules names only obligations a mechanism observes; every remaining model-carried obligation still says so.
- [x] No item from the source analysis was adopted without appearing in the gap table with a verdict — the plan integrates a verified subset rather than restating the source.

## Blockers

### blocker: ui-session-capture-window
- **Status:** open
- **Owner:** external
- **Blocks:** Phase 1 — Measure
- **What to do:**
  1. Let the capture concern run across normal UI work until the corpus reaches the threshold; no human decision is required, only elapsed sessions.
  2. Check progress by counting distinct session ids in the capture state file.
- **Resolved when:** the capture state holds ≥ 20 distinct sessions containing at least one UI turn.

### blocker: enforcement-evidence
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 5 — Reach and enforcement
- **What to do:**
  1. Read the published consultation and discharge rates from Phase 1 and the nudge A/B from Phase 4.
  2. Decide whether warn-level pressure closed the gap; record the decision with the numbers that produced it.
- **Resolved when:** the enforcement decision is recorded against the published rates, either as a flip or as an explicit no-change.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Selector stays unknown | implementation | The catalogue capture shows the described/bare split but no frontmatter or projection property separates the two sets, because the selector is host-internal. Phase 2 then has no fix to pick and the roadmap stalls after its measurement. | Store the raw catalogue block, not just derived counters, so a later host change can be re-diagnosed without a new capture; treat a null selector as a publishable finding and fall back to the estate-reduction path, which shrinks the catalogue regardless of the selector. | Phase 1: Measure |
| 2 | Two executors for one job | product | Executor-mode `fe-design` and the directive set both claim an implementation prompt, and a ticketed run picks the wrong one — trading a no-owner defect for an ambiguous-owner defect. | Scope executor mode explicitly to sessions outside the engine, leave the engine path's positioning untouched, and pin the disjunction as should-trigger and should-not-trigger rows so the ambiguity fails CI rather than a run. | Phase 3: Own the prompt |
| 3 | Inlined heuristics overrun the budget | product | Moving the load-bearing heuristics into the skill body pushes it past its token-budget class, and the ceiling lint forces either a class change or a partial revert that recreates the empty shell. | Measure the body against the class before landing, keep depth in the reference files, and inline only heuristics that change a write decision rather than everything the references carry. | Phase 3: Own the prompt |
| 4 | Nudge fatigue | implementation | The route nudge fires on every UI write, the degradation valve silences it early, and the measured effect is noise — leaving a concern that costs a slot and delivers nothing. | Pre-register the minimum effect before the run, count valve activations as a first-class metric, and drop the concern outright if more than half the nudges are silenced by session end. | Phase 4: Route |
| 5 | Pack lint fires on an inactive axis | implementation | The pack-legality invariant reports routes that break only when pack-scoped rule projection is enabled, which ships inactive — producing findings consumers cannot act on and gate fatigue on a latent defect. | Check pack legality of the rule/skill pair rather than the current projection state, ship advisory until the finding set is empty, and state in the finding text that the defect is latent until the axis is enabled. | Phase 5: Reach and enforcement |

## Notes

- The two rules under discussion are `ui-audit-gate` (read side, audit before writing) and `design-review-after-ui-write` (write side, review before done). They are twins by construction; a change to one usually belongs on both.
- The engine's ownership model for ticketed runs is explicitly out of scope. So is a prose-matching missed-activation detector — the round-6 phase drew that boundary and this roadmap does not reopen it.
- The `plain → blade-ui` dispatch defect from the earlier design sweep is fixed in-engine (`stack_bundles.ts` plus its pack-legality lint). It changes nothing about reachability, which is what this roadmap is about.

## Provenance

- Source: an external analysis artifact dropped into the maintainer inbox, consumed as `agents/tmp.old/frontend-skills.txt`; the originating thread link, via `src/scripts/_lib/link_crypto.ts decrypt`: ENC1:KMygM6Jj+L6qzM7c+ieq+ugyXnjDwSx9FWN22uI5hsuhCNtV8SXg9NRfwf/uumdJBxJkeqQBabY5PyaqZEg2xG8fYI8zE0jUt5fRchhlHqU7HDgzZIwiJaU24NiGGq9AQNM3MIBhaIvM5YkMgEogrPraTS1Zo699IlqF
- The source is a proposal by an external analysis agent and is not adopted doctrine. Every claim carried into this roadmap was re-verified against `origin/main` before drafting; three were corrected and two dropped, as recorded in `## Context` and the gap table.
- Council: none run. The contested choices in this plan (delivery fix, enforcement level) are gated on measurements rather than argued, so a pre-authoring council would have resolved questions the evidence answers.
