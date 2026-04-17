# Roadmap: Skill Linter — Execution Governance

> Extend the skill linter from schema validation to full execution governance
> with type boundary enforcement, verification maturity, and CI ratcheting.

## Prerequisites

- [x] Read `AGENTS.md` and linter architecture
- [x] Phase 1 complete: 7 execution quality checks in `scripts/skill_linter.py`
- [x] Test suite: `tests/test_skill_linter.py` (24 tests passing)

## Context

The linter gained execution quality checks in Phase 1. This roadmap covers
Phases 2-5: fixing failing artifacts, hardening heuristics, enforcing type
boundaries, and adding CI governance.

- **Feature:** [`agents/features/linter-execution-governance.md`](../features/linter-execution-governance.md)
- **Linter:** `scripts/skill_linter.py`
- **Tests:** `tests/test_skill_linter.py`

## Phase 1: Execution Quality Foundation ✅

- [x] `missing_analysis_before_action` (error, skills only)
- [x] `missing_real_verification` (error, skills + strong match)
- [x] `missing_verification_tool_mapping` (warning)
- [x] `missing_runtime_debug_guidance` (warning)
- [x] `missing_efficient_tooling_guidance` (warning)
- [x] `missing_anti_bruteforce_guidance` (warning)
- [x] `missing_clarification_guard` (warning)
- [x] Detection: file-name signals + content threshold (5+)
- [x] Exclusions: commands, guidelines, rules (most checks)
- [x] Tests: 6 new tests for all check paths

## Phase 2: Fix Failing Artifacts + Harden Heuristics

### 2a: Fix the 8 failing skills

Each needs an analysis/understand section added to pass `missing_analysis_before_action`:

- [ ] `api-endpoint` — add "analyze existing endpoints/patterns before creating new ones"
- [ ] `api-testing` — add "understand the endpoint behavior before writing tests"
- [ ] `copilot-agents-optimization` — add "analyze current AGENTS.md/copilot-instructions before optimizing"
- [ ] `copilot-config` — add "review current Copilot configuration before changing"
- [ ] `dependency-upgrade` — add "analyze current dependency tree before upgrading"
- [ ] `devcontainer` — add "inspect existing container setup before modifying"
- [ ] `override-management` — add "understand original skill/rule before creating override"
- [ ] `traefik` — add "review current routing setup before changing"
- [ ] Run `python3 scripts/skill_linter.py --all` — target: 0 FAIL
- [ ] Quality: all tests pass

### 2b: Expand signal synonyms

Reduce false negatives by adding more synonyms to signal groups in `lint_execution_quality()`:

- [ ] Analysis signals: add "review", "examine", "study", "investigate", "check existing"
- [ ] Verification signals: add "confirm", "assert", "check result", "observe"
- [ ] Anti-bruteforce signals: add "diagnose", "root cause", "targeted fix"
- [ ] Clarification signals: add "confirm with user", "verify requirement", "ambiguous"
- [ ] Tests: add fixture for skill using synonyms (should pass, not false-negative)

### 2c: Section-based detection (complement to keywords)

- [ ] Detect `## Procedure` / `## Steps` sections and check if step 1 is analysis-related
- [ ] Detect `## Verify` / `## Validation` sections as strong verification signal
- [ ] Detect `## Do NOT` sections and check for anti-bruteforce bullets
- [ ] Tests: fixture for section-based detection

## Phase 3: Type Boundary Enforcement

### New checks

- [ ] `rule_contains_long_procedure` (warning) — rule has >5 ordered steps → suggest skill
- [ ] `skill_pointer_only` (error) — skill has <30 lines of actual content → useless
- [ ] `guideline_contains_executable_procedure` (warning) — guideline has numbered steps
- [ ] `command_missing_skill_references` (warning) — command doesn't reference any skill
- [ ] `skill_validation_too_generic` (warning) — validation section says "check if it works"

### Boundary rules documentation

- [ ] Document type boundaries in `.augment/contexts/` or template
- [ ] Rule = constraint (short, always-active, no procedure)
- [ ] Skill = executable knowledge (procedure, validation, examples)
- [ ] Guideline = coding patterns (reference, not workflow)
- [ ] Command = orchestration (steps, skill references, no domain logic)

### Tests

- [ ] Fixture: valid rule (short, constraint-only)
- [ ] Fixture: rule that's really a skill (long procedure)
- [ ] Fixture: guideline with executable steps
- [ ] Fixture: pointer-only skill (<30 lines)
- [ ] Run full suite — no regressions

## Phase 4: Verification Maturity

### Task-type → verification mapping

- [ ] Detect task type from skill content (backend, frontend, CLI, database, debugging)
- [ ] Map to expected verification: backend→curl/Postman, frontend→Playwright, CLI→exit code
- [ ] `missing_backend_verification_example` (warning) — backend skill without curl/Postman
- [ ] `missing_frontend_verification_example` (warning) — frontend skill without Playwright
- [ ] `verification_is_vague` (warning) — verification says "check" without concrete command

### Enrichment suggestions

- [ ] When verification is vague, suggest concrete commands in linter output
- [ ] Example: "Consider adding: `curl -s /api/endpoint | jq '.status'`"

## Phase 5: Governance & Packaging Consistency

### Repo-wide checks

- [ ] `compressed_variant_missing` — uncompressed exists but no compressed (already exists)
- [ ] `compression_hash_stale` — hash doesn't match current content
- [ ] `duplicate_skill_name` — two skills with same `name` in frontmatter
- [ ] `invalid_location_for_type` — skill in rules/ directory, etc.

### CI modes

- [ ] **Local dev mode** — colored output, fix suggestions
- [ ] **PR mode** — check only changed files, annotate errors
- [ ] **Full repo mode** — complete scan, baseline comparison

### Baseline / Ratchet

- [ ] Save current warning/error count as baseline
- [ ] New PRs must not increase the count
- [ ] JSON export for metrics tracking

## Acceptance Criteria

- [ ] 0 FAIL on `python3 scripts/skill_linter.py --all`
- [ ] All execution checks have pass + fail test fixtures
- [ ] Type boundary checks active for new/changed files
- [ ] CI integration documented
- [ ] All quality gates pass (tests, no regressions)

## Notes

- Phase 1 was implemented in branch `refactor/improve-skill-system`
- The 78 warnings are expected — most are pre-existing structural issues
- False positive risk is highest in Phase 3 (boundary enforcement)
- JSON output format can wait until Phase 5 — human-readable is fine for now
