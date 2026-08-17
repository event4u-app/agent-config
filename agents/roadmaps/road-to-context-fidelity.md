---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Road to context fidelity

> Rule survival across a compaction boundary and memory staleness become enforced system behaviour instead of user hygiene folklore.

## Goal

Raise the measured post-compaction obligation-compliance rate for trigger-loaded rules above its pre-registered baseline, and replace manual memory deletion with a verification-stamped eviction ladder — each behind a falsification spike that can close the phase instead of building it.

## Prerequisites

- [ ] Read `src/rules/context-hygiene.md` and `src/scripts/hot_context_hook.ts`
- [ ] Read `src/scripts/hook_manifest.yaml` § `session_start` and § `pre_compact`
- [ ] Read `src/scripts/learning_sidecar.ts` — the decay mechanics that already exist for intake
- [ ] Re-verify the Context table against branch HEAD before executing a phase

## Context

Source: an external analysis session over this repository, 2026-08-13, pinned at `8a043ec`. That pin is 373 commits behind the branch base, so every claim was re-verified at `6d18f5bb2`. One load-bearing claim did not survive, and the plan below is adjusted for it rather than carried unchanged.

**Two observed failure modes.** Rules stop being followed as a session grows; after compaction the agent behaves as though trigger-loaded rules never existed. Separately, learned memory goes stale, and the working fix a second user reports is deleting it by hand — a human substitute for a missing eviction policy.

**Re-verified at `6d18f5bb2`:**

| Claim as drafted | Status now | Evidence |
|---|---|---|
| `pre_compact` binds only the language pin | **overtaken** — it now binds `[language-mirror, hot-context]`, and the hot-context cache is written at the compaction boundary so the restore reflects the state immediately before it | `hook_manifest.yaml:701` |
| The `session_start` chain contains no rule-index concern | still true — the chain is unchanged across all platform blocks | `hook_manifest.yaml:672,679,723` |
| No `reinject` concern exists anywhere | still true — zero hits across `src/scripts/` and `src/rules/` | negative grep, 2026-08-17 |
| No API-level context management for spawned workers | still true — zero hits for the relevant API parameters across `src/` | negative grep, 2026-08-17 |
| Learned memory carries no staleness enforcement | partially overtaken — `learning_sidecar.ts` implements a half-life decay, promotion thresholds, and a dead-end ledger for the **intake** path, but it never mutates the curated store, and the curated files still carry no verification stamp and no eviction ladder | `src/scripts/learning_sidecar.ts` |

**Consequence for scope.** The working-memory half of the compaction problem has been hardened independently; the rule-index half has not. Phase 2 reuses the existing decay mechanics as its reference rather than inventing decay a second time, and narrows to what is genuinely missing: verification stamps and eviction on the curated store.

**External evidence, mapped to the defects rather than added to them.** Degradation with growing input length is documented across frontier models and begins well before a window fills. Positional attention flips with fill level: the familiar start-and-end advantage holds only below roughly half-full, above which recency dominates — which makes per-turn injection at the end of context the structurally strongest carrier and the session-start block the weakest position in a long session. What survives a compaction on the primary host is contested: vendor-adjacent documentation and a field-reported issue disagree about whether disk-loaded instruction files are reliably re-injected, which is exactly why Phase 0 measures instead of picking a side. Two community hook patterns demonstrate the reinject shape as prior art, and their shared consensus is an index of at most twenty lines carrying pointers rather than payloads. On the memory side, field advice runs as far as disabling host auto-memory entirely because stale entries make an agent trust memory instead of looking things up, while the host's own idle-time consolidation performs prune, merge, and refresh — precedent that consolidation belongs in the system, not in the user's habits.

## Phase 0 — Falsification spikes

- [ ] Run a compaction-survival census: in an instrumented session, place three probes before a manual compaction — a session-canary-bound obligation, a completion-gate reminder, and one trigger-loaded rule with a detectable obligation. Measure per probe whether it is still followed, present only as paraphrase, or gone. Repeat across at least five sessions and stamp the host version. <!-- verify: test -f agents/evidence/eval-findings/context-fidelity-cf01.md -->
- [ ] Run a memory staleness census: walk the curated memory store and check each entry against the live tree, producing a table of still-true, stale, and unverifiable with age where datable. <!-- verify: test -f agents/evidence/eval-findings/context-fidelity-cf02.md -->
- [ ] Count compaction events per long session from the session-start source field in the chat-history records, piggybacking on the first spike. <!-- verify: grep -c compact agents/evidence/eval-findings/context-fidelity-cf01.md -->
- [ ] Pre-register both measurements as claims with their honest-null thresholds: a baseline compliance at or above 90 % for all three probe classes closes Phase 1 unbuilt; a stale ratio below 10 % shrinks Phase 2 to stamps only. <!-- verify: ./scripts-run src/scripts/check_claims -->

**Exit criteria:** both censuses exist as written findings with numbers, and both pre-registered claims carry a baseline.

**Rollback:** spikes are scratch work; nothing ships from this phase.

## Phase 1 — Compaction-boundary rule reinjection

- [ ] Add a `reinject-index` concern bound on `session_start` and gated on the compact and resume sources, reusing the gating pattern the hot-context concern already proves works. <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->
- [ ] Generate the index at build time from rule frontmatter — tier plus a new optional reinject flag — rather than maintaining it by hand: a hand-maintained index is the staleness defect wearing a new hat. Cap it at twenty lines of pointers, never rule bodies; refilling the window with bulk material re-spends exactly the tokens the compaction reclaimed. <!-- verify: ./scripts-run src/scripts/lint_rule_references -->
- [ ] Spotlight the injected block as data-plus-directive, consistent with the framing the hot-context concern already uses. <!-- verify: grep -q spotlight src/scripts/reinject_index_hook.ts -->
- [ ] Bind the concern on the primary host only, and report the other platforms as open gaps rather than as covered — the same honesty posture the session-canary rule states for its own uncovered hosts. <!-- verify: ./scripts-run src/scripts/check_enforcement_coverage -->
- [ ] Re-run the Phase 0 census with the concern live and record the delta against the baseline. No delta after five sessions reverts the concern and publishes the null. <!-- verify: ./scripts-run src/scripts/check_claims -->
- [ ] Record the decision as an ADR: rule survival across compaction is a suite responsibility carried on the compaction-sourced session start, index-form only, budget-capped. Rejected alternatives: full-payload reinjection (token regression), per-turn reinjection (the cost shape the session-canary rule already refuses), and relying on host re-injection alone (contested, which is why the census exists). <!-- verify: ./scripts-run src/scripts/adr/regenerate_index -->

**Exit criteria:** the concern is bound, the census re-run shows a recorded delta, and the ADR is indexed.

**Rollback:** remove the concern from the manifest; the build-time index generation is inert without it.

**Kill criteria:** no measured delta over five sessions removes the concern and publishes the null.

## Phase 2 — Memory eviction on the curated store

- [ ] Add a last-verified stamp per entry in the curated memory files — an ISO date plus the commit it was verified against — written on create and refreshed only when a check confirms the entry against the live tree. <!-- verify: ./scripts-run src/scripts/check_memory_contradiction -->
- [ ] Add the consolidation pass as a deterministic carrier reusing the existing condense, contradiction, and similarity tooling: what is new is the policy, not the machinery. Reference the existing intake decay implementation for its half-life and promotion semantics rather than reimplementing decay. <!-- verify: ./scripts-run src/scripts/condense_memory --help -->
- [ ] Add the eviction ladder: an entry not re-verified within the first threshold demotes to the quarantine directory where it stays inspectable; a further threshold without re-confirmation deletes it. Both thresholds come from the Phase 0 census, not from a guess. <!-- verify: ./scripts-run src/scripts/check_memory_proposal -->
- [ ] Cap the memory index injected at session start, enforced by the carrier refusing to inject beyond budget rather than by prose. <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->
- [ ] Make contradiction outrank retention: an entry failing the contradiction check against the live tree demotes immediately regardless of age. <!-- verify: ./scripts-run src/scripts/check_memory_contradiction -->
- [ ] Record the decision as an ADR: learned memory carries verification stamps, unverified entries decay through a quarantine ladder, and injection is budget-capped. Rejected alternatives: manual deletion (the unenforced status quo), disabling learned memory outright (discards the value the consolidation tooling was built for), and age-only expiry (age is a proxy; contradiction against the tree is the actual signal). <!-- verify: ./scripts-run src/scripts/adr/regenerate_index -->

**Exit criteria:** every curated entry carries a stamp, the ladder runs on a real store, and one entry has actually moved through demotion.

**Rollback:** stamps are additive metadata; removing the ladder leaves them harmless.

**Kill criteria:** a stale ratio below 10 % in Phase 0 shrinks this phase to stamps only, with the ladder unbuilt and the null published.

## Phase 3 — Skill-top position lint

- [ ] Add a check in the existing lint family asserting that load-bearing obligation blocks sit near the start of each skill file, because post-compaction skill re-injection truncates by keeping the file start. Re-verify the truncation cap against current host documentation at build time — it is a host fact, not a tree fact. Warn level first; escalation to blocking only after one release of data. <!-- verify: ./scripts-run src/scripts/lint_skill_top_position -->

**Exit criteria:** the check runs across the skill set and reports a count without failing the build.

**Rollback:** remove the check registration.

## Phase 4 — Context management for spawned workers

- [ ] Enable the provider's context-management parameters for suite-spawned workers and evaluate the summary-replacement control alongside them. This operates below the existing worker-recycling checkpoints, at the API layer, and does not touch the standing decision against external runtime federation — it is a feature of the provider already in use, not a new runtime. <!-- verify: grep -rq context_management src/scripts/ -->
- [ ] Measure tokens per completed worker task with and without, over the same task set, and adopt only on a measured improvement. Otherwise publish the null. <!-- verify: ./scripts-run src/scripts/check_claims -->

**Exit criteria:** a recorded measurement exists either way.

**Rollback:** the parameters are per-request and removable without migration.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Reinjection re-spends the tokens compaction reclaimed | implementation | An index that grows into payloads turns a fix into a regression. | Twenty-line pointer cap generated at build time, one injection per compaction event rather than per turn, and a measured token delta in the census re-run. | Phase 1 |
| 2 | Eviction deletes a still-valid memory entry | product | An entry that is true but simply not re-verified decays out and the knowledge is lost. | Demotion moves to an inspectable quarantine before deletion; contradiction against the tree, not age alone, drives immediate demotion; thresholds come from the census. | Phase 2 |
| 3 | Host mechanics drift underneath the plan | implementation | Compaction survival rules, re-injection caps, and session-source semantics are host facts that change without notice. | Every census result is stamped with the host version; the skill-top cap is re-verified at build time rather than hardcoded from a document read once. | Phase 0, Phase 3 |
| 4 | The baseline shows no defect to fix | product | Post-compaction compliance turns out to be high and Phase 1 was built on folklore. | The honest-null threshold is pre-registered before the census runs; at or above 90 % across all three probe classes, Phase 1 is not built and the null is published with the host version recorded. | Phase 0 |
| 5 | A new obligation surface grows the estate | product | Fixing context loss by adding rules is self-defeating. | The plan adds one concern, one frontmatter flag, policy on existing machinery, and one lint — zero new rules is the intent, and a rule turning out to be necessary is a finding to surface rather than absorb. | Phase 1 |

## Acceptance Criteria

- [ ] Both Phase 0 censuses exist as written findings with numbers and a recorded host version.
- [ ] Either the reinject concern is bound with a measured positive delta, or the null is published and the concern is absent.
- [ ] Either the curated store carries verification stamps with a working ladder, or the stale-ratio null is published and only stamps ship.
- [ ] No new rule was added by this roadmap, or the one that was is named explicitly with its justification.
- [ ] Every claim in the Context table is re-verified against the executing branch head before its phase runs.

## Provenance

- Source: an external analysis session over this repository, 2026-08-13, pinned at `8a043ec` and re-verified at `6d18f5bb2` for this file. The Context table records which claims survived that re-verification and which did not.
- External evidence is summarized without naming the individual community repositories that demonstrate the reinject pattern; the raw session material with its links stays local and untracked at `agents/tmp.old/road-to-context-fidelity.txt`.
- Council: not convened.
