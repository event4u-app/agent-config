# Roadmap: Skills & Rules Restructuring

> Audit all ~90 agent skills — extract rule-like content into rules, upgrade remaining skills to the standardized template, split broad skills into focused tool-workflow skills, and validate everything with the new meta-skill toolchain.

## Prerequisites

- [ ] Read `AGENTS.md` and `.augment/rules/` overview
- [ ] Read meta-skills: `skill-writing`, `skill-validator`, `skill-caveman-compression`, `skill-refactor`
- [ ] Read `.augment.uncompressed/skills/skill-writing/SKILL.md` (gold standard reference)
- [ ] Read `capture-learnings` rule and `learning-to-rule-or-skill` skill

## Context

The skill library (~90 skills) has grown organically. External review and internal audit identified:

**Structural issues:**
- Skills mixing rule-like content ("always do X") with procedural workflows
- Broad "framework" skills (e.g. "Laravel general") that the model already knows
- Missing sections: Procedure, Output format, Preconditions, Decision hints, Validation
- No "Do not use" boundaries → false triggers
- Missing container/Docker environment context

**What we now have (built in this session):**
- Standardized skill template with all required sections
- Meta-skill toolchain: writing → validating → refactoring → compressing → decompressing
- Learning capture loop: rule + 2 skills
- Updated compress workflow with enrichment and quality gates
- Source-of-truth workflow: always edit `.augment.uncompressed/`, compress before commit

**Clean separation target:**
- **Rules** = always-apply constraints (short, hard, no procedures)
- **Skills** = repeatable workflows (step-by-step, one job, executable)

- **Feature:** none
- **Jira:** none
- **Related:** `agents/roadmaps/skill-improvement-pipeline.md`

## Phase 1: Foundation — Template & Audit

### Step 1: Save skill template

Save the standardized template to `.augment.uncompressed/templates/skill-template.md`.

Required sections (from `skill-writing` gold standard):
- When to use (with "Do not use when")
- Goal
- Preconditions
- Decision hints
- Procedure (with Step 0: Inspect + numbered steps + concrete validation)
- Output format (numbered expectations)
- Core rules
- Gotchas
- Do NOT
- Auto-trigger keywords
- Anti-patterns
- Examples (good/bad contrast)
- Environment notes (local / Docker / CI)

### Step 2: Audit all skills

For each skill in `.augment/skills/`, read the uncompressed source and classify:

| Classification | Criteria | Action |
|---|---|---|
| **→ RULE** | Primarily "always do X" constraints | Migrate to `.augment/rules/` |
| **→ KEEP** | Already a good procedural workflow | Upgrade in Phase 3 |
| **→ SPLIT** | Mix of rule + procedure | Extract rules, refine skill |
| **→ MERGE** | Overlaps with another skill | Combine, delete redundant |
| **→ NARROW** | Too broad (e.g. "Laravel general") | Split into focused variants |
| **→ REMOVE** | Too generic, model already knows | Delete |

**Use `skill-validator` on each skill** to identify missing sections and anti-patterns.

### Step 3: Document audit results

Save to `agents/roadmaps/skills-audit-results.md`:

| Skill | Classification | Target | Missing Sections | Notes |
|---|---|---|---|---|

### Batch approach

- Process 5-10 skills per session
- Use `/agent-handoff` between batches
- Run `skill-validator` on each skill before classifying
- Mark audited skills in the results table immediately

## Phase 2: Rules Extraction & Cleanup

For each classification, use the appropriate workflow:

### → RULE skills
1. Identify target rule file (existing or new)
2. Write rule in `.augment.uncompressed/rules/{name}.md` (short, hard constraints)
3. Compress to `.augment/rules/{name}.md`
4. Delete original skill directory (both uncompressed + compressed)

### → SPLIT skills
1. Extract rule-portions → `.augment.uncompressed/rules/`
2. Refactor remaining skill using `skill-refactor`

### → MERGE skills
1. Identify which skill is stronger → keep that one
2. Merge unique content from the weaker skill
3. Refactor merged skill using `skill-refactor`
4. Validate → compress → delete redundant

### → NARROW skills (too broad)
1. Identify distinct workflows within the skill
2. Create new focused skills using `skill-writing` (one per workflow)
3. Add to Phase 4 new skills list
4. Delete or reduce original broad skill

### → REMOVE skills
1. Verify content is truly generic/redundant (check: does the model already know this?)
2. Check for unique gotchas or anti-patterns worth preserving elsewhere
3. Delete skill directory (both uncompressed + compressed)

### Cross-references update
- Update `.augmentignore` if skills removed/renamed
- Update AGENTS.md skill references
- Update any context files that reference deleted skills
- Run `task sync` if needed

## Phase 3: Skill Quality Upgrade

Upgrade every remaining skill to the standardized template. Per skill:

### Procedure (use `skill-refactor`)

1. **Read uncompressed source** — always edit `.augment.uncompressed/`
2. **Run `skill-validator`** — identify missing sections and anti-patterns
3. **Add missing sections:**
   - Step 0: Inspect (inspect before acting)
   - "Do not use when" boundary (prevent false triggers)
   - Concrete validation step (not "check if it works")
   - Anti-patterns section
   - Examples (good/bad contrast)
   - Environment notes (local / Docker / CI)
4. **Sharpen existing sections:**
   - Decision hints: one-line if/then choices
   - Output format: numbered expectations controlling verbosity
   - Auto-trigger keywords: comprehensive coverage
5. **Validate with `skill-validator`** — must pass
6. **Compress with `skill-caveman-compression`:**
   - Apply enrichment rules (concretize validation, add examples if missing)
   - Compare before/after — compressed must be at least as executable
   - Follow NEVER-remove list (triggers, decisions, validation, gotchas)

### Batch approach

- 5-10 skills per session
- Validate each individually, not in bulk
- Compress once per batch (not after every edit)
- `/agent-handoff` between batches

## Phase 4: New Focused Tool-Workflow Skills

Create new, narrow skills for specific workflows currently missing or buried in broad skills.
**This list will grow from Phase 1 audit findings.**

Use `skill-writing` for each. Validate with `skill-validator`. Compress with `skill-caveman-compression`.

### Quality Tools
- [ ] `rector-fix` — Run Rector with flags, read output, fix issues
- [ ] `ecs-fix` — Run ECS with flags, read output, fix issues
- [ ] `phpstan-analyse` — Run PHPStan, interpret errors, fix by category

### Laravel Artisan Inspection
- [ ] `artisan-route-inspection` — Routes via `route:list --json` + jq
- [ ] `artisan-config-inspection` — Config with `config:show`, debug issues
- [ ] `artisan-model-inspection` — Model info with `model:show --json`

### Data Processing
- [ ] `jq-json-parsing` — Parse JSON output from CLI tools with jq

### Shell & Debugging
- [ ] `docker-container-exec` — Execute commands in correct container
- [ ] `log-inspection` — Read Laravel logs, filter by level/context
- [ ] `xdebug-session` — Start/stop Xdebug debugging sessions

### Git & PR Workflows
- [ ] `git-conflict-resolution` — Resolve merge conflicts
- [ ] `pr-review-checklist` — Systematic PR review with quality gates

### Testing
- [ ] `pest-test-debug` — Debug failing Pest tests, isolate failures
- [ ] `test-data-setup` — Set up test data with seeders/factories

### From Audit
- [ ] Additional skills discovered during Phase 1 audit (added here dynamically)

## Phase 5: Final Validation & Documentation

- [ ] **Step 1:** Run `skill-validator` on ALL remaining skills (full sweep)
- [ ] **Step 2:** Verify all skills follow source-of-truth workflow:
  - Uncompressed version exists in `.augment.uncompressed/skills/`
  - Compressed version exists in `.augment/skills/`
  - Compressed is derived from uncompressed (not the other way)
- [ ] **Step 3:** Update AGENTS.md with final skill/rule inventory
- [ ] **Step 4:** Update `.augmentignore` — remove deleted, add new where needed
- [ ] **Step 5:** Run `/compress` on any remaining unsynced files

## Acceptance Criteria

- [ ] All ~90 skills audited and classified (results in `skills-audit-results.md`)
- [ ] All rule-like content migrated to `.augment/rules/`
- [ ] All remaining skills pass `skill-validator` checks
- [ ] Every skill has: Procedure (with Step 0 + validation), Output format, Anti-patterns, Examples
- [ ] New focused tool-workflow skills created and validated
- [ ] Source-of-truth workflow respected (uncompressed → compressed)
- [ ] AGENTS.md and cross-references updated
- [ ] `.augmentignore` current

## Toolchain Reference

| Task | Skill to use |
|---|---|
| Create new skill | `skill-writing` |
| Validate skill quality | `skill-validator` |
| Refactor existing skill | `skill-refactor` |
| Compress for runtime | `skill-caveman-compression` |
| Expand for maintenance | `skill-decompression` |
| Capture learning → rule/skill | `learning-to-rule-or-skill` |
| Post-task retrospective | `post-task-learning-capture` |

## Notes

- **Always edit `.augment.uncompressed/`** — never edit `.augment/` directly
- **Compress before commit/push** — not after every edit (per `augment-source-of-truth` rule)
- **Process in batches** (5-10 per session) to keep context fresh
- **Do NOT change skill behavior** — only restructure and improve structure/format
- **Rules stay short and hard** — constraints only, no procedures
- **Skills stay focused** — one job, clear trigger, executable steps
- **Portability:** All skills remain in `.augment/skills/` (shared, not project-specific)
- **Session handoff:** Use `/agent-handoff` between batches
- **Pipeline integration:** After restructuring, enable `skill-improvement-pipeline` for continuous improvement (see `agents/roadmaps/skill-improvement-pipeline.md`)
