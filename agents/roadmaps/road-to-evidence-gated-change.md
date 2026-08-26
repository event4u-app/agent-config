---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-26
relates: []
# relates: grepped every active, later and archived roadmap for `test-first`,
# `test-driven`, `TDD` and `reuse-first`. One hit, `later/road-to-surface-consolidation.md:75`,
# and it is about slash-command cluster count, not about test ordering. No sibling
# roadmap carries a test-ordering or reuse-verdict item.
estate_growth_exempt: "Charges +0 on the COUNT half (status-scoped, this file is draft) and +1 on one-in-one-out, which is file-based. Warranted on a measurement rather than an opinion: four independently drafted proposals landed on the same three defects, and all three reproduce verbatim at HEAD 1c8321f0c — a flagship command telling the agent to write tests alongside the implementation, an engine step tuple that orders production before any test, and a RED contract that is unsatisfiable for a symbol that does not exist yet. The scope below is the intersection that survived verification; roughly half of what the four proposals asked for is dropped in the section of that name."
estate_offset_exempt: "No archive move is available in this change. The four source proposals are consolidated into this one file rather than landed as four, which is the offset that was available to make."
---
# Road to evidence-gated change — the order is wrong in three places, and nothing at runtime notices

> **Source:** `agents/tmp.old/reduntandt-3/` (2026-08-26) — four separately
> drafted proposals for the same workstream plus the transcript that produced
> them. Two models drafted independently, then each critiqued the other; the
> inbox directory is named for the redundancy. The originating request was one
> sentence from the maintainer of a consumer project: plan tests first, and look
> for existing code before writing new code, including the case where a `v1`
> controller carries the more modern implementation than a `v2` one.
>
> Every claim below was re-derived at HEAD `1c8321f0c`. The pinned commit the
> proposals used, `2f73c2d`, is an ancestor with eight commits since, none of
> which touch a cited surface — so nothing here was overtaken. What did not
> survive is in § Prevented, and what the proposals asked for and this roadmap
> refuses is in § Dropped.
>
> External references informing the proposals are deliberately unnamed here per
> `source-confidentiality`; three of them are on the denylist and naming them
> would red `check_no_external_sources`.

## Goal

A behaviour-changing change cannot reach production code before two questions
have been answered where a later reader can check the answer: does this already
exist in the tree, and has a relevant test been observed failing. Finished
means: the three surfaces that currently instruct the opposite have been
corrected, the RED contract admits the failure a not-yet-existing symbol
actually produces, the existence question fires on the change classes that
currently skip it, one runtime carrier observes the phase instead of only prose
asking for it, and the surface-version-is-not-implementation-generation
distinction is recorded as a decision with a golden fixture that fails without it.

## What is already built — read this before proposing a mechanism

Nine mechanisms the proposals asked for already exist. This is the most
valuable finding in the whole analysis, and it is why this roadmap is a
sixth the size of what arrived.

- **The four-mode TDD contract with diff-checkable prohibitions** —
  `src/skills/test-driven-development/SKILL.md:91-98`. The Implement row already
  forbids test edits and names changing the assertion to fit the code as the
  canonical violation; the Debug row already forbids a bugfix before a
  reproducing test. A runtime guard would be a carrier for this prose, not new
  policy.
- **The unlock condition for that carrier is already recorded** —
  `src/config/assurance-capability-registry.json:52-58` carries
  `revisit_if: a durable RED-run identifier is emitted somewhere a later reader
  can check`. Phase 4 discharges a recorded revisit condition rather than
  opening a new one.
- **Inventory-before-you-add already ships, for UI** — `src/rules/ui-audit-gate.md`
  plus `src/skills/existing-ui-audit/SKILL.md:20-22`, with a diff-decidable
  cheap path. Phase 3 generalises a shipped pattern.
- **The Evidence Report contract** — `src/skills/source-discovery/SKILL.md:35`
  and `src/rules/source-discovery-gate.md:38-51`. Verified / Assumed / Gaps with
  provenance exists; its scope is DB, API, DTO and vendor structure, not code reuse.
- **The solution-size ladder** — `src/rules/improve-before-implement.md:49-51`,
  a partial change-strategy decision already in the tree.
- **A symbol and caller search engine** — `src/skills/code-intelligence/SKILL.md`
  and `agent-config code-graph detect|query|affected|path`, with
  `src/rules/external-code-graph-interop.md` already mandating query-before-grep.
- **Parallel Change under another name** — `src/skills/migration-architect/SKILL.md:61,97`
  carries expand, migrate, contract plus dual-write and strangler.
- **A repo-local canonical-procedure artefact class** — `playbook-authoring`
  plus `playbook-precedence` (ADR-244), already graded `configured` or `observed`
  and already ruling that the local answer bounds the generic skill. The
  conventions map two proposals wanted is this artefact re-invented.
- **The completion gate is live and hook-enforced** —
  `src/rules/verify-before-complete.md:10-11`. Phase 4.4 is a clause edit inside
  a running gate, not a new gate.

## Context — the three defects, measured at HEAD `1c8321f0c`

- **D1, a flagship command instructs test-after.**
  `src/domains/engineering-base/feature/dev/command.md:91` reads
  `6. Write tests alongside the implementation.` The whole command mentions
  `test` three times and `TDD` zero times. The projection carries it too,
  `dist/agent-src/commands/feature/dev.md:91`.
- **D2, the engine orders production before any test, in code.**
  `src/agent-src/templates/scripts/work_engine/directives/backend/index.ts:52-55`
  hard-orders `plan, implement, test, verify`, and both engine descriptions say
  the same in prose: `work/command.md:10`, `implement-ticket/command.md:10`.
  This is a stronger instance than D1 and no proposal named it as code.
- **D3, the RED contract is unsatisfiable for a new symbol.**
  `src/skills/test-driven-development/SKILL.md:94` requires the test to fail
  `at an assertion, not an import/setup error`, and the same requirement sits in
  a second surface, `src/domains/engineering-base/tdd/red/command.md`. A class
  that does not exist can only fail at load, so the contract as written forces a
  production stub before the first test — which is the thing it exists to forbid.
- **D4, the discipline has no always-on carrier.** `src/rules/` contains no test
  or TDD rule at all; the only rule-layer mention is
  `src/rules/think-before-action.md:43`, which is `type: auto`. The discipline
  lives entirely in an activation-gated skill, and `src/scripts/hook_manifest.yaml`
  carries no TDD concern among its registered set.
- **D5, the existence question is inert on the changes that duplicate most.**
  `src/rules/improve-before-implement.md:38-43` excludes bug fixes and trivial
  changes from activation, and the reuse rung at `:51` sits inside that scope.
- **D6, follow-existing-patterns has no anchor.** `src/rules/architecture.md:38`
  and `src/skills/developer-like-execution/SKILL.md:232` both instruct
  pattern-following, and nothing in the tree says which in-repo pattern is the
  current one. `characteriz`, `fitness function` and any lineage concept return
  zero relevant hits across `src/`.

## Prevented — proposal claims that did not survive re-derivation

- **The reuse scan cannot live in the TDD design mode.** Two proposals put it
  there as the one point every behaviour passes. The orchestrator is
  maintainer-only: `src/domains/engineering-base/tdd/command.md:4,6,17-20` carries
  `visibility: internal`, `disable-model-invocation: true` and
  `workspaces: [agent-config-maintainer]`. A consumer cannot reach it, so the
  chokepoint argument fails on delivery, not on taste.
- **Profile mapping `full` / `balanced` / `minimal` does not exist as an enum.**
  Those are installer presets; the key is `discipline_profile` with
  `off|essential|full|auto|custom` (`src/config/agent-settings.template.yml:134,157`).
  A new `discipline.tdd` key exists in neither proposal-land nor the tree.
- **`agents/context/conventions-map.md` names a directory that does not exist.**
  The convention is `agents/settings/contexts/`, and the artefact class is
  `playbook-authoring`.
- **The commit-order test-first check was never in the tree.**
  `src/skills/judge-test-coverage/SKILL.md` contains zero commit references, so
  one proposal spends a correction removing something unbuilt. The underlying
  point stands and is Phase 4: evidence comes from runtime, not chronology.
- **Git-recency-as-authority was a straw man.** The proposal it criticises names
  the human as the source of truth and uses recency only to seed a draft.
- **The cross-surface consolidation sweep is near-empty.** One source site for
  `tests alongside`, zero for `write tests after`. Phase 1 covers it in one step.
- **`road-to-code-intelligence-master` does not exist**; the real file is
  `agents/roadmaps/later/`-adjacent `road-to-native-code-intelligence.md`, so the
  estate question one proposal raised is answered by looking.

## Phase 1 — The three surfaces that instruct test-after

- [ ] **1.1 Replace the test-after instruction in the flagship feature command.**
      `src/domains/engineering-base/feature/dev/command.md:91` currently reads
      `Write tests alongside the implementation`, which contradicts the TDD skill
      it never cites. Replace it with a per-behaviour instruction: one failing
      test, then the minimum code for that one behaviour, then the next behaviour.
      Regenerate the projection in the same change.
      <!-- verify: grep -rn "tests alongside" src/ dist/ | wc -l  (expect 0) -->
- [ ] **1.2 Stop emitting tests as a summary afterthought in planning.**
      `src/skills/feature-planning/SKILL.md:135` lists tests under
      `Suggest next steps`, and `:150` ships an example plan whose steps are
      `Add login endpoint` then `Update tests` — the exact shape this workstream
      exists to reject. Replace the example with a behaviour-slice pair and move
      the test obligation out of the summary phase.
      <!-- verify: grep -n "next steps (tests" src/skills/feature-planning/SKILL.md | wc -l  (expect 0) -->
- [ ] **1.3 Raise the rule-layer wording from a preference to a default.**
      `src/rules/think-before-action.md:43` says `prefer test-first / TDD`. Make
      it the default for behaviour-changing work with an override that is
      recorded rather than silent, and cite the TDD skill Do-NOT list at
      `src/skills/test-driven-development/SKILL.md:20-25` as the single exception
      set instead of restating exceptions.
      <!-- verify: grep -n "prefer test-first" src/rules/think-before-action.md | wc -l  (expect 0) -->
- [ ] **1.4 Record the engine ordering decision without producing batch-TDD.**
      `.../work_engine/directives/backend/index.ts:52-55` is a linear tuple, so
      moving `test` in front of `implement` buys a single test phase followed by
      a single code phase — the second anti-pattern, not a fix. Instead make the
      `implement` directive refuse to emit production work for a behaviour that
      has no observed failing test yet, and state in `index.ts` why the tuple
      order stays. Update both engine descriptions at `:10` to match.
      <!-- verify: task test -- --filter=work_engine -->

## Phase 2 — A RED that a not-yet-existing symbol can actually produce

- [ ] **2.1 Replace assertion-only RED with failure relevance in the skill.**
      In the Test-Red row of the mode-contract table
      (`src/skills/test-driven-development/SKILL.md:91-98`), admit three valid
      failures — a failing assertion, a missing target such as class-not-found
      or a compile or type error naming the unimplemented symbol, and a contract
      failure — and name four invalid ones: a broken fixture, a syntax error in
      the test, a missing unrelated dependency, and a runner or environment
      fault. The discriminator is whether the failure is about the behaviour
      under test.
      <!-- verify: grep -n "not an import/setup error" src/skills/test-driven-development/SKILL.md | wc -l  (expect 0) -->
- [ ] **2.2 Apply the same taxonomy to the second surface.**
      `src/domains/engineering-base/tdd/red/command.md` carries the same
      assertion-only requirement in its description. One of the two surfaces
      edited alone leaves the contradiction reachable.
      <!-- verify: grep -rn "at an assertion, not" src/domains/engineering-base/tdd/ | wc -l  (expect 0) -->
- [ ] **2.3 Scope the delete-and-restart Iron Law to the case it was written for.**
      `src/skills/test-driven-development/SKILL.md:75-78` says delete the code,
      write the test, reimplement, with no qualification — which reads as a
      standing instruction to delete tested legacy that a reuse verdict would
      keep. Split it into three cases: untested code this task just wrote,
      delete and restart; pre-existing tested code, keeping it is legitimate;
      pre-existing untested code, write a characterization test that pins
      current behaviour first. The file is at 352 lines against a 400-line cap,
      so put the expansion in `src/skills/testing-anti-patterns/` and keep the
      three-case split in the skill.
      <!-- verify: ./scripts-run src/scripts/lint_skills -->

## Phase 3 — The existence question, on the changes that currently skip it

- [ ] **3.1 Fire the existence question on bug fixes and trivial changes.**
      `src/rules/improve-before-implement.md:38-43` excludes both from
      activation, which switches the reuse rung off for exactly the change
      classes that most often duplicate an existing helper. Narrow the exclusion
      to the three heavy checks and let the one cheap question — does this
      already exist in the tree — fire regardless, with the audit-gate cheap-path
      shape from `src/rules/ui-audit-gate.md` as the precedent for keeping it cheap.
      <!-- verify: grep -n "Does NOT activate" -A 6 src/rules/improve-before-implement.md -->
- [ ] **3.2 Give the answer a verdict set instead of a yes or no.**
      Extend the ladder at `src/rules/improve-before-implement.md:49-51` to a
      named verdict — reuse, extract, refactor, extend, migrate, or new — where
      the new verdict owes negative evidence naming the best existing candidate
      and why it does not fit. The order is a thinking preference, not a ranking,
      and textual similarity alone is not grounds for an abstraction.
      <!-- verify: grep -cn "why_not_new\|why not new" src/rules/improve-before-implement.md -->
- [ ] **3.3 Point the search at the engine that already exists.**
      The verdict step calls `agent-config code-graph query` and `code-graph affected`
      rather than specifying a fresh grep protocol; `src/rules/external-code-graph-interop.md`
      already mandates query-before-grep, and a second search specification would
      contradict it.
      <!-- verify: grep -n "code-graph" src/rules/improve-before-implement.md -->
- [ ] **3.4 Record why the discovery gate is not routed through the TDD cluster.**
      Two source proposals put it in the TDD design mode. Add a one-paragraph
      note in the rule stating that `src/domains/engineering-base/tdd/command.md`
      is `visibility: internal` and maintainer-scoped, so a consumer cannot reach
      it — otherwise the next author re-proposes the same routing.
      <!-- verify: grep -n "visibility: internal" src/rules/improve-before-implement.md -->

## Phase 4 — One runtime carrier, advisory first

- [ ] **4.1 Emit a durable RED-run identifier.**
      Write the test-runner outcome that the TDD phase depends on to
      `agents/runtime/state/test-results.json`: the target, the observed failure
      class from Phase 2, and a run identifier a later reader can check. This is
      the artefact `src/config/assurance-capability-registry.json:52-58` names in
      its own `revisit_if`, so the step discharges a recorded condition and the
      registry entry is updated in the same change.
      <!-- verify: task test -- --filter=test_results_state -->
- [ ] **4.2 Add a `tdd-phase-guard` concern, advisory and fail-open.**
      Register a `pre_tool_use` concern in `src/scripts/hook_manifest.yaml` with
      `fail_closed: false` whose rules are the existing Forbidden columns and
      nothing new: a production edit with no observed failing test for the
      current behaviour, a test edit during the implement phase, and a test
      deletion. Phase source is the handoff state the skill already resumes from
      (`src/skills/test-driven-development/SKILL.md:98-105`). No model call per
      edit.
      <!-- verify: ./scripts-run src/scripts/validate_hook_manifest -->
- [ ] **4.3 Derive enforcement from the profile knob that exists.**
      Read the enforcement level from `discipline_profile`
      (`src/config/agent-settings.template.yml:134`) rather than adding a second
      profile axis, and keep the planning default independent of it: the
      discipline stays the default in every profile, only whether the guard warns
      or blocks varies. A profile must never switch the discipline off silently.
      <!-- verify: grep -n "discipline_profile" src/scripts/hooks/tdd_phase_guard.ts -->
- [ ] **4.4 Add the observed red-to-green clause to the completion gate.**
      `src/rules/verify-before-complete.md` is already hook-enforced at `:10-11`.
      Extend its fresh-evidence definition so that, for behaviour-changing work,
      fresh evidence includes the observed failing run and the observed passing
      run of the same target — never the commit order, which squash and rebase
      both destroy.
      <!-- verify: grep -cn "observed" src/rules/verify-before-complete.md -->

## Phase 5 — Surface version is not implementation generation

- [ ] **5.1 Record the two axes as a decision.**
      Write an ADR stating that a public surface version and an implementation
      generation are independent: a controller can be publicly `v1` and carry the
      current internal architecture, and `v2`, file age and most-recent commit are
      weak evidence that never decide alone. Name the canonicality evidence
      order: an applicable live decision record, then an executable architecture
      test, then a shared abstraction in maintained code, then current tests and
      contracts, then several recent analogous implementations, then migration or
      deprecation documentation, then git history, then names and paths last.
      <!-- verify: ./scripts-run src/scripts/regenerate_adr_index -->
- [ ] **5.2 Mechanise the top rank instead of restating staleness.**
      Rank one of that order is already checkable: `adr_cite_check` reports
      status, amendments, successors and trigger state. The ADR cites it and
      `src/rules/decision-revisit-gate.md` for the stale case rather than writing
      a second staleness rule.
      <!-- verify: ./scripts-run src/scripts/adr_cite_check --help -->
- [ ] **5.3 Persist confirmed answers in the artefact class that exists.**
      A confirmed canonical pattern for a scope — a module, a public surface, a
      runtime — is recorded as a playbook under the ADR-244 contract, graded
      `configured` or `observed` by `playbook-authoring`, with the consumer
      example in the source request as its worked case. No new conventions-map
      contract, and no single global exemplar per artefact type.
      <!-- verify: grep -rn "implementation generation" src/skills/playbook-authoring/SKILL.md -->
- [ ] **5.4 Add the golden fixture that fails without the distinction.**
      A fixture where the newer implementation sits behind the older public
      surface, so an agent that treats the version number as the generation
      places new code in the wrong lane and the eval catches it.
      <!-- verify: task test -- --filter=surface_generation -->

## Phase 6 — One pre-registered claim, and the evals

- [ ] **6.1 Pre-register exactly one claim.**
      In `docs/CLAIMS.md`: the share of engine runs with an observed failing test
      before the first production edit rises after Phase 1 and Phase 4. One
      claim, because that is the one metric an instrument exists for after 4.1;
      the remaining proposal metrics have no instrument and are named as such
      rather than pre-registered. Honest null is a first-class outcome.
      <!-- verify: ./scripts-run src/scripts/check_claims -->
- [ ] **6.2 Extend the TDD evals with the three failures this roadmap names.**
      `src/skills/test-driven-development/evals/evals.json` carries one scenario
      and no planning trigger. Add three: a planning request that must not emit
      an implement-then-test plan, a change whose helper already exists and must
      draw a reuse verdict, and a new class whose only possible first failure is
      a missing target, which the pre-Phase-2 contract rejects.
      <!-- verify: task test -- --filter=tdd_evals -->

## Dropped — asked for by the source proposals, refused here

- **A duplication ratchet built on the tool one proposal names.** A council
  resolved this on measurement in 2026-07-28 (`src/rules/code-provenance.md:120-128`,
  `docs/CLAIMS.md:289-291`, recorded `resolved-null`): rename-only recall and
  false-positive rate both missed their pre-registered thresholds, and the
  verdict was no such detector in any form, not even advisory. Worse, a still-live
  claim has a falsification criterion that fires when any user-facing surface
  implies a CI-facing duplication detector exists, machine-enforced by
  `src/scripts/lint_provenance_vocabulary.ts`. Adopting it would trip a
  pre-registered falsifier. Reopening it is a `decision-revisit-gate` case with
  new measurement, never a roadmap step.
- **A ten-gate protocol as a new artefact.** The gates map onto chokepoints that
  already exist; landing them as a named protocol adds a second vocabulary over
  the same enforcement points. The parts with a verified defect behind them are
  Phases 1 through 5; the rest was structure without a finding.
- **Architecture fitness functions.** Zero footing in the tree, no owner, no host
  surface, and in tension with the standing refusal to hard-code project
  architecture globally. Aspiration, not scope.
- **A new always-on rule for the discipline.** D4 is real, but the extended
  always-budget has no room, so the carrier is Phase 4 plus the existing `auto`
  rule — not a tenth kernel rule.
- **The commit-order coverage check.** Nothing in the tree to remove, and the
  premise is wrong: squash and rebase both destroy the order it would read.
- **Twelve telemetry metrics.** Seven have no instrument. Phase 6 pre-registers
  the one that does.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The guard fires on work that was correct | implementation | A phase guard reading runner state misclassifies a legitimate production edit — a refactor under green, a generated file, a test-support fixture — and every future author learns to route around it | Ships `fail_closed: false` and advisory in 4.2; the blocking question is deliberately not a step in this roadmap and needs a measured false-positive rate first | Phase 4 — One runtime carrier, advisory first |
| 2 | The engine refusal produces batch-TDD instead of slices | implementation | 1.4 gates the implement directive on an observed failure; the cheapest way to satisfy that gate is to write every test for the feature up front, which is the second anti-pattern | The gate is per behaviour, not per run; 6.2 adds the eval that fails a plan emitting one test phase and one code phase | Phase 1 — The three surfaces that instruct test-after |
| 3 | The existence question becomes a tax on trivial changes | product | 3.1 widens activation to bug fixes and trivial changes, the highest-frequency class; a heavy check there costs more than the duplication it prevents | Only the one cheap question widens, not the three heavy checks, and it calls the existing code-graph query rather than a fresh search protocol | Phase 3 — The existence question, on the changes that currently skip it |
| 4 | The RED taxonomy is read as permission for a lazy red | implementation | Admitting a missing-target failure lets a genuinely broken test or a wrong import pass as a valid RED | The taxonomy names four invalid classes explicitly and the discriminator is relevance to the behaviour under test, which 6.2 tests from both sides | Phase 2 — A RED that a not-yet-existing symbol can actually produce |
| 5 | The two-axis decision stays prose nobody reads | product | 5.1 records a distinction with no carrier, so the next agent still reads a version number as a generation | 5.2 mechanises rank one on an existing tool, 5.3 persists confirmed answers in a graded artefact class, and 5.4 adds a fixture that fails without the distinction | Phase 5 — Surface version is not implementation generation |

## Acceptance Criteria

- [ ] AC-1 — No surface in `src/` or its projections instructs writing tests
      alongside or after the implementation, and the planning skill ships no
      example plan whose steps are an implementation followed by its tests.
- [ ] AC-2 — The RED contract admits a missing-target failure for a symbol that
      does not exist yet, in both surfaces that state it, and names the invalid
      failure classes.
- [ ] AC-3 — The delete-and-restart Iron Law distinguishes untested code written
      this task from pre-existing tested code and from pre-existing untested
      code, so a reuse verdict and the Iron Law no longer contradict each other.
- [ ] AC-4 — A change classified as a bug fix or a trivial change still answers
      the existence question, and the answer is one of six named verdicts with
      negative evidence required for the new one.
- [ ] AC-5 — A registered `pre_tool_use` concern observes the TDD phase from a
      durable run identifier, warns rather than blocks, and the assurance
      registry entry that named this artefact as its revisit condition records it
      as discharged.
- [ ] AC-6 — Fresh evidence for a behaviour-changing completion claim includes an
      observed failing run and an observed passing run of the same target, and
      nowhere reads commit order.
- [ ] AC-7 — A live decision record states that a public surface version and an
      implementation generation are independent, cites the existing citation
      checker for its top evidence rank, and a golden fixture fails when an agent
      reads the version number as the generation.
- [ ] AC-8 — Exactly one claim from this workstream is pre-registered, with an
      instrument that exists, and the metrics without instruments are named as
      unmeasured rather than promised.
