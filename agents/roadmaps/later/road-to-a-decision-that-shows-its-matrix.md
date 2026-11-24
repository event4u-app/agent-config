---
complexity: structural
status: later
tree_pin: 9b6242da90
review_by: 2027-01-15
entry_condition:
  what: "a free slot under the WIP cap of 25 active roadmaps"
  when: "when an active roadmap closes"
  who: owner
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: >-
  Receiver for owner directive OD1 (the owner's own turn in round inbox-2026-11-xa: AC uses a
  decision matrix for its decisions). Lands in later/ because 32 roadmaps are active against a
  WIP cap of 25; nothing is activated by this change.
estate_offset_exempt: >-
  Owner search ran before this file was written:
  grep -rlF -e decision_matrix -e decision:matrix -e weighted-matrix -- agents/roadmaps/*.md
  agents/roadmaps/later agents/roadmaps/stubs — no hit across the whole roadmap tree.
  road-to-questions-that-reach-the-right-decider owns who decides a dominant option, not how
  dominance is shown; it is extended, not edited.
relates:
  - slug: road-to-weighted-decision-matrix
    relation: extends
    note: "Archived, done. Shipped the user-elicited weighted mode inside decision-record."
  - slug: road-to-questions-that-reach-the-right-decider
    relation: extends
    note: "Active. Owns the cascade dominant -> agent, contested -> council, owner-four -> owner. No routing list changes here."
  - slug: road-to-a-change-that-knows-its-reach
    relation: consumes
    note: "Sibling from the same round. Supplies the computed Reach and Contract cells."
  - slug: road-to-modules-you-can-swap-and-facts-with-one-source
    relation: consumes
    note: "Sibling from the same round. Supplies the computed Boundary and Truth cells."
---
# Road to a decision that shows its matrix

> **Source:** `agents/tmp.old/inbox-2026-11-xa/` — an owner transcript of three turns plus two
> external agents' plan chains (three revisions each) built on it. Claims verified against
> `main@9b6242da90` on 2026-11-24; the plans' own pin was `b10d45539a`, 26 commits earlier, and
> only `docs/contracts/ai-council-config.md` moved (+8 lines after `:708`).

> **Owner directive OD1 (2026-11-23, owner's own words, recorded as owner intent):** AC uses a
> decision matrix for its decisions. Not a proposal ID of this file — the owner's demand. Both
> external plans add the same proportionality bound (no table on every trivial step); it is
> their reading, not the owner's words, and is carried as tier T0 and kill criterion K2.

## Goal

Before AC asks the owner, calls the council, or records a choice, it builds a matrix sized to
the decision, and a script — not the model — computes it. "Dominant" means the script said so.
The record keeps the options and the criteria, and a later revisit recomputes only the cells
that moved. Weights stay the owner's.

## Context — what the tree shows at `9b6242da90`

| ID | Finding | Evidence |
|---|---|---|
| F1 | The shipped matrix needs the user to name criteria and weights, and forbids the AI to weight (council verdict 2026-07-19). AC's own decisions have no matrix path | `src/skills/decision-record/references/weighted-matrix.md:22-28`, `:36-43` |
| F2 | No script computes a sum or a flip threshold; the arithmetic is prose the model performs | `weighted-matrix.md:66-77`; grep of `src/scripts` for `decision_matrix`, `weighted sum`, `flip threshold`: no hit |
| F3 | "Dominant" is asserted, never shown: 18 of 60 sampled asks were labelled `dominant` and still reached the owner | `src/rules/no-cheap-questions.md:60`; `agents/evidence/analysis/decision-asks-census-2026-11-21.md:88` onward |
| F4 | The memo keeps the winner and drops options and criteria | `src/scripts/decision_memo.ts:50-61`, `:106` |
| F5 | The council names an option, not the criterion it disagrees on; `jury_aggregate` is kept off the verdict path on purpose | `docs/contracts/ai-council-config.md:861-880`; `src/scripts/ai_council/jury_aggregate.ts:9`, `:19`, `:56` |
| F6 | One eval scenario, on the ADR shape | `src/skills/decision-record/evals/evals.json:6-7` |
| F7 | In the 60-row census the reply was `redirected` 37 times, a confirmation 20, an override 3 — the option set misses more often than the pick (bound: a redirect may be an elaboration) | same census file |
| F8 | Weights are values and have no owner-authored home | `src/scripts/ai_council/ownership_classes.ts:35` |
| F9 | `decision-record` reaches only the `agent-config-maintainer` workspace; a consumer never gets it | `src/skills/decision-record/SKILL.md:13-14` |

Kept as is: fixed anchors, the under-10 % margin rule, the flip tests, "a structured argument,
not a verdict" (`weighted-matrix.md:18`, `:51-62`); the mandatory do-nothing option
(`decision-record/SKILL.md:92`) — it becomes the datum; no self-adversarial fallback
(`ai-council-config.md:1052-1056`).

## What this roadmap is NOT

- No kernel-rule edit, nothing added to the always-loaded payload or the subagent preamble.
- No routing-list change; the cascade stays in `road-to-questions-that-reach-the-right-decider`.
- No model ever emits a weight (PD5). Not adopted: AHP, TOPSIS, fuzzy variants, fixed pillar
  weights with "highest score wins" (PD9).
- No second vocabulary of duplication or reach classes: the structural cells' values live in
  the vocabulary file the sibling roadmaps own (see Phase 5).

## Design

| Tier | Fires when | Shape | Who resolves |
|---|---|---|---|
| T0 | deterministic, or reversible with no ask pending and reach `local` | none | agent |
| T1 | about to emit a numbered-options block or record a choice; or an option's reach is above `local`, or it creates a new unit of code or data | MUST screen, then `+/0/−` against the do-nothing datum per criterion; structural cells computed | agent only on Pareto dominance with no assumed or unknown hinge cell; else one rung up |
| T2 | no dominance on a contested technical trade-off | the anchored 1-10 mode | council |
| T3 | owner-locked class | prefilled sheet plus the one cell that flips the result | owner |

Rules: unknown is never safe — an `unknown` cell sends the decision up a rung or names the
lookup that resolves it; MUST screens run before any comparison; the option set is completed
before it is compared (siblings come from the two sibling roadmaps); on a `fungible` verdict
the better Boundary cell wins, then the better Truth cell.

## Phase 0 — Baseline before any behaviour changes

Evidence (read): `tests/fixtures/decision-asks/` holds 5 fixtures (S05, S15, S21, S45, S46).

- [ ] **0.1 Grow the ask fixtures** to at least 20, with at least 5 cases that never name the
      word "decision" or "matrix" (keyword-free) and 5 where the right answer is "no matrix".
      verify: `ls tests/fixtures/decision-asks/*.md | wc -l` -> /^[2-9][0-9]$/
- [ ] **0.2 No-matrix baseline** on those fixtures, labelled by an independent session (not the
      session that writes Phase 1), recorded in
      `agents/evidence/analysis/decision-matrix-baseline-<date>.md`.
      verify: `grep -cE '^\| kappa \| 0\.[0-9]+ \|' agents/evidence/analysis/decision-matrix-baseline-*.md` -> 1
- [ ] **0.3 Pre-register thresholds K1-K6** in one council round before any Phase 1-4 number
      exists; recorded as PD14 in the vocabulary file only.
      verify: `grep -c '^ *K[1-6]:' src/config/decision-vocabulary.yaml` -> 6

## Phase 1 — The matrix is computed by a script

Evidence (read): `src/scripts/decision_memo.ts:50-61`; `src/scripts/_dispatch.bash` carries `decision:memo`.

- [ ] **1.1 Failing tests** in `tests/scripts/decision_matrix.test.ts`: MUST screen; Pareto
      dominance on `+/0/−`; `fungible`; weighted sum; margin under 10 %; weight flip; ±1 and
      ±2 flips; missing is never 0; hinge cells with assumptions and unknowns first; an added
      option changes no existing cell; permutation invariance (option and criterion order);
      the same input JSON gives a byte-identical result on every OS in CI.
      verify: `npx vitest run tests/scripts/decision_matrix.test.ts` -> /failed/
- [ ] **1.2 `src/scripts/decision_matrix.ts`** — `init`, `score`, `compute`, `render`.
      `init` hash-locks criteria and weights; `score` refuses on a changed hash. Each cell needs
      a basis ref, `assumption`, or `computed: <verb>`. Verdicts from a closed set read from the
      vocabulary file: `dominant`, `fungible`, `no-dominance`, `no-clear-winner`, `fragile`,
      `clear`.
      verify: `npx vitest run tests/scripts/decision_matrix.test.ts` -> 0
- [ ] **1.3 Dispatch** `decision:matrix` beside `decision:memo`.
      verify: `./agent-config decision:matrix --help` -> 0
- [ ] **1.4 Point the existing weighted mode at the script**: `weighted-matrix.md:66-77`
      replaces the prose arithmetic with the `compute` call.
      verify: `grep -c 'decision:matrix compute' src/skills/decision-record/references/weighted-matrix.md` -> /[1-9]/

## Phase 2 — T1 at the ask boundary (shadow first)

Evidence (read): `src/rules/no-cheap-questions.md:60` ("One option obviously dominant?").

- [ ] **2.1 `references/screen-and-datum.md`** in `decision-record`: MUSTs read from existing
      floors and fences plus the structural screens; at most six criteria, four of them the
      structural cells whenever code is touched; datum = do-nothing; option completion; at
      most fifteen lines of output.
      verify: `test -f src/skills/decision-record/references/screen-and-datum.md` -> 0
- [ ] **2.2 Carry it in `cheap-question-mechanics.md`**, not in a kernel rule: "dominant"
      means `decision:matrix compute` returned `dominant`.
      verify: `grep -c 'decision:matrix' src/agent-src/contexts/execution/cheap-question-mechanics.md` -> /[1-9]/
- [ ] **2.3 Consumer reach of T1** (F9): the screen ships through a surface the engineering
      workspace receives — the context above — and the projection test proves a consumer
      install carries it.
      verify: `npx vitest run tests/scripts/decision_matrix_projection.test.ts` -> 0
- [ ] **2.4 Shadow replay** on the 0.1 fixtures and the sibling roadmaps' planted repositories,
      scored by an independent session: verdict, lines, tokens, options added by completion,
      whether an added option won; results split by stack, legacy/modern, graph present/absent
      and host (Claude plus at least one other).
      verify: `grep -cE '^\| (claude|codex|cursor|gemini|augment) \| (php|ts|py|go)' agents/evidence/analysis/decision-matrix-shadow-*.md` -> /^([2-9]|[1-9][0-9])$/
- [ ] **2.5 Gate** K1, K2, K6. A stop here keeps Phase 1.
      verify: `grep -cE '^\| K(1|2|6) ' agents/evidence/analysis/decision-matrix-shadow-*.md` -> 3

## Phase 3 — The record keeps the field, and notices when it moves

Evidence (read): `src/scripts/decision_memo.ts:106`; `src/rules/decision-revisit-gate.md` step 2.

- [ ] **3.1 Memo `--matrix <path>`**; agent-resolved multi-option memos without it are refused.
      verify: `npx vitest run tests/scripts/decision_memo.test.ts` -> 0
- [ ] **3.2 `## Decisions` rows may cite a matrix**; an all-assumption matrix grades `E0`.
      verify: `npx vitest run tests/scripts/decision_matrix.test.ts -t grade` -> 0
- [ ] **3.3 `revisit if` derived from hinge cells.**
      verify: `npx vitest run tests/scripts/decision_matrix.test.ts -t revisit` -> 0
- [ ] **3.4 `decision:matrix recheck`** re-runs computed cells and re-reads basis refs:
      `holds`, `holds-partially`, `flips`, `cannot-tell`; wired as evidence for step 2 of the
      decision-revisit gate in its enforcement context. This is the owner's "75 % still hold"
      directive made mechanical.
      verify: `npx vitest run tests/scripts/decision_matrix.test.ts -t recheck` -> 0

## Phase 4 — Weights and standing intent

Evidence (read): `src/scripts/ai_council/ownership_classes.ts:35`.

- [ ] **4.1 OD1-OD4 recorded as owner intent** in an owner-authored settings file with
      `authority_basis: owner_intent`; dependency reach, module boundary and one-source are
      standing criteria in the PD19 order (owner-delegated panel, 2026-11-24). The file is the
      only place the ranking is stated; PD19 here is its provenance, not a second copy.
      verify: `grep -c 'authority_basis: owner_intent' agents/settings/decision-criteria.yml` -> 1
- [ ] **4.2 Rank-order weights**, deterministic; no model emits a weight.
      verify: `npx vitest run tests/scripts/decision_matrix.test.ts -t rank-order` -> 0
- [ ] **4.3 No profile → per-weighting report** ("wins under k of n").
      verify: `npx vitest run tests/scripts/decision_matrix.test.ts -t no-profile` -> 0
- [ ] **4.4 Overrides are a signal**: three overrides on one criterion open one owner question;
      nothing re-weights itself.
      verify: `npx vitest run tests/scripts/decision_matrix.test.ts -t override` -> 0

## Phase 5 — The council scores cells (default off), and the vocabulary is one file

Evidence (read): `src/scripts/ai_council/jury_aggregate.ts:9`.

- [ ] **5.1 `src/config/decision-vocabulary.yaml`** is the only place stating tiers, matrix
      verdicts, MUST screens, the structural cells' values and the kill thresholds. The
      Truth cell's values map onto the verdicts of `docs/guidelines/redundancy-taxonomy.md`
      (including `keep-duplicated` and `de-abstract`) rather than restating them. Prose tables
      are generated and carry the generated-artefact header.
      verify: `./scripts-run src/scripts/check_generated_artefact_headers` -> 0
- [ ] **5.2 `matrix_scoring` contract**, opaque labels, permuted order, one line per judged
      cell; computed cells are shown, not scored; aggregated through `jury_aggregate`; only
      disputed cells go to the next round. Ten shadow rounds, gate K4.
      verify: `npx vitest run tests/scripts/ai_council/matrix_scoring.test.ts` -> 0

## Phase 6 — Evals, then the default

Evidence (read): `src/skills/decision-record/evals/evals.json:6-7`.

- [ ] **6.1 Scenarios**: a dominated option is decided without a question; a breaking contract
      with unknown consumers is not decided by the agent; a re-implementation loses to its
      reuse sibling; a deliberate per-module model is not failed; an unknown reach is never
      rendered as "no impact"; weights changed after scoring are refused; a keyword-free task
      still triggers T1.
      verify: `jq '.evals | length' src/skills/decision-record/evals/evals.json` -> /^([7-9]|[1-9][0-9])$/
- [~] **6.2 Default flip** for consumers, put to the owner with the shadow numbers.
      <!-- blocked-by: t1-consumer-default -->
      verify: `grep -cE '^ *matrix_t1: (on|opt-in) *# owner-ruled [0-9]{4}-[0-9]{2}-[0-9]{2}' src/config/agent-settings.template.yml` -> 1

## Kill criteria (thresholds set in 0.3, before data)

| ID | Fires when | Then |
|---|---|---|
| K1 | T1's dominance verdict agrees with the labels no better than baseline | stop after Phase 2; keep the script |
| K2 | T1's added output or tokens exceed the budget on trivial tasks | shrink once; second miss drops T1 |
| K3 | the owner picks against T3 recommendations above the set rate in 20 sheets | pause weighting; back to the ranking question |
| K4 | per-cell council scoring changes no verdict in ten rounds and costs more | stance tally only |
| K5 | weights or criteria changed after a score in any recorded run | fix the order-lock first |
| K6 | options added by completion are never chosen in shadow | completion becomes opt-in |

## Decisions (proposed)

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| PD1 | business-owned | owner (OD1) | AC uses a matrix for its decisions, sized by tier | owner transcript turn 1 | — |
| PD2 | contested-technical | proposed | `+/0/−` against a datum by default; anchored 1-10 only at T2 | F2; LLM score-consistency literature | three levels prove too coarse on the fixtures |
| PD4 | deterministic | proposed | The script computes everything numeric; weights hash-locked before scoring | F2 | — |
| PD5 | business-owned | proposed — owner | Weights come from the owner; a model never emits one | F1, F8; council 2026-07-19 | the owner asks for model-proposed weights |
| PD6 | contested-technical | proposed | Agent self-resolves only on Pareto dominance with no assumed or unknown hinge cell | F1, F3 | the sample shows such rows the agent got wrong |
| PD10 | deterministic | proposed | No kernel-rule edit, no preamble growth | `road-to-questions-that-reach-the-right-decider` AC-6 | — |
| PD14 | contested-technical | open — council in 0.3 | Numeric thresholds K1-K6, stated in the vocabulary file only | must precede the data | — |
| PD19 | business-owned | owner-delegated panel 2026-11-24, `/panel decide` shape (10 seats, 5 on the session model, 5 on sonnet, blind, lens-diverse) | Standing criteria rank: dependency reach > one source > module boundary > delivery speed > token cost | Borda 39 / 29 / 19 / 12 / 1; the Condorcet order is identical; dependency reach first on 9 of 10 seats, beating every other criterion pairwise 9-10 to 0-1; one source beats module boundary 9-1 | K3 fires, or the owner overrides the order |

## Dissent

PD19 panel, 2026-11-24:
- **DDD-architect seat** ranked module boundary first: a boundary is what makes reach knowable.
  Its own counter-argument, which the majority shares: the owner limited modularity with "geht
  nicht immer", and most consumer codebases are legacy code without a boundary.
- **Three seats** (product/delivery and two others) put delivery speed above module boundary:
  small, quick diffs keep reach low in an untested monolith, and a module extraction widens reach
  at first. Recorded as the revisit signal for PD19 if K3 fires on module-boundary sheets.
- **One seat** put token cost above delivery speed.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Matrix theatre on trivial steps | product | T1 fires on routine choices and adds lines and tokens the owner never wanted ("not a heavy table on every step") | T0 tier; K2 budget gate; 0.1 carries "no matrix" fixtures | Phase 2 — T1 at the ask boundary (shadow first) |
| 2 | Pseudo-precision | product | A model fills `+/0/−` cells with confident guesses and the script launders them into a "dominant" verdict | every cell needs a basis ref or `assumption`; assumed hinge cells block self-resolution (PD6) | Phase 1 — The matrix is computed by a script |
| 3 | Consumers never see it | implementation | `decision-record` is maintainer-only (F9), so the whole mechanism stays internal | 2.3 ships the screen through a context the engineering workspace receives, with a projection test | Phase 2 — T1 at the ask boundary (shadow first) |
| 4 | Self-graded shadow | implementation | The session that wrote the matrix also scores the replay and finds it better | 0.2 and 2.4 are labelled by an independent session; `evaluator-independence` applies | Phase 0 — Baseline before any behaviour changes |

## Blockers

### blocker: standing-criteria-ranking
- **Status:** resolved 2026-11-24 — the owner delegated the ranking to ten agents ("entscheide das in einer 10 agenten arena"); it ran as a `/panel decide`-shaped panel, not an `/arena` bracket, because a criteria ranking is a decision, not competing solutions; result recorded as PD19, dissent under `## Dissent`.
- **Owner:** owner
- **Class:** 2
- **Ownership:** business-owned
- **Routed:** pending — no council ran in this authoring round; expected reserved row: purpose (the owner's own ranking of standing intent OD2-OD4 is a declared outcome, not a mechanism)
- **Blocks:** Phase 4 — step 4.1
- **Question:** Rank the standing criteria for your projects: dependency reach (OD2), module boundary (OD3), one source per fact (OD4), delivery speed and token cost — where does each sit, and against each other?
- **Recommendation:** OD2 > OD4 > OD3 > delivery speed > token cost — a break you did not see costs more than a copy, and a copy more than a missing module seam; asked once, stored once.

### blocker: t1-consumer-default
- **Status:** open
- **Owner:** owner
- **Class:** 2
- **Ownership:** business-owned
- **Routed:** pending — the question carries step 2.4's shadow numbers, which do not exist yet; expected reserved row: product-owned, since a consumer default flip is externally visible
- **Blocks:** Phase 6 — step 6.2
- **Question:** After the shadow numbers: T1 default-on for consumers, or opt-in?
- **Recommendation:** decide only with the 2.4 numbers in hand; opt-in if K2 fired once.

## Acceptance Criteria

- [ ] AC-1 — `decision:matrix compute` returns the same verdict for a permuted input (1.1 green).
- [ ] AC-2 — No reply labels an option `dominant` unless the script returned `dominant` (2.2, 6.1).
- [ ] AC-3 — A memo for an agent-resolved multi-option choice carries its matrix (3.1).
- [ ] AC-4 — No model-emitted weight exists in any recorded run (K5 never fires).
- [ ] AC-5 — No kernel rule file changed.
