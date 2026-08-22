---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to requirements traceability minimal

> **Source:** agents/tmp.old/feedpack-points — a dropped inbox artifact
> proposing that a roadmap's requirements, acceptance criteria and evidence be
> linkable to each other. Every claim below was re-verified against the tree on
> 2026-08-22, and one of the findings turned out to be larger than the source
> stated and to cut both ways.

## Goal

A roadmap can optionally declare a requirement id, an acceptance id and
evidence refs, using grammars that already ship elsewhere in this tree rather
than a new vocabulary; and a listing gate can print the REQ-to-AC-to-EVIDENCE
table over the real roadmap corpus with the unlinked and unresolved counts
visible. When this is finished the question "is traceability worth enforcing
here" has a measured answer instead of an intuition — including the answer
"no", which is a legitimate outcome and has a live precedent.

## Context

**There is no requirement identifier anywhere in the execution contract.**
`src/agent-src/contexts/execution/roadmap-execution-contract.md` contains the
word "requirement" **zero** times. "acceptance" occurs **four** times — at
`:28`, `:34`, `:162` and `:200` — and all four mean *the user's acceptance of
the contract*, not an acceptance criterion. So nothing today ties a step to a
requirement, or an acceptance criterion to the evidence that discharged it.

**Two reusable grammars already ship, and neither needs inventing.**

1. **The claim-ledger slug form.** `docs/CLAIMS.md:33-40` defines
   `### claim: <kebab-id>` carrying `kind` / `evidence` / `status` /
   `last_verified`, with an optional `superseded_by` forward link. That is a
   working id-plus-lifecycle grammar for a corpus of assertions.
2. **Envelope `evidence_refs` as ref tokens, never bodies.**
   `src/scripts/_lib/subagent_response.ts:19` declares
   `evidence_refs?: string[]` on a finding, and `:88-90` rejects any element
   that is not a ref token — an entry containing a newline fails validation
   with `evidence_refs must be ref tokens, not bodies`. That is the pointer
   discipline this roadmap reuses verbatim.

**There is precedent for additive optional contract fields.** The same contract
carries `late_artifacts` as § 2a (`:102`) and `deferred_policy` as § 2b
(`:134`), both shipped in 14.8.0, both optional, both defaulting to the
conservative value. (A correction to the source draft, which placed both in
§ 2b.) So a third optional block is a shape the contract already has, not a new
kind of change.

**No such gate exists.** `ls src/scripts | grep -iE 'requir|trace'` yields
exactly three files — `check_skill_requires.ts`, `lint_explain_trace.ts`,
`print_required_checks.ts` — none of which reads a roadmap.

**The finding that is larger than the source stated, and it cuts both ways: NO
gate parses `verify:` structurally at all.** A grep for `verify:` across
`src/scripts/*.ts` returns, for roadmap purposes, exactly two hits — the
template prose emitted by `src/scripts/new_roadmap.ts:73`, and a comment at
`src/scripts/lint_evidence_artifacts.ts:272`. The remaining hits are unrelated
CLI-flag and fixture fields (`dispatch_r2_reviewer.ts:860` is the `--verify`
flag; `release_drill.ts` uses `verify` as a callback key). Both halves matter:

- **Nothing breaks.** An `[AC:<id>]` prefix on a `verify:` line cannot break a
  parser, because no parser reads those lines.
- **Nothing to build on.** There is also no existing extractor to extend, so
  the listing gate in Phase 1 writes the first structural reader of that
  annotation — and any claim about coverage rests entirely on it.

**The known failure mode has a live precedent, and it is registered as this
roadmap's falsifier.** `agents/roadmaps/later/road-to-plan-gates-measurement.md`
is parked precisely because its counter measured **0** — its own lines `:38`,
`:50` and `:188` record "Measured at parking time: 0", a trigger state of 0 of
10, and an advisory window of 0 of 10 gated PRs. A listing gate that lists
nothing is not a neutral outcome; it is that roadmap's outcome, arriving again.

## Phase 0 — Three optional fields and one annotation convention

- [ ] **Step 0.1:** add `requirement_id`, `acceptance_id` and `evidence_refs`
      to the execution contract's § 2 as OPTIONAL fields, reusing the
      claim-slug kebab form for the two ids and the envelope's ref-token rule
      for `evidence_refs`. Absent means not declared, which is not the same
      claim as "there is no requirement".
      <!-- blocked-by: b-required-for-structural -->
      verify: `grep -c requirement_id src/agent-src/contexts/execution/roadmap-execution-contract.md`
      returns 1 or more, where the same grep against the `git show HEAD:` copy
      of that path returns 0.
- [ ] **Step 0.2:** state the `[AC:<id>]` prefix convention for `verify:`
      lines, together with the verified fact that no gate parses those lines
      today — so a reader knows the convention is a new surface rather than an
      extension of an existing one.
      verify: the contract section names both the prefix form and the
      no-existing-parser fact; `./scripts-run src/scripts/lint_plan_risk_register`
      exits 0 afterwards.
- [ ] **Step 0.3:** dogfood the three fields on this roadmap itself before
      asking any other roadmap to carry them. A convention its own author did
      not use is a convention nobody will.
      verify: this file's own § Phase 0 declares at least one
      `requirement_id`, and the value matches the claim-slug kebab pattern.

## Phase 1 — A listing gate and a growth-only ratchet

- [ ] **Step 1.1:** ship `check_requirements_trace` as a **listing** gate:
      print a REQ-to-AC-to-EVIDENCE table over the active roadmap corpus with
      `unlinked` and `unresolved` columns, and exit **0 always**. A gate that
      can fail on day one reds the whole backlog, which is the failure this
      tree has already recorded once. <!-- ref-ignore -->
      verify: the script exits 0 on the current corpus AND on a fixture
      containing a deliberately dangling `[AC:…]` ref, and prints a non-empty
      table in both cases.
- [ ] **Step 1.2:** register a growth-only ratchet modelled on
      `src/config/estate-count-budget.json` — baseline is the MEASURED count at
      registration, never a target, with `owner` and `review_by` set, so the
      number can only walk down.
      verify: the new budget file carries `owner`, `review_by`, a `baseline`
      block and a `_comment` naming what the metric counts; and the recorded
      baseline equals what step 1.1's gate printed on the same commit.
- [ ] **Step 1.3:** record the unresolved count as a number, not as a verdict.
      The point of the listing phase is the distribution, and a table summarised
      as "traceability is patchy" cannot be compared to the next reading.
      verify: the gate's output line carries an integer `unresolved` count and
      the corpus size it was computed over.

## Phase 2 — Dogfood on three real roadmaps, then decide

- [ ] **Step 2.1:** carry the three fields on the two other roadmaps authored
      in this drain run — `road-to-subagent-envelope-adoption.md` and
      `road-to-code-graph-extractor-defect.md` — and on the active
      `road-to-subagent-lifecycle-integrity.md` Phase 2. Three real roadmaps,
      not four sibling drafts: three of the drafts the source draft assumed
      were dropped in this run and do not exist.
      verify: the gate's table lists all three files with a non-empty
      `requirement_id` column, and `unlinked` for those three rows is 0.
- [ ] **Step 2.2:** read the `unresolved` count against the falsifier before
      proposing any enforcement. If the count over the dogfooded set is 0 and
      the count over the rest of the corpus is 0 because nothing declared the
      fields at all, that is the parked-precedent outcome and the honest move is
      to park this roadmap the same way.
      <!-- blocked-by: b-traceability-value-unmeasured -->
      verify: the recorded reading names both counts separately — dogfooded set
      and remainder — so a zero from adoption cannot be read as a zero from
      compliance.
- [ ] **Step 2.3:** write the disposition down either way. A decision to park
      carries the measured counts and the condition that would reopen it; a
      decision to continue carries the count that justified it.
      verify: the disposition paragraph exists in this file and names an
      integer count; `./scripts-run src/scripts/lint_roadmap_blockers`
      exits 0.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The listing gate lists nothing and is kept anyway | product | Optional fields nobody declares produce an empty table, and an empty table reads as "clean" rather than as "unadopted" — this is exactly the parked precedent's outcome, arriving a second time with a different name | Step 2.2 requires the dogfooded count and the remainder count to be reported separately, and the blocker registers the parked roadmap as the explicit falsifier rather than as a cautionary aside | Phase 2 |
| 2 | The `[AC:…]` prefix becomes a de facto requirement without a decision | implementation | Once one gate reads the annotation, a later author adds a failing arm "for consistency", and an optional convention silently becomes mandatory for every roadmap including the 3 active and 57 parked ones | The gate is specified exit-0-always and is verified against a deliberately dangling ref; the required-for-structural question is held open in its own blocker rather than defaulted | Phase 1 |
| 3 | A new id vocabulary is invented instead of reused | implementation | Three fields is exactly the size at which inventing a private format feels cheaper than reading two existing ones, and the result is a third grammar for ids in a tree that already has two working ones | Step 0.1 names the claim-slug kebab form and the envelope ref-token rule as the sources, both with file and line, so a divergence is visible as a diff against a cited grammar | Phase 0 |
| 4 | The baseline is set as an aspiration rather than a measurement | implementation | A budget file whose baseline is a target reds on the day it lands and teaches readers to ignore it — the estate-count budget's own `_comment` records this as the reason it is measured-at-registration | Step 1.2 verifies the recorded baseline equals what the gate printed on the same commit, so an aspirational number cannot pass its own verify | Phase 1 |

## Acceptance Criteria

- [ ] AC-1 — The execution contract carries `requirement_id`, `acceptance_id`
      and `evidence_refs` as optional § 2 fields, each pointing at the shipping
      grammar it reuses; and the contract states that no gate parses `verify:`
      lines today.
- [ ] AC-2 — `check_requirements_trace` prints a REQ-to-AC-to-EVIDENCE table
      with integer `unlinked` and `unresolved` counts and the corpus size, and
      exits 0 on both the real corpus and a dangling-ref fixture. <!-- ref-ignore -->
- [ ] AC-3 — A growth-only budget file exists with `owner`, `review_by` and a
      baseline equal to the gate's printed count on the registering commit.
- [ ] AC-4 — Three real roadmaps carry the fields, and the recorded reading
      states the `unresolved` count for the dogfooded set and for the remainder
      separately — so an empty table from non-adoption is distinguishable from
      an empty table from compliance.
- [ ] AC-5 — A disposition is written down naming an integer count: either
      continue, with the count that justified it, or park with the count and the
      reopening condition, following the parked precedent rather than quietly
      keeping an empty gate.

## Blockers

### blocker: b-traceability-value-unmeasured

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 2.2
- **Class:** 3
- **What to do:** pick exactly one — (a) accept
  `agents/roadmaps/later/road-to-plan-gates-measurement.md` as this roadmap's
  registered falsifier, so an `unresolved` count of 0 arising from
  non-adoption parks this roadmap the same way (that file records "Measured at
  parking time: 0" at `:38` and an advisory window of 0 of 10 at `:188`); or
  (b) declare a different falsifier with its own threshold and state why the
  parked precedent does not apply.
- **Recommendation:** (a). The precedent is not an analogy — it is the same
  mechanism, a counter over roadmap-shaped artefacts, measured at 0 and parked
  for that reason. Declaring a different falsifier means arguing that this
  counter will populate where that one did not, and there is no evidence for
  that argument yet.
- **If you do nothing:** Phase 2 reads an empty table as a clean result, the
  gate ships and stays green forever without listing anything, and the tree
  acquires a second counter that measures 0 next to the first.
- **Resolved when:** the falsifier is named at this blocker with its threshold,
  and step 2.2's reading is judged against it rather than against a narrative.

### blocker: b-required-for-structural

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 0.1
- **Class:** 3
- **What to do:** pick exactly one — (a) keep all three fields optional for
  every complexity, so `complexity: structural` roadmaps are under no
  additional obligation and Phase 0 ships a purely additive block; or (b)
  commit now to making them required for `complexity: structural` at a named
  later phase, and state which gate would enforce it.
- **Recommendation:** (a) for Phase 0, explicitly. Deciding requiredness before
  the listing phase has produced a single count is deciding it on intuition,
  and the additive-optional shape is the one `late_artifacts` and
  `deferred_policy` already established in the same contract section.
- **If you do nothing:** step 0.1 lands with the requiredness question
  unstated, and the first author to read the fields has to guess whether a
  structural roadmap omitting them is non-conforming.
- **Resolved when:** this blocker records (a) or (b), and if (b), names the
  phase and the enforcing gate.
