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
- **Related:** `agents/roadmaps/archive/skills-rules-restructuring.md` (Phase 1, archived), `agents/roadmaps/archive/controlled-self-optimization.md` (Phase 2, archived)

## Phase 1: Settings & Configuration

- [x] **Step 1:** Add `skill_improvement_pipeline` setting to agent-settings template
- [x] **Step 2:** Add `upstream_repo` setting (default empty — user sets per project)
- [x] **Step 3:** Add `improvement_pr_branch_prefix` setting

## Phase 2: Pipeline Trigger Rule

- [x] **Step 1:** Create rule `skill-improvement-trigger.md`
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
- [x] **Step 2:** Compress rule

## Phase 3: Pipeline Orchestration Skill

- [x] **Step 1:** Create skill `skill-improvement-pipeline`
  - Full pipeline workflow using existing component skills:
    1. **Capture** — `post-task-learning-capture` (extract 1-3 learnings)
    2. **Promotion Gate** — hard decision, no exceptions:

       | Learning is... | Action |
       |---|---|
       | One-off, never seen before | **Reject** — do nothing |
       | Occurred once, but clearly generalizable | **Note** — remember, act on second occurrence |
       | Occurred 2+ times | **Promote** — continue to step 3 |
       | Already covered by existing rule/skill | **Update existing** — skip to step 4 with refactor |
       | Vague ("be more careful") | **Reject** — not actionable |

       ALL of these must be YES to promote:
       - Repeated or clearly generalizable?
       - Prevents a real observed failure?
       - No existing guidance covers it?
       - Actionable (concrete constraint or workflow)?

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
    8. **Apply locally** — dual-write workflow (see `override-system.md`):
       - **New content**: write to `.agent-src.uncompressed/` + `.augment/`
       - **Improving existing shared rule/skill**: create override in `agents/overrides/{type}/{name}.md` (mode `replace`, full version) for immediate local benefit
    9. **PR upstream** (if universal — must pass upstream contribution guard):
       - PR must contain **both** complete uncompressed + compressed versions
       - Create branch `{prefix}{learning-slug}` from `main`
       - Commit changes to `.agent-src.uncompressed/` AND `.augment/`
       - Create PR against `upstream_repo`
       - Must pass `task lint-skills`
    10. **After upstream merge** — remove local override from `agents/overrides/`
        (package update delivers the improvement to all projects)
- [x] **Step 2:** Compress skill

## Phase 4: PR Template & Automation

- [x] **Step 1:** Create PR template `.github/PULL_REQUEST_TEMPLATE/agent-improvement.md`
- [x] **Step 2:** PR description structure included in template

## Phase 5: Documentation

- [x] **Step 1:** Document pipeline in `agents/docs/skill-improvement-pipeline.md`
- [x] **Step 2:** Example flows embedded in pipeline skill (Procedure section)
- [x] **Step 3:** AGENTS.md not updated — pipeline is opt-in, documented in agents/docs/

## Acceptance Criteria

- [x] `.agent-settings` has `skill_improvement_pipeline` setting (default: `false`)
- [x] When `true`, agent proposes learning capture after meaningful tasks
- [x] Universal improvements create PR against upstream repo
- [x] Project-specific improvements go to `agents/overrides/`
- [x] All improvements applied locally first
- [x] Pipeline uses existing skills (no duplication)
- [x] User controls every step (numbered options)
- [x] Pipeline is silent when setting is `false`

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
- **Tool-first, script-last** — pipeline skills use CLI tools (jq, grep), not custom scripts. Scripts only when no tool exists → then capture as learning to create a skill (see `token-efficiency` rule)
- **Targeted operations** — single queries over lists, filtered tests over full suites, minimal token consumption at every step
