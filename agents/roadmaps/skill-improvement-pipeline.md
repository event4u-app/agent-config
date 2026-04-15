# Roadmap: Agent Skill Improvement Pipeline

> A repeatable, opt-in pipeline that captures post-task learnings, converts them into rules or skills, and proposes universal improvements back to the agent-config package via PR.

## Current State (PR #2)

**✅ All component skills exist:**
- `post-task-learning-capture` — extract learnings after tasks
- `learning-to-rule-or-skill` — classify and decide rule vs skill
- `skill-writing` — create new skills to standard
- `skill-validator` — validate quality
- `skill-refactor` — improve existing skills
- `skill-caveman-compression` — compress for runtime
- `skill-linter` — structural validation (agent-side + script)
- `capture-learnings` rule — always-apply reflex

**⏳ Remaining (this roadmap):**
- `.agent-settings` configuration
- Trigger rule (opt-in activation)
- Pipeline orchestration skill
- PR template for upstream contributions

- **Feature:** none
- **Jira:** none
- **Related:** `agents/roadmaps/skills-rules-restructuring.md` (Phase 1), `agents/roadmaps/controlled-self-optimization.md` (Phase 2)

## Phase 1: Settings & Configuration

- [ ] **Step 1:** Add `skill_improvement_pipeline` setting to agent-settings template
  - Key: `skill_improvement_pipeline`
  - Values: `true`, `false`
  - Default: `false`
  - Description: "When true, run post-task learning capture after meaningful tasks and propose improvements"
  - Add to `.augment.uncompressed/templates/agent-settings.md` + compress
- [ ] **Step 2:** Add `upstream_repo` setting
  - Key: `upstream_repo`
  - Default: `event4u-app/agent-config`
  - Description: "Target repository for universal improvement PRs"
- [ ] **Step 3:** Add `improvement_pr_branch_prefix` setting
  - Key: `improvement_pr_branch_prefix`
  - Default: `improve/agent-`

## Phase 2: Pipeline Trigger Rule

- [ ] **Step 1:** Create rule `skill-improvement-trigger.md`
  - Read `skill_improvement_pipeline` from `.agent-settings`
  - When `true` and a meaningful task completes:
    1. Quick mental check (not full workflow)
    2. If 1+ concrete learnings found → ask user:
       ```
       > 💡 Learning detected: "{learning summary}"
       >
       > 1. Capture & improve — run full pipeline
       > 2. Skip — not worth capturing
       ```
    3. If user picks 1 → continue to pipeline skill
  - When `false` → silent
  - Never trigger on trivial tasks (config, typos, docs-only)
- [ ] **Step 2:** Compress rule

## Phase 3: Pipeline Orchestration Skill

- [ ] **Step 1:** Create skill `skill-improvement-pipeline`
  - Full pipeline workflow using existing component skills:
    1. **Capture** — `post-task-learning-capture` (extract 1-3 learnings)
    2. **Promotion Gate** — check criteria (see `controlled-self-optimization.md` Phase 2.1)
       - Repeated or generalizable? Impact? Non-duplicate? Reject if not.
    3. **Classify** — `learning-to-rule-or-skill` (rule vs skill vs update vs skip)
    4. **Create/Update** — `skill-writing` or `skill-refactor`
    5. **Validate** — `skill-validator` / `task lint-skills`
    6. **Compress** — `skill-caveman-compression`
    7. **Decide scope** — ask user:
       ```
       > 📦 Improvement ready: {description}
       >
       > 1. Universal — apply locally + PR to upstream package
       > 2. Project-specific — apply locally only (agents/overrides/)
       > 3. Review first — show me the changes before deciding
       ```
    8. **Apply locally** — write to `.augment.uncompressed/` + `.augment/` (or `agents/overrides/`)
    9. **PR upstream** (if universal — must pass upstream contribution guard):
       - Create branch `{prefix}{learning-slug}` from `main`
       - Commit changes
       - Create PR against `upstream_repo`
       - Link back to task context
- [ ] **Step 2:** Compress skill

## Phase 4: PR Template & Automation

- [ ] **Step 1:** Create PR template `.github/PULL_REQUEST_TEMPLATE/agent-improvement.md`
  - Title: `improve(agent): {short description}`
  - Body: Learning, Classification, Changes, Context
  - Auto-label: `agent-improvement`
- [ ] **Step 2:** Create PR description template for improvement PRs

## Phase 5: Documentation

- [ ] **Step 1:** Document pipeline in `agents/docs/skill-improvement-pipeline.md`
- [ ] **Step 2:** Add example flows to the pipeline skill
- [ ] **Step 3:** Update `AGENTS.md` with pipeline reference

## Acceptance Criteria

- [ ] `.agent-settings` has `skill_improvement_pipeline` setting (default: `false`)
- [ ] When `true`, agent proposes learning capture after meaningful tasks
- [ ] Universal improvements create PR against `event4u-app/agent-config`
- [ ] Project-specific improvements go to `agents/overrides/`
- [ ] All improvements applied locally first
- [ ] Pipeline uses existing skills (no duplication)
- [ ] User controls every step (numbered options)
- [ ] Pipeline is silent when setting is `false`

## Pipeline Flow

```
Task Complete
    ↓
[skill_improvement_pipeline=true?] → false → stop
    ↓ true
Post-Task Learning Capture
    ↓
Promotion Gate (repeated? impact? not duplicate?)
    ↓ reject → stop
Classify: Rule or Skill?
    ↓
Create / Update / Skip
    ↓
Validate (skill-validator / task lint-skills)
    ↓
Compress (skill-caveman-compression)
    ↓
Universal or Project-specific?
    ↓                    ↓
Universal            Project-specific
    ↓                    ↓
Apply locally        Apply to agents/overrides/
    +
PR → event4u-app/agent-config
```

## Notes

- **Start manual** — pipeline is agent-assisted, not fully automated
- **User controls every step** — numbered options, no surprises
- **Universal vs project-specific** is a human decision
- **PRs go to `event4u-app/agent-config`** — the shared package
- **Local changes always happen first** — PR is additional
- **Do not automate prematurely** — manual flow first, then CLI tooling
