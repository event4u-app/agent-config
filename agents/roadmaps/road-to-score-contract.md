---
complexity: lightweight
status: draft
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived only status: draft roadmaps, which were never counted and so are unavailable as offsets. The addition is sanctioned on its own terms: two companion roadmaps landed in the same run name this file's artifact as the surface their verify: lines write into, and later/road-to-ac-deep-capabilities.md names its verifier in the first conjunct of its entry condition."
execution:
  mode: phase-checkpoints
pin: "fd42264a998e4ec66ba4fd397d9c37b801d045ba"
---
# Road to a score contract

> **Source:** agents/tmp.old/road-to-10/road-to-score-contract.md

> Council synthesis 2026-08-23, pinned to
> `fd42264a998e4ec66ba4fd397d9c37b801d045ba`. Re-verified at landing
> (2026-08-24, HEAD `0f7c26ee9`): no scorecard or score-contract artifact
> exists anywhere in the tracked tree, and `src/scripts/check_score_contract.ts`
> is absent. Modeled on the existing Claims Ledger mechanics
> (`docs/CLAIMS.md`, enforced by `src/scripts/check_claims.ts`) — same
> culture, applied to the external 32-category rubric instead of public
> marketing claims.

## Goal

External reviews stop re-litigating what counts as a 10. A machine-readable
scorecard records, per rubric category, the current claim, the required
evidence classes, and resolvable evidence URIs — and a verifier makes an
unreferenced prose "10" impossible. A **measured no-build null with a
pre-registered criterion is a terminal 10-eligible state**, so the contract can
never force machinery into existence to satisfy a rubric row.

## Context

1. **The artifact is absent, not merely stale.** Nothing in the tracked tree
   records per-category claims, evidence classes, or status — verified at the
   pin and again at landing. This is defect D11 of the program roadmap
   (`road-to-ten-across-the-board.md`).
2. **The mechanics already exist next door.** `docs/CLAIMS.md` plus
   `src/scripts/check_claims.ts` is the working precedent for "a claim may not
   stand without a resolvable evidence reference". This roadmap does not
   invent a validator shape; it re-applies one that is already green in CI.
3. **This would be a fourth ledger.** `docs/CLAIMS.md`,
   `provenance/borrows.jsonl` and `provenance/harvests.jsonl` are three
   deliberately separate registers, and `provenance/README.md` documents the
   three-way split as a decision rather than an accident. Adding a fourth is
   a governance change, not only a file — see blocker
   `b-scorecard-fourth-ledger`.
4. **Two companions depend on the artifact.** `road-to-ten-across-the-board.md`
   Wave 0 adopts it, and `later/road-to-ac-deep-capabilities.md` names
   `check_score_contract` exit 0 as the first conjunct of its entry condition.

## Definition of 10 (frozen here, referenced everywhere else)

A category is 10 only if all six hold, or a pre-registered no-build null closes
the row:

1. **Mechanism** at the right boundary; 2. **Adoption** on the default path;
3. **Falsifiability** — a targeted defect turns the right check red;
4. **Production proof** where the claim concerns production; 5. **Outcome
evidence** — connectable to an engineering outcome, not an invocation count;
6. **Non-regression** — no existing 10 (runtime simplicity, portability,
security, governance-complexity, context discipline) is spent to buy it.

Synthetic fixtures can never satisfy dimensions 2, 4, or 5.

## Phase 0 — The artifact

- [ ] **Step 0.1:** `agents/evidence/ac-capability-scorecard.yaml`: one entry
      per rubric category with `category, baseline, claim,
      mechanism_evidence[], adoption_evidence[], negative_control_evidence[],
      production_window, outcome_evidence[], non_regression_evidence[],
      status`. Legal `status` values: `missing-mechanism | missing-adoption |
      missing-proof | measured-null | max-boundary | ten`. `max-boundary`
      exists so a row capped by a standing doctrine constraint is
      distinguishable from a row that ran a benchmark and measured nothing —
      collapsing the two loses the reason the row is closed.
      Seed every row from the external review baseline as **historical
      input**, never as current proof.
      verify: the file parses as YAML; every row's `status` is one of the six
      legal values; a row seeded with a baseline score carries no evidence URI
      that did not exist before this step.
- [ ] **Step 0.2:** Rows for capped-by-doctrine debates carry no special
      casing in the verifier — a doctrine-shaped outcome is recorded as
      `max-boundary` with the pre-registered criterion and the constraint it
      derives from (e.g. no-runtime-daemon, `docs/CLAIMS.md:104`); a
      benchmark-shaped null is `measured-null` with its measurement window.
      verify: for every non-`ten` row, the recorded reason resolves to either
      a named constraint (`max-boundary`) or a named measurement window
      (`measured-null`); a row carrying neither fails the shape check.

## Phase 1 — The verifier

- [ ] **Step 1.1:** `src/scripts/check_score_contract.ts`: shape,
      evidence-URI resolvability, stale pin detection, and the class rule — a
      row may read `ten` only if every required evidence class for its kind is
      non-empty and resolvable.
      verify: negative controls — (a) missing evidence ref, (b) stale pin,
      (c) `production_window` pointing at a fixture run, (d) `ten` with a
      required class absent — each turns exactly this check red and nothing
      else (twin pattern, `tests/fixtures/pack-conformance/twins/`).
- [ ] **Step 1.2:** The verifier never judges outcome *quality* — that stays a
      report. A judgement question behind a gate is score theatre.
      verify: grep the verifier for any threshold applied to an outcome
      *quality* field returns zero hits; the quality report is emitted on the
      green path and gates nothing.

## Phase 2 — Binding

- [ ] **Step 2.1:** The program roadmap and both companion roadmaps reference
      scorecard rows by category id in their `verify:` lines; a completed
      phase updates the row's evidence URIs, never its status directly —
      status changes only through the verifier's class rule.
      verify: every scorecard category id cited in a companion roadmap
      resolves to a row in the YAML; no roadmap step writes a `status:` value.

## Blockers

### blocker: b-scorecard-fourth-ledger
- **Status:** open
- **Owner:** council
- **Blocks:** Phase 0 Step 0.1 (the artifact cannot land before the split is
  amended), and transitively Phases 1 and 2.
- **What to do:**
  1. Read `provenance/README.md` — it documents a deliberate three-way split
     across `docs/CLAIMS.md` (public claims this package makes about itself),
     `provenance/borrows.jsonl` (code borrows) and
     `provenance/harvests.jsonl` (knowledge borrows), and states that the
     shared vocabulary between them is a grep hazard.
  2. Decide whether the scorecard is a fourth register or a projection of
     `docs/CLAIMS.md` rows filtered by rubric category. A projection needs no
     amendment; a register does.
  3. If a fourth register: amend `provenance/README.md` in the SAME change
     that lands the YAML, so the split document never describes three
     registers while four exist.
- **Recommendation:** Resolve as a fourth register with the README amended in
  the same change. The rubric categories are not claims this package makes
  publicly — they are an external reviewer's axes — so filtering `CLAIMS.md`
  would mean registering 32 public claims the package does not want to make.
- **If you do nothing:** Phase 0 lands a fourth ledger while
  `provenance/README.md` documents three, which is exactly the grep hazard
  that document exists to prevent. The next reader cannot tell which register
  owns a given assertion.
- **Resolved when:** `provenance/README.md` describes the register set that
  actually exists in the tree, and the scorecard's own header states which of
  the four it is and what it does NOT cover.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Self-awarded 10 via roadmap checkboxes | implementation | A roadmap step flips a row to `ten` because its own phase closed, which reintroduces the prose-10 this contract exists to make impossible — just with YAML syntax. | Phase 2 Step 2.1 rule: checkboxes update evidence URIs only; the verifier's class rule is the sole writer of `status`. Step 2.1's verify greps for any roadmap step writing a `status:` value. | Phase 2 — Binding |
| 2 | Scorecard becomes a merge hotspot | implementation | 32 rows in one YAML file, touched by every track, is a structural conflict magnet across parallel branches. | One row per category, evidence as URIs not prose, edits are appends to arrays rather than rewrites. | Phase 0 — The artifact |
| 3 | A fourth ledger fragments provenance | product | Four registers with overlapping vocabulary and no document saying which owns what is worse than three registers and a gap. | Blocker `b-scorecard-fourth-ledger` gates Phase 0 on amending `provenance/README.md` in the same change. | Phase 0 — The artifact |
| 4 | Rubric drift across future reviews | product | A later external review renames or re-cuts categories and the historical rows stop being comparable, so the contract records an incomparable series. | The 32 category ids are frozen in the YAML; a review proposing new rows adds them as `missing-mechanism`, never renames an existing id. | Phase 0 — The artifact |
| 5 | `max-boundary` becomes a dodge | product | A row that could be measured is closed as doctrine-capped because measuring is expensive, and the enum makes that look legitimate. | Step 0.2's verify requires a `max-boundary` row to name the standing constraint it derives from; a row naming no constraint fails the shape check rather than passing as capped. | Phase 0 — The artifact |

## Acceptance Criteria

- [ ] AC-1 — `agents/evidence/ac-capability-scorecard.yaml` exists, parses,
      and carries one row per frozen rubric category, each with a `status`
      drawn from the six-value enum.
- [ ] AC-2 — `./scripts-run src/scripts/check_score_contract` exits 0 on the
      seeded scorecard, and each of the four negative controls in Step 1.1
      turns exactly this check red and nothing else.
- [ ] AC-3 — No row reads `ten` whose required evidence classes are not all
      non-empty and resolvable; proven by the (d) negative control, not by
      inspection.
- [ ] AC-4 — Every non-`ten` row names either a standing constraint
      (`max-boundary`) or a measurement window (`measured-null`); a row with
      neither fails the shape check.
- [ ] AC-5 — `provenance/README.md` describes the register set that exists in
      the tree after this roadmap lands (blocker `b-scorecard-fourth-ledger`
      reads `Status: resolved`).

## Corrections applied at landing (2026-08-24)

| What | Was | Now | Why |
|---|---|---|---|
| `status` enum, Phase 0.1 | Five values: `missing-mechanism \| missing-adoption \| missing-proof \| measured-null \| ten` | Six values, adding `max-boundary` | Salvaged from a rival draft dissolved in the same inbox run (`road-to-deep-capability-boundary-experiments.md`). A doctrine-bounded row and a benchmark-null row are different terminal states; one enum value for both loses the reason a row is closed. |
| Step 0.2 status value | Doctrine-shaped outcomes recorded as `measured-null` | Doctrine-shaped outcomes recorded as `max-boundary` | Follows from the enum addition above. |
| Blocker inventory | No `## Blockers` section | Added `b-scorecard-fourth-ledger` (owner: council) | The scorecard would be a FOURTH ledger alongside `docs/CLAIMS.md`, `provenance/borrows.jsonl` and `provenance/harvests.jsonl`; `provenance/README.md` documents a deliberate three-way split that must be amended in the same change. Not present in the source draft. |
| Risk table shape | `## Risks` with a two-column Risk/Mitigation table | `## Risk Register` with the six-column house grammar plus the `risk-review` marker | `src/scripts/lint_plan_risk_register.ts:212` requires the exact six-cell header; `Risk type` admits only `product` or `implementation` (`:288-293`). |
| Missing house sections | No `## Context`, no `## Acceptance Criteria`, no Source line, `verify:` on one step only | All present; every step carries a `verify:` line | House roadmap contract. |
| Verification note | "Verified at pin: no scorecard exists" | Re-verified at landing HEAD `0f7c26ee9`; `check_score_contract.ts` confirmed absent | The pin is 2026-08-23; the landing is a day later against a different HEAD. |
| Frontmatter | No `estate_offset_exempt` | Added, with the offset-unavailability reason stated | Every added roadmap in this run carries the exemption; the run archived only `status: draft` roadmaps, which were never counted and so cannot serve as offsets. |
