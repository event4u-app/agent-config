---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Road to metric loop and review integrity

> A bounded keep-or-revert optimization loop against a scalar metric, and review artifacts that machine-carry their own epistemics so a same-family review can never silently pass as cross-model acceptance.

## Goal

Ship two capabilities, each behind a pre-registered benchmark with an honest-null path: a session-bound loop that can express "minimize X" against a mechanical verifier, and an independence field on review output that makes same-family verdicts self-declaring rather than indistinguishable from cross-model ones.

## Prerequisites

- [x] Read `src/skills/verify-repair-loop/SKILL.md` — the existing bounded loop and why it cannot express a metric
- [x] Read `src/scripts/schemas/` — the existing schema set and the one review schema already there
- [x] Read `src/scripts/hook_manifest.yaml` § fail-closed concerns
- [x] Re-verify the Context table against branch HEAD before executing a phase

## Context

Source: an external capability-harvest session over this repository and ten public agent-tooling references, 2026-08-13, pinned at `b3a2d29`. That pin is 405 commits behind the branch base, so every claim was re-verified at `6d18f5bb2`; two moved materially and the scope below is cut accordingly.

**Re-verified at `6d18f5bb2`:**

| Claim | Status | Evidence |
|---|---|---|
| No keep-or-revert loop exists anywhere in the estate | still true — zero hits across skills and rules | negative grep, 2026-08-17 |
| No schema standardizes a mechanical verifier's output | still true — none of the 24 schemas covers it | `src/scripts/schemas/` |
| No review-output schema exists | **overtaken** — a review-findings schema now ships; the gap narrows to the independence fields, not the schema itself | `src/scripts/schemas/review-findings.schema.json` |
| Eval coverage is 42 of 289 skills | **overtaken** — now 103 of 289; the coverage argument is weaker than drafted and the phase shrinks accordingly | directory count, 2026-08-17 |
| No independence or acceptance-status metadata on council output | still true — zero hits | negative grep, 2026-08-17 |
| Per-concern fail-open policy already exists and is stronger than the external candidate | still true (58 concerns open, 3 closed — drift from the drafted 54, same shape) | `src/scripts/hook_manifest.yaml` |

**Gap-table against the existing surface.** The harvest proposed eleven items; six survive.

| Item | Verdict | Reason |
|---|---|---|
| Evaluator output contract (JSON on stdout, higher-is-better invariant, error table) | **KEEP** | No schema covers a mechanical verifier's output; it is the smallest transplantable unit and decouples any loop from its verifier. |
| Bounded keep-or-revert loop against a scalar metric | **KEEP** | The existing bounded loop converges only toward a known target state; it cannot express "minimize X". |
| Review independence and acceptance-status metadata | **KEEP** | Council output can produce same-family verdicts today with nothing in the artifact saying so. |
| Results register as a file rather than conversational state | **KEEP** | Two independent references converge on files-as-truth after documenting silent degradation of in-conversation loop state. |
| Dual-condition loop exit | **KEEP** | Guards both failure directions; a never-stop directive alone is the wrong half for a governed estate. |
| Shipping-intent diff-volume gate | **KEEP, narrowed** | The existing minimal-diff concern counts files touched per turn, not diff volume at ship time — a complementary trigger, not a duplicate. |
| Review-output schema as such | **FOLD** | Now exists; extend the shipped schema with the independence fields rather than adding a second one. |
| Eval-coverage benchmark | **FOLD** | Coverage more than doubled unaided; fold the remaining question into the existing measurement work rather than opening a phase. |
| Blanket fail-open hook policy | **CUT** | The per-concern policy already in the manifest is strictly stronger. |
| Per-run iteration budget for the improvement pipeline | **CUT** | The existing recurrence escalation covers the failure it was proposed against. |
| Cross-host session ingestion | **CUT** | Already exists; the reference's transfer is the mirror direction, not a gap. |

**Two standing constraints bind the design.** Description-triggered skills do not self-activate, so loop doctrine must ride the projection pipeline rather than a description. And a marker convention without a machine backstop is dead text, so nothing here ships a frontmatter convention without an enforcing check or a measuring benchmark.

**Findings that shaped the design.** Stop conditions rot when written loosely — one reference documents its own shipped bug where a disjunctive stop condition with a stale verdict vocabulary had to be corrected in place; stop conditions here are machine-checkable predicates, never prose. Independence has to be a recorded property rather than a promise. Thin routing is real economy: one reference replaced a large monolith with a small router plus per-command files, claiming a large per-invocation reduction — an unverified own-claim, treated as direction rather than as a number.

## Phase 0 — Falsification spikes

- [x] Run a session-bound keep-or-revert loop on a toy metric with branch advance and an untracked register, and count iterations before context degradation. Pre-registered kill: fewer than five clean iterations. <!-- verify: test -f agents/evidence/eval-findings/metric-loop-s01.md -->
- [x] Wrap three existing verifiers in the JSON-on-stdout contract without modifying the verifiers. Kill: two or more need invasive changes. <!-- verify: test -f agents/evidence/eval-findings/metric-loop-s02.md -->
- [x] Add the independence fields to the council result object without touching the consensus path. Kill: the consensus code must change. <!-- verify: test -f agents/evidence/eval-findings/metric-loop-s03.md -->
- [x] Replay recent merged work and count how often a shipping-intent diff-volume gate would have fired and whether each firing would have been useful. Kill: precision below a pre-registered floor cuts the gate rather than tuning it into noise. <!-- verify: test -f agents/evidence/eval-findings/metric-loop-s04.md -->

**Exit criteria:** four written spike results with numbers, and each kill criterion evaluated explicitly.

**Rollback:** spikes are scratch-only.

## Phase 1 — Evaluator contract

- [x] Add an evaluator-output schema with a required pass boolean, a score carrying a higher-is-better invariant (minimize tasks negate), and an optional raw metric value. <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->
- [x] Add the companion contract document covering the error semantics: a non-zero exit, absent JSON, or a timeout all mean the experiment failed, revert, and continue. The error table is the part that makes the contract usable; without it every caller invents its own failure handling. <!-- verify: test -f docs/contracts/evaluator-output.md -->
- [x] Add a check enforcing the schema on emitters, landing in the same change as the schema — no convention without a backstop. <!-- verify: ./scripts-run src/scripts/check_evaluator_schema -->

**Exit criteria:** three existing verifiers emit against the schema and the check passes over them.

**Rollback:** the schema is additive; unregistering the check restores the previous state.

## Phase 2 — Independence on review output

- [ ] Extend the shipped review-findings schema with a review-independence field and an acceptance-status field, rather than adding a second schema. <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->
- [ ] Set the fields from the actual reviewer set: a review whose members share a model family records same-family and provisional, and the artifact may not be described as cross-model acceptance anywhere it is consumed. <!-- verify: ./scripts-run src/scripts/check_review_schema -->
- [ ] Add the assurance axis as a property orthogonal to effort: how much independent evidence backs a verdict is not the same question as how hard the reviewer worked, and collapsing them is what lets a same-family pass read as acceptance. <!-- verify: ./scripts-run src/scripts/check_review_schema -->

**Exit criteria:** a council run over a same-family member set produces an artifact that declares itself provisional, and a consumer reading it can tell.

**Rollback:** the fields are optional additions to an existing schema.

## Phase 3 — The experiment loop

- [ ] Add an `experiment-loop` skill, born thin: the skill file routes, and the loop protocol, register format, and pivot ladder live in reference files loaded on demand. <!-- verify: ./scripts-run src/scripts/skill_linter -->
- [ ] Implement the protocol: a bounded iteration count, one focused change per iteration, commit before verify, the evaluator-contract verdict as the decision input, keep on strict improvement and revert otherwise. <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Express the exit as two conditions rather than one — completion indicators and an explicit exit signal — as machine-checkable predicates, never prose. <!-- verify: ./scripts-run src/scripts/check_evaluator_schema -->
- [ ] Keep loop state in an append-only register file re-read from disk each cycle, never in conversational state. <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Route the skill through the projection pipeline rather than relying on its description to trigger it. <!-- verify: ./scripts-run src/scripts/lint_featured_skills -->

**Exit criteria:** the loop runs the toy metric from Phase 0 end to end and its register reconstructs the run without the transcript.

**Rollback:** the skill is removable; nothing else depends on it.

**Kill criteria:** the Phase 0 iteration floor not met means this phase is not built and the null is published.

## Phase 4 — Shipping-intent diff gate

- [ ] Add the gate at ship verbs, measuring diff volume rather than files touched per turn, with thresholds derived from this repository's own history rather than copied from the reference that suggested it. <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->
- [ ] Ship it warn-level first and escalate only after one release of recorded firings. <!-- verify: ./scripts-run src/scripts/check_enforcement_coverage -->

**Exit criteria:** the gate has a recorded firing rate over one release window.

**Rollback:** unregister the concern; the existing per-turn concern is untouched throughout.

**Kill criteria:** precision below the Phase 0 floor cuts the gate rather than tuning it.

## Phase 5 — Measurement

- [ ] Pre-register the two capability claims with their honest-null thresholds before either is adopted. <!-- verify: ./scripts-run src/scripts/check_claims -->
- [ ] Record the outcome of each: the loop's iteration count against its floor, and the independence field's effect on how review artifacts are consumed. <!-- verify: ./scripts-run src/scripts/check_claims -->

**Exit criteria:** both claims carry a recorded outcome, including nulls.

**Rollback:** none required; the phase is measurement only.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The loop optimizes a metric into a worse system | product | A scalar target rewards changes that improve the number and degrade what it was a proxy for. | Bounded iterations, one focused change per iteration, an append-only register that makes every kept change reviewable after the fact, and a dual exit condition rather than a never-stop directive. | Phase 3 |
| 2 | The independence field is set but not consumed | implementation | The metadata ships and every consumer keeps reading the verdict as acceptance. | The acceptance-status value is what consumers read, and the schema check enforces that a same-family set cannot emit an unqualified acceptance. | Phase 2 |
| 3 | The harvest becomes a dump | product | Adopting eleven proposed items rebuilds what exists and duplicates what should have folded. | The gap-table cut five of eleven before drafting, and two of the cuts are items the existing surface already covers more strongly. | Context |
| 4 | Thresholds copied rather than derived | implementation | A gate tuned on someone else's history fires wrong here. | Thresholds come from a replay of this repository's own merged work, and the precision floor is pre-registered before the replay runs. | Phase 0, Phase 4 |
| 5 | A convention ships without a backstop | implementation | Frontmatter or schema fields become dead text nothing enforces. | Each schema lands with its check in the same change; the standing constraint that markers need machine backstops is a phase-level condition, not advice. | Phase 1, Phase 2 |

## Acceptance Criteria

- [ ] Every adopted item traces to a KEEP row in the gap-table, and no CUT row appears anywhere in the phases.
- [ ] The evaluator schema ships with its error-semantics document and its enforcing check in the same change.
- [ ] A same-family council run produces an artifact that declares itself provisional.
- [ ] Either the loop meets its pre-registered iteration floor, or the null is published and the skill is absent.
- [ ] The diff gate's thresholds are derived from this repository's history, with the derivation recorded.

## Provenance

- Source: an external capability-harvest session over this repository and ten public agent-tooling references, 2026-08-13, pinned at `b3a2d29` and re-verified at `6d18f5bb2` for this file. References are described by capability rather than named; the raw session material with its links stays local and untracked at `agents/tmp.old/metric-loop.txt`.
- Council: not convened. No contested item survived the gap-table — the eleven proposals resolved to six keeps, two folds, and three cuts on tree evidence rather than on judgement.
