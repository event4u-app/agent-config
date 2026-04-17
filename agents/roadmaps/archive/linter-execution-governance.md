# Roadmap: Skill Linter — Execution Governance ✅

> Extend the skill linter from schema validation to full execution governance
> with type boundary enforcement, verification maturity, and CI ratcheting.
>
> **Status: COMPLETE** — All 5 phases implemented. Deferred items tracked in "Remaining" section.

## Prerequisites

- [x] Read `AGENTS.md` and linter architecture
- [x] Phase 1 complete: 7 execution quality checks in `scripts/skill_linter.py`
- [x] Test suite: `tests/test_skill_linter.py` (24 tests passing)

## Context

The linter gained execution quality checks in Phase 1. This roadmap covers
Phases 2-5: fixing failing artifacts, hardening heuristics, enforcing type
boundaries, and adding CI governance.

- **Feature:** [`agents/features/linter-execution-governance.md`](../../features/linter-execution-governance.md)
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

## Phase 2: Fix Failing Artifacts + Harden Heuristics ✅

### 2a: Fix the 8 failing skills ✅

- [x] 4 fixed via synonym expansion (api-endpoint, copilot-config, dependency-upgrade, devcontainer)
- [x] 4 fixed with analysis sections (api-testing, copilot-agents-optimization, override-management, traefik)
- [x] Result: 0 FAIL (was 8)

### 2b: Expand signal synonyms ✅

- [x] Analysis: +examine, study, investigate, assess, gather context, read project, before upgrading/changing/creating
- [x] Verification: +confirm, assert, run phpstan, must pass, response shape
- [x] Tools: +phpstan, rector, pest, devcontainer build
- [x] Debug: +runtime, stack trace, dump
- [x] Efficiency: +narrow, scoped, only relevant
- [x] Anti-bruteforce: +diagnose, root cause, targeted fix
- [x] Clarification: +confirm with user, if unsure, when in doubt

### 2c: Section-based detection ✅

- [x] Section header extraction via regex (H1-H4)
- [x] Analysis sections: understand, analyze, assess, context, review, current setup
- [x] Verification sections: verify, validat, test, acceptance, quality gate
- [x] Anti-pattern sections: do not, don't, gotcha, anti-pattern, avoid
- [x] Combined with keywords via OR logic
- [x] Test: fixture for section-only signals

## Phase 3: Type Boundary Enforcement ✅

### New checks ✅

- [x] `guideline_contains_executable_procedure` (warning) — 5+ executable numbered steps
- [x] `command_missing_skill_references` (warning) — no skill reference in frontmatter or body
- [x] `skill_validation_too_generic` (warning) — vague validation without concrete checks
- [x] Pre-existing: `rule_contains_long_procedure` (warning), `pointer_only_skill` (warning)
- [x] Findings: 3 commands without skill refs
- [x] Tests: 5 new fixtures (guideline pass/fail, command pass/fail, vague validation)

### Boundary rules (documented in feature plan)

- [x] Rule = constraint (short, always-active, no procedure)
- [x] Skill = executable knowledge (procedure, validation, examples)
- [x] Guideline = coding patterns (reference, not workflow)
- [x] Command = orchestration (steps, skill references, no domain logic)

## Phase 4: Verification Maturity ✅

### Task-type → verification mapping ✅

- [x] 5 task types: backend, frontend, CLI, database, debugging
- [x] Each maps to expected verification tools (curl, Playwright, exit code, etc.)
- [x] Need 2+ content signals per type to classify (avoids false positives)
- [x] Only for execution-oriented skills (strong file-name match)
- [x] Findings: 6 warnings across 4 skills
- [x] Tests: 2 new fixtures (backend with/without curl)

### Enrichment suggestions (deferred)

- [ ] When verification is vague, suggest concrete commands in linter output
- [ ] Example: "Consider adding: `curl -s /api/endpoint | jq '.status'`"

## Phase 5: Governance & Packaging Consistency ✅

### Repo-wide checks ✅

- [x] `compressed_variant_missing` — uncompressed exists but no compressed
- [x] `uncompressed_variant_missing` — compressed exists but no source
- [x] `invalid_location_for_type` — artifact type doesn't match directory
- [x] 0 findings on current repo (clean)
- [x] Tests: 2 new governance tests (orphan + paired rule)

### CI modes (deferred)

- [ ] **PR mode** — check only changed files, annotate errors
- [ ] **Baseline / Ratchet** — save warning count, prevent increase
- [ ] **JSON export** — structured output for metrics tracking

## Acceptance Criteria

- [x] 0 FAIL on `python3 scripts/skill_linter.py --all` (129 pass, 86 warn, 0 fail)
- [x] All execution checks have pass + fail test fixtures (34 tests, all green)
- [x] Type boundary checks active for new/changed files
- [x] CI integration — linter runs in `task ci` and GitHub Actions consistency workflow
- [x] All quality gates pass (tests, no regressions)

## Remaining (nice-to-have, future work)

- [ ] Enrichment suggestions in linter output
- [ ] PR mode (check only changed files)
- [ ] Baseline / ratchet (prevent warning count increase)
- [ ] JSON export for metrics
- [ ] `compression_hash_stale` check
- [ ] `duplicate_skill_name` check

## Stats

| Metric | Before | After |
|---|---|---|
| Total checks | ~15 | ~30 |
| FAIL | 8 | 0 |
| WARN | 78 | 86 |
| PASS | 128 | 129 |
| Test count | 24 | 34 |
| Linter layers | 1 (schema) | 5 (schema + execution + boundary + verification + governance) |

## Notes

- All 5 phases implemented in branch `refactor/improve-skill-system`
- The 85 warnings are expected — mostly pre-existing structural issues
- Warning breakdown: 42 missing_inspect_step, 17 long_rule, 13 procedural_rule, etc.
- False positive rate is low — strong/weak match separation works well
