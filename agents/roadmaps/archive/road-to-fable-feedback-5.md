---
complexity: structural
---

# Road to Fable-Feedback 5 — post-8.10.0 hardening + code-comment discipline

**Goal:** Land the accepted next steps from the external 8.10.0 review (PR #873, scored 9.1/10) plus the maintainer's new code-comment-discipline requirement — as council-decided, evidence-first, PR-sized phases; every contested design shape was resolved by the AI council before this roadmap locked it in.

## Context

An external frontier-model review of release 8.10.0 confirmed the release resolved most 8.9.0-round feedback (consumer tarball matrix, red-workflow tripwire, semantic invariants, governed worktrees, delegation-quality telemetry, release sizing contract, test-case discovery, surface contracts) and raised a set of next-step design decisions. Independently, the maintainer reported the agent writes too many code comments — redundant PHPDoc restating native typehints, what-narration comments — and wants comments reduced to the genuinely necessary minimum across ALL languages (token cost + source bloat).

**Council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-10, 2-round debate, $0.15 actual):**

| Question | Convergence |
|---|---|
| Q1 comment discipline | New focused rule + per-language guideline sections + worked examples + behavioral eval. Lint backstop DEFERRED (corpus-only lint is a lagging indicator; the eval covers the corpus). Machine-precision docblocks (PHPStan generics, array shapes) stay as an explicit carve-out INSIDE the rule. `code_style.docblocks: minimal\|full` setting ships as a cheap conditional, default `minimal`. |
| Q2 semantic invariants | Keep string-fragment enforcement NOW; add a documented invariant-change process NOW; migrate to invariant IDs only AFTER behavioral evals cover ≥50% of the 19 invariants (IDs before evals = ceremony without teeth; both members converged after round 2). |
| Q3 delegation metrics | Ship a precise operationalization table for `first_pass_success` as a definitions doc. ZERO new schema fields — 5 of 6 proposed fields are unobservable without new infra (verification harness, diff classifier, judge, human loop); the 2026-07-10 two-field cap stands. |
| Q4 eval coverage | Tier-classification ("kernel + default-surface skills MUST have an eval; niche exempt") beats weighted scoring (false precision, maintenance cost). Golden E2E tasks ranked by signal/cost: (1) parallel-worktree overlapping-file hazard, (2) subagent delegation with deliberately bad lite output — ship both; ambiguous-bugfix deferred; Laravel/React/poisoned-doc/stale-memory skipped. |
| Q5 sizing + ops | Sizing stays a NORM (no mechanical subsystem-count lint — a subsystem map is its own maintenance burden); add a `Primary-Goal:` line to the release-PR flow + a documented exception annotation. Ops ranking: worktree edge-case tests (unanimous ship) > growth-ratchet PR checklist (zero enforcement cost) > matrix leg verification (ship — cheap) > bus-factor neutral state (ship-if-trivial) > tripwire risk classes (deferred, YAGNI: threshold doesn't change fix-when-seen behavior). |

**Web-research grounding for Phase 1** (comment discipline): cross-language consensus is "comments explain WHY, never WHAT" — competent readers get the WHAT from the code; redundant comments rot and mislead. Modern PHP (Spatie conventions, Laravel 10+) drops docblocks that only restate native type hints; docblocks stay ONLY for machine-relevant precision (generics, array shapes for PHPStan/Psalm) or genuine why-context. Google style guides (C++/Go/Python/TS) all ban stating the obvious; Google Python: "never describe the code — assume the reader knows the language better than you." TSDoc/JSDoc type annotations are redundant in typed TS.

## Prerequisites

- 8.10.0 merged (`main` at or past PR #873).
- Working surfaces (verified paths, this branch): `src/rules/minimal-safe-diff.md`, `docs/guidelines/code-clarity.md`, `docs/guidelines/php/php-coding-patterns.md`, `src/agent-src/contexts/execution/orchestration-telemetry.md`, `tests/golden/invariants.json` + `src/scripts/check_rule_invariants.ts`, `src/scripts/consumer_matrix.ts` + `.github/workflows/consumer-matrix.yml`, `.github/workflows/self-review-gate.yml` + `src/scripts/self_review_gate.ts`, `src/domains/engineering-base/worktree/` (create/status/verify/cleanup) + `src/skills/worktree-lifecycle/`, `src/scripts/skill_eval_coverage.ts`, `src/scripts/run_skill_evals.ts`, `docs/contracts/release-sizing.md` + `src/scripts/lint_changelog_rollback.ts`.
- Locks honored: telemetry field set capped at 2 (council 2026-07-10); schema-shape privacy floor; kernel always-budget concentration cap (~12%/~3,600 chars per always rule); subagents default `ask`.

---

## Phase 1 — Code-comment discipline (maintainer priority)

**Outcome:** The agent emits comments only when they state a WHY / a constraint the code cannot show; redundant docblocks and what-narration disappear from generated code. Language-neutral rule, per-language operationalization, behavioral eval as the regression gate.

### 1a — The rule

- [x] Create `src/rules/code-comment-discipline.md` (tier-1 `auto`, triggered on any code-writing/editing context — NOT kernel-`always`; respect the always-budget concentration cap). Iron Law block (draft, refine while authoring):
  ```
  A COMMENT STATES A WHY OR A CONSTRAINT THE CODE CANNOT SHOW — NOTHING ELSE.
  NEVER RESTATE WHAT THE CODE, THE NAME, OR THE TYPE ALREADY SAYS.
  NO DOCBLOCK THAT ONLY MIRRORS THE NATIVE SIGNATURE.
  DOCBLOCKS EARN THEIR PLACE ONLY WITH MACHINE-RELEVANT PRECISION
  (GENERICS, ARRAY SHAPES, NON-TRIVIAL UNIONS) OR GENUINE WHY-CONTEXT.
  WHEN IN DOUBT: NO COMMENT. SHORTER IS BETTER. NONE IS OFTEN BEST.
  ```
- [x] Body sections: (1) what a comment is FOR (why, invariant, non-obvious trade-off, warning, spec/ticket linkage); (2) banned classes — what-narration (`// increment i`), signature-mirroring docblocks (`@param string $name` on `string $name`), banner/section-divider comments, change-log comments (`// added for X`), PR-reviewer-directed comments ("why my change is correct"), commented-out code; (3) the machine-precision carve-out (PHPStan/Psalm generics + array shapes, `@template`, TS `@deprecated`/`@internal` when tooling consumes them, Python type-stub cases); (4) public-API carve-out — exported library surface MAY carry summary docblocks when `code_style.docblocks: full`; (5) explicit precedence note: this rule governs NEW/edited code only — never a license to strip comments from untouched code (`minimal-safe-diff` wins on diff shape).
- [x] Wrong/right worked examples inline (≥3 pairs, language-mixed): PHP method with redundant PHPDoc → bare typed signature; PHP collection return needing `@return Collection<int, Post>` → docblock KEPT (the carve-out); TS function with JSDoc type restatement → no docblock; a genuine WHY comment that stays.
- [x] Cross-references both directions: `minimal-safe-diff` § no-docstrings-on-untouched-code ↔ new rule; `docs/guidelines/code-clarity.md` § comment discipline becomes the canonical long-form and the rule points at it.

### 1b — Per-language guideline operationalization

- [x] Extend `docs/guidelines/code-clarity.md` § "Comment discipline" into the canonical cross-language reference: per-language subsections (PHP/PHPDoc, TypeScript/JSDoc-TSDoc, Python docstrings, Go doc comments) each with a keep/drop decision table and 2+ wrong/right pairs. Cite the external consensus in one line each (why-not-what; Google style guides "do not state the obvious"; modern-PHP docblock dropping; TSDoc types redundant in typed TS) — no external source names beyond public style guides.
- [x] Update `docs/guidelines/php/php-coding-patterns.md` § PHPDoc (line ~65) to align exactly with the rule (currently close but weaker) and link the guideline section instead of restating it.
- [x] Sweep remaining touchpoints for contradictions: `docs/guidelines/php/general.md`, `docs/guidelines/php/resources.md`, `docs/guidelines/php/patterns/repositories.md`, `src/rules/output-discipline.md` (banned placeholder comments — adjacent, keep distinct), any skill emitting code templates with decorative comments (grep `src/skills/` for docblock-heavy templates: `php-service`, `laravel-*`, `api-endpoint`, `form-handler`; fix templates that model the anti-pattern).

### 1c — Setting

- [x] Add `code_style.docblocks: minimal|full` to `src/config/agent-settings.template.yml` (default `minimal`) + schema entry; document in `src/agent-src/templates/agent-settings.md`. `full` relaxes ONLY the public-API carve-out (summary docblocks on exported surface); the redundancy ban holds in both modes. Downstream: `npm run build:install-bundle` after schema edit; settings-sync surfaces.

### 1d — Behavioral eval (the enforcement that matters)

> Implementation note: rules host no `evals/` dir — the established rule-fixture pattern is a catalog under `tests/` (precedent: `tests/design-artifacts/eval-fixtures.md`). Fixtures live at `tests/code-comments/eval-fixtures.md` (ids `ccd-*`), decidability proven by `tests/scripts/code_comment_fixtures.test.ts`.

- [x] Author eval fixtures per the option-(d) shape: task prompts that make the agent write (i) a PHP class with typed properties/params + one genuinely generic-typed method, (ii) a TS module with exported functions. Assertions: zero signature-mirroring docblocks; zero what-comments; the ONE legitimately-required `@return Collection<...>`-style docblock IS present (tests the carve-out is not overshooting); why-comments allowed. Wire into the skill-eval harness (`src/scripts/run_skill_evals.ts` conventions, `evals/` beside the rule's routed skill or as a rich-surface eval).
- [x] Trigger coverage — rules carry frontmatter triggers compiled into the deterministic router trigger matrix (skills-style `evals/triggers.json` does not apply to rules; the trigger-eval presence gates are skills-only by design). Frontmatter declares intents + keywords for code-writing contexts and comment/docblock vocabulary.
- [x] Run the new eval fixtures once locally to establish the baseline — decidable subset proven via `npx vitest run tests/scripts/code_comment_fixtures.test.ts` (4/4 green); rubric fixtures recorded pending-first-host-run in the fixture catalog's Baseline table. <!-- carve-out: new-gate-verification -->

### 1e — Downstream + verification

- [x] `/condense` for the new/edited rule + guideline files (rode the Phase 7 batch pass); `task generate-tools` regenerated projections; reference checker green (guideline files under docs/ are not condensation targets — only src/ .md surfaces are).
- [x] Targeted verification: `./scripts-run src/scripts/skill_linter --all` → 406 pass / 0 fail; `npx tsx src/scripts/check_rule_invariants.ts` still green (kernel untouched); trigger-eval presence ratchet green.

**Non-goal (this phase):** deterministic redundant-docblock lint. Corpus-only lint is a lagging indicator and the eval already covers the corpus; agent-emitted code in consumer repos has no lintable control plane. Revisit-if: manual review of ≥5 real consumer tasks shows ≥30% of emitted comments are pure type/name restatements AFTER the rule ships.

---

## Phase 2 — `first_pass_success` operationalization (definitions, zero schema change)

**Outcome:** The two shipped telemetry fields become comparable across sessions because "parent rework" is precisely defined. No new fields.

- [x] Add an "Operationalization" section to `src/agent-src/contexts/execution/orchestration-telemetry.md` with the mechanical decision table:
  ```
  first_pass_success = TRUE iff the parent adopts the subagent work product
  with NO scope-relevant modification and issues NO corrective follow-up
  prompt to the same subagent within the same task scope.

  EXCLUDED from "modification" (still TRUE): auto-formatter output
  (prettier/eslint/pint --fix), import sorting, lockfile regeneration,
  whitespace-only diffs.
  INCLUDED as rework (FALSE): any business-logic line diff, added or
  changed tests, changed API contract/signature, manual conflict
  resolution, architectural restructuring of the returned diff.

  escalated = TRUE iff the parent re-dispatched the same slice to a higher
  tier after a verification failure — mechanism metric, not a quality verdict.
  ```
- [x] State the boundary honestly in the same section: the two fields are machine-observable proxies; they do NOT measure output quality directly. Add the explicit revisit-if for field extensions (`verification_passed`, `parent_rework_level`, …): only when a verification harness exists that makes them machine-observable without content inspection (privacy floor) — cite the 2026-07-10 two-field cap.
- [x] Update `src/domains/meta/cost/report/command.md` + `src/scripts/_lib/orchestration_savings.ts` doc-strings/report copy to reference the definitions section (no logic change; the n/a-under-20 and cost-never-without-quality behaviors stay as shipped).
- [x] Verification: `npx vitest run tests/scripts/_lib_orchestration_record.test.ts tests/scripts/_lib_orchestration_savings.test.ts` → 21/21 green (no logic change); condensation/sync rides the Phase 7 pass.

---

## Phase 3 — Semantic-invariant change process (strings stay, IDs gated)

**Outcome:** Legitimate rewordings of protected kernel prose follow a documented review path instead of "update the gate green"; ID migration is explicitly gated on behavioral-eval coverage.

- [x] Write the invariant-change process into `docs/contracts/kernel-membership.md` (new § "Changing a protected invariant") or a sibling contract if it fits poorly: rewording a string in `tests/golden/invariants.json` requires (1) the PR names WHICH invariant and WHY the wording changes, (2) side-by-side old/new assertion equivalence statement, (3) mutation self-test re-run (`check_rule_invariants.ts --mutation-selftest`) in the PR, (4) where a behavioral eval covers the invariant, cite it; where none exists, note that explicitly. Kernel-edit slow-rollout rules (own PR, ≥24h soak) apply on top.
- [x] Add a header comment/`_meta` block to `tests/golden/invariants.json` pointing at the change process (so the person editing the file finds the contract).
- [x] Extend `src/scripts/check_rule_invariants.ts` failure output to print the change-process pointer (one line) — the gate teaches the process at the moment someone trips it.
- [x] Record the ID-migration gate as a tracked decision inside the contract section: "migrate string fragments → frontmatter invariant IDs only after behavioral evals cover ≥10 of the 19 invariants; until then IDs would claim guarantees nothing verifies."
- [x] Verification: `npx tsx src/scripts/check_rule_invariants.ts && npx tsx src/scripts/check_rule_invariants.ts --mutation-selftest` both green (19 invariants present; selftest detects removal). <!-- carve-out: new-gate-verification -->

---

## Phase 4 — Eval coverage: tier floor + two golden E2E tasks

**Outcome:** Coverage pressure lands where routing risk lives (kernel + default surface), and the two highest-signal-per-cost end-to-end scenarios exist as repeatable evals.

### 4a — Tier-classification floor

- [x] Extend `src/scripts/skill_eval_coverage.ts --check` from ratchet-only to a tier floor over the `priority` tier (rich + default-surface + router): every member MUST have `evals/evals.json` or an exemption-with-reason in `internal/evals/tier-floor-exemptions.json`; stale exemptions are surfaced. Rides the existing `--check` CI wiring (taskfiles/ci-fast.yml) — no new workflow. Tests: `tests/scripts/skill_eval_coverage.test.ts` 10/10 green.
- [x] Baseline run: priority tier already fully covered (35/35 — rich 4/4, default-surface 29/29, router 2/2); exemptions file ships EMPTY, floor active immediately. `npx tsx src/scripts/skill_eval_coverage.ts --check` green. <!-- carve-out: new-gate-verification -->
- [x] Documented in `docs/proof.md` § Behavioural-eval coverage (the stable published surface; also refreshed its stale 2/264 numbers to 37/270 with priority 35/35): tier floor replaces any weighted-score ambition (council: weighted coverage = false precision; bright line beats score).

### 4b — Golden E2E task 1: parallel-worktree overlapping-file hazard

- [x] Scenario built as a harness-conformant behavioral eval (`src/skills/worktree-lifecycle/evals/evals.json`, id `wtl-parallel-overlap-hazard`): two parallel worktrees whose scope locks overlap on `src/middleware/**` — repo state embedded in the scenario prompt (the eval harness executes prompts, not physical fixture repos; a checked-in repo would be dead weight nothing runs).
- [x] Eval asserts: scope locks written; overlap DETECTED and surfaced as a user decision (never silently double-owned, never auto-merged); merge-readiness treats the unresolved overlap as NOT ready. Plus a second scenario `wtl-cleanup-refusal-is-success` pinning the refuse-on-unsaved/unique-commits cleanup contract.
- [x] Run once locally: schema-validated against `evals.schema.json`, counted by the coverage metric, skill linter + freshness lint + `--check` all green; rubric baseline recorded as pending-first-host-run in `_calibration` (rubric grading is host-scored by design — pass ratified in PR review, never a hidden judge). <!-- carve-out: new-gate-verification -->

### 4c — Golden E2E task 2: delegation with deliberately bad lite output

- [x] Built as `src/skills/subagent-orchestration/evals/evals.json` (id `sao-bad-lite-output-escalation`): lite return with 3+ planted defects (first-space-only replace, no stripping, no collapsing, no tests); asserts never-adopt-unverified, verification catches ≥2 defects, `escalated=true` + `first_pass_success=false` per the Phase-2 operationalization, correct final output. Plus negative control `sao-good-return-no-spurious-escalation` (clean return → no spurious findings, `first_pass_success=true`).
- [x] Run once locally: schema-valid, coverage-counted, all gates green (same evidence set as 4b); the harness discovers evals by skill slug — no extra wiring surface exists. <!-- carve-out: new-gate-verification -->

**Non-goals (this phase):** weighted coverage scoring machinery; Laravel-feature E2E (high setup + version-churn cost, medium signal); React screenshot-diff E2E (flaky, very high cost); poisoned-external-doc and stale-memory E2E (unit-fixture-sized, not E2E — candidates for existing untrusted-input / memory test suites instead). Ambiguous-bugfix E2E deferred to a follow-up once 4b/4c are stable.

---

## Phase 5 — Worktree cleanup edge-case hardening

**Outcome:** The safe-cleanup guarantees ("refuse on unsaved changes or unreachable-elsewhere commits; refusal is a success exit") hold under the awkward states real repos produce.

- [x] Mapped: all cleanup gates were prose-only (inline shell in the command doc). Deterministic core extracted to `src/scripts/worktree_cleanup_check.ts` (`check <path>` = dirty/detached/unique-commit gates; `scope-overlap` = cross-worktree scope-lock scan). No daemon, no runtime ambition — a plain CLI the command docs call; refusal stays the success path (exit 1 with named gate).
- [x] Edge-case matrix — one test/fixture per row, asserting refuse-vs-proceed exactly (all 8 rows implemented in `tests/scripts/worktree_cleanup_check.test.ts` with REAL git repos in tmp dirs):
  | Case | Expected |
  |---|---|
  | Branch with no remote/upstream | commits reachable check runs against ALL local refs; refuse if unique |
  | Detached HEAD in the worktree | refuse with explanation, no branch deletion attempted |
  | Branch whose only other ref is a tag | tag counts as reachability → cleanup allowed |
  | Remote branch deleted after push | local-only commits detected → refuse |
  | Untracked-but-not-modified files present | counts as unsaved work → refuse |
  | Path with spaces | all git invocations quoted; cleanup works |
  | Multiple worktrees on related branches (parent/child) | reachability judged per-branch, not repo-global assumption |
  | Overlapping scope globs in two live `.worktree-scope.md` files | status/verify surfaces the overlap |
- [x] Run the new tests once locally: `npx vitest run tests/scripts/worktree_cleanup_check.test.ts` → 12/12 green (8 matrix rows + parent/child + disjoint-globs + ownsOverlap unit rows). <!-- carve-out: new-gate-verification -->
- [x] Updated `worktree/cleanup/command.md` § 2 (gates now run the helper; detached-HEAD gate added; tag-counts-as-reachability made explicit), `worktree/status/command.md` (cross-worktree `scope-overlap` scan + hazard semantics), and `worktree-lifecycle` SKILL § 4 (same gates, helper referenced) — docs follow the verified behavior.

---

## Phase 6 — Release-ops hardening (cheap, ranked items only)

**Outcome:** The remaining reviewer ops-items land where value/cost clears the single-maintainer bar; the rest are recorded non-goals with revisit conditions.

### 6a — Consumer-matrix leg verification (ship — cheap)

- [x] `src/scripts/consumer_matrix.ts`: `--manifest <path>` emits the machine-readable leg manifest (`executed` per leg + expected list + node version); leg-completeness gate fails a full run when any expected leg did not execute (only declared skip: `upgrade` under an explicit `--skip-registry`) — a silently-skipped leg can no longer ride a green workflow.
- [x] `.github/workflows/consumer-matrix.yml`: manifest written per run, rendered as a leg table into the job summary (Node 20/22 × leg × ok × executed), and uploaded as artifact `consumer-matrix-leg-manifest-node<major>`.
- [x] Run the driver once locally in leg-manifest mode: `npx tsx src/scripts/consumer_matrix.ts --only pack --manifest …` → pack leg green, manifest written with expected-legs list (full-run legs execute in the workflow; the local smoke proves the manifest + gate wiring). <!-- carve-out: new-gate-verification -->

### 6b — Bus-factor gate: explicit neutral state (ship-if-trivial)

- [x] `src/scripts/self_review_gate.ts`: no-key path now emits `::warning::self-review-gate NEUTRAL — … NOTHING was reviewed` + a `### Self-review gate: NEUTRAL` job-summary block ("This is not a pass."). ~14 changed lines, within budget; verified live (`--base HEAD~1` without key → NEUTRAL warning + summary written); existing 7 gate tests green.

### 6c — Growth ratchet + sizing norm (zero enforcement cost)

- [x] Added to `.github/pull_request_template.md` § Promotion Gate: "New capability? Names what it replaces/consolidates, or justifies its routing + context cost (growth ratchet)". (Human judgment; no gate.)
- [x] `docs/contracts/release-sizing.md` § "Primary goal declaration": `Primary-Goal:` line on every release PR + exception annotation; mechanical subsystem-count lint explicitly REJECTED with the council rationale inline.

**Non-goal (this phase):** tripwire risk classes (per-workflow tolerated-red windows). The 48h uniform threshold stays — the consequence of red is "maintainer sees it and fixes it"; class machinery doesn't change that. Revisit-if: a publish-critical workflow stays red past 24h AND the uniform tripwire demonstrably surfaced it too late.

---

## Phase 7 — Closure

- [x] Full condensation/sync pass: 9 changed .md files condensed to `dist/agent-src/` (`condense.sh --check` ✅ in sync; `check_condensation` ✅ zero errors); `task generate-tools` regenerated all tool projections (rules=312 incl. the new rule).
- [x] Cross-reference sweep: `./scripts-run src/scripts/check_references` → no broken references; new rule cross-linked from `code-clarity.md` + php guideline; `task typecheck-ts` exit 0 over the whole tree incl. tests.
- [x] Regenerate the roadmap dashboard (`./agent-config roadmap:progress`) — ran after every phase flip in this run.
- [x] Memory: council convergence recorded as `council-fable-feedback-5` (five verdicts + revisit-ifs) in the maintainer memory index.

## Acceptance criteria

- `code-comment-discipline` rule exists, is routed (tier-1 auto), passes the skill linter, and its behavioral eval demonstrates: zero redundant docblocks/what-comments in fixture output while the machine-precision docblock survives.
- `first_pass_success`/`escalated` have a written, mechanically-checkable definitions table; telemetry schema unchanged (2 fields).
- Invariant-change process documented; `check_rule_invariants.ts` (+ mutation self-test) green; failure output points at the process.
- Tier floor active in `skill_eval_coverage.ts --check`; both golden E2E evals run in the harness with recorded baselines.
- Worktree cleanup edge-case matrix fully tested (8 rows) with refuse/proceed semantics asserted.
- Consumer matrix fails on any silently-skipped leg; leg table visible in the job summary.
- Every new gate/test introduced by this roadmap executed once locally (carve-out steps above); remote CI remains the authoritative gate for everything else (`quality.local_auto_run: false`).

## Quality gates (targeted, per roadmap-ci-steps-policy)

- `./scripts-run src/scripts/skill_linter` (new rule + touched skills)
- `npx tsx src/scripts/check_rule_invariants.ts --mutation-selftest`
- `npx tsx src/scripts/skill_eval_coverage.ts --check`
- Targeted test files for worktree edge cases + consumer-matrix leg manifest
- Remote CI on the PR is the full-pipeline gate

## Non-goals (decided, with revisit conditions)

1. **Deterministic comment lint** — revisit-if ≥30% redundant-comment rate observed in ≥5 real tasks post-rule.
2. **Invariant-ID migration now** — revisit-if behavioral evals cover ≥10/19 invariants.
3. **New telemetry fields** (`verification_passed`, `parent_rework_level`, `regression_detected`, `task_completed`, `judge_confidence`, `human_rejected`) — revisit-if a verification harness makes them machine-observable within the privacy floor.
4. **Weighted eval-coverage scoring** — tier floor supersedes; no revisit condition (false precision).
5. **Tripwire risk classes** — revisit-if the uniform 48h window demonstrably surfaces a publish-critical red too late.
6. **Mechanical release-size lint** — sizing stays a norm + declaration + exception annotation.
7. **Laravel / React-screenshot / poisoned-doc / stale-memory E2E tasks** — first two: cost≫signal for a single maintainer; last two: unit-fixture-sized, route to existing suites.
