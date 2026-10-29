---
complexity: structural
status: done
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search: grep -rliE 'reconstruct|recreat|obligation.ledger|parity registry|authority.*coverage' over agents/roadmaps (active, later/, stubs/, archive/) and docs/decisions; the only related owner, road-to-an-analysis-family-that-deepens-itself, is archived and cannot take a step. Opened active because the operator's invocation asked for this round's roadmaps to be processed in the same run (inbox-2026-10-bj); closed and archived in the PR that opens it."
relates:
  - slug: road-to-an-analysis-family-that-deepens-itself
    relation: extends
    note: "Archived parent of the analysis doors (ADR-288). This adds authority/coverage to its evidence and a transfer mode that closes against an obligation ledger."
---
# Road to transfers that close on evidence

> **Source:** `agents/tmp.old/inbox-2026-10-bj/` (t1 and t2) — two external
> references: a reverse-engineering toolkit and a family of clean-room app
> reconstructions. Mechanisms adopted below are own analysis of those sources,
> recorded once under `provenance/harvests.jsonl`; no source is named here.

## Goal

The owner asked for analyses that do not stop at AC: "analyse a package, rebuild
an app or a feature from it, integrate it — into any project". After this
roadmap, the reference door can be run with a **transfer mode**
(`learn | adapt | rebuild | integrate`) against any destination project; an
`adapt` or `rebuild` result closes only against an **obligation ledger** whose
rows carry evidence of the right authority, and "visible in the UI" is never
recorded as "verified". Evidence in the analysis ledger says where it came from
(authority) and how complete the search was (coverage), so "not found" is never
silently "does not exist".

## Phase 1 — Evidence carries authority and coverage

- [x] **1.1 Authority axis.** `Evidence` in `src/scripts/analysis_ledger.ts`
      gains an optional `authority` (`upstream-artifact | controlled-replay |
      own-tree | external-claim | analyst-inference`), separate from `tier`.
      verify: `npx vitest run tests/scripts/analysis_ledger.test.ts` -> exit 0
- [x] **1.2 Coverage axis.** `Evidence` gains an optional `coverage`
      (`complete | partial | unknown`); a helper renders an absence finding as
      `unknown` unless its coverage is `complete`.
      verify: `npx vitest run tests/scripts/analysis_ledger.test.ts` -> exit 0
- [x] **1.3 Vocabulary.** `analysis-loop.md` names both axes and states they are
      not the `evidence_basis` taxonomy (that one grades numbers).
      verify: `grep -c 'coverage' src/agent-src/contexts/execution/analysis-loop.md` -> /^[1-9]/

## Phase 2 — The obligation ledger

- [x] **2.1 Contract.** `docs/contracts/reconstruction-obligations.md` defines an
      obligation (behaviour, evidence ids, required cases, verifier, verifier
      authority, status), the equivalence tiers (inspired-by, UX, behaviour,
      protocol, byte), the statuses (`open | visible-only | verified | waived`),
      and the non-goals (no proprietary code or assets, no access-control
      circumvention — the `code-provenance` rule already binds).
      verify: `grep -c 'visible-only' docs/contracts/reconstruction-obligations.md` -> /^[1-9]/
- [x] **2.2 Validator.** `src/scripts/_lib/reconstruction_ledger.ts` closes an
      obligation only when every required case has evidence and the verifier's
      authority is not `analyst-inference`; an empty ledger reads `unknown`; a
      parity score counts only `verified`.
      verify: `npx vitest run tests/scripts/reconstruction_ledger.test.ts` -> exit 0

## Phase 3 — Transfer modes on the reference door

- [x] **3.1 Transfer modes.** `analyze/reference/command.md` gets
      § Transfer modes: `--transfer learn|adapt|rebuild|integrate` (named so it
      does not collide with the free-text `--goal`); for `adapt` and `rebuild`
      a behaviour spec comes first, the destination is the run's local scope —
      any project, not only AC — and the result closes against the ledger.
      verify: `grep -c -- '--transfer' src/domains/analysis-workbench/analyze/reference/command.md` -> /^[1-9]/
- [x] **3.2 Provenance link.** `code-provenance` points to the ledger for a
      conscious rebuild.
      verify: `grep -c 'reconstruction-obligations' src/rules/code-provenance.md` -> /^[1-9]/
- [x] **3.3 Provenance row.** `provenance/harvests.jsonl` records the adopted
      mechanisms under an opaque source id.
      verify: `npx tsx src/scripts/lint_harvest_provenance.ts` -> exit 0

## Stubs (need a window, network or the owner)

- Delta re-analysis of a pinned source (`--since-pin`) — network-bound.
- Optional external observation providers (runtime, browser, binary) — owner
  decision, `agents/owner-questions.md`.
- Oracle corpora and a differential harness for a real reconstruction.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The ledger becomes a checklist nobody fills | product | A transfer mode that can be skipped is a label | The door's `adapt`/`rebuild` text makes the ledger the closing condition, and the validator is the closing check | Phase 3 — Transfer modes on the reference door |
| 2 | New optional fields break existing ledgers | implementation | Old records lack authority/coverage | Both fields are optional; absent coverage renders as `unknown`, which is the conservative reading | Phase 1 — Evidence carries authority and coverage |

## Acceptance Criteria

- [x] AC-1 — No absence finding renders as "does not exist" unless its coverage
      is `complete`.
- [x] AC-2 — An obligation never closes on analyst inference alone, and a
      `visible-only` row never counts toward parity.
- [x] AC-3 — The reference door documents a transfer into a destination other
      than AC.
