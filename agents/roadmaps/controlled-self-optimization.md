# Roadmap: Controlled Self-Optimization (Phase 2)

> Upgrade the agent system from "learning-enabled" to "controlled self-optimizing" — add selection, validation, lifecycle management, and governance layers.

## Prerequisites

- [ ] Phase 1 complete: `agents/roadmaps/skills-rules-restructuring.md`
- [ ] Pipeline foundation: `agents/roadmaps/skill-improvement-pipeline.md`
- [ ] Meta-skills available: `skill-writing`, `skill-validator`, `skill-caveman-compression`, `skill-refactor`
- [ ] Learning loop active: `capture-learnings` rule, `learning-to-rule-or-skill`, `post-task-learning-capture`

## Context

Phase 1 enables capturing learnings and generating rules/skills.
Phase 2 prevents uncontrolled growth by adding three control layers:

**Without Phase 2:**
- Uncontrolled growth of rules/skills
- Duplicate or weak guidance entering the system
- Degraded signal quality over time
- No mechanism to remove or retire outdated content

**With Phase 2:**
- Only proven, repeated learnings become permanent guidance
- Every change is structurally validated before merge
- Outdated content is actively deprecated and removed
- Upstream contributions are quality-gated

- **Feature:** none
- **Jira:** none
- **Depends on:** `skills-rules-restructuring.md`, `skill-improvement-pipeline.md`

## Phase 2.1: Promotion Gate (Selection Layer)

A learning may be promoted to rule/skill ONLY if it passes these criteria.

### Promotion criteria

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

- [ ] **Step 1:** Create rule `promotion-gate.md` in `.augment.uncompressed/rules/`
  - Short, hard constraints: "Do not create new skill/rule without passing promotion criteria"
  - Reference the criteria table above
  - Link to `learning-to-rule-or-skill` skill for the full workflow
- [ ] **Step 2:** Update `learning-to-rule-or-skill` skill
  - Add promotion gate as mandatory Step 0 before any creation
  - Add "Reject" as explicit outcome with examples
- [ ] **Step 3:** Update `post-task-learning-capture` skill
  - Add promotion gate check before proposing creation
- [ ] **Step 4:** Compress all updated files

## Phase 2.2: Skill/Rule Linter (Validation Layer)

Automated structural and quality validation enforced in CI and before compression.

### Validation checks

**Structural (SKILL.md):**
- [ ] Required sections exist: When to use, Procedure, Output format, Gotchas, Do NOT
- [ ] "Do not use when" boundary present
- [ ] Procedure has Step 0 (Inspect) and concrete validation step
- [ ] Description starts with "Use when..." and is under 200 chars

**Structural (Rules):**
- [ ] Short and directive
- [ ] Always applicable (no conditional logic)
- [ ] No procedures or examples (those belong in skills)


**Execution quality:**
- [ ] Procedure steps are actionable (not "think about X")
- [ ] Validation is concrete (not "check if it works")
- [ ] Output format controls verbosity
- [ ] Trigger is specific enough to match reliably

**Anti-pattern detection:**
- [ ] Not overly broad (e.g. "Laravel skill")
- [ ] Not documentation disguised as skill
- [ ] No duplicated logic across skills
- [ ] No excessive length without justification

**Compression safety:**
- [ ] Compressed version preserves: trigger clarity, validation, decision hints, gotchas

### Implementation

- [ ] **Step 1:** Create `skill-linter` skill — wraps `skill-validator` with CI-compatible output
  - Input: file path or directory
  - Output: pass/fail + issue list + suggested fixes
  - Exit code for CI integration
- [ ] **Step 2:** Create Taskfile command `task lint-skills`
  - Runs linter on all skills in `.augment/skills/`
  - Fails on structural errors, warns on quality issues
- [ ] **Step 3:** Create Taskfile command `task lint-rules`
  - Validates rules are short, directive, always-applicable
- [ ] **Step 4:** Add CI check in GitHub Actions
  - Required check on PRs touching `.augment/` or `.augment.uncompressed/`
  - Runs `task lint-skills` + `task lint-rules`
  - Blocks merge on failure
- [ ] **Step 5:** Add compression consistency check
  - Verify compressed version exists for every uncompressed file
  - Verify compressed is not older than uncompressed (hash check via `task sync-changed`)

## Phase 2.3: Lifecycle Management (Cleanup Layer)

Prevent long-term degradation by actively managing skill/rule lifecycle.

### Status model

Add YAML frontmatter field to skills and rules:

    status: active          # default, actively used
    status: deprecated      # better alternative exists, still works
    status: superseded      # fully replaced, will be removed
    replaced_by: new-skill  # optional, points to replacement

### Lifecycle rules

| Action | When |
|---|---|
| **Deprecate** | Better alternative exists, partially redundant, outdated |
| **Supersede** | Fully replaced by better version, merged into another |
| **Remove** | Deprecated/superseded AND unused for 2+ months |

### Implementation

- [ ] **Step 1:** Add `status` field to skill template YAML frontmatter
  - Values: `active`, `deprecated`, `superseded`
  - Optional: `replaced_by`
  - Default: `active` (backwards compatible — missing = active)
- [ ] **Step 2:** Create rule `lifecycle-management.md`
  - When to deprecate, supersede, remove
  - "Prefer merge over accumulation"
  - "Deprecated skills must have `replaced_by` or removal date"
- [ ] **Step 3:** Add linter check for deprecated status
  - Warn on deprecated skills still active
  - Warn on superseded skills not yet removed
- [ ] **Step 4:** Create periodic cleanup task
  - Quarterly review: list all deprecated/superseded skills
  - Decide: remove, merge, or reactivate

## Phase 2.4: Upstream Contribution Guard

Quality gate for PRs against `event4u-app/agent-config`.

### Requirements for upstream PR

| Requirement | Check |
|---|---|
| Passed promotion gate | All criteria YES |
| Passed linter | No structural errors |
| Not project-specific | No domain assumptions, no local conventions |
| Tested in real usage | Applied locally and validated |
| Improves general behavior | Benefits all projects using the package |

### Do NOT upstream

- Local conventions or domain-specific hacks
- Unproven ideas or partially working skills
- Skills with project-specific environment notes
- Rules that only apply to one tech stack variant

### Implementation

- [ ] **Step 1:** Add upstream checklist to `skill-improvement-pipeline` skill
- [ ] **Step 2:** Create PR template `.github/PULL_REQUEST_TEMPLATE/agent-improvement.md`
  - Sections: Learning, Promotion Gate, Linter Output, Local Validation, Impact
- [ ] **Step 3:** Add CI check on upstream repo for lint validation

## Phase 2.5: CI Integration

### Required checks (block merge)

- [ ] `task lint-skills` — structural + quality validation
- [ ] `task lint-rules` — rule format validation
- [ ] `task sync-changed` — compression consistency
- [ ] Duplicate detection (basic name + description similarity)

### Optional checks (warn only)

- [ ] Size limits — warn if skill exceeds 500 lines
- [ ] Change impact hints — flag skills with many dependents
- [ ] Deprecated usage detection — flag references to deprecated skills

### Implementation

- [ ] **Step 1:** Add lint tasks to Taskfile
- [ ] **Step 2:** Create GitHub Actions workflow `.github/workflows/lint-agent-config.yml`
- [ ] **Step 3:** Configure as required check for PRs

## Acceptance Criteria

- [ ] Promotion gate rule exists and enforced in learning workflows
- [ ] Skill/rule linter runs in CI and blocks on failure
- [ ] Lifecycle status field in YAML frontmatter (active/deprecated/superseded)
- [ ] Upstream contribution guard integrated in pipeline
- [ ] All CI checks configured and running
- [ ] Existing skills validated against linter (baseline clean)

## Success Metrics

The system is "controlled self-optimizing" when:

- Repeated mistakes decrease over time
- Rule/skill count grows slowly and intentionally
- Duplicates remain low
- Deprecated items are actively cleaned up
- Upstream PRs pass quality gate on first attempt

## Anti-patterns

- Capturing every small learning
- Creating new instead of updating existing
- Skipping validation
- Compressing away critical logic
- Keeping outdated or redundant skills
- Over-automating without control gates

## Notes

- **Phase 2 depends on Phase 1** — restructuring must be complete first
- **Start with promotion gate** — highest impact, lowest effort
- **CI linter second** — automates what `skill-validator` does manually
- **Lifecycle management third** — needs enough skills to matter
- **Do not automate prematurely** — manual review first, CI second