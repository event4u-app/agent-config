# Roadmap: Agent Skill Improvement Pipeline

> A repeatable, opt-in pipeline that captures post-task learnings, converts them into rules or skills, and proposes universal improvements back to the agent-config package via PR.

## Prerequisites

- [ ] Read `AGENTS.md` and `.augment/rules/capture-learnings.md`
- [ ] Read skills: `post-task-learning-capture`, `learning-to-rule-or-skill`, `skill-writing`, `skill-validator`, `skill-caveman-compression`
- [ ] Understand the `.agent-settings` mechanism (see `.augment/templates/agent-settings.md`)

## Context

The agent system has skills for capturing learnings and creating new rules/skills, but no automated
pipeline that ties them together. Projects using the `agent-config` package should be able to:

1. **Opt in** via `.agent-settings` (`skill_improvement_pipeline=true`, default: `false`)
2. **Capture learnings** after meaningful tasks automatically
3. **Apply improvements locally** — always, regardless of universality
4. **Propose universal improvements upstream** — via PR against `event4u-app/agent-config`

The pipeline distinguishes:
- **Universal improvements** → apply locally AND create PR against upstream package
- **Project-specific improvements** → apply locally only (in `agents/overrides/`)

- **Feature:** none
- **Jira:** none

## Phase 1: Settings & Configuration

- [ ] **Step 1:** Add `skill_improvement_pipeline` setting to agent-settings template
  - Key: `skill_improvement_pipeline`
  - Values: `true`, `false`
  - Default: `false`
  - Description: "When true, run post-task learning capture after meaningful tasks and propose improvements"
  - Add to `.augment.uncompressed/templates/agent-settings.md` (template block + reference table)
  - Compress to `.augment/templates/agent-settings.md`
- [ ] **Step 2:** Add `upstream_repo` setting for the package origin
  - Key: `upstream_repo`
  - Values: GitHub repo in `owner/repo` format
  - Default: `event4u-app/agent-config`
  - Description: "Target repository for universal improvement PRs"
- [ ] **Step 3:** Add `improvement_pr_branch_prefix` setting
  - Key: `improvement_pr_branch_prefix`
  - Values: branch prefix string
  - Default: `improve/agent-`
  - Description: "Branch prefix for auto-generated improvement PRs"

## Phase 2: Pipeline Trigger Rule

- [ ] **Step 1:** Create rule `skill-improvement-trigger.md` in `.augment.uncompressed/rules/`
  - Read `skill_improvement_pipeline` from `.agent-settings`
  - When `true` and a meaningful task completes:
    1. Run `post-task-learning-capture` mentally (quick check, not full workflow)
    2. If 1+ concrete learnings found → ask user:
       ```
       > 💡 Learning detected: "{learning summary}"
       >
       > 1. Capture & improve — run full pipeline
       > 2. Skip — not worth capturing
       ```
    3. If user picks 1 → continue to Phase 3 workflow
  - When `false` → do nothing (silent)
  - Never trigger on trivial tasks (config changes, simple typos, docs-only)
- [ ] **Step 2:** Compress rule to `.augment/rules/`

## Phase 3: Pipeline Workflow Skill

- [ ] **Step 1:** Create skill `skill-improvement-pipeline` in `.augment.uncompressed/skills/`
  - Full pipeline workflow:
    1. **Capture** — run `post-task-learning-capture` (extract 1-3 learnings)
    2. **Classify** — run `learning-to-rule-or-skill` (rule vs skill vs update vs skip)
    3. **Create/Update** — run `skill-writing` or `skill-refactor` as needed
    4. **Validate** — run `skill-validator`
    5. **Compress** — run `skill-caveman-compression`
    6. **Decide scope** — ask user:
       ```
       > 📦 Improvement ready: {description}
       >
       > 1. Universal — apply locally + PR to upstream package
       > 2. Project-specific — apply locally only (agents/overrides/)
       > 3. Review first — show me the changes before deciding
       ```
    7. **Apply locally** — write files to `.augment.uncompressed/` + `.augment/` (or `agents/overrides/`)
    8. **PR upstream** (if universal):
       - Create branch `{prefix}{learning-slug}` from `main`
       - Commit changes
       - Create PR against `upstream_repo` with description explaining the learning
       - Link back to the task/context that triggered it
- [ ] **Step 2:** Compress skill to `.augment/skills/`

## Phase 4: PR Template & Automation

- [ ] **Step 1:** Create PR template for improvement PRs
  - Title: `improve(agent): {short description}`
  - Body sections: Learning, Classification, Changes, Context
  - Auto-label: `agent-improvement`
- [ ] **Step 2:** Create PR description skill/command for improvement PRs
  - Standardized format for the PR body
  - Include: what was learned, why it's universal, what changed, how to validate
- [ ] **Step 3:** Add label auto-assignment for improvement PRs

## Phase 5: Documentation & Examples

- [ ] **Step 1:** Document the pipeline in `agents/docs/skill-improvement-pipeline.md`
  - When to use, how it works, settings, examples
- [ ] **Step 2:** Add example flow to the pipeline skill
  - Real example: markdown copyability learning → rule + skill
  - Real example: route inspection → new focused skill
- [ ] **Step 3:** Update `AGENTS.md` with pipeline reference

## Acceptance Criteria

- [ ] `.agent-settings` has `skill_improvement_pipeline` setting (default: `false`)
- [ ] When `true`, agent proposes learning capture after meaningful tasks
- [ ] Universal improvements create PR against `event4u-app/agent-config`
- [ ] Project-specific improvements go to `agents/overrides/`
- [ ] All improvements are always applied locally first
- [ ] Pipeline uses existing skills (no duplication)
- [ ] User always has control (numbered options at every decision point)
- [ ] Pipeline is silent when setting is `false`

## Notes

- **Start manual.** The pipeline is agent-assisted, not fully automated.
- **User controls every step** — numbered options, no surprises.
- **Universal vs project-specific** is a human decision, not auto-detected.
- **PRs go to `event4u-app/agent-config`** — the shared package, not project repos.
- **Local changes always happen first** — PR is an additional step.
- **Session handoff** between pipeline steps if context gets long.
- **Do not automate prematurely** — get the manual flow right first, then consider CLI tooling.

## Pipeline Overview (Visual)

```
Task Complete
    ↓
[skill_improvement_pipeline=true?] → false → stop
    ↓ true
Post-Task Learning Capture
    ↓
1-3 concrete learnings
    ↓
Learning → Rule or Skill?
    ↓
Create / Update / Skip
    ↓
Validate (skill-validator)
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
