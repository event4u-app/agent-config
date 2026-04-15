# Roadmap: Skills & Rules Restructuring

> Restructure all ~90 agent skills — migrate "always apply" content into rules, upgrade remaining skills to a standardized template with Procedure/Output format, and create new focused tool-workflow skills.

## Prerequisites

- [ ] Read `AGENTS.md` and `.augment/rules/` overview
- [ ] Read `.augment/skills/` directory listing
- [ ] Skill template is saved as `.augment/templates/skill-template.md`

## Context

The current skill library (~90 skills) has grown organically. Many skills contain a mix of:
- **Rule-like content** (always-apply conventions, Do/Don'ts, style rules) that should be rules
- **Procedural workflows** that are correctly skills but lack structure (no Procedure, no Output format)
- **Broad framework knowledge** (e.g. "Laravel general") that the model already knows

This roadmap restructures the library into a clean separation:
- **Rules** = how to always work (style, architecture, conventions)
- **Skills** = how to do a specific job (step-by-step, tool-specific, repeatable)

External review identified key gaps in existing skills:
- Missing `Procedure` (step sequences)
- Missing `Output format`
- Missing `Preconditions`
- Missing `Decision hints`
- Incomplete auto-trigger keywords
- Missing container/Docker environment context
- Some skills too broad (should be split)

- **Feature:** none
- **Jira:** none

## Phase 1: Foundation — Skill Template & Audit Spreadsheet

- [ ] **Step 1:** Save the standardized skill template to `.augment/templates/skill-template.md`
  - Reference example: `.augment/skills/markdown-safe-codeblocks/SKILL.md` (already follows new format)
  - Required sections: When to use, Goal, Preconditions, Decision hints, Procedure, Output format, Core rules, Gotchas, Do NOT, Auto-trigger keywords, Examples, Environment notes
- [ ] **Step 2:** Audit every skill in `.augment/skills/` and classify into one of:
  - **→ RULE**: Content is primarily "always apply" conventions → migrate to `.augment/rules/`
  - **→ KEEP**: Already a good procedural workflow → upgrade to new template in Phase 3
  - **→ SPLIT**: Contains both rule + procedure content → extract rules, keep/refine skill
  - **→ MERGE**: Overlapping with another skill → combine into one
  - **→ REMOVE**: Too generic, redundant, or model already knows this → delete
- [ ] **Step 3:** Document audit results in `agents/roadmaps/skills-audit-results.md` as a table:
  | Skill | Classification | Target | Notes |

## Phase 2: Rules Extraction

- [ ] **Step 1:** For each skill classified as **→ RULE**:
  - Identify which existing rule file the content belongs to (or create a new one)
  - Migrate the rule-like content into `.augment/rules/{name}.md`
  - Delete the original skill directory
- [ ] **Step 2:** For each skill classified as **→ SPLIT**:
  - Extract rule-portions into the appropriate `.augment/rules/` file
  - Keep the procedural portion as the skill
- [ ] **Step 3:** For each skill classified as **→ MERGE**:
  - Combine overlapping skills into one
  - Delete the redundant skill directory
- [ ] **Step 4:** For each skill classified as **→ REMOVE**:
  - Verify it is truly redundant
  - Delete the skill directory
- [ ] **Step 5:** Update `.augmentignore` if needed
- [ ] **Step 6:** Update skill descriptions in any cross-references (AGENTS.md, contexts, etc.)

## Phase 3: Skill Quality Upgrade

Upgrade every remaining skill to the standardized template structure.

- [ ] **Step 1:** For each remaining skill, ensure it has ALL of these sections:
  - `When to use` (with "Do not use when")
  - `Goal`
  - `Preconditions`
  - `Decision hints`
  - `Procedure` (numbered steps with commands/code)
  - `Output format` (1-5 ordered expectations)
  - `Core rules`
  - `Gotchas`
  - `Do NOT`
  - `Auto-trigger keywords` (comprehensive)
  - `Examples` (real user request → good answer shape)
  - `Environment notes` (local / Docker / CI)
- [ ] **Step 2:** Add container/Docker context where relevant
- [ ] **Step 3:** Expand auto-trigger keywords for better matching
- [ ] **Step 4:** Add Decision hints for skills where the model needs to choose approaches
- [ ] **Step 5:** Validate each upgraded skill against the template checklist

## Phase 4: New Focused Tool-Workflow Skills

Create new, narrow skills for specific tool workflows that are currently missing or buried in broad skills.

### Quality Tools
- [ ] `rector-fix` — Run Rector with proper flags, read output, fix issues
- [ ] `ecs-fix` — Run ECS with proper flags, read output, fix issues
- [ ] `phpstan-analyse` — Run PHPStan, interpret errors, fix by category

### Laravel Artisan Inspection
- [ ] `artisan-route-inspection` — Read routes with `route:list --json`, filter with jq
- [ ] `artisan-config-inspection` — Read config with `config:show`, debug config issues
- [ ] `artisan-model-inspection` — Read model info with `model:show --json`

### Data Processing
- [ ] `jq-json-parsing` — Parse JSON output from CLI tools with jq


### Shell & Debugging
- [ ] `docker-container-exec` — Execute commands in the right container, handle output
- [ ] `log-inspection` — Read Laravel/application logs, filter by level/context
- [ ] `xdebug-session` — Start/stop Xdebug debugging sessions

### Git & PR Workflows
- [ ] `git-conflict-resolution` — Resolve merge conflicts with specific strategies
- [ ] `pr-review-checklist` — Systematic PR review with quality gates

### Testing
- [ ] `pest-test-debug` — Debug failing Pest tests, read output, isolate failures
- [ ] `test-data-setup` — Set up test data with seeders/factories for specific scenarios

### Documentation
- [ ] Additional skills based on audit findings in Phase 1

**Note:** This list will grow based on Phase 1 audit results. Skills discovered during audit that are "too broad" will be split into focused variants here.

## Acceptance Criteria

- [ ] All ~90 skills have been audited and classified
- [ ] Audit results documented in `agents/roadmaps/skills-audit-results.md`
- [ ] Skill template saved as `.augment/templates/skill-template.md`
- [ ] All rule-like content migrated to `.augment/rules/`
- [ ] All remaining skills follow the standardized template
- [ ] Every skill has: Procedure, Output format, Preconditions, Decision hints
- [ ] New focused tool-workflow skills created and validated
- [ ] AGENTS.md and cross-references updated
- [ ] `.augmentignore` updated if skills were removed/renamed

## Notes

- **Execution approach:** Process skills in batches (5-10 per session) to keep context fresh
- **Do NOT change skill behavior** — only restructure and improve documentation/format
- **Skill template** is the single source of truth for skill structure
- **Rules stay short and hard** — no procedures, no examples, just constraints
- **Skills stay focused** — one job, clear trigger, executable steps
- **Portability:** All skills remain in `.augment/skills/` (shared, not project-specific)
- **Session handoff:** Use `/agent-handoff` between batches to keep context clean
- **Priority within phases:** No specific order — process alphabetically or by dependency