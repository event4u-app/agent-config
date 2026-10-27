---
complexity: lightweight
status: ready
tree_pin: ac6c60802a
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
estate_offset_exempt: "Not a fold candidate. Owner search over agents/roadmaps/*.md, later/ and stubs/ for the identifiers findingId, review-findings.schema, deliberation_metrics, exhibit and admissib returned no owner of evidence admissibility or ledger precision; council-topology-evidence-followups owns deliberation_metrics' existing metrics, not a flip count. The operator asked for this round's roadmaps to be processed in the same invocation, which is the WIP-cap exception for an active roadmap. Count half: +1 active against a floor of 2, under the cap of 5."
relates:
  - slug: road-to-a-court-at-the-stops
    relation: extends
    note: "later/. Carries every step of this round's court plan that needs spend, a ratification, or a blocking-gate decision. This file builds the zero-spend parts those steps consume."
  - slug: road-to-council-topology-evidence-followups
    relation: disjoint
    note: "later/. Owns the existing deliberation_metrics readings (attribution, zero-marginal rate). Phase 4 here adds a third reading beside them and edits neither."
---
# Road to findings that show their exhibits

> **Source:** `agents/tmp.old/inbox-2026-10-bd/t01/` — an adversarial-court
> review proposal (transcript plus two plans). Every claim below was re-taken
> at `ac6c60802a` (18.2.0); the proposal was drafted at 16.5.0.

## Goal

A review finding can carry a typed exhibit that a deterministic, zero-spend
checker resolves against the reviewed commit; the precision the release ledgers
already adjudicated is printed by a script; and a council run reports how many
seats changed stance without naming a reason. Nothing here decides a
disposition, adds a verdict label, or calls a model.

**Out of scope:** new prosecutor, defence, jury or judge roles (all exist, and
`docs/CLAIMS.md` records more adversarial voices as a measured null); a new
verdict vocabulary; any spend-bearing run; anything on the ratification
gated-surface list. Those live in `later/road-to-a-court-at-the-stops`.

## Context — readings at the pin

- `src/scripts/schemas/review-findings.schema.json` has `file`, `title`,
  `detail` and no `line`, quote or commit field.
- `findingId()` hashes `kind|title|file` (`src/scripts/self_review_gate.ts:78`);
  56 of 509 ledger findings carry a `:<n>` inside `file`, so a moved line mints
  a new id.
- No module resolves a cited location or quote against a commit.
- The ledgers hold 509 findings: 79 `fixed`, 58 `false_positive`, 29
  `accepted_risk`, 20 `still_open`, 323 undisposed. No report prints that.
- `deliberation_metrics.ts` attributes corrections and measures zero-marginal
  calls; nothing counts a stance change.

## Phase 1 — A typed exhibit in the finding schema

- [x] **1.1 Add optional `line` and `exhibits[]` to `review-findings.schema.json`.**
      `line` is an integer ≥ 1. Each exhibit has a `type` from the closed set
      `presence` (`path`, `line`, `quote` ≤ 300 chars, `commit`), `absence`
      (`path_glob`, `pattern`, `commit`, `expected: 0`), `pair` (two presence
      exhibits) and `executed` (`command`, `exit_code`, `output_digest`).
      Both fields are optional, so every existing producer stays valid.
      verify: the schema test carries one valid row per exhibit type and one
      invalid row per required field.
- [x] **1.2 Keep `findingId()` stable across line moves.** Strip a trailing
      `:<n>` or `:<n>-<m>` from `file` before hashing, and lift it into `line`
      where the finding is parsed.
      verify: a unit test shows two findings that differ only in the line
      suffix share one id, and a finding without a suffix keeps its old id.
- [x] **1.3 Keep exhibits through `parseFindings`.** A model reply carrying
      `exhibits` keeps them on the parsed finding; a malformed exhibit is
      dropped with the finding kept.
      verify: a parse test over a reply with one good and one malformed exhibit.

## Phase 2 — Admissibility, deterministic and zero-spend

- [ ] **2.1 Build `check_finding_exhibits`.** A pure reader over a findings
      file (or the schema's array) that resolves each exhibit at its `commit`
      through `git show`/`git grep`: `presence` holds when the quote occurs
      within ±3 lines of `line`; `absence` holds when the match count over the
      glob equals `expected`; `pair` holds when both legs hold; `executed` is
      recorded, never re-run. Each exhibit gets `admissible`, `inadmissible` or
      `unverifiable` (commit or blob unreachable).
      verify: fixtures per type against a temporary git repository, plus a
      sabotage case — shifting a quote by one character flips the verdict to
      `inadmissible`.
- [ ] **2.2 Admissibility informs, it never filters.** The checker writes no
      disposition and drops no finding.
      verify: a test greps the checker's source for every disposition status
      literal and the ledger directory and finds none.

## Phase 3 — The precision the ledgers already hold

- [ ] **3.1 Build `report_finding_precision`.** Read-only over
      `agents/evidence/release-findings/*.json`; per release and in total it
      prints `fixed`, `false_positive`, `accepted_risk`, `still_open`,
      `undisposed`, precision = fixed / (fixed + false_positive), and the
      undisposed share. Text and `--json`.
      verify: a fixture test asserts the arithmetic, and the live totals are
      computed by the script, never copied from this file.

## Phase 4 — Stance changes that name no reason

- [ ] **4.1 Add `unreasonedFlips` to `deliberation_metrics`.** Per member, read
      the `STANCE:` label of each stage with the existing parser; a change of
      label is a flip; it is reasoned when the flipping call carries a
      correction sentence that near-duplicates a peer's earlier correction
      (`is_near_duplicate`). Report flips, unreasoned flips and the per-member
      split inside `measureDeliberation`'s result. No model call, no edit to
      the gated stance parser.
      verify: fixtures for a reasoned flip, an unreasoned flip and a stable
      seat; dropping the peer-correction check turns the reasoned fixture red.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Exhibits become ceremony | product | Producers paste any line that exists, and an `admissible` count is read as quality. | Presence needs the quote near the claimed line; precision is measured from adjudicated ledgers (Phase 3), never from exhibit counts. | Phase 2 — Admissibility, deterministic and zero-spend |
| 2 | Id change for suffixed findings | implementation | A finding that used to carry `:<n>` in `file` gets a new id once. | Dispositions are per-release ledgers that store their id; no stored row is recomputed, so no recorded disposition detaches. | Phase 1 — A typed exhibit in the finding schema |
| 3 | Admissibility drifts into deciding | product | A later gate reads `inadmissible` as `false_positive`. | 2.2's source test; the filtering question is carried to later/ behind a measurement. | Phase 2 — Admissibility, deterministic and zero-spend |
| 4 | Flip metric read as a quality score | product | `unreasonedFlips` is cited as evidence a council is worse. | The result documents itself as a text reading, like the two metrics beside it. | Phase 4 — Stance changes that name no reason |

## Acceptance Criteria

- [ ] AC-1 — The schema accepts typed exhibits and a `line`, and every existing
      finding shape still validates.
- [ ] AC-2 — A finding id does not change when only its line suffix changes.
- [ ] AC-3 — Every exhibit type resolves to one of three verdicts, with a
      sabotage-proven test, and no code path derives a disposition from it.
- [ ] AC-4 — The ledgers' precision prints from a script.
- [ ] AC-5 — A council run's metrics name its unreasoned stance changes.
