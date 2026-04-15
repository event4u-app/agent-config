# Roadmap: Controlled Self-Optimization (Phase 2)

> Upgrade the agent system from "learning-enabled" to "controlled self-optimizing" — add selection, validation, lifecycle management, and governance layers.

## Current State

**✅ All phases complete:**
- Promotion Gate in `capture-learnings` rule + `learning-to-rule-or-skill` Step 0
- Linter: 14 tests, `--pairs`, `--duplicates` modes, lifecycle status detection
- CI: `skill-lint.yml` + `consistency.yml` workflows
- Lifecycle: `status` field in template, linter detects deprecated/superseded
- Upstream guard: PR template with 4-gate checklist
- Taxonomy decision matrix in skill-writing, skill-reviewer, learning-to-rule-or-skill

## Prerequisites

- [x] Phase 1 toolchain: meta-skills, learning loop, compress workflow
- [x] Linter MVP: script + tests + Taskfile
- [x] Phase 1 audit complete (skills-rules-restructuring)
- [x] Taxonomy audit complete (taxonomy-audit)

## Phase 2.1: Promotion Gate (Selection Layer)

A learning may be promoted to rule/skill ONLY if it passes these criteria:

| Gate | Question | Must be YES |
|---|---|---|
| Repetition | Occurred at least twice OR clearly generalizable? | ✅ |
| Impact | Improves correctness, reliability, or consistency? | ✅ |
| Failure pattern | Prevents a real, observed failure? | ✅ |
| Non-duplication | No existing rule/skill covers this? | ✅ |
| Scope fit | Fits rule (constraint) OR skill (workflow)? | ✅ |
| Minimal | Update preferred over creation? | Checked |

### Decision outcomes
- **Create new** — only if no existing guidance covers it
- **Update existing** — preferred over create
- **Reject** — one-off, vague, or already covered

### Implementation — ✅ COMPLETE
- [x] **Step 1:** Promotion gate added to existing `capture-learnings` rule (no separate rule needed)
- [x] **Step 2:** `learning-to-rule-or-skill` skill — Step 0 (mandatory) with gate table
- [x] ~~Step 3: `post-task-learning-capture` — does not exist, covered by capture-learnings rule~~
- [x] **Step 4:** Compressed all updated files

## Phase 2.2: Skill/Rule Linter CI Integration

Extend the existing linter script (`scripts/skill_linter.py`) with CI enforcement.

### Already done
- [x] Structural checks: required sections, trigger quality, procedure quality
- [x] Vague validation detection
- [x] Rule quality checks
- [x] Text + JSON output
- [x] `--all`, `--changed` modes
- [x] Taskfile commands
- [x] 5 passing tests

### Still needed — ✅ COMPLETE
- [x] **Step 1:** `--pairs` mode: checks uncompressed/compressed pair consistency
- [x] **Step 2:** `--duplicates` mode: cross-skill description similarity (>70% word overlap)
- [x] **Step 3:** GitHub Actions workflow `.github/workflows/skill-lint.yml`
- [x] **Step 4:** Consistency check `.github/workflows/consistency.yml`
- [x] **Step 5:** 14 linter tests passing + lifecycle status detection

## Phase 2.3: Lifecycle Management (Cleanup Layer)

### Status model

Add YAML frontmatter field:

    status: active          # default
    status: deprecated      # better alternative exists
    status: superseded      # fully replaced
    replaced_by: new-skill  # optional

### Lifecycle rules

| Action | When |
|---|---|
| **Deprecate** | Better alternative exists, partially redundant, outdated |
| **Supersede** | Fully replaced, merged into another |
| **Remove** | Deprecated/superseded AND unused for 2+ months |

### Implementation — ✅ COMPLETE
- [x] **Step 1:** `status` field added to skill template (active/deprecated/superseded + replaced_by)
- [x] ~~Step 2: `lifecycle-management.md` rule — not needed, linter enforces lifecycle~~
- [x] **Step 3:** Linter detects deprecated and superseded skills with warnings
- [ ] **Step 4:** Periodic cleanup task (quarterly review) — process, not an artifact

## Phase 2.4: Upstream Contribution Guard

An improvement may be submitted upstream ONLY if ALL of these pass:

| # | Gate | Criterion | Hard fail if... |
|---|---|---|---|
| 1 | Promotion | All promotion criteria passed | Any gate = NO |
| 2 | Linter | `task lint-skills` — 0 errors | Exit code ≠ 0 |
| 3 | Universality | No project-specific assumptions | Contains domain logic, local paths, or FQDN-specific behavior |
| 4 | Local proof | Applied locally AND validated in real usage | Only theoretical, never tested |
| 5 | Package benefit | Improves behavior for ALL consumers | Only benefits one project |
| 6 | Completeness | Both uncompressed + compressed versions present | Missing either file |
| 7 | Non-regression | Does not break or weaken existing guidance | Removes constraints without replacement |

**Reject immediately if:**
- Learning occurred only once and is not clearly generalizable
- Similar rule/skill already exists (update instead)
- Contains project-specific conventions, domain terms, or local paths
- Compressed version drops validation, gotchas, or trigger clarity

### Implementation — ✅ COMPLETE
- [x] **Step 1:** Upstream checklist documented in PR template
- [x] **Step 2:** PR template `.github/pull_request_template.md` with 4-gate checklist
- [ ] **Step 3:** CI check on upstream repo (deferred — needs upstream repo setup)

## Phase 2.5: CI Integration Summary

### Required checks (block merge)
- [x] `task lint-skills` — script + Taskfile exist
- [x] GitHub Actions workflow (`.github/workflows/skill-lint.yml`)
- [x] Consistency check (`.github/workflows/consistency.yml` + `task consistency`)
- [ ] Duplicate detection in linter

### Optional checks (warn only)
- [ ] Size limits (skill > 500 lines)
- [ ] Deprecated usage detection

## Acceptance Criteria

- [x] Promotion gate enforced in capture-learnings rule + learning-to-rule-or-skill Step 0
- [x] Linter runs in CI (skill-lint.yml), blocks on errors
- [x] Lifecycle status field in YAML frontmatter + linter detection
- [x] Upstream contribution guard in PR template (4-gate checklist)
- [x] CI checks configured (skill-lint + consistency)
- [x] Existing skills pass linter: 0 FAIL / 164 total

## Success Metrics

Controlled self-optimizing when:
- Repeated mistakes decrease
- Rule/skill count grows slowly and intentionally
- Duplicates remain low
- Deprecated items actively cleaned up
- Upstream PRs pass quality gate on first attempt

## Anti-patterns
- Capturing every small learning
- Creating new instead of updating existing
- Skipping validation
- Compressing away critical logic
- Keeping outdated or redundant skills
- Over-automating without control gates

## Notes

- **Phase 2 depends on Phase 1** — restructuring first
- **Start with promotion gate** — highest impact, lowest effort
- **CI linter second** — automates what already works locally
- **Lifecycle third** — needs enough skills to matter
- **Do not automate prematurely** — manual first, CI second
- **Tool-first, script-last** — linter script is the exception; all agent-side guidance uses skills + CLI tools, not custom scripts (see `token-efficiency` rule)