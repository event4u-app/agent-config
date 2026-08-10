<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: autonomous
parent_roadmap: road-to-feedback-9-29
---

# Road to carrier-layer convergence — 109 rules arrive twice, none identical

> The delivered-payload measurement found 109 rules present in BOTH carrier
> layers with **zero byte-identical duplicates — all 109 divergent**. That is two
> defects wearing one number: the largest immediately-removable share of the
> standing-delivery floor, and a correctness hole, because when two copies of a
> rule differ there is no defined answer to which text binds.

> Source: the loaded-token measurement in
> [`agents/evidence/analysis/loaded-rule-token-distribution.md`](../evidence/analysis/loaded-rule-token-distribution.md),
> produced by the parent roadmap and deliberately routed out of its blockers:
> the parent treated it as evidence-deciding-nothing, which is right for a diet
> verdict and wrong for a delivery defect.

> **CORRECTION, 2026-08-10 — half the premise above is false, and Phase 1 is what
> falsified it.** All 109 pairs carry **byte-identical prose**; the entire
> difference is the frontmatter block, which the host does not deliver. So there
> is no correctness hole: no governed text differs, nothing is
> binding-ambiguous, and no claim one copy retracts can be re-asserted by the
> other. The duplication is real and the ambiguity is not. The defect that WAS
> real sat in the instrument — a metadata-only difference was reported as body
> divergence, i.e. as the one class the report tells a reader to act on — and it
> is repaired under Phase 2. Classification, the cited precedence answer, and the
> explanation of why two earlier readings of one commit disagreed:
> [`agents/evidence/analysis/carrier-layer-divergence-classification.md`](../evidence/analysis/carrier-layer-divergence-classification.md).
> The original claim is kept above rather than rewritten, so the trail from
> premise to falsification stays readable.

## Goal

Converge the two rule-carrier layers so a session receives each governed rule
exactly once, with a defined binding text — measured as: overlap count 0 (or a
stated, reasoned remainder), `check_standing_rule_delivery` under its cap on a
maintainer machine, and no obligation lost in the process.

## Prerequisites

- [x] The divergence is measured, not assumed (109 shared / 0 duplicate / 109
      divergent, two instruments, recorded with their proxies)

## Context

- **Suppression alone is unsafe here, and the doctor already says so.** The
  `install --layer` path suppresses one layer without deleting it — correct for
  byte-identical copies, wrong for divergent ones: suppressing a copy drops
  whatever obligations only that copy carried. The savings line carries this
  caveat for exactly this reason.
- So the order is **converge, then deduplicate**. The global layer is a release
  snapshot; the project layer is generated from `src/` at the current commit and
  wins on precedence. A refresh makes the copies identical; only then is
  suppression a no-op on content.
- The 109 is not a token-diet line item. It is the answer to "which text binds
  when two differ", which is the question behind every report of an instruction
  being followed inconsistently.

## Phase 1 — Establish which layer is stale, per rule

- [x] For each of the 109 divergent rules, classify the divergence: the global
      copy is an older release of the same rule (refresh closes it), the project
      copy is generated differently (the generator is the fix), or the two carry
      genuinely different obligations (a content decision, and the interesting
      case). Report counts per class — a single mixed bucket is not a finding. <!-- verify: report lists all 109 with a class and the per-class totals -->
      <!-- DONE 2026-08-10, commit a5b2f4cb7, freshly regenerated checkout.
      Totals: refresh-closes-it 0 · generator-difference 109 ·
      genuinely-different-obligation 0. All 109 listed flat (one class) in
      carrier-layer-divergence-classification.md. All 109 carry byte-identical
      prose; the whole difference is the frontmatter block. -->
- [x] Name the precedence rule the host actually applies when both layers carry
      a rule of the same basename, from the host's own documentation or an
      observed load, never from inference — if it is unobservable, say so and
      treat every divergence as binding-undefined. <!-- verify: the precedence answer cites a doc section or an InstructionsLoaded observation -->
      <!-- DONE 2026-08-10. Answer: the host applies NO precedence — rules
      without a `paths` key load at launch with the same priority as CLAUDE.md,
      no marker between the layers, so binding is UNDEFINED whenever the two
      disagree. Cited to claude-code-rules-dir-contract.md (host 2.1.226: the
      host's own docs plus a first-party observation), never inferred. Two
      instruments were printing the opposite ("the project projection … and
      wins"); both corrected under Phase 2. -->

Exit criteria: every one of the 109 carries a class; the precedence question has
a cited answer or an explicit unobservable verdict.
Rollback: report-only phase, nothing to revert.

## Phase 2 — Converge

- [-] Refresh the stale side for every rule in the refresh-closes-it class, so
      the two copies become byte-identical. <!-- verify: report_carrier_divergence shows those rules as duplicate rather than divergent -->
      <!-- SKIPPED 2026-08-10 — the class is measured EMPTY (0 of 109). No global
      copy carries superseded prose, so there is no stale side to refresh. An
      empty class is a real answer, not an unfinished step. -->
- [-] For the generator-difference class, fix the generator so the projection is
      reproducible rather than patching the output. <!-- verify: task sync + generate-tools leaves no drift for those rules -->
      <!-- SKIPPED 2026-08-10 — the step's own verification PASSES with no change:
      `task sync` + `task generate-tools` at a5b2f4cb7 leaves a clean tree, so the
      projection is already reproducible and there is no generator defect to fix.
      The 109 are a deliberate two-writer policy difference — `generate-tools`
      emits only `paths:` because the host reads nothing else from the block;
      `install.ts` writes the full vocabulary plus its ownership stamp because
      agent-config's own tooling needs it. Making them byte-identical would mean
      either shipping payload the host ignores or dropping metadata the installer
      needs, so convergence-by-alignment is the wrong target here. The defect the
      classification actually surfaced was in the instrument — see the step
      below. -->
- [-] For any genuinely-different-obligation rule, surface it as a decision
      rather than picking a side — this is the class where a silent choice loses
      a governed obligation. <!-- verify: each such rule is listed with both texts and no edit applied -->
      <!-- SKIPPED 2026-08-10 — the class is measured EMPTY (0 of 109). No pair
      carries different obligations, so there is nothing to surface and no side
      to avoid picking. This is the class the phase called "the interesting
      case"; it is empty, and that is the finding. -->
- [x] **Added 2026-08-10, and the only convergence work that landed.** Repair the
      instrument that reported a metadata-only difference as body divergence —
      i.e. as the one class the report tells a reader to act on — and the
      precedence claim both surfaces were printing. <!-- verify: report_carrier_divergence prints `differ in PROSE 0` + `differ ONLY in frontmatter 109`, states binding is UNDEFINED, and no surface claims the newer copy "wins"; pinned by tests -->
      <!-- DONE: `proseEqual` + `stripFrontmatter` in _lib/carrier_divergence.ts
      (deliberately NOT folded into `comparePair`, which stays byte-identity so
      the dedup predicate is untouched); a fourth `frontmatter-only` class in
      report_carrier_divergence; the same split and the corrected precedence
      prose in report_conformance_funnel. Two existing tests pinned the false
      "and wins" claim and were inverted with the citation in the test body. -->

Exit criteria: `report_carrier_divergence` reports 0 divergent, or a stated
remainder whose every member is a surfaced decision.
<!-- MET 2026-08-10, in the terms the measurement forced: 0 PROSE-divergent, with
a stated remainder of 109 frontmatter-only pairs whose cause is named in the
report itself and which require no decision, because no governed text differs. -->
Rollback: the refresh is regeneration from tracked sources, so revert is
regeneration at the previous commit.

## Phase 3 — Deduplicate, and prove the saving

> **Its safety precondition is discharged ahead of its measurement (2026-08-10).**
> The phase order exists because suppressing a *divergent* copy drops whatever
> obligations only that copy carried. Phase 1 measured the prose identical across
> all 109, so suppression is already a no-op on content — the thing Phase 2 was
> meant to establish. Only the before/after reading is still owed, and that needs
> the maintainer machine, so the blocker stands unchanged.

- [ ] With the layers converged, apply the single-layer suppression and record
      the delivered-token reading before and after on the same machine and the
      same commit. <!-- verify: check_standing_rule_delivery under cap, with the before/after pair recorded -->
- [ ] Re-measure `report_carrier_divergence` afterwards to confirm suppression
      removed a duplicate rather than an obligation. <!-- verify: rule count per layer unchanged in content terms; no rule absent from the surviving layer -->

Exit criteria: the gate is green on the maintainer machine with both readings
recorded at a named commit.
Rollback: `install --layer` is suppression, not deletion — re-enabling the
suppressed layer restores the prior state.

## Blockers

### blocker: b-convergence-machine
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 only (Phases 1-2 are repo work)
- **What to do:** Phase 3's before/after pair needs the maintainer machine,
  since the two-layer topology is a property of the install rather than of the
  repo. Run the reading, apply `install --layer`, run it again.
- **Resolved when:** both readings exist at a named commit.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Suppressing before converging | implementation | Suppressing a divergent copy drops whatever obligations only that copy carried — a silent loss of governed text, which is worse than the duplication it removes | The phase order IS the mitigation: Phase 3 is gated on Phase 2's zero-divergent exit, and the doctor's own savings line already carries the refresh caveat | Phase 3 — Deduplicate, and prove the saving |
| 2 | A genuinely-different obligation resolved by picking the newer copy | product | The interesting class is exactly where two texts disagree on what is required; choosing silently is a governance decision made by whoever ran the script | That class is surface-only by construction — the step forbids an edit and requires both texts side by side | Phase 2 — Converge |
| 3 | The precedence answer is inferred rather than observed | implementation | The whole plan rests on which copy binds; an inferred answer would make every later step rest on a guess | Phase 1 step 2 requires a cited doc section or an observed load, and admits "unobservable" as a legal verdict that reclassifies all 109 as binding-undefined | Phase 1 — Establish which layer is stale, per rule |
| 4 | The before/after pair measured across a moving tree | implementation | The project carrier is generated from `src/`, so two readings at different commits differ for reasons unrelated to deduplication and would read as a saving that is not one | Same machine, same commit, both readings recorded — the pin-your-SHA lesson the parent roadmap's own report had to learn twice | Phase 3 — Deduplicate, and prove the saving |
| 5 | Convergence closes, then re-opens on the next release | product | The global layer is a release snapshot; refreshing it today says nothing about the next one, so the 109 could simply return | Out of scope here and named rather than hidden: a standing fix belongs to the install/release path, and this roadmap's exit criteria are point-in-time by design | Acceptance criteria |

**Risk 3 materialized, and was the real defect (2026-08-10).** It warned that an
*inferred* precedence answer would leave every later step resting on a guess.
That is exactly what had already happened: two shipped surfaces printed "the
project projection … and wins", which no host behaviour supports, and two tests
pinned it. Rank 1 and Rank 2 did not materialize — both depended on a divergence
class the measurement found empty.

## Acceptance criteria

- **MET** — All 109 divergent rules are classified, with per-class totals
  (0 refresh-closes-it · 109 generator-difference · 0 genuinely-different-obligation).
- **MET** — Divergence reaches 0, or every remaining member is a surfaced decision:
  0 prose-divergent, remainder 109 frontmatter-only with its cause stated in the
  report and no decision owed, because no governed text differs.
- **OPEN** — The delivered-token before/after pair is recorded at one commit on one
  machine. Blocked on `b-convergence-machine`; its safety precondition is now
  discharged (see Phase 3).
- **OPEN** — No rule present before convergence is absent after deduplication.
  Blocked with the reading above.
- **Added, MET** — No surface claims a precedence the host does not implement. Both
  carrier surfaces now state that binding is undefined when prose diverges, and
  that the project copy's recency is not precedence.
