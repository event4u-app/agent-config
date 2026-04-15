# Roadmap: Controlled Self-Optimization (Phase 2)

> Upgrade the agent system from "learning-enabled" to "controlled self-optimizing" — add selection, validation, lifecycle management, and governance layers.

## Current State (PR #2)

**✅ Completed (validation layer partially):**
- `skill-linter` skill (agent-side structural validation)
- `scripts/skill_linter.py` (CLI linter with 10 check categories)
- Taskfile commands: `task lint-skills`, `task lint-skills-strict`, `task lint-skills-changed`, `task lint-skills-json`
- 5 passing tests for linter
- Baseline: 13 pass, 65 warn, 219 fail

**⏳ Remaining:**
- Promotion Gate (selection layer)
- CI integration for linter (GitHub Actions)
- Lifecycle management (deprecation, cleanup)
- Upstream contribution guard
- Compression pair checks in linter

- **Feature:** none
- **Jira:** none
- **Depends on:** `skills-rules-restructuring.md` (Phase 1), `skill-improvement-pipeline.md`

## Prerequisites

- [x] Phase 1 toolchain: meta-skills, learning loop, compress workflow
- [x] Linter MVP: script + tests + Taskfile
- [ ] Phase 1 audit complete (skills-rules-restructuring)
- [ ] Pipeline foundation (skill-improvement-pipeline)

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

### Implementation
- [ ] **Step 1:** Create rule `promotion-gate.md`
  - Short constraints: "Do not create new skill/rule without passing promotion criteria"
  - Reference criteria table
- [ ] **Step 2:** Update `learning-to-rule-or-skill` skill — add promotion gate as mandatory Step 0
- [ ] **Step 3:** Update `post-task-learning-capture` skill — add promotion check before proposing creation
- [ ] **Step 4:** Compress all updated files

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

### Still needed
- [ ] **Step 1:** Add compression pair checks to linter script
  - `--pair` mode: compare uncompressed vs compressed
  - Verify compressed preserves: trigger, validation, decisions, gotchas

- [ ] **Step 2:** Add duplication detection improvements
  - Cross-skill name + description similarity
  - Warn on high overlap
- [ ] **Step 3:** Create GitHub Actions workflow `.github/workflows/lint-agent-config.yml`
  - Trigger: PRs touching `.augment/` or `.augment.uncompressed/`
  - Runs `task lint-skills`
  - Required check (blocks merge on errors)
- [ ] **Step 4:** Add compression consistency check to CI
  - `task sync-changed` — verify no unsynced files
- [ ] **Step 5:** More tests for edge cases + pair mode

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

### Implementation
- [ ] **Step 1:** Add `status` field to skill template YAML frontmatter
- [ ] **Step 2:** Create rule `lifecycle-management.md`
- [ ] **Step 3:** Add linter check for deprecated status
- [ ] **Step 4:** Create periodic cleanup task (quarterly review)

## Phase 2.4: Upstream Contribution Guard

### Requirements for upstream PR

| Requirement | Check |
|---|---|
| Passed promotion gate | All criteria YES |
| Passed linter | `task lint-skills` — 0 errors |
| Not project-specific | No domain assumptions |
| Tested locally | Applied and validated |
| Improves general behavior | Benefits all package consumers |

### Implementation
- [ ] **Step 1:** Add upstream checklist to pipeline skill
- [ ] **Step 2:** Create PR template `.github/PULL_REQUEST_TEMPLATE/agent-improvement.md`
- [ ] **Step 3:** Add CI check on upstream repo

## Phase 2.5: CI Integration Summary

### Required checks (block merge)
- [x] `task lint-skills` — script + Taskfile exist
- [ ] GitHub Actions workflow to run on PRs
- [ ] `task sync-changed` — compression consistency in CI
- [ ] Duplicate detection in linter

### Optional checks (warn only)
- [ ] Size limits (skill > 500 lines)
- [ ] Deprecated usage detection

## Acceptance Criteria

- [ ] Promotion gate rule enforced in learning workflows
- [ ] Linter runs in CI, blocks on errors
- [ ] Lifecycle status field in YAML frontmatter
- [ ] Upstream contribution guard in pipeline
- [ ] CI checks configured
- [ ] Existing skills pass linter (after Phase 1)

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