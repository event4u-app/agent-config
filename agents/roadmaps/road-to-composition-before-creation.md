---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-27
relates: []
# relates: `agent-config roadmap:context` on 2026-08-27 — scanned 2 PRs,
# 783 roadmap file(s) across active/later/stubs/archive, 348 remote branch(es),
# 3 live session record(s), 0 inbox file name(s). No sibling roadmap on the
# topic, no remote branch carrying the slug, and no open-PR file overlap for
# this roadmap. The "context fingerprint" is the probe's own digest of the
# inputs it read, printed by `agent-config roadmap:context`; a later run whose
# fingerprint differs has seen a changed estate and the relates block should be
# re-probed. Fingerprint 1fad1aa7901bc34b, base 0be1cf6b7.
estate_offset_exempt: "No disposal is available in this change — the dashboard reports 6/205 steps done across the seven active roadmaps, so nothing is near archival, and parking this would grow the later_roadmaps floor instead of the active one. No sibling owns the subject: grepping every active and parked roadmap for `incumbent`, `composition gate`, `overlap gate` and `declared delta` returns one file, `later/road-to-catalogue-host-fit.md:280`, where the word is incidental prose about record dating, not an authoring gate."
---
# Road to composition before creation — the estate grew to 299 skills and nothing ever asked "what does this extend?"

> **Source:** `agents/tmp.old/mixed-analysis/` (2026-08-27), track G0 of an
> external synthesis drafted against `3738c23e3`. Adopted after per-claim
> verification: most of that track is already owned by this tree and is dropped
> below. What survived is the one question nothing in the estate asks, plus a
> `corrected-from-reproduction` repair to the source's field list and to its
> proposed vocabulary — both of which collide with keys and enums that already
> exist here.

## Goal

A new skill, rule or command carries a recorded answer to "what incumbent did
you search for, and what is the declared delta?" — machine-readable, written at
authoring time, checkable. When this is finished, the estate can be asked which
additions were searched before they were made, an unsearched addition is a
reported finding, and the disposition vocabulary that records the answer is
**one** enum reconciled against those already in the tree, not a third one
sitting beside them.

## Context — the question nothing asks

The estate is 299 skills, 120 rules and 114 guidelines. Two gates already
measure its **size**: `check_estate_count.ts` ratchets `skill_count` against an
exact floor, and `lint_canonical_terms.ts` scanned 1,583 files on 2026-08-27.
Three tools already measure **overlap** after the fact — `audit_overlap.ts`,
`audit_skill_overlap.ts`, `report_layer_overlap.ts`.

What none of them holds is the authoring-time record. `artifact-drafting-protocol`
Phase B mandates a four-surface overlap scan before creating an artifact, and
that rule ships `instruction-only`: the scan leaves no artefact, so a skill
authored without one and a skill authored after a thorough one are indiscernible
in the tree. The consequence is not hypothetical — it is why the overlap tools
exist at all, and why they are run over a corpus rather than over a decision.

## Dropped — what the source asked for and this tree already has

Named rather than silently omitted, because a later harvest that re-reads the
source will otherwise re-propose all six.

| Source item | Disposition | Evidence |
|---|---|---|
| Estate inventory | already-fixed | `check_estate_count.ts` counts the estate against an exact base-ref floor; `discovery_graph.ts` maps artefact relations |
| Canonical controlled vocabulary, hard lint | already-fixed | `lint_canonical_terms.ts`, 1,583 files scanned, ratcheted at 1,006/1,007 on 2026-08-27 |
| Drain rationale — merge state is not correctness | already-owned | `road-to-evidence-gated-change.md` in this estate |
| Make delivery observable, staged migration | already-owned | `later/road-to-thin-flip-under-anchor-scoring.md`, a three-gate design with two recorded failed measurements and ADR-202 behind it |
| One automatic routing hop | already-decided, more strongly | a second retrieval router was REJECTED by council 2026-07-07; `later/road-to-deferred-rule-retriever.md` holds it behind three named re-open conditions |
| Eight-state finding lifecycle | corrected — extend, do not add | `check_finding_dispositions.ts` already ships a committed ledger with `fixed \| false_positive \| accepted_risk` plus rationale and `verified_by`. A parallel eight-state vocabulary is the duplicate-terminology failure the source's own third-pass challenge names |

**The rows do not share one kind of authority, and the table should not read as
if they do** — added 2026-08-27 per gate finding `75d4bd8c5efc` (low): only one
row cites an ADR, which invites the reading that the others are weaker. They are
not weaker, they are different: rows 1, 2 and 6 cite a **shipped script**, which
is the strongest form here because it can be run; row 3 cites an **active
roadmap**; row 4 cites a parked roadmap **plus** ADR-202; row 5 cites a **council
REJECT of 2026-07-07** whose record lives in the archived flow-learnings and
whose re-open conditions are carried in `later/road-to-deferred-rule-retriever.md:12`
— a council decision, not an ADR, and citing an ADR number it does not have
would be the fabrication this table exists to avoid.

## Corrected from reproduction — two collisions in the source's own text

- **The field name `requires:` is taken.** The source's relationship block lists
  `implements / requires / extends / replaces / runtime_level / side_effects /
  evidence`. `src/scripts/schemas/skill.schema.json:48` states that `requires` is
  reserved for ADR-015 pack-dependency edges, validated in
  `build_discovery_manifest.ts`, and that "reusing it makes every skill carrying
  one unassignable in the discovery manifest". The same schema already ships
  `runtime_requires` (`:45`) and `harness_compat` (`:37`) for the runtime half.
  Any field this roadmap adds is named against that schema, never against the
  source's list.
- **`side_effects` would be the third risk vocabulary.** The source pairs it with
  a ten-value hint list. Before any of it is adopted, Phase 2 reconciles against
  what exists rather than landing beside it.

## Phase 1 — Measure the gap before building for it

- [ ] **1.1 Sample the authoring record.** Take the twenty most recently added
      skills and rules by first-commit date and record, per artefact, whether any
      committed text states what incumbent was searched and what the delta is.
      verify: a table of twenty rows with a `file:line` per positive and an
      explicit blank per negative, written to `agents/evidence/analysis/`.
- [ ] **1.2 State the rate, and let it decide the shape.** If the rate is high,
      the mechanism is a lint over a convention that already exists; if it is
      low, it is a new field. Write which, and why, before Phase 2 starts.
      verify: the sentence names the measured count out of twenty, not an
      impression.
- [ ] **1.3 Kill criterion, with its own detector validated first.** If 15 or
      more of the 20 already carry a searchable record, Phases 2 to 4 are
      cancelled and this roadmap closes with the measurement as its deliverable.
      **The criterion may not be evaluated until 1.1's detection has been checked
      in both directions** — added 2026-08-27 per gate finding `e76ae09bb9f2`
      (medium): a criterion whose instrument is unvalidated can cancel real work
      on a miss, or authorise unnecessary work on a false hit, and neither is
      visible from the count alone.
      verify: before the count is read, one artefact known to carry a record and
      one known to carry none are run through the same detection and come back
      positive and negative respectively. Then the criterion is evaluated in
      writing against 1.1's table, with the cancel or continue stated **and the
      two-direction check cited**. A count from an instrument never seen fail is
      not a count.

## Phase 2 — One disposition vocabulary, reconciled

- [ ] **2.1 Inventory the vocabularies in the tree.** Enumerate every enum that
      records "what happened to a candidate" — the finding dispositions in
      `check_finding_dispositions.ts`, the review dispositions in
      `check_review_dispositions.ts`, the roadmap glyphs, the blocker `Status:`
      token.
      verify: one table, each row citing the file and line that defines the enum.
- [ ] **2.2 Decide extend-or-add, per enum.** For each, state whether the
      authoring disposition reuses it, extends it, or genuinely needs its own,
      with the discriminator that makes them different.
      verify: no row reads "genuinely new" without naming a case the existing
      enum cannot express.
- [ ] **2.3 Register the result with the canonical-term lint.** Whatever 2.2
      settles on is added to the canonical-term corpus so a fourth vocabulary
      cannot appear unnoticed.
      verify: `./scripts-run src/scripts/lint_canonical_terms` runs clean and its
      scanned count is reported before and after.

## Phase 3 — Record the search where the artefact is authored

- [ ] **3.1 Add the field to the schema.** A single frontmatter object holding
      the incumbent searched, the disposition from Phase 2, and the delta in one
      sentence. Named against `skill.schema.json`, never against the source's
      list.
      verify: the schema validates, `npm run typecheck` is clean, and a fixture
      artefact carrying the field passes the skill linter.
- [ ] **3.2 Backfill nothing.** The field is optional on existing artefacts and
      required only on additions, so the change costs 299 edits of zero.
      verify: the linter is run over the whole corpus and reports zero new
      violations.
- [ ] **3.3 Teach the authoring surface.** `artifact-drafting-protocol` Phase B
      already mandates the scan; it now names where the answer is written.
      verify: the rule cites the field, and the reference resolves under
      `check_references`.

## Phase 4 — Advisory first, and only then a gate

- [ ] **4.1 Report, do not block.** A check that reports additions carrying no
      record, registered in `src/config/gate-coverage.yml` with a
      `reportScanned` count and a `--self-test`.
      verify: the gate is green on the current tree and its canary — an added but
      still untracked artefact, enumerated with the others-listing form of
      `ls-files` — is reported, so a diff-scoped check is not silently blind.
- [ ] **4.2 Measure the false-positive rate before proposing a block.** Run
      advisory for one release and record how often the finding was wrong.
      verify: the rate is a number in `agents/evidence/analysis/`, and no
      blocking flip is proposed in this roadmap. A measurement is not a gate.

## Blockers

### blocker: disposition-vocabulary-authority

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 step 2.2 only. Phase 1 lands regardless, and 2.1's
  inventory is a measurement that is useful whichever way this goes.
- **What to do:** pick exactly one — (a) the authoring disposition reuses the
  finding-disposition enum, accepting that "extend an incumbent" is recorded as a
  status that enum was not designed for; (b) it gets its own enum, which makes
  four in the tree and needs the canonical-term registration in 2.3 to be
  load-bearing; or (c) the enums are unified into one shared definition, which is
  the tidiest answer and the only one that touches release tooling.
- **Resolved when:** the answer is recorded in the roadmap and, for (c), in an
  ADR — unifying an enum that gates a release is a contract change.
- **Recommendation:** (b), then reconsider (c) once 4.2 has a false-positive
  rate. (c) touches `check_finding_dispositions.ts`, which is red-on-release
  tooling, and doing that before this mechanism has shown it is worth keeping
  spends a contract change on an unproven field.
- **If you do nothing:** Phase 1 produces the measurement and 1.3 may cancel the
  rest of the roadmap on it. That is a real outcome, not a stalled one.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The field becomes a pro-forma line | product | An author who must write "searched X, delta Y" will write it whether or not a search happened, and the estate then carries 299 sentences that prove nothing while looking like evidence. This is the failure the schema itself already refuses for speculative fields | 1.1 measures whether the record is missing before anything is built, and 1.3 cancels the mechanism outright if the rate says the convention already exists; 4.2 measures whether the resulting findings are right before any block is proposed | Phase 1 — Measure the gap before building for it |
| 2 | A fourth disposition vocabulary lands beside three | implementation | The source proposes new enums for findings, closures and side effects. Adding them without reconciliation is the duplicate-terminology defect this tree already has a lint for, and it would be introduced by the very roadmap meant to prevent uncontrolled growth | Phase 2 inventories every existing enum with a file:line before deciding, 2.2 forbids a "genuinely new" verdict without a case the incumbent cannot express, and 2.3 registers the outcome with the canonical-term lint | Phase 2 — One disposition vocabulary, reconciled |
| 3 | The gate is diff-scoped and therefore blind | implementation | A check reading only the committed diff reports nothing on an addition that has not been committed yet, exits green, and reads as coverage. This tree has recorded that failure before | 4.1 requires the canary to enumerate untracked additions and requires a `--self-test`, so a scan of nothing cannot pass as a scan | Phase 4 — Advisory first, and only then a gate |
| 4 | The field name collides with a reserved key | implementation | The source's list reuses `requires`, which the discovery manifest reserves for pack edges; adopting it verbatim makes every skill carrying one unassignable | The collision is stated in the roadmap body and 3.1 requires the name to be chosen against `skill.schema.json` rather than against the source | Phase 3 — Record the search where the artefact is authored |
| 5 | Phase 1 is skipped because the conclusion feels obvious | product | "Nothing records this" is easy to believe and was in fact the working hypothesis; if it is wrong the whole roadmap is a mechanism for a gap that is not there | 1.3 is a written kill criterion with a number, evaluated before Phase 2 may start, rather than a caveat at the end | Phase 1 — Measure the gap before building for it |

## Acceptance Criteria

- [ ] AC-1 — The twenty-artefact sample exists with a `file:line` per positive
      and a blank per negative, and the kill criterion has been evaluated in
      writing against it. A cancelled roadmap satisfies this criterion.
- [ ] AC-2 — Every "what happened to a candidate" enum in the tree is listed with
      the file and line that defines it, and each one carries an extend-or-add
      verdict naming a case the incumbent cannot express.
- [ ] AC-3 — No enum added by this roadmap is absent from the canonical-term
      corpus, demonstrated by the lint's scanned count before and after.
- [ ] AC-4 — The advisory check reports an added-but-untracked artefact in its
      canary run, so its scope is proved non-empty rather than assumed.
- [ ] AC-5 — No blocking flip is proposed anywhere in this roadmap without a
      recorded false-positive rate from at least one release of advisory
      operation.
