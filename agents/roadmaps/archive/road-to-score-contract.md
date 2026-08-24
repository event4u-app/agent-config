---
complexity: lightweight
status: ready
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

> **Flipped `draft` → `ready` at closure, 2026-08-24, and archived in the same
> change.** The file shipped as a draft, which means `collect()` never counted it
> and the archiver never saw it — so a completed draft would have sat in the
> active directory forever looking like open work. Flipping and archiving in one
> change is estate-neutral (+1 active, −1 disposed) and leaves the honest state:
> executed, not abandoned.

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

- [x] **Step 0.1:** `agents/evidence/ac-capability-scorecard.yaml`: one entry
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
      verify (discharged 2026-08-24): the file parses as YAML; every row's
      `status` is one of the six legal values; every seeded row carries **empty**
      evidence arrays, so no URI was invented for a baseline. Asserted by
      `tests/scripts/check_score_contract.test.ts` (22 tests) and by
      `./scripts-run src/scripts/check_score_contract`, which prints
      `scanned: 23`.

      **The rubric turned out not to be reconstructible, and the count changed.**
      Both this roadmap and its program parent say **32** categories and both say
      to seed from the external review. **The external review is not in the
      tracked tree** — its inbox copy under `agents/tmp.old/road-to-10/` is gone.
      What is recoverable is the `Category → closing path` table at
      `road-to-ten-across-the-board.md:117-138`, which yields **23** categories
      with baseline scores. **Nine identities are unknown**, not merely their
      scores.

      AI council 2026-08-24 (2/2 convergent, `anthropic/claude-sonnet-4-5` +
      `openai/codex-default`, 2 rounds, blind peer review) chose **option (a):
      seed the 23 recoverable rows** and make the incompleteness machine-readable
      rather than inventing nine placeholders or holding the whole phase. Both
      seats independently corrected the arithmetic this run first got wrong —
      32 − 23 = **9**, not 7 — and both refused the two unscored non-regression
      floors (`runtime simplicity`, `host portability`) as rows: nothing
      establishes they were rubric categories, so adding them would shrink a
      known gap by guessing. They are recorded in `excluded_from_manifest`, and
      the gate refuses a row bearing one of those ids.

      The `rubric:` block therefore declares `state: incomplete`,
      `authority: unavailable-external-review`, and the arithmetic — and the gate
      enforces all three: the counts must add up, the row count must equal
      `recovered_category_count`, and `state: complete` is **refused** while the
      authority is unavailable. Twin `e-false-completeness` proves that last one
      fires.
- [x] **Step 0.2:** Rows for capped-by-doctrine debates carry no special
      casing in the verifier — a doctrine-shaped outcome is recorded as
      `max-boundary` with the pre-registered criterion and the constraint it
      derives from (e.g. no-runtime-daemon, `docs/CLAIMS.md:104`); a
      benchmark-shaped null is `measured-null` with its measurement window.
      verify (discharged 2026-08-24, **with the rule corrected — read literally
      it failed every row 0.1 creates**): for every **terminal** non-`ten` row,
      the recorded reason resolves to either a named constraint (`max-boundary`)
      or a named measurement window (`measured-null`); a row carrying neither
      fails the shape check.

      **The contradiction, and the council's resolution.** As written, 0.2 asked
      *every* non-`ten` row for a constraint or a window. But a freshly seeded
      row is `missing-mechanism` — none of the three `missing-*` statuses is
      terminal, and none can carry either field honestly. So 0.1 and 0.2 could
      not both hold. Both seats reached the same answer independently: **the
      reason requirement binds only the two terminal non-`ten` statuses. For a
      `missing-*` row, the status IS the reason.** Asserted directly in
      `check_score_contract.test.ts` § *a seeded missing-\* row needs no reason
      field*.

      **The statuses became ordered claims rather than labels**, which is the
      part that makes them checkable: `missing-adoption` now *requires* non-empty
      mechanism evidence, because otherwise it and `missing-mechanism` describe
      the same evidence shape and either could be written for any row.
      `standing_constraint` is **forbidden** on every status except
      `max-boundary`, so the doctrine escape cannot be attached to a row that did
      not earn it — twin `f-max-boundary-no-constraint` proves the requirement
      fires, and `STATUS_RULES` is asserted complete over the six-value enum.

## Phase 1 — The verifier

- [x] **Step 1.1:** `src/scripts/check_score_contract.ts`: shape,
      evidence-URI resolvability, stale pin detection, and the class rule — a
      row may read `ten` only if every required evidence class for its kind is
      non-empty and resolvable.
      verify (discharged 2026-08-24): all four negative controls exist as
      committed twins under `tests/fixtures/score-contract/twins/`, and
      `check_score_contract.test.ts` asserts each produces **exactly one finding
      code** — not merely a non-zero exit, which would let a twin keep passing
      while testing the wrong defect.

      | Twin | Control | Finding code |
      |---|---|---|
      | `d-unresolvable-path` | (a) missing evidence ref | `unresolvable_evidence` |
      | `b-stale-pin` | (b) stale pin | `unresolvable_evidence` |
      | `c-fixture-as-production` | (c) fixture as production window | `fixture_in_production_class` |
      | `a-ten-with-empty-class` | (d) `ten` with a required class absent | `class_rule` |
      | `e-false-completeness` | *added:* incompleteness redeclared complete | `false_completeness` |
      | `f-max-boundary-no-constraint` | *added:* doctrine escape with no constraint | `class_rule` |

      **`fixture:` had to become part of the URI grammar, or (c) was prose.** The
      frozen definition of 10 says synthetic fixtures can never satisfy adoption,
      production, or outcome — but with no marker the gate cannot tell a fixture
      path from a production one, so the rule would have been unenforceable. A
      URI may now be prefixed `fixture:`, and the gate refuses one in any of
      those three classes.

      **Registered, and it cost two ratchets rather than none.** The gate emits
      one `scanned: <N>` line on **both** paths and is registered in
      `src/config/gate-coverage.yml` (`min_scanned: 20` against a live 23) with a
      create-only canary. Registering it immediately turned
      `gate-self-test:registered-non-adopters` red at 25-vs-24, so the gate also
      carries `--self-test`: 9 cases, 7 rejecting, driving the real CLI against
      all six twins plus a **dead-scan-root** case a twin cannot express. Both
      ratchets are green.

      **One defect the test found in the gate itself**, recorded because it is the
      kind that hides: `--file` with an ABSOLUTE path reported `missing_file` for
      a file that exists, because `path.join(REPO, '/abs')` silently yields
      `REPO + '/abs'`. Found by the first test that copied the scorecard to a
      temp directory, and fixed.
- [x] **Step 1.2:** The verifier never judges outcome *quality* — that stays a
      report. A judgement question behind a gate is score theatre.
      verify (discharged 2026-08-24, mechanised rather than grepped by hand):
      `check_score_contract.test.ts` § *quality is never judged* scans the
      verifier's source for a comparison operator against a quality-shaped field
      name (`quality|score|rating|grade|confidence`), skipping comment lines, and
      asserts **zero** hits. The gate also states the bound on its own green path
      (*"quality is NOT judged here: emptiness and resolvability only"*), and the
      test asserts that sentence is present — so a reader is never left to infer
      the limit from silence.

## Phase 2 — Binding

- [x] **Step 2.1:** The program roadmap and both companion roadmaps reference
      scorecard rows by category id in their `verify:` lines; a completed
      phase updates the row's evidence URIs, never its status directly —
      status changes only through the verifier's class rule.
      verify (discharged 2026-08-24): both halves are asserted in
      `tests/scripts/check_score_contract.test.ts` § *Phase 2 binding*. The first
      collects every backticked kebab token in each companion and requires it to
      resolve to a declared row (or to one of the two `excluded_from_manifest`
      ids); the second scans for a line assigning a scorecard `status:` value and
      requires zero.

      **What binds the ids.** `road-to-ten-across-the-board.md` § Category →
      closing path gained a **Scorecard row id** column, so each of its 18 rows
      names the row(s) it closes — e.g. `release-integrity`,
      `context-efficiency`, `hook-runtime-economy`, and the three
      deep-capability rows `code-intel` · `persistent-runtime` ·
      `persistent-learning`. This file cites `return-contract-adoption` and
      `security` here to satisfy its own half of the binding. The two axes that
      are deliberately NOT rows — `runtime-simplicity` and `host-portability` —
      are named as excluded so a reader looking for them finds the reason rather
      than an absence.

      **The status rule is the whole point of the phase.** A step appends
      evidence URIs; the gate then accepts or refuses the resulting combination.
      No checkbox in either file can award a `ten`, and the second assertion is
      what keeps that true as the files grow — its discriminator is a bare
      assignment versus a backticked mention, so prose *about* the rule stays
      legal while an assignment does not.

## Blockers

### blocker: b-scorecard-fourth-ledger
- **Status:** resolved
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
- **Resolved when:** ~~`provenance/README.md`~~ **`agents/evidence/README.md`**
  describes the register set that actually exists in the tree, and the
  scorecard's own header states which of the four it is and what it does NOT
  cover.
- **Resolution (2026-08-24) — a fourth register, documented in a NEW file, and
  the `Resolved when` above named the wrong one.** AI council 2/2 convergent
  (`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, blind peer
  review); the maintainer delegated council-owned blockers to the council for
  this autonomous drain run.

  **Register, not projection** — the roadmap's own recommendation, and both seats
  agreed: rubric categories are an external reviewer's assessment axes, so
  filtering `docs/CLAIMS.md` by category would mean registering ~32 *public
  claims this package does not want to make*.

  **But not in `provenance/README.md`.** Both seats reached this independently
  and it is the correction worth keeping: that file opens *"**Two** append-only
  ledgers live here"* and scopes itself to **what this package took from
  somewhere else**. A capability score is neither borrowed code nor a harvested
  heuristic. Amending it to mention a scorecard would have mis-filed the
  scorecard in the one document whose purpose is preventing exactly that
  confusion — the "grep for 'claim' hits all three" hazard it names. So
  `provenance/README.md` is **untouched, because it is already accurate**, and
  the register set is recorded in the new
  [`agents/evidence/README.md`](../evidence/README.md): four classes, what each
  is a register *of*, and why the scorecard is none of the other three.

  The id `b-scorecard-fourth-ledger` is kept although one seat proposed renaming
  it to `b-scorecard-register-location` (on the ground that "ledger" perpetuates
  the provenance-category confusion). The reasoning is accepted and recorded
  here; the id is not changed, because blocker ids are cited from other files and
  a stable wrong-ish name costs less than a dangling reference. The word "ledger"
  is corrected everywhere it describes the artefact.

  `agents/evidence/README.md` also carries the authority rule the other seat
  pushed back on: the writer (a human, or a roadmap step appending evidence) is
  named separately from the authority (the gate, refusing an inconsistent
  combination), because a validator does not ordinarily author repository data.

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

- [x] AC-1 — `agents/evidence/ac-capability-scorecard.yaml` exists, parses,
      and carries one row per frozen rubric category, each with a `status`
      drawn from the six-value enum.
      **Met for the DECLARED manifest, and the wording is corrected rather than
      claimed.** 23 rows, all `missing-mechanism`, every status from the enum.
      "Frozen rubric category" cannot mean 32 while nine identities are unknown;
      the file declares `state: incomplete` and the gate refuses a
      redeclaration. Closing the manifest needs the authoritative review
      re-supplied — a maintainer action, recorded as such.
- [x] AC-2 — `./scripts-run src/scripts/check_score_contract` exits 0 on the
      seeded scorecard, and each of the four negative controls in Step 1.1
      turns exactly this check red and nothing else.
      **Met, and each twin is asserted on its finding CODE, not on its exit
      code** — a twin passing for the wrong reason is the failure mode this
      distinction exists for. Six twins, four named by the step plus two the
      council added.
- [x] AC-3 — No row reads `ten` whose required evidence classes are not all
      non-empty and resolvable; proven by the (d) negative control, not by
      inspection.
      **Met by `a-ten-with-empty-class`**, which reds on `class_rule` alone.
      `STATUS_RULES.ten` requires all five evidence arrays plus a
      `production_window`, and the test asserts the rule table covers the whole
      enum, so a future status cannot be added without a rule.
- [x] AC-4 — Every non-`ten` row names either a standing constraint
      (`max-boundary`) or a measurement window (`measured-null`); a row with
      neither fails the shape check.
      **Met as corrected: this binds the two TERMINAL non-`ten` statuses.** Read
      literally over all non-`ten` rows it contradicted Step 0.1 — a seeded
      `missing-mechanism` row can carry neither field honestly. Council
      resolution, 2/2: for a `missing-*` row the status is the reason.
      `f-max-boundary-no-constraint` proves the terminal half fires.
- [x] AC-5 — `provenance/README.md` describes the register set that exists in
      the tree after this roadmap lands (blocker `b-scorecard-fourth-ledger`
      reads `Status: resolved`).
      **Met with the FILE corrected — the AC named the wrong one.** Both council
      seats independently found that `provenance/README.md` scopes itself to
      *what this package took from somewhere else* (two ledgers, plus a pointer
      distinguishing them from `docs/CLAIMS.md`), and a capability scorecard is
      neither a borrow nor a harvest. Amending it would have mis-filed the
      scorecard in the document that exists to prevent exactly that. The register
      set is recorded in the **new `agents/evidence/README.md`**, and
      `provenance/README.md` is left untouched **because it is already accurate**.

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
