---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
entry_condition:
  what: road-to-findings-that-show-their-exhibits is archived (typed exhibits, check_finding_exhibits, the precision report and the flip metric exist), and OQ-24 is answered for the Phase 4 runs
  when: after that roadmap closes; Phases 1 and 2 need no answer and can start then
  who: an implementer for Phases 1-3; the owner for the Phase 4 spend; the AI council for decisions C1-C3
review_by: 2027-01-31
estate_offset_exempt: "Parked under later/ in the same change that adds its active sibling road-to-findings-that-show-their-exhibits; later/ is excluded from the dashboard and from /roadmap:process-*, so it adds no active roadmap. Owner search over the estate for findingId, review-findings.schema, exhibit and admissib found no owner."
estate_growth_exempt: "open_blockers +1: court-measurement-spend is a new owner-reserved spend decision this round created (OQ-24); it is not a duplicate of any open blocker. later_roadmaps +1 is this file."
relates:
  - slug: road-to-findings-that-show-their-exhibits
    relation: depends
    note: "Every phase here consumes that file's exhibits, checker or metrics."
  - slug: road-to-a-learner-the-measurements-gate
    relation: disjoint
    note: "later/. Owns running council-vs-solo-baseline; this round's arm-C amendment landed there as step 1.2a, not here."
depends:
  - road-to-findings-that-show-their-exhibits
---
# Road to a court at the stops

> **Source:** `agents/tmp.old/inbox-2026-10-bd/t01/` — the adversarial-court
> proposal's steps that need a gate decision, a ratification or spend. The
> owner's second question in that transcript — does the court run at planning,
> roadmap and review automatically, or in between — is answered here: it
> attaches to the stops the tree already has, only the free tier is automatic,
> and the paid tier is offered on a risk trigger, never on a cadence.

## Goal

The deterministic exhibit check runs automatically at the three moments the
tree already stops (plan, roadmap, review); a fresh-subagent prosecutor runs
where a fresh reviewer already runs; a paid cross-vendor court is offered only
on a named risk trigger; and `/council court` exists as an opt-in sub-command,
labelled unmeasured until the precision claim passes.

## Decisions (council-decidable)

| C | Question | Recommendation from the source |
|---|---|---|
| C1 | Is the exhibit check blocking at roadmap citations (1.3) and R2 locations (1.4)? | Blocking — a dead citation is a fact. Plan exhibits (1.1) advisory until 4.2 resolves. |
| C2 | Does a seat from the implementer's model family count toward `required_providers`? | Record, do not enforce; enforcing deadlocks the two-vendor council. |
| C3 | Does `/council court` exist before 4.2 resolves? | Yes, opt-in and labelled unmeasured. |

## Phase 1 — Free tier at the stops that exist

- [ ] **1.1 Planning.** A plan's claim that a module exists or is missing is
      written as a `presence`/`absence` exhibit in a fenced `exhibits` block,
      and the plan-confidence gate runs `check_finding_exhibits` before the
      plan is saved. The R1 table keeps its six columns.
      verify: a fixture plan claiming a missing module that exists reports
      `inadmissible` before save.
- [ ] **1.2 Planning prosecutor.** On the substantial-change trigger, R1 gets
      one fresh-subagent prosecutor pass, recorded as `same-family`, never as
      independent.
      verify: a substantial fixture plan records one pass; a typo edit records
      none.
- [ ] **1.3 Roadmap citations.** Extend the citation check from blocker
      sections to every backticked `path:line` in active roadmaps, ratcheted
      like `lint_blocker_citations`.
      verify: a fixture roadmap with a line beyond EOF is reported.
- [ ] **1.4 R2 locations.** `check_completion_review` resolves each
      `File:Line` against the reviewed head and reports `inadmissible-location`.
      verify: a fixture review with a dead path reports it.
- [ ] **1.5 Risk triggers only.** The paid tier is offered when a plan crosses
      the substantial-change trigger at judgment rung 4, the change expands
      authority, or an R2 critical finding is disputed. Never per turn, never
      per PR.
      verify: one fixture per trigger; a session with none emits nothing.

## Phase 2 — Producers write exhibits

- [ ] **2.1** One exhibit paragraph in the self-review system prompt and the
      `judge-bug-hunter` and `adversarial-review` output contracts.
      verify: the review-schema fixtures pass with exhibits present.
- [ ] **2.2** `check_finding_dispositions` accepts `false_positive` with
      `rationale: inadmissible-exhibit` only when every exhibit is
      inadmissible, and never from the finding's producer.
      verify: gate test plus a producer-is-not-verifier check.
- [ ] **2.3** A release adds no new blocking class while its undisposed share
      is above a shrink-only bound starting at today's share.
      verify: fixtures at bound−1 and bound+1.

## Phase 3 — Paid runs keep their findings

- [ ] **3.1** `bench_adversarial_council` stores the full finding objects next
      to the counts, keyed by corpus hash, prompt version and model id.
      verify: a stored run re-scores offline without a model call.
- [ ] **3.2** Shadow the debate stop: run `argument_exhaustion` after each
      round and log would-stop; behaviour unchanged. Promotion belongs to the
      existing early-stop pre-registration.
      verify: log lines on a mock debate, rounds unchanged.

## Phase 4 — Measure before anything blocks

- [ ] **4.1** Corpus `release-findings-v1` from adjudicated rows only
      (`fixed` at the fix parent, `false_positive` at the release tag), its
      single-producer bias declared in `_meta`. <!-- blocked-by: court-measurement-spend -->
      verify: deterministic generator; row count matches the precision report.
- [ ] **4.2** Pre-register and run claim `exhibit-precision-lift`: precision up
      ≥ 10 pp with fixed-recall loss ≤ 5 pp, else an honest null and admissibility
      stays a label. <!-- blocked-by: court-measurement-spend -->
      verify: the claim is dated in `docs/CLAIMS.md` before the first run commit.

## Phase 5 — The verdict that binds, and the door

- [ ] **5.1** Proposal, ratified like any gated edit: a ratification seat that
      refuses carries an admissible exhibit, else it shows as
      `refused-without-exhibit`; `implemented_family` is recorded, per C2.
      verify: lands only with its own ratification artifact.
- [ ] **5.2** `/council court` as a sub-command of `/council`: independent
      first pass, author as defence with ACCEPT/REJECT/COMPROMISE (REJECT
      carries an exhibit), one cross-examination round on disputed exhibits,
      the owner as judge. No new verb, no new verdict label; courtroom words
      stay inside prompts. Default-on only behind 4.2 passing.
      verify: command doc plus a dry-run fixture; grep against the closed
      verdict vocabularies finds no new label.

## Blockers

### blocker: court-measurement-spend

- **Status:** open — raised 2026-10-27 by the inbox round that planned Phase 4.
- **Owner:** the owner (`agents/owner-questions.md` OQ-24) — spend is owner-reserved.
- **Blocks:** 4.1 and 4.2, and through 4.2 the default-on half of 5.2.
- **What to do:** pick exactly one — (a) fund one run per arm on the ledger corpus with one producer, estimate printed by `./scripts-run src/scripts/bench_adversarial_council --estimate` before any call; or (b) decline, and admissibility stays a label permanently.
- **Resolved when:** OQ-24 moves to `## Answered` in `agents/owner-questions.md`.
- **Recommendation:** (a), after Phase 3.1, so the paid run's findings can be re-asked later without paying again.
- **If you do nothing:** exhibits are recorded and checked but never filter anything; that is a valid end state.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A court on every turn | product | The free tier grows a cadence and starts nagging. | 1.5 offers the paid tier only on named triggers, with a silent-session fixture. | Phase 1 — Free tier at the stops that exist |
| 2 | The door read as a measured gain | product | `/council court` ships and is cited as an improvement. | 5.2 labels it unmeasured; default-on reads the claim status. | Phase 5 — The verdict that binds, and the door |

## Acceptance Criteria

- [ ] AC-1 — Plan, roadmap and review stops run the exhibit check automatically.
- [ ] AC-2 — The paid tier is offered only on its triggers.
- [ ] AC-4 — Admissibility filters only after `exhibit-precision-lift` passes. <!-- blocked-by: court-measurement-spend -->
- [ ] AC-3 — `/council court` adds no verb and no verdict label.
