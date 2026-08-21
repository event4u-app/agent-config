---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Roadmap: Frontend skills stop being loaded shelfware

> On an ad-hoc UI turn the agent receives an activation signal for the design surface, holds the load-bearing heuristics in context rather than a map to them, and its consultation rate on UI turns is a published number instead of a suspicion.

## Goal

Raise the measured **consultation rate** on ad-hoc UI turns (share of UI-shaped turns where a design surface is actually consulted) from its published baseline, by fixing catalogue delivery and the ownership hole — with the baseline captured before any fix lands, and every enforcement claim matching what the tree can verify.

## Outcome

Closed out 2026-08-20. **Archived does not mean achieved.** This roadmap raised a
measurement and an ownership fix; it did not raise the consultation rate, because
no intervention was ever switched on to raise it with.

| Phase | Outcome | What that means |
|---|---|---|
| 1 — Measure | **satisfied** | Both metrics pre-registered, the UI-turn definition shared with the hook and the nudge, the zero-pressure baseline recorded, and the consultation rate now published over a corpus that contains UI work: **0.0 %, 0 of 275 UI-write turns across 16 UI-write sessions**. The selector diagnosis is published as a split verdict, not a single null. |
| 2 — Deliver | **abandoned** | No delivery fix is selectable. The one host that observed a described/bare split found no separating property; the other could not observe the split at all. Estate reduction shipped elsewhere and did **not** restore descriptions (§ 6 of the finding). Steps 2–4 are conditionals whose conditions never fired. |
| 3 — Own the prompt | **satisfied** | The ad-hoc lane landed inside `fe-design` rather than as a new skill — deliberately, because a new skill would have inherited the very catalogue-delivery defect Phase 1 measured as unfixed. Heuristics inlined, trigger evals pin the engine/ad-hoc disjunction. |
| 4 — Route | **narrowed** | Rule triggers extended beyond Laravel, the `ui-route-nudge` concern shipped warn-only, the dispatch-brief lint landed. The A/B (Step 5) has a measured **control** arm and no intervention arm: the nudge is default-OFF and was never enabled in any measured store. |
| 5 — Reach and enforcement | **satisfied, as an explicit no-change** | The pack note is corrected, the pack-reach invariant runs in CI, and `enforced_by:` stayed `none` because a warn-only capped default-OFF reminder is not enforcement. The enforcement decision is recorded as a deliberate **no-change** with the numbers that produced it. |

**One premise the closing disposition rested on did not survive verification, and
is not relied on.** The enforcement-projection honest-null
(`docs/contracts/governance-enforcement-projection.md`, 2026-06-25) was offered as
terminal on the grounds that it matches this repository's population and epoch. It
does not: its selector was the `tier: safety-floor` rule set, which today matches
**zero** files, while the two rules Phase 5 governs are `tier: "2b"`. Different
population, different mechanism, different metric, two months earlier. Phase 5
still closes `no-change` — on this roadmap's own measurement instead. Full
citation: `agents/evidence/analysis/frontend-skill-application-closeout.md` § 2a.

**The corpus was not absent.** The `ui-corpus-has-no-ui` blocker concluded that
the question could not be answered without a human naming a consumer store. The
stores were already on the machine and readable by the command the blocker itself
prescribes; measuring them is what produced the 0/275 above. The blocker's
literal floor (≥ 20 UI-write sessions in one store) is still 4 short in
aggregate, which is why Phase 1 reads *satisfied* and Phase 4 reads *narrowed*
rather than both reading done.

**Nothing remains open on this roadmap.** The one human-only item — filling the
catalogue-observation corpus, 7 of 20 observations across 2 hosts — is resolved as
**transferred**, in two halves, to destinations verified to carry it: the count
half to `road-to-catalogue-host-fit` Phase 1, whose AC-1 references *"the parent
blocker's threshold across at least two hosts"* explicitly, and the verdict half
to `stubs/road-to-host-aware-skill-projection.md` precondition P1, which restates
the condition on a field that can actually change. That restatement matters:
this roadmap's own `Resolved when` was **unfalsifiable** on the truncation host,
because `buildBudgetEventRecord` writes `insufficient-observation` unconditionally
(`src/scripts/_lib/skill_catalogue.ts:595`). Detail in the blocker entry.

**Known gate disagreement — a defect in one of two contracts, currently latent.**
Two call sites hold different rules for the same question:
`src/agent-src/scripts/archive_completed_roadmaps.ts:338-354` refuses to archive a
roadmap whose steps are all closed while a blocker is still open, stating the
principle *"An unresolved blocker outlives its steps"*; the CI backstop
`agent-config roadmap:progress-check` counts steps only and flags such a file as a
violation regardless of blocker state. So a roadmap in the state the sweep
deliberately protects is a state the backstop reports as broken.

**It was live on this file mid-closeout and is not live now** — recorded in both
directions so nobody hunts a symptom that has gone. While the transferred blocker
was still open the sweep printed `1 blocker(s) still open … not archived` for this
file while `progress-check` exited 1 on it. After the transfer the sweep reports
`Would archive`, so the two now agree here. The only other file `progress-check`
flags, `road-to-release-review-p0.md`, carries **no blocker entries at all**
(verified), and the sweep omits it purely through `changed_only` branch scoping —
`--all --dry-run` offers to archive both. Nothing in the tree instantiates the
contradiction today; the contracts still differ.

Left unfixed on purpose — editing a shared gate to make one's own closeout green
is the wrong order of operations.

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

**Correction (2026-08-17) — this falsifier can no longer fire as written, and that is a defect in the test rather than a detail.** It is pinned to a 289-entry estate; no recorded observation has that denominator. `skill-catalogue.jsonl` reports `entries_total` of **336** (claude) and **497 / 497 / 497 / 426** (codex) — the estate grew and, since scoped projection shipped, the denominator also varies per install (`projection_mode: "scoped"` records 297 → 226 projected). A falsifier keyed to a fixed count therefore cannot be satisfied by any capture, so the "publish the null and cancel Phase 2" branch is unreachable by construction. The same 289 appears in the Context bullet above (`fe-design` #88 in "the sorted 289-skill estate"); the *positions* it cites were true for that capture and are left as recorded. Restating the falsifier against the observation's own `entries_total` — every entry described in the catalogue actually delivered — is the repair, and it is a scope decision for whoever resumes Phase 1, not made here.

## Phase 2: Deliver — design surfaces reach the model with a description

Gated on Phase 1's selector diagnosis. The fix is chosen from what the selector turns out to be; only the first option below is currently supported by evidence.

- [x] **Step 1:** Choose the delivery fix from the Phase-1 selector finding and record the choice with the evidence line that decided it. <!-- decided: NO fix selectable on observation 1 — verdict `no-selector`, all 16 bare entries declare a description, described entries reach #325 while bare start at #45. Recorded in agents/settings/contexts/skill-catalogue-baseline.md; steps 2-4 stay open pending the capture window. -->
- [-] **Step 2:** ~~If the selector is estate size — project a workspace-scoped skill subset at install.~~ **Answered elsewhere, negatively.** Scoped skill projection shipped under `road-to-catalogue-host-fit`, and the post-scoped observation refutes the conditional rather than satisfying it: 2026-08-16, codex, `projection_mode: "scoped"`, `projected_skill_count: 226` against a legacy 297 — and still `entries_total: 426` with `dropped_count: 330`, verdict `insufficient-observation`. The estate shrank by roughly a quarter and the host still dropped about four fifths. Estate reduction is not the delivery fix; one candidate is removed, no selector is identified. Evidence: `agents/evidence/analysis/frontend-skill-application-closeout.md` § 6.
- [-] **Step 3:** ~~If the selector is a per-entry property — fix that property on the eight design surfaces.~~ **Condition never fired.** On the one host that observed a described/bare split, all 16 bare entries declare a `description:`, description-length ranges overlap, sorted position overlaps (described reach #325, bare start at #45) and no `frontmatter:<key>` candidate was emitted. There is no per-entry property to fix. The residual — more observations, more hosts — is the `ui-session-capture-window` blocker, owned onward by `road-to-catalogue-host-fit` Phase 1.
- [-] **Step 4:** ~~Re-run the Phase-1 capture and assert every design surface is described.~~ **Depends on Step 2 or Step 3**, neither of which landed a fix; there is no post-fix state to capture. Re-running the capture today would re-measure the unchanged tree, which the capture already records.

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
- [-] **Step 5:** ~~Measure the nudge against no-nudge on the pre-registered consultation rate.~~ **Control arm measured; intervention arm does not exist.** The no-nudge arm is now a real number — 0.0 %, 0 of 275 UI-write turns across 16 UI-write sessions, instrument sensitivity proven end-to-end at 50.0 % (1/2) on a synthetic probe. The nudge arm cannot be measured from any store on this machine: `hooks.ui_route_nudge.enabled` is default-OFF and was never switched on in a project that writes UI, so every session in the corpus is a control session. Enabling it is a consent action in a consumer project, not work this roadmap can do. Carried by the `ui-corpus-has-no-ui` blocker entry below, which records the control number so a later intervention has something to beat. Evidence: `agents/evidence/analysis/frontend-skill-application-closeout.md` § 3–4.

**Exit criteria.** The A/B is published with its pre-registered effect size, whichever sign it carries.

**Rollback.** Unregister the concern from the manifest; the rule trigger extension is independent and stays.

**Falsifier.** The degradation valve silences more than half the nudges by session end → the signal is noise; redesign or drop it and publish.

## Phase 5: Reach and enforcement — only where a mechanism exists

Enforcement moves only where the tree can verify it; `enforced_by:` changes because a mechanism appeared, never because the prose got bolder.

- [x] **Step 1:** Correct the pack asymmetry note in `design-review-after-ui-write` — it documents the direction that `requires: [engineering-base]` makes impossible, and omits the real one (an engineering-base install carrying the skills with no rule routing to them). <!-- verify: ./scripts-run src/scripts/check_references -->
- [x] **Step 2:** Add a CI invariant in the shape of `lint_ui_stack_bundles`: no rule routes to a skill that a pack-legal install of that rule's pack set cannot receive. Ship it advisory first; promote to error once its finding set is empty. <!-- verify: ./scripts-run src/scripts/lint_rule_skill_pack_reach -->
- [x] **Step 3:** Decide the `design-slop` default from the Phase-1 and Phase-4 evidence, and record the decision with the numbers that produced it. <!-- decided: explicit NO-CHANGE. `hooks.design_slop.enabled` stays default-OFF and `lint_design_slop` stays advisory. Numbers that produced it: consultation rate 0.0% (0/275 UI-write turns, 16 UI-write sessions, 166 sessions scanned across 10 UI-bearing stores); discharge proxy 0.0% (0/275); intervention arm n=0 because the nudge is default-OFF everywhere measured. The flip condition as written keys on the discharge RATE, which this roadmap does not compute by design (prose-matching is a stated non-goal), so the condition is unevaluable on its own terms and a flip would rest on the labelled proxy rather than the rate it names. Recorded in agents/evidence/analysis/frontend-skill-application-closeout.md § 1. -->
- [-] **Step 4:** ~~If and only if warn-level pressure proved insufficient, gate a non-trivial ad-hoc UI write on the presence of an audit artifact.~~ **Precondition unmet by its own conditional.** Warn-level pressure was never enabled in any measured store, so it cannot have proved insufficient — there is no arm in which it was tried. Shipping the gate anyway would skip the evidence step the conditional exists to require. Reopens only if a nudge arm is measured and falls short.
- [x] **Step 5:** Update `enforced_by:` in both rules to name the hook id, and only for the obligations that hook actually observes; anything still model-carried keeps saying so. <!-- verify: ./scripts-run src/scripts/check_enforcement_coverage --> <!-- checked, result: stays `none`. The ui-route-nudge is warn-only, capped, and default-OFF; a reminder that can be ignored is not enforcement. Both rules now name the carrier and say why the field did not move. -->

**Exit criteria.** The pack invariant runs in CI with an empty finding set; the enforcement decision is recorded with its evidence; `enforced_by:` in both rules matches what a mechanism observes, checked by the enforcement-coverage join.

**Rollback.** Demote the gate to warn and restore `enforced_by: none`; the pack lint is independent and stays.

## Acceptance Criteria

- [x] Consultation rate is a published number with a stated counting method, measured over a corpus that contains UI work. <!-- amended: the original criterion demanded the discharge rate too. Its definition is a property of prose and prose-matching is a stated non-goal of this roadmap, so it is unmeasurable by construction rather than unbuilt. A labelled proxy ships instead; see agents/settings/contexts/skill-catalogue-baseline.md. --> <!-- satisfied 2026-08-20: 0.0% (0/275 UI-write turns, 16 UI-write sessions, 10 UI-bearing stores, 166 sessions scanned). Counting method: assistant TURNS, a consultation counting only for writes after it, predicates shared with ui_route_nudge_hook. Instrument sensitivity proven end-to-end (50.0% on a synthetic probe) so the zero is not a predicate that never fires. The corpus contains UI work — 275 turns, versus the 3 this repo alone offers. Honest shortfall: the pre-registered floor of 20 UI-write SESSIONS is 4 short in aggregate and no single store reaches it, so the tool still prints its provisional marker. Evidence: agents/evidence/analysis/frontend-skill-application-closeout.md § 3-4. -->
- [-] A post-fix catalogue capture shows all eight design surfaces described on a frontend-workspace install, or the null is published and the delivery phase is closed as cancelled. <!-- transferred 2026-08-20: no fix landed, so there is no post-fix capture; the null IS published but it is a SPLIT verdict, not the single null this criterion assumes — 1 no-selector (claude, a measured null) and 6 insufficient-observation (codex, an absence of observation), which the closing disposition required be kept apart. Delivery is closed as abandoned rather than cancelled-on-a-null, and the observation-corpus residual is owned by road-to-catalogue-host-fit Phase 1 (exists, parked in later/). Evidence: closeout finding § 5. -->
- [x] An ad-hoc "build this UI" prompt has exactly one owner on every path, asserted by trigger evals rather than by prose.
- [x] `fe-design` carries its load-bearing heuristics in the body and still passes its token-budget class check.
- [-] The pack-legality invariant runs in CI and reports an empty finding set. <!-- split verdict 2026-08-20: first half SATISFIED, second half not this roadmap's to close. `lint_rule_skill_pack_reach` is registered in src/config/gate-coverage.yml with `status: enforced` and `min_scanned: 90`, and its own registry note states the design: "Advisory on findings, enforced on COVERAGE: the gate exits 0 while its unreachable-route set is non-empty (12 at introduction)". Measured now: 119 rules, 290 skills, 34 packs, 11 unreachable-route + 13 unrouted-skill, exit 0. So it runs and it is not empty — and 9 of the 11 unreachable routes are in finance / founder-strategy / gtm-marketing pack pairs that have nothing to do with UI. Emptying the set is cross-pack routing work outside this roadmap's scope; the two UI-relevant findings (design-review and existing-ui-audit unrouted on an engineering-base-only install) are exactly the real asymmetry Phase 5 Step 1 documented, so the lint is correctly detecting this roadmap's own finding rather than failing to. -->
- [x] `enforced_by:` in both UI rules names only obligations a mechanism observes; every remaining model-carried obligation still says so.
- [x] No item from the source analysis was adopted without appearing in the gap table with a verdict — the plan integrates a verified subset rather than restating the source.

## Blockers

### blocker: ui-session-capture-window
- **Status:** resolved — **transferred** 2026-08-20 (outcome: `transferred`). Destinations verified to carry the obligation rather than merely named: `agents/roadmaps/later/road-to-catalogue-host-fit.md` Phase 1 "Fill the observation corpus" holds the **count** half, and `agents/roadmaps/stubs/road-to-host-aware-skill-projection.md` precondition **P1** holds a **repaired** version of the verdict half. Resolved here rather than left open because the item is preserved there and a second live copy of one obligation is the duplication a merge is supposed to remove.
- **Owner:** maintainer
- **Class:** 3 — human-only (needs human-authored observation files that do not exist)
- **Blocks:** Phase 1 — Measure · Phase 2 — Deliver
- **What to do:**
  1. **Rewritten after implementation, because the original text described a mechanism that does not exist.** It said "let the capture concern run … no human decision is required, only elapsed sessions". There is no concern: a `session_start` hook cannot see the injected catalogue (envelope carries `session_id`/`source`/`cwd`/`transcript_path`, and `preamble_byte_census` verified no local artifact holds the system payload). Capture is a script plus a labelled self-report, so the corpus does NOT fill by itself.
  2. Per observation: have a session write the entries it saw bare and the ones it saw described into `agents/evidence/metrics/skill-catalogue/<date>-<host>-{bare,described}.txt`, then run `./scripts-run src/scripts/capture_skill_catalogue --observed <bare> --described <described> --record --observed-at <ISO date> --host <host>`.
  3. Progress is `wc -l agents/evidence/metrics/skill-catalogue.jsonl` — one line per observation, currently 1.
  4. Vary the host and the session shape: a selector that only shows up on one host is exactly what the current `no-selector` verdict cannot distinguish from no selector at all.
  5. **Correction (2026-08-17) — the progress figure in item 3 is stale and one half of the resolution condition is already met.** `skill-catalogue.jsonl` holds **5** observations, not 1, and they span **2 hosts** (`claude` ×1, `codex` ×4) — so the "across ≥ 2 hosts" half of *Resolved when* is satisfied and only the count half (5 of 20) is outstanding. Item 4's framing is stale too: the standing verdict is **not** a uniform `no-selector`. One observation reads `no-selector` (claude); the other four read **`insufficient-observation`** (codex), which is a different state and must not be aggregated with it. Those four also carry a field set this blocker predates — `observation_source: "host-event"` with `truncation_mode: "budget-strip-and-drop"` and `dropped_count` 330–402 — i.e. the host now publishes its own truncation, which is mechanism evidence the "selector is unknowable" framing above does not account for.
  6. **Correction (2026-08-18) — item 2's command is incomplete, and item 3's counter has a better instrument.** The command as written records an observation carrying **no projection scope**, which `road-to-catalogue-host-fit` step 1.1 closed: pass `--projection-mode <scoped|legacy-all>` as well, or the record stays outside every mode comparison (absence is NOT `legacy-all` — a comparison skips it). Do not guess the value: run `capture_skill_catalogue --cadence`, which measures the mode off the installed host root and prints the exact command, omitting the flag with a stated reason when the root matches neither count. Measured 2026-08-18, both `~/.codex` and `~/.claude` hold 297 skills against this tree's scoped 219 / legacy-all 290, so on this machine the honest value today is *no flag*. Item 3's `wc -l` still works but `--cadence` publishes the same count against the bar plus per-host freshness; the corpus now holds **7** observations across 2 hosts.
- **Resolved when:** `skill-catalogue.jsonl` holds ≥ 20 observations across ≥ 2 hosts, and `capture_skill_catalogue` reports either a `selector-found` verdict or a `no-selector` that has stopped moving.
- **Recommendation:** (agent-drafted 2026-08-20) Transfer, which is what happened. The count is the only half that needs elapsed sessions — the "≥ 2 hosts" condition is already met (claude ×1, codex ×6), so what remains is **13 more observations**, not a design question. Record one opportunistically when a session can honestly report its own catalogue; never by inferring one.
- **If you do nothing:** Nothing degrades and nothing is lost. Phase 2 stays abandoned (no selector to act on), the 7 observations stay tracked and `skill-catalogue.jsonl` is append-only, and the corpus keeps growing whenever someone runs the capture. The delivery hypothesis stays unresolved — already its published state, and the closeout finding records that estate reduction, its strongest candidate fix, was measured and did not restore descriptions.
- **Probe baseline carried across:** **7 catalogue observations of the floor of 20, across 2 hosts — 13 short.** Stated because the count is easy to confuse with its sibling: the *16 of 20* figure this closeout also produced belongs to `ui-corpus-has-no-ui` and counts **UI-write sessions**, a different population that happens to carry a similar floor. Both are recorded so neither can be quoted for the other.
- **Destination verification — the obligation is carried, in two halves, and one of them is repaired.** Checked rather than assumed, because a named destination that does not hold the obligation is a burial with a citation.
  1. **Count half — `agents/roadmaps/later/road-to-catalogue-host-fit.md` Phase 1.** Titled "Fill the observation corpus" and opens "This phase unblocks everything else in the file, and it is repo work." Its step 1.1 already automated the codex capture and records projection scope per observation; step 1.2 shipped the pointable-bare join. Decisively, its **AC-1** reads: *"the observation count crosses **the parent blocker's threshold** across at least two hosts, or the capture cadence is published as failed with the reason."* That is this entry's own threshold, referenced explicitly — a genuine merge, not a name.
  2. **Verdict half — `agents/roadmaps/stubs/road-to-host-aware-skill-projection.md` precondition P1.** Its probe is "at least 2 rows in `skill-catalogue.jsonl` sharing one `projection_mode` with differing `dropped_count`", measured FAIL (the only two rows carrying a mode carry *different* modes). It carries a **restated** resume condition on `dropped_count` / `projected_skill_count` under a fixed `projection_mode` — deliberately not on `verdict`.
- **Why the verdict half needed repairing — a defect in THIS entry's own `Resolved when`, verified in code.** The condition above asks for "a `selector-found` verdict or a `no-selector` that has stopped moving". On the truncation host that is **unfalsifiable**: `buildBudgetEventRecord` writes `verdict: 'insufficient-observation'` unconditionally (`src/scripts/_lib/skill_catalogue.ts:595`), with its own comment explaining why — "there is nothing to separate: the host did not choose per entry, it stripped all of them". `buildNoTruncationRecord` writes `no-selector` equally unconditionally (`:643`). Only `analyzeSelector` computes a verdict from data (`:363-364`, `candidates.some((c) => c.separates)`), and only on the per-entry self-report path. So 6 of the 7 rows sit on a path where the verdict is a **constant**: reaching 20 by accumulating codex rows would satisfy the count half and leave the verdict half frozen forever. The stub's restatement is the fix, and it exists independently of this closeout — which is the strongest evidence the destination genuinely owns the question rather than inheriting it.
- **What closed it here:** the transfer, not the work. No observation was fabricated to reach 20 — inferring a self-reported catalogue is precisely the evidence this roadmap refuses to write. Both halves are preserved at destinations that exist in this tree, and this entry's defective verdict condition is recorded above so the next reader does not re-adopt it.

### blocker: consultation-rate-instrument
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1 — Measure · Phase 4 — Route
- **What to do:**
  1. ~~Build the analyzer or decide against it.~~ Built: `report_consultation_rate` computes the consultation rate from transcripts, sharing the UI-write and consultation predicates with the nudge so the metric and the trigger cannot drift apart.
  2. The discharge rate is deliberately NOT computed — its definition is a property of prose, and prose-matching is a roadmap non-goal. A labelled proxy ships in its place and is named so it cannot be quoted as the rate.
- **Resolved when:** the analyzer exists and has published a first measurement. Done: 107 sessions, and the finding is the denominator rather than the rate — see the corpus blocker below.

### blocker: ui-corpus-has-no-ui
- **Status:** resolved — **narrowed** 2026-08-20 (outcome: `narrowed`; the premise was refuted and the question measured, but the pre-registered session floor is 4 short)
- **Owner:** maintainer
- **Class:** 2 — consent-once (a human names the consumer store, then the report re-runs)
- **Blocks:** Phase 4 — Step 5 · Phase 5 — Reach and enforcement
- **What to do:**
  1. The first measurement found **3 UI-write turns across 107 sessions** in this repo. That is not a low rate, it is an absent population: a skill/rule suite is not a frontend, so the question cannot be answered from this store no matter how long it runs.
  2. Point the analyzer at a project that actually writes UI: `./scripts-run src/scripts/report_consultation_rate --store ~/.claude/projects/<flattened-consumer-path>`. `ls ~/.claude/projects` lists the candidates.
  3. Enable the nudge in that project first (`hooks.ui_route_nudge.enabled: true`) if the A/B is wanted — without it there is no intervention arm.
- **Resolved when:** a store with ≥ 20 sessions containing UI writes has been measured, and the rate is published without the provisional marker.
- **What closed it (2026-08-20):** item 1's conclusion is **refuted**. "The question cannot be answered from this store no matter how long it runs" was right about *this* store and wrong about the machine: item 2's own command needed no consent that was missing, and sweeping all 122 stores under `~/.claude/projects` found **10 UI-bearing stores, 16 UI-write sessions, 275 UI-write turns** — versus the 3 turns this entry was written against. The rate is **0.0 % (0/275)**, discharge proxy 0.0 %. The predicate was proven able to fire before the zero was believed: 36 unit tests pass with `consulted: 1` assertions, and an end-to-end synthetic probe reports `CONSULTATION RATE 50.0% (1/2)`. So the zero is a measurement, not a gate that scanned nothing.
- **Why `narrowed` and not `satisfied`:** the literal condition asks for **one store** with ≥ 20 UI-write sessions and a rate published without the provisional marker. No single store reaches 20; the real-store aggregate is 16, and the tool still prints its provisional marker. Seventeen synthetic `scale-history-*` harness stores would carry the total to 33 sessions / 292 turns and cross the floor — they are excluded on purpose, because crossing a pre-registered floor on 1-turn fixtures is denominator-padding of exactly the kind this roadmap's baseline document warns against. Residual, stated precisely: **4 more UI-write sessions, or one store with 20.**
- **Recommendation:** (agent-drafted 2026-08-20) Accept the narrowing and treat 0/275 as the control arm. It is two orders of magnitude better attested than the 3-turn figure and it is what any future nudge arm must beat. Do not re-open this to chase the last 4 sessions — the marginal session cannot move a rate that is 0 of 275, and the honest next move is an intervention arm (`hooks.ui_route_nudge.enabled: true` in a project that writes UI), not more control data.
- **If you do nothing:** Nothing degrades. The control number stands and is reproducible by the loop in the closeout finding § 3. The cost is only that Phase 4 Step 5's A/B stays one-armed, which is already its recorded state.

### blocker: enforcement-evidence
- **Status:** resolved — **satisfied** 2026-08-20 (outcome: `satisfied`; the resolution condition explicitly admits "an explicit no-change", and that is what was recorded)
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** Phase 5 — Reach and enforcement
- **What to do:**
  1. Read the published consultation and discharge rates from Phase 1 and the nudge A/B from Phase 4.
  2. Decide whether warn-level pressure closed the gap; record the decision with the numbers that produced it.
- **Resolved when:** the enforcement decision is recorded against the published rates, either as a flip or as an explicit no-change.
- **What closed it (2026-08-20):** an explicit **no-change**, recorded with its numbers in Phase 5 Step 3 and in `agents/evidence/analysis/frontend-skill-application-closeout.md` § 1. `hooks.design_slop.enabled` stays default-OFF; `lint_design_slop` stays advisory; no artifact-presence gate ships. The decisive fact is a missing arm, not a preference: Phase 5 Step 4 fires "if and only if warn-level pressure proved insufficient", and warn-level pressure was never enabled in any measured store, so it cannot have proved anything. Against that, the control arm is now real — consultation 0.0 % (0/275 UI-write turns, 16 UI-write sessions). A flip on those numbers would change every consumer's shipped posture on the strength of an experiment that was never run.
- **A premise offered for this decision was checked and NOT used.** The disposition arrived citing the enforcement-projection honest-null (`docs/contracts/governance-enforcement-projection.md`, 2026-06-25) as terminal because it matches this repository's population and epoch. It does not. Its selector was rules carrying `tier: safety-floor`; `grep -rl "tier: safety-floor" src/rules/` returns **zero files** today, so the measured population no longer exists, and the two rules Phase 5 governs are `tier: "2b"` and were never in it. Different mechanism (compile-time prose hardening vs a runtime default flip), different metric (`discipline_score` on trapD/trapE fixtures vs consultation rate on UI turns), and two months earlier. The mismatch is cited rather than absorbed, and the no-change stands on this roadmap's own measurement instead. Detail: closeout finding § 2a.
- **Recommendation:** (agent-drafted 2026-08-20) Keep the default OFF. Revisit only behind an intervention arm — enable `hooks.ui_route_nudge.enabled` in one project that actually writes UI, re-run `report_consultation_rate --store` on it, and compare against 0/275. Note the flip condition as written is unevaluable on its own terms: it keys on the discharge **rate**, which this roadmap deliberately does not compute (prose-matching is a stated non-goal), so anyone flipping it would be acting on the labelled proxy rather than the rate the condition names. Fix the condition before acting on it.
- **If you do nothing:** Nothing degrades and nothing is at risk. The shipped posture is unchanged, which is the whole content of the decision; consumers keep a default-OFF warn-only hook and an advisory lint. The only cost is that design-quality pressure stays at zero on every path — which is the baseline this roadmap recorded on purpose, not a regression it introduced.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Selector stays unknown | implementation | The catalogue capture shows the described/bare split but no frontmatter or projection property separates the two sets, because the selector is host-internal. Phase 2 then has no fix to pick and the roadmap stalls after its measurement. | Store the raw catalogue block, not just derived counters, so a later host change can be re-diagnosed without a new capture; treat a null selector as a publishable finding and fall back to the estate-reduction path, which shrinks the catalogue regardless of the selector. | Phase 1: Measure |
| 2 | Two executors for one job | product | Executor-mode `fe-design` and the directive set both claim an implementation prompt, and a ticketed run picks the wrong one — trading a no-owner defect for an ambiguous-owner defect. | Scope executor mode explicitly to sessions outside the engine, leave the engine path's positioning untouched, and pin the disjunction as should-trigger and should-not-trigger rows so the ambiguity fails CI rather than a run. | Phase 3: Own the prompt |
| 3 | Inlined heuristics overrun the budget | product | Moving the load-bearing heuristics into the skill body pushes it past its token-budget class, and the ceiling lint forces either a class change or a partial revert that recreates the empty shell. | Measure the body against the class before landing, keep depth in the reference files, and inline only heuristics that change a write decision rather than everything the references carry. | Phase 3: Own the prompt |
| 4 | Nudge fatigue | implementation | The route nudge fires on every UI write, the degradation valve silences it early, and the measured effect is noise — leaving a concern that costs a slot and delivers nothing. | Pre-register the minimum effect before the run, count valve activations as a first-class metric, and drop the concern outright if more than half the nudges are silenced by session end. | Phase 4: Route |
| 5 | Pack lint fires on an inactive axis | implementation | The pack-legality invariant reports routes that break only when pack-scoped rule projection is enabled, which ships inactive — producing findings consumers cannot act on and gate fatigue on a latent defect. | Check pack legality of the rule/skill pair rather than the current projection state, ship advisory until the finding set is empty, and state in the finding text that the defect is latent until the axis is enabled. | Phase 5: Reach and enforcement |

**Risk outcomes at closeout (2026-08-20).** Recorded rather than restamped — the
`risk-review` header above still reads `reviewed: 2026-08-12` because these are
observed outcomes, not a fresh review pass.

- **Risk 1 — selector stays unknown: MATERIALIZED, and its mitigation held.** The
  selector is unknown and Phase 2 stalled after its measurement, exactly as
  written. The mitigation worked as designed: raw observations are stored
  append-only in `skill-catalogue.jsonl`, the null was published rather than
  hidden, and the estate-reduction fallback the risk names was tried — and § 6 of
  the closeout finding records that it did **not** restore descriptions, which is
  a finding the mitigation would not have produced if the null had been buried.
- **Risk 2 — two executors for one job: did not materialize.** The ad-hoc lane
  landed inside `fe-design` rather than as a second artefact, so there is no
  second claimant; the disjunction is pinned by trigger evals as planned.
- **Risk 3 — inlined heuristics overrun the budget: did not materialize.** The
  token-budget class check passes with the heuristics in the body.
- **Risk 4 — nudge fatigue: UNTESTED, not avoided.** The valve exists and its
  falsifier (more than half the nudges silenced by session end) was never
  evaluated, because the nudge was never enabled in a project that writes UI. The
  risk is neither realized nor retired; it carries forward with Phase 4 Step 5.
- **Risk 5 — pack lint fires on an inactive axis: MATERIALIZED as designed.** The
  invariant reports 11 unreachable-route findings on a latent axis and exits 0,
  which is the mitigation working rather than the risk biting: advisory until the
  set empties, with the latency stated in the finding text.

## Notes

- The two rules under discussion are `ui-audit-gate` (read side, audit before writing) and `design-review-after-ui-write` (write side, review before done). They are twins by construction; a change to one usually belongs on both.
- The engine's ownership model for ticketed runs is explicitly out of scope. So is a prose-matching missed-activation detector — the round-6 phase drew that boundary and this roadmap does not reopen it.
- The `plain → blade-ui` dispatch defect from the earlier design sweep is fixed in-engine (`stack_bundles.ts` plus its pack-legality lint). It changes nothing about reachability, which is what this roadmap is about.

## Provenance

- Source: an external analysis artifact dropped into the maintainer inbox, consumed as `agents/tmp.old/frontend-skills.txt`; the originating thread link, via `src/scripts/_lib/link_crypto.ts decrypt`: ENC1:KMygM6Jj+L6qzM7c+ieq+ugyXnjDwSx9FWN22uI5hsuhCNtV8SXg9NRfwf/uumdJBxJkeqQBabY5PyaqZEg2xG8fYI8zE0jUt5fRchhlHqU7HDgzZIwiJaU24NiGGq9AQNM3MIBhaIvM5YkMgEogrPraTS1Zo699IlqF
- The source is a proposal by an external analysis agent and is not adopted doctrine. Every claim carried into this roadmap was re-verified against `origin/main` before drafting; three were corrected and two dropped, as recorded in `## Context` and the gap table.
- Council: none run. The contested choices in this plan (delivery fix, enforcement level) are gated on measurements rather than argued, so a pre-authoring council would have resolved questions the evidence answers.
