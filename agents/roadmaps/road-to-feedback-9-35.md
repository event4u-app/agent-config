---
complexity: structural
status: ready
execution:
  mode: autonomous
---

# Road to feedback 9.35 — the verified residue of five external release reviews

> Five external review blocks covering the 9.30.0→9.35.0 span (316 commits,
> five minor releases) were verified claim-by-claim against the live tree. The
> reviews converge hard — four of five name the same three P0s — but the tree
> has moved one full minor release past their head, and the highest-convergence
> items split three ways: one already **materialized as a shipped defect**, two
> are **already planned and blocked on a maintainer decision**, and one
> **contradicts a documented decision** whose rationale still stands. The single
> most valuable finding is not in any of the reviews: the archival sweep buries
> unresolved maintainer blockers, and that burial is what let the shipped defect
> through.

> Source (consumed inbox): [`agents/tmp.old/feedback-9.35.0-1.txt`](../tmp.old/feedback-9.35.0-1.txt)
> — five multi-model release-review blocks, 5 870 lines. Produced by
> `/analyze:inbox`; verification ran against `main` @ `fed7f437e` on 2026-08-12.
> The reviews' own provenance head is `fda1ff20`, 71 commits behind that —
> including the whole of 9.36.0.

## Goal

Close the three defects this span actually created (a machine-dependent test, a
release-highlight head that shipped unrewritten, and an archival sweep that
buries open blockers), correct three figures the reviews are re-deriving wrongly
so the seventh review stops repeating them, and hand every contested or
spend-bearing direction to its named owner as a structured blocker — without
building a single new governance dimension, which this same review set
explicitly forbids for the next one to two releases.

## Prerequisites

- [x] Every actionable review claim verified against the tree (verification
      table in the analysis session; 11 claims labelled, evidence per claim)
- [x] Overlap scan against the 32 active roadmaps (see **Prevented work**)
- [x] Worktree baseline explained: all 32 initial vitest failures were a
      seeding gap (absent build output), green after building the gitignored
      targets only. One genuine red remains and is Phase 1.1.

## Context

- **The reviews are one release stale, and it matters asymmetrically.** Their
  head `fda1ff20` predates 9.36.0. Praise sections are therefore reliable;
  "still open" claims are not, and three of them are wrong at their own SHA.
- **Convergence is not evidence.** Four of five reviews demand a hard block on
  the release-highlight placeholder. That reverses a decision recorded *in the
  gate's own source* whose stated purpose was removing a guaranteed-red build.
  Convergence across five models that read the same tree is correlated, not
  independent — the decision stays the maintainer's (`b-highlights-level`).
- **The reviews' loudest ask is already one authorization away.** The
  solution-minimalism bench ("my longest-open recommendation, third time not
  run") is 25/36 steps done in an active roadmap whose every remaining step
  carries `<!-- blocked-by: benchmark-spend-authorization -->`. Nothing is
  missing but a human's word on the spend.
- **A figure is on its sixth circulation.** `carrier-divergence-109-vs-24.md`
  exists *because* the "109 divergent carrier pairs" figure kept being
  re-derived; it records that the number was wrong by 78 % and that all 109
  pairs carry byte-identical prose. This span's reviews cite it again and set
  the target "divergent carrier pairs = 0" — a target that describes nothing.
- **This roadmap is the fourth feedback-driven roadmap.** Its three predecessors
  (`road-to-feedback-8.11`, `-8.11-2`, `-9-29`) are the only three of 471
  archived roadmaps carrying `Status: open` blockers. That is Phase 1.3, and it
  is the reason this file exists at all.

## Gap-table (verified — full evidence in the analysis session)

| # | Review claim (convergence) | Verdict | Evidence |
|---|---|---|---|
| 1 | Release-head placeholder must not survive merge (4/5, P0) | **still-true — materialized twice in one day** | shipped in the released `## [9.36.0]` head (PR #1297) and again in `## [10.0.0]` (PR #1302, two fields), the second landing on `main` mid-run while this roadmap was being executed |
| 2 | Confirmation token binds too weakly; needs payload/session/scope (4/5, P0) | **partly overtaken** | `staged_confirmation.ts` `StagedAction` already binds the *exact object* — the "delete foo ≠ delete bar" case is closed; actor/session/repo/branch are genuinely absent |
| 3 | Turn-end counts verification presence, not scope match (4/5, P0) | **still-true** | `turn_end_gate_hook.ts`: `DetectorId = 'promissory' \| 'language' \| 'verification'`; `detectUnverifiedEdit` matches commands, not surfaces |
| 4 | solution-minimalism bench 3× not run (1/5, but the strongest-argued) | **still-true, planned, human-blocked** | `road-to-solution-minimalism.md` 25/36; all 10 open steps `blocked-by: benchmark-spend-authorization` |
| 5 | Coverage frozen at 12,9 % (15/116); "the 84 baseline rules are unchanged 84" | **ratio claim true, companion figure never-true** | `internal/reports/enforcement-coverage.json`: blocking 15, `summary.total` 114 (resolver scope — it excludes the two pack rules), undeclared 86. 15/116 governed = 12,9 % — the reviews' headline is right; the "84 unchanged" half matches neither frame. Two denominators, and 3.2 now says so where a reviewer lands |
| 6 | "Bring divergent carrier pairs to 0" (1/5, P0) | **never-true framing** | `carrier-divergence-109-vs-24.md`: 109 pairs prose-identical; only 24 disagree on `paths:` |
| 7 | rich-band + imperative-density contradictions unmoved a 3rd time | **rich-band never-true at their own SHA** | `ADR-217` accepted 2026-08-06 — six days before head `fda1ff20`, outside the window |
| 8 | `confirmation inspect`, `verification explain`, `sessions conflicts`, unified `pending` are missing (3/5, P1) | **still-true** | registry carries only `sessions:claim`, `sessions:list` |
| 9 | Runtime state machine should be codified (1/5, P0) | **absent, and contested** | no `RuntimeState` in `src/`; the same review set forbids new governance dimensions — `b-runtime-state-machine` |
| 10 | Cadence: back to 20–40 commits per release (3/5) | **out of scope** | a process preference, not a tree change; no artefact to carry it |
| 11 | *Not from the reviews:* archival buries open blockers | **new, verified** | `archive_completed_roadmaps.ts` gates on `open_ !== 0 \|\| deferred !== 0` only |

## Phase 1 — The three defects this span actually created

- [x] **1.1 A test reads the developer's machine.** `tests/scripts/council_cli.test.ts`
      asserts `council:quota · no providers have a configured cap` and receives
      `anthropic · 40/50` on any machine whose user-global `.ai-council.yml`
      carries a cap. The assertion depends on the developer's real council
      config, so it is green only where that config is absent (CI). Isolate the
      case against a fixture or an explicit config override so the expectation
      is a property of the test, not of the host.

- [x] **1.2 Curate the 9.36.0 highlight head that shipped unrewritten.**
      `CHANGELOG.md:347` carries `_auto-derived, rewrite before merge:_` inside
      the released `## [9.36.0]` section, together with the
      `<!-- Curated head: fill before merge -->` comment. Rewrite the
      Behaviour-changes line from the evidence the generator already cites
      (`9f69017`, `924cad8`, `3c20d47`, `72bb1bc`) — this is the editorial fix,
      not the mechanism question, which is `b-highlights-level`.

- [x] **1.3 Archival must not bury an open blocker.** `archive_completed_roadmaps.ts`
      refuses archival only for `open_ !== 0 || deferred !== 0`. A roadmap whose
      steps are all closed but which still carries a `Status: open` blocker
      archives silently — the exact path by which `b-highlights-mechanism` left
      the active tree unanswered in the 9.29 roadmap, four releases before the
      failure it predicted shipped. Extend the guard so an open blocker is a
      refusal-or-surface condition, the same discipline
      `roadmap-progress-sync` Iron Law 3 already applies to `[~]` steps.

- [x] **1.4 Re-surface the already-buried blockers.** Exactly three of 471
      archived roadmaps carry an open blocker: `road-to-feedback-8.11`,
      `road-to-feedback-8.11-2`, `road-to-feedback-9-29` — six decisions in
      total. Enumerated in
      [`buried-roadmap-blockers`](../settings/contexts/buried-roadmap-blockers.md),
      a durable context rather than this roadmap's `## Blockers`: copying six
      foreign decisions into this file would make 1.3's own guard refuse to
      archive it until strangers' questions are answered, which is Risk 1
      firing on the change that introduced it. Two of the six use a legacy
      single-line blocker form the parser cannot see, so the guard would not
      have held those roadmaps — recorded there, not silently implied.

## Phase 2 — Honour the documented intent (no decision reversed)

- [x] **2.1 Threat-model the confirmation store before touching its bindings.**
      Output: [`staged-confirmation-threat-model`](../evidence/analysis/staged-confirmation-threat-model.md).
      Headline correction for the roadmap's own gap-table: the payload-hash P0
      that four of five reviews demand is **already closed by construction** —
      the token is `sha256(action ∥ NUL ∥ object ∥ NUL ∥ nonce)`, so a different
      object is a different token. The real gap is one axis over: the record
      binds *what*, and nothing about *who* or *where*. Five abuse cases, no 🔴
      (there is no remote entry point; the local filesystem is named as an
      accepted trust boundary rather than mitigated away).
      Three reviews independently observe that staged confirmation is no longer
      a work-engine feature but an authorization system, and ask for the
      properties one implies (replay protection, expiry, scope binding, audit
      trail, invalidation). `security-sensitive-stop` requires the threat pass
      *before* the first edit, so this step produces the analysis, not the
      change: run `threat-modeling` against `staged_confirmation.ts` +
      `staged_confirmation_store.ts`, record abuse cases and the required
      negative tests as an evidence artefact, and name the binding set the
      policy already implies. The implementation lands against that output, in
      its own change — half a binding on an authorization boundary is worse
      than none.

- [x] **2.2 Record the claim-transfer question the threat pass must answer.**
      Captured as the second abuse case in 2.1's output, with its own required
      negative test. The sharper finding sits beside it: `listPending` publishes
      every pending token and `gates --pending` renders them, so the token is an
      enumerable *identifier* being used as the sole *capability* — which is why
      a session binding is the control, not a longer token.
      One review names a concrete sequence nothing in the tree decides: session
      A claims a roadmap, stages a confirmed action, dies; session B takes the
      claim; the pending confirmation still exists. `StagedAction` binds no
      actor and no session, so today the token survives the handover. Capture
      this as a named abuse case in 2.1's output rather than a separate
      investigation.

## Phase 3 — Corrections to the record (cheap, and they stop re-derivation)

- [x] **3.1 The carrier figure, sixth circulation.**
      `agents/settings/contexts/carrier-divergence-109-vs-24.md` says the
      109-as-debt figure "circulated through five independent release reviews".
      This span is the sixth, and it added a target the correction does not yet
      rebut in so many words: "divergent carrier pairs = 0". Update the count
      and add the one sentence that closes the framing — 109 prose-identical
      pairs have nothing to converge; the actionable number is 24, and it is
      blocked on `carrier-install-paths-decision`.

- [x] **3.2 Publish the live enforcement-coverage figures where a reviewer
      lands.** Landed in `docs/CLAIMS.md` § `enforcement-coverage-resolved`, the
      place a reviewer actually reads, with `docs/proof.md` regenerated.
      **The pass corrected itself here:** the first edit wrote "15 of 114
      (13,2 %)" and claimed the total had moved 116→114. `task sync` rejected the
      114 — and it was right. 116 is the governed-rule count; 114 is only the
      coverage resolver's scope, which deliberately excludes the two scale/history
      pack rules the claim already explains. Same 15 rules, two denominators. So
      the reviews' 12,9 % headline was accurate and the correction was mine to
      make; what does not hold in either frame is their "84 baseline rules
      unchanged" (live: `undeclared` 86 in-scope, 88 in the 116-frame), and
      `blocking` did move, 14 → 15.

- [x] **3.3 Close the rich-band contradiction in the record.** The place it was
      still listed open is `skill-ecosystem-sweep-2026-08.md` § R1, whose
      disposition ("measure real tokenisation first, then put the band question
      to the maintainer") `ADR-217` discharged on 2026-08-06 — unmarked, which is
      why two reviews read it as unmoved a third time. Marked discharged there,
      with the ADR's actual result (band 2,000–3,500, ceiling gated, floor
      deliberately ungated). § R2 (imperative density) is left open: the reviews
      were right about that half. Two reviews list
      it as unmoved for the third time. `ADR-217` accepted it on 2026-08-06,
      six days before their own verification head. Add the pointer wherever the
      contradiction is still listed as open, so it stops being reported.

## Phase 4 — Route the evidence to the decision that already exists

- [x] **4.1 Add the shipped-evidence line to `release-head-cadence-decision`.**
      The enforcement level for a derived highlight head is **not** this
      roadmap's to decide, and not this roadmap's to re-ask: it is already an
      open blocker on an active roadmap —
      `road-to-inbox-harvest-2026-08-b-release-integrity.md`, blocking its step
      1.4 (`[-]`, "flip the placeholder check to blocking"), owner maintainer,
      with the two mutually exclusive options already named. What that blocker
      does **not** carry is the one fact this span produced: the placeholder
      stopped being hypothetical. Append it — the marker shipped into the
      released `## [9.36.0]` head (`CHANGELOG.md:347`, PR #1297, 2026-08-12),
      four of five independent reviews of the 9.30→9.35 span predicted exactly
      that, and the earlier mechanism blocker was archived unanswered in
      between. Evidence only; the (a)/(b) choice stays the maintainer's, and the
      recorded no-guaranteed-red rationale in `check_release_highlights.ts`
      stays quoted as the counter-argument it is.

## Prevented work (verified — do not rebuild here)

| Review ask | Where it already lives |
|---|---|
| Hard-block the release-highlight placeholder (4/5 reviews, P0) | `road-to-inbox-harvest-2026-08-b-release-integrity.md` step 1.4 + blocker `release-head-cadence-decision` (owner: maintainer), with both options already named. Phase 4.1 adds this span's evidence there; Phase 1.2 fixes the shipped head. No fourth copy of the question |
| Run the solution-minimalism bench | `road-to-solution-minimalism.md`, 25/36 done, every open step `blocked-by: benchmark-spend-authorization` |
| Carrier divergence → resolve the `paths:` disagreements | `road-to-carrier-layer-convergence.md` Phase 3, blocked on `carrier-install-paths-decision` (owner: maintainer) |
| Reduce the active skill/rule surface by 10–20 % | `road-to-tier-removal.md`, `road-to-surface-consolidation.md` |
| Skill invocation attestation | `road-to-skill-description-measurement.md`; `report_skill_activation.ts` already ships the measurement half |
| Runtime event bus · unified `pending` queue · `sessions conflicts` · `confirmation inspect` · `verification explain` · council integrity dashboard | New surface. The same review set forbids new governance dimensions for one to two releases; each is a blocker below, not a step |
| Extend session claims to file/scope claims | Contested *within* the source: one review makes it P0, another makes "freeze the claim system" P0. `b-claim-scope` |
| Return to a 20–40-commit cadence | Process preference with no artefact to carry it; recorded here and nowhere else |

## Risk Register

| # | Risk | Type | Severity | Mitigation | Owner |
|---|---|---|---|---|---|
| 1 | Phase 1.3's guard turns every roadmap with a long-lived maintainer blocker into an unarchivable roadmap, and the active tree grows instead of the decisions getting made | implementation | med | Surface-and-require-acknowledgement rather than hard-refuse; the 1.4 enumeration measures how many roadmaps the guard would actually hold before the shape is chosen | maintainer |
| 2 | 2.1's threat pass produces a binding set large enough to be its own release, and the confirmation store ships half-bound in the meantime | implementation | high | The step deliberately produces analysis only; no binding field is added in this roadmap. The store's current state is unchanged, not partially changed | maintainer |
| 3 | Phase 3 is read as agreeing that the reviews were careless, and the next review is discounted wholesale | product | low | Each correction states what was *right* about the claim (the frozen coverage level is real; the carrier `paths:` gap is real) before correcting the figure | maintainer |
| 4 | 4.1's evidence line reads as advocacy for the block, and the recorded no-guaranteed-red rationale loses by omission | product | med | The appended line states the fact (it shipped) and quotes the existing rationale as the standing counter-argument; the (a)/(b) choice is left verbatim as the blocker already words it | maintainer |
| 5 | The 9.36.0 head is curated (1.2) and the mechanism question then feels settled, so `release-head-cadence-decision` is archived unanswered a second time | implementation | med | 1.3's guard is what prevents exactly this, and it now protects the roadmap that actually owns the blocker; 1.2 and 4.1 are deliberately separate so the editorial fix cannot close the mechanism question | maintainer |

## Blockers

The release-head enforcement level is deliberately **not** a blocker here — it is
already `release-head-cadence-decision` on
`road-to-inbox-harvest-2026-08-b-release-integrity.md`. Phase 4.1 adds this
span's evidence to that blocker instead of opening a fourth copy of the same
question.

### blocker: b-benchmark-spend
- **Status:** open
- **Owner:** user
- **Blocks:** nothing here — every open step of `road-to-solution-minimalism.md`
- **What to do:** authorize (or decline) the paid frozen-corpus run. The reviews'
  single most-argued recommendation across five blocks is this run, and the arms
  have been built, tested and pre-registered since 9.29. A spend-bearing run is
  never autonomous.
- **Resolved when:** the user authorizes or declines.

### blocker: b-claim-scope
- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing here
- **What to do:** the source contradicts itself — one block makes file/scope
  claims P0 for real multi-agent work, another makes "freeze the claim system,
  collect collision/stale/false-collision telemetry first" P0. Both cannot be
  next. Decide which, or decide that neither is.
- **Resolved when:** recorded in the claim system's own contract or an ADR.

### blocker: b-runtime-state-machine
- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing here
- **What to do:** one review makes an explicit runtime state machine (with
  transition invariants over confirmation, claims, recycling and verification)
  its top P0, on the argument that it *consolidates* guards that already exist.
  Three other blocks in the same file forbid any new governance dimension for
  one to two releases. Whether consolidation counts as new surface is the
  decision.
- **Resolved when:** an ADR records either the state-machine scope or the
  deferral.

### blocker: b-coverage-floor
- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing here (3.2 publishes the figures either way)
- **What to do:** enforcement coverage has held at ~13 % for five releases; the
  ratchet prevents regression and does not raise the level. Decide whether a
  per-release floor that must *rise* (N of the 86 undeclared rules bound to a
  real backstop) becomes policy, and what N is.
- **Resolved when:** the ratchet's contract records a rising floor, or records
  that it deliberately does not have one.
