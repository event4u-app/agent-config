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

- [x] **1.1 Sample the authoring record.** Take the twenty most recently added
      skills and rules by first-commit date and record, per artefact, whether any
      committed text states what incumbent was searched and what the delta is.
      verify: **discharged.** `agents/evidence/analysis/authoring-search-record-sample-2026-08-27.md` — twenty rows, `file:line` per positive, explicit blank per negative (rows 13 `experiment-loop` and 15 `forensics-report`). Sample selected by first-commit date, 2026-08-06 to 2026-08-23.
- [x] **1.2 State the rate, and let it decide the shape.** If the rate is high,
      the mechanism is a lint over a convention that already exists; if it is
      low, it is a new field. Write which, and why, before Phase 2 starts.
      verify: **discharged, and the step's own premise was wrong in an informative way.** The word "record" turned out to admit three readings with three different counts — **machine-readable 1/20**, **strict prose 9/20**, **loose prose 18/20** — so "the rate" is not a single number and could not decide the shape by itself. The council chose the shape instead, on the measurement: a new field, not a lint over a convention, because 1/20 is the count for the thing the Goal actually asks for ("machine-readable, written at authoring time, checkable"). One seat took the strict reading and one the machine-readable; both continue, and both explicitly rejected the loose one.
- [x] **1.3 Kill criterion, with its own detector validated first.** If 15 or
      more of the 20 already carry a searchable record, Phases 2 to 4 are
      cancelled and this roadmap closes with the measurement as its deliverable.
      **The criterion may not be evaluated until 1.1's detection has been checked
      in both directions** — added 2026-08-27 per gate finding `e76ae09bb9f2`
      (medium): a criterion whose instrument is unvalidated can cancel real work
      on a miss, or authorise unnecessary work on a false hit, and neither is
      visible from the count alone.
      verify: **discharged, in that order.** Two-direction check ran **before** the count was read and is the first table in the evidence artefact: known-positive `src/rules/fix-what-you-see.md:77-87` (`## Why separate from active-remediation`) detected **positive**; known-negative `src/skills/experiment-loop/SKILL.md` (no incumbent named anywhere in the file) detected **negative**. Criterion evaluated in writing: it fires at ≥15/20, and it **does not fire** — 1/20 machine-readable, 9/20 strict. **Continue.** The loose reading at 18/20 would have cancelled, and both council seats rejected it: a `See also` gloss or a `Do NOT use when` routing row names a neighbour without recording that it was evaluated as an incumbent or why creation stayed justified.

## Phase 2 — One disposition vocabulary, reconciled

- [x] **2.1 Inventory the vocabularies in the tree.** Enumerate every enum that
      records "what happened to a candidate" — the finding dispositions in
      `check_finding_dispositions.ts`, the review dispositions in
      `check_review_dispositions.ts`, the roadmap glyphs, the blocker `Status:`
      token.
      verify: **discharged, and the step undercounted — six, not four.** `check_finding_dispositions.ts:43` (`fixed | false_positive | accepted_risk`) · `check_completion_review.ts:281` (`open | fixed | accepted-risk | deferred`) · `check_review_dispositions.ts:53` (terminal set `fixed | accepted-risk | deferred`) · `build_archive_index.ts:71-76` (`Disposition`: `completed | completed-with-deferrals | closed-with-cancellations | archived-with-open-steps | not-extractable`) · **`lint_harvest_provenance.ts:76` (`adopt | adapt`)** — not in the step's list and the closest incumbent of all · `lint_roadmap_blockers.ts:48` + `:193` (the `Status:` token, `open | resolved`). The roadmap glyphs are defined at `build_archive_index.ts:63` as a regex over four characters, not as a named enum. All six are pinned in `tests/scripts/lint_composition_review.test.ts` § disjointness with their file:line in comments, so a seventh colliding value reds.
- [x] **2.2 Decide extend-or-add, per enum.** For each, state whether the
      authoring disposition reuses it, extends it, or genuinely needs its own,
      with the discriminator that makes them different.
      verify: **discharged — genuinely new, and the case is named.** All six incumbents are rejected for one reason each, none of them "it feels different": the finding, completion-review and archived-review vocabularies classify **defects and review rows**; `build_archive_index`'s `Disposition` classifies a **roadmap file's closure shape**; the blocker `Status:` token classifies a **blocker's lifecycle**. The nearest is the harvest ledger's `adopt | adapt`, and it is rejected on its own recorded design: `lint_harvest_provenance.ts:222` deliberately **excludes** `reject`/`already`/`unclear`, because a rejected harvest has no artefact to cite. This record is the mirror image — it is written **on** the artefact being created — so rejection is the value it most needs. That value is `create_separate`: an incumbent exists, was evaluated, and a separate artefact was authored anyway. No incumbent vocabulary has a slot for it, asserted in the disjointness suite. Council 2026-08-27, 2/2, option (b).
- [x] **2.3 Register the result with the canonical-term lint.** Whatever 2.2
      settles on is added to the canonical-term corpus so a fourth vocabulary
      cannot appear unnoticed.
      verify: **intent discharged, venue corrected.** `lint_canonical_terms` runs clean and its scanned count is **1,586 before and 1,586 after** — unchanged, and that is the finding: the file maps **spelling variants** to a canonical spelling (`behaviour` → `behavior`), and an enum value is not a misspelling of anything, so registering there would have satisfied this verify literally while guarding nothing. The obligation — "so a fourth vocabulary cannot appear unnoticed" — is discharged where it can bite instead: `tests/scripts/lint_composition_review.test.ts` § *composition dispositions are disjoint from every incumbent vocabulary* pins all six incumbents with their file:line and fails when any value appears in two of them. Sensitivity proven: adding `deferred` to the enum turns **2 red**, naming the review vocabulary it collides with. A second spec pins the two JSON schemas' `enum` to the exported constant, so a schema and the script cannot disagree about the vocabulary.

## Phase 3 — Record the search where the artefact is authored

- [x] **3.1 Add the field to the schema.** A single frontmatter object holding
      the incumbent searched, the disposition from Phase 2, and the delta in one
      sentence. Named against `skill.schema.json`, never against the source's
      list.
      verify: **discharged.** `composition_review` added to **both** `src/scripts/schemas/skill.schema.json` and `src/scripts/schemas/rule.schema.json` (15 lines each, inserted rather than round-tripped so the diff carries no reformat). Named against those schemas, never against the source's list: `requires` is untouched. `task typecheck-ts` exits 0. Fixture artefacts carrying the field are driven through the real CLI by `--self-test` (8 cases, 5 rejecting) rather than committed as tracked files — a tracked fixture with a deliberately malformed record would be a permanent violation of the gate that reads it.
- [x] **3.2 Backfill nothing.** The field is optional on existing artefacts and
      required only on additions, so the change costs 299 edits of zero.
      verify: **discharged.** `validate_frontmatter` — **450 artefacts, 0 failing, 0 with warnings**. `lint_composition_review` — **419 artefacts, records well-formed, 0 additions without one**. The field is optional in both schemas, so the change costs 299 edits of zero exactly as the step predicted.
- [x] **3.3 Teach the authoring surface.** `artifact-drafting-protocol` Phase B
      already mandates the scan; it now names where the answer is written.
      verify: **discharged, and it cost a stated ceiling raise.** `artifact-drafting-protocol` § The three phases now says Phase B's verdict is written into the artefact and names `composition_review:`; the lookup material (YAML shape, the four dispositions with discriminators, why `none_found` must exist, why `create_separate` is the value no incumbent can express, what the lint can and cannot check) went to the pointer target, `docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md` § Where the answer is written. `check_references`: 1,713 scanned, no broken references. `check_rule_stub_ceiling` correctly refused the growth twice; after two shrink passes (928 → 783 → 754 tokens) the residual +74 is obligation surface that cannot move without the rule mandating a field it does not name, so the ceiling was raised **680 → 754 — the exact measured count, no slack** — with a `history` entry stating the reason. The ceiling was hand-set rather than written by `--write-baseline`, because that mode additionally re-anchored five unrelated ceilings downward (`context-hygiene` 2470→1979, `improve-before-implement` 1385→840, and three more) — real shrink-only gains, but ones this change neither made nor measured, and locking them in here would be a ratchet moved on a local reading.

## Phase 4 — Advisory first, and only then a gate

- [x] **4.1 Report, do not block.** A check that reports additions carrying no
      record, registered in `src/config/gate-coverage.yml` with a
      `reportScanned` count and a `--self-test`.
      verify: **discharged, both halves probed separately.** `src/scripts/lint_composition_review.ts` is green on the tree (**419 artefacts scanned**, floor 380) and registered in `src/config/gate-coverage.yml` with a `reportScanned` count, a `--self-test` and a `canary:` recipe — `check_gate_coverage` reports **every enforced gate cleared its coverage floor**, and `check_gate_coverage --canary` reports *"lint_composition_review: caught the planted contract-violation defect (exit 1)"*. The **advisory** half was probed on its own, because the canary proves the hard half only: an untracked `src/rules/__advisory_probe__.md` with no record was reported by path at **exit 0** (`420 artefact(s) … 1 addition(s) without one`), and the tree was clean after removal. That is the blindness the step names — `addedArtefacts` unions `git diff --diff-filter=A` with `git ls-files --others --exclude-standard`, so a create-only plant is visible. Six further surfaces registered: `taskfiles/ci-fast.yml`, the `ci:` list in `Taskfile.yml`, a step in `.github/workflows/consistency.yml` with the same argv and exit-2-degraded handling, and the gate-coverage header denominators updated **in place, same line count** so the `.secret-allow` PEM pin held at line 487. `check_ci_local_parity` green (153 CI / 290 local); `gate-self-test:registered-non-adopters` unchanged at 24 because the gate carries a `--self-test`.
- [~] **4.2 Measure the false-positive rate before proposing a block.**
      <!-- deferred-resolution: carried-to=road-to-composition-review-false-positive-rate --> Run
      advisory for one release and record how often the finding was wrong.
      verify: **second half discharged, first half CARRIED — `[~]`.** No blocking flip is proposed anywhere in this roadmap, and the advisory half exits 0 by construction, asserted by a spec. The rate itself is **unexecutable rather than unfinished**: it requires "one release of advisory operation", which is elapsed time, and on the day this roadmap closes the population is zero additions. Carried into `road-to-composition-review-false-positive-rate.md`, **created in this same change** — the council-decidable disposition under `roadmap-progress-sync` Iron Law 3's preservation test, since the item stays alive in the active estate. That file writes the true-positive / false-positive definitions **before** any collection, names the two known false-positive shapes, requires the population to be greater than zero (a rate over an empty population closes nothing), and forbids proposing a flip itself. Estate: +1 active, −1 disposed, and it carries no blocker, so the `open_blockers` floor is untouched. **Correction, 2026-08-27 (same day):** the carried file was measured against its own AC-1 immediately after this roadmap closed and the population was **0** — the gate had landed two commits earlier, so no in-scope artefact had yet been added. A council round (anthropic + openai, 2/2 convergent) parked it in `agents/roadmaps/later/` with a recorded measurement baseline and a `revisit-if`. The disposition therefore reads **carried, then parked**, and the clause above claiming the item "stays alive in the active estate" is true of the moment this roadmap closed and false thereafter. The item is preserved, not dropped; it is simply not on the dashboard.

## Blockers

### blocker: disposition-vocabulary-authority

- **Status:** resolved
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
- **Resolution — (b), 2026-08-27.** AI council, 2 seats (anthropic + openai),
  **2/2 convergent**. Substituting for maintainer sign-off under the drain
  mandate. Both seats: the composition record gets its own enum, and (c)
  unification is deferred rather than rejected — it expands scope into
  release tooling (`check_finding_dispositions.ts` is red-on-release) before a
  shared domain model has been shown to exist, and the parent's own sequencing
  puts it after a false-positive rate. Neither seat would reuse the finding
  enum: `fixed | false_positive | accepted_risk` describes **defect
  remediation**, and forcing "extend an incumbent" into it produces records
  whose meaning cannot be recovered.

  The step's own bar — name a case the incumbent cannot express — is met by
  `create_separate`, and the argument is the harvest ledger's, not an opinion:
  `lint_harvest_provenance.ts:222` **excludes** rejection from `adopt | adapt`
  because a rejected harvest has no artefact to cite, while this record is
  written on the artefact being created and therefore needs rejection most.
  Enforced by the disjointness suite rather than asserted.
- **Five defects in the shipped gate were found by an independent cross-model
  review after 4.1 was written, and all five are fixed rather than noted.**
  Neither seat wrote the code or the review prompt's expectations; the scope was
  the whole non-doc delta, split mechanically by file group because it exceeded
  the transport ceiling.

  1. **The contract over-claimed.** This module's docstring and BOTH schema
     descriptions said a lint checks that `candidate` resolves — while the code
     exempted `command:` and `guideline:` with a comment calling their trees
     unwalked. `candidate: command:this-does-not-exist` passed every check. Two
     ways to close it; the trees are readable, so `artefactIds` now walks all
     four kinds and the claim is earned. Commands resolve as the path below their
     pack (`command:refine-ticket`), guidelines without the extension
     (`guideline:code-clarity`).
  2. **`composition_review: []` was accepted.** Present, saying nothing —
     neither of the two states the gate distinguishes. The schema's `minItems: 1`
     catches it, but a gate claiming "present and malformed → exit 1" has to
     deliver that itself rather than assume another gate ran first. Now
     `empty-record`.
  3. **A git failure read as "no additions".** With an unresolvable base ref the
     diff call failed, the catch returned `[]`, and the gate exited 0 reporting
     zero advisories — a blind run indistinguishable from a clean one, which is
     the exact failure `gate-coverage.yml`'s own header describes. Now throws
     `GitScopeError`.
  4. **The advisory path had ZERO test coverage**, despite a comment calling its
     `ls-files --others` union load-bearing. Now covered by a real git fixture:
     an untracked artifact is reported and a committed one is not.
  5. **Two parser holes.** A YAML block scalar (`rationale: |`) captured the `|`
     and produced a one-character value — valid YAML read wrongly, which is worse
     than a parse error because it looks like data. And the candidate grammar
     admitted `guideline:/foo`, `guideline:foo/` and `guideline:foo//bar`. Both
     rejected now.

  Sensitivity, one probe per finding: restoring the carve-out turns **2** red,
  accepting an empty record **1**, git-failure-as-empty **1**, the loose grammar
  **1**, unmarking block scalars **1**; 24/24 restored, tree clean.

  Two of the original specs had to be **corrected rather than kept**: one
  asserted the carve-out that turned out to be the defect, and one measured the
  coverage floor against `artefactIds` rather than the scanned corpus, so it went
  red the moment candidate resolution widened — the floor it was checking had not
  changed.
- **Revisit-if:** the false-positive rate from
  `road-to-composition-review-false-positive-rate.md` lands **and** the four
  vocabularies show genuine semantic equivalence — not merely similar enum
  mechanics — or maintaining separate validators starts producing contradictory
  classifications of the same string. Neither seat adopted a numeric threshold
  for this: one proposed 60% vocabulary overlap and 6-month adoption windows,
  the other rejected all of them as unsupported by any measurement here, and
  they are **not** recorded as conditions.

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

- [x] AC-1 — The twenty-artefact sample exists with a `file:line` per positive
      and a blank per negative, and the kill criterion has been evaluated in
      writing against it. A cancelled roadmap satisfies this criterion.
- [x] AC-2 — Every "what happened to a candidate" enum in the tree is listed with
      the file and line that defines it, and each one carries an extend-or-add
      verdict naming a case the incumbent cannot express.
- [x] AC-3 — No enum added by this roadmap is absent from the canonical-term
      corpus, demonstrated by the lint's scanned count before and after.
- [x] AC-4 — The advisory check reports an added-but-untracked artefact in its
      canary run, so its scope is proved non-empty rather than assumed.
- [x] AC-5 — No blocking flip is proposed anywhere in this roadmap without a
      recorded false-positive rate from at least one release of advisory
      operation.

**AC-3 is `[x]` on its intent, not on its literal venue.** It asks that no enum
added here be absent from the canonical-term corpus, "demonstrated by the lint's
scanned count before and after". The count is 1,586 both sides and that is
correct: `canonical-terms.yml` maps spelling variants, so an enum value has no
row to occupy there. The guard that actually holds the obligation is the
disjointness suite, whose sensitivity is proven (adding `deferred` to the enum
turns 2 red). Recorded rather than quietly re-scoped — see step 2.3.

**AC-4 is `[x]` on the advisory half specifically.** The `--canary` recipe proves
the gate can still fail, but it plants a *malformed* record, so it exercises the
hard half. The added-but-untracked case AC-4 names was probed separately and is
reported at exit 0. Both probes are recorded at step 4.1; neither substitutes for
the other.
