# Roadmap: Skills & Rules Restructuring

> Audit all ~90 agent skills — extract rule-like content into rules, upgrade remaining skills to the standardized template, split broad skills into focused tool-workflow skills, and validate everything with the new meta-skill toolchain.

## Current State (PR #2)

This PR delivers the complete toolchain for restructuring:

**✅ Completed:**
- Meta-skill toolchain: `skill-writing`, `skill-validator`, `skill-refactor`, `skill-caveman-compression`, `skill-decompression`, `skill-linter`
- Learning capture loop: `capture-learnings` rule + `learning-to-rule-or-skill` + `post-task-learning-capture`
- Compress workflow with enrichment rules and quality gates
- Source-of-truth rule (always edit `.augment.uncompressed/`, compress before commit)
- Skill linter MVP script (`scripts/skill_linter.py`) with 5 passing tests
- Taskfile commands: `task lint-skills`, `task lint-skills-strict`, `task lint-skills-changed`, `task test-linter`
- 4 content skills re-compressed as proof of concept
- **Baseline: 13 pass, 65 warn, 219 fail** (297 files scanned)

**⏳ Remaining (this roadmap):**
- Audit all ~90 skills using linter output
- Extract rules, merge, narrow, remove
- Upgrade remaining skills to template
- Create new focused tool-workflow skills
- Final validation sweep

- **Feature:** none
- **Jira:** none
- **Related:** `agents/roadmaps/skill-improvement-pipeline.md`, `agents/roadmaps/controlled-self-optimization.md`

## Prerequisites

- [x] Meta-skills: `skill-writing`, `skill-validator`, `skill-caveman-compression`, `skill-refactor`
- [x] Gold standard reference: `.augment.uncompressed/skills/skill-writing/SKILL.md`
- [x] Learning loop: `capture-learnings` rule + skills
- [x] Linter MVP: `scripts/skill_linter.py` + Taskfile commands
- [ ] Read linter baseline output: `task lint-skills`

## Clean Separation Target

- **Rules** = always-apply constraints (short, hard, no procedures)
- **Skills** = repeatable workflows (step-by-step, one job, executable)

## Phase 1: Audit (using linter baseline)

### Step 1: Run linter and export results

    task lint-skills-json > agents/roadmaps/skills-audit-baseline.json
    task lint-skills > agents/roadmaps/skills-audit-baseline.txt

### Step 2: Classify each skill

Use linter output + manual review. For each skill, classify:

| Classification | Criteria | Action |
|---|---|---|
| **→ RULE** | Primarily "always do X" constraints | Migrate to `.augment/rules/` |
| **→ KEEP** | Already a good procedural workflow | Upgrade in Phase 3 |
| **→ SPLIT** | Mix of rule + procedure | Extract rules, refine skill |
| **→ MERGE** | Overlaps with another skill | Combine, delete redundant |
| **→ NARROW** | Too broad (e.g. "Laravel general") | Split into focused variants |
| **→ REMOVE** | Too generic, model already knows | Delete |

**Linter shortcuts:**
- `missing_section` errors → likely needs KEEP + upgrade
- `broad_scope` warnings → likely NARROW
- `rule_looks_like_skill` errors → likely RULE
- Skills with 0 errors, only recommended-section warnings → KEEP (low priority)

### Step 3: Document audit results

Save to `agents/roadmaps/skills-audit-results.md`:

| Skill | Linter Status | Classification | Missing Sections | Action |
|---|---|---|---|---|

### Batch approach

- Process 10-15 skills per session (linter pre-screens, so faster than manual)
- Start with `fail` skills (219), then `warn` (65), then `pass` (13)

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
3. Validate with `skill-validator` (or `task lint-skills`)
4. Compress with `skill-caveman-compression`

### → MERGE skills
1. Identify which skill is stronger → keep that one
2. Merge unique content from the weaker skill
3. Refactor merged skill using `skill-refactor`
4. Validate → compress → delete redundant

### → NARROW skills (too broad)
1. Identify distinct workflows within the skill
2. Create new focused skills using `skill-writing` (one per workflow)
3. Delete or reduce original broad skill

### → REMOVE skills
1. Verify content is truly generic/redundant (does the model already know this?)
2. Check for unique gotchas worth preserving elsewhere
3. Delete skill directory (both uncompressed + compressed)

### Cross-references update (after each batch)
- Update `.augmentignore` if skills removed/renamed
- Run `task generate-tools` to regenerate symlinks for Claude/Cursor/etc.
- Update AGENTS.md if significant changes

## Phase 3: Skill Quality Upgrade

Upgrade every remaining skill to the standardized template. Per skill:

### Procedure (use `skill-refactor`)

1. **Read uncompressed source** — always edit `.augment.uncompressed/`
2. **Run `task lint-skills` on the specific file** — identify exact issues
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
5. **Validate: `task lint-skills` on the file** — must pass (no errors)
6. **Compress with `skill-caveman-compression`:**
   - Apply enrichment rules from compress command
   - Compare before/after — compressed must be at least as executable
   - Follow NEVER-remove list (triggers, decisions, validation, gotchas)

### Batch approach

- 10-15 skills per session
- Validate each individually with linter
- Compress once per batch (not after every edit)
- `/agent-handoff` between batches
- Target: reduce `fail` count toward 0

## Phase 4: New Focused Tool-Workflow Skills

Create new, narrow skills for specific workflows currently missing or buried in broad skills.
**This list will grow from Phase 1 audit findings.**

Use `skill-writing` → `skill-validator` → `skill-caveman-compression` for each.

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

### Git & PR Workflows
- [ ] `git-conflict-resolution` — Resolve merge conflicts
- [ ] `pr-review-checklist` — Systematic PR review with quality gates

### Testing
- [ ] `pest-test-debug` — Debug failing Pest tests, isolate failures
- [ ] `test-data-setup` — Set up test data with seeders/factories

### From Audit
- [ ] Additional skills discovered during Phase 1 audit (added dynamically)

## Phase 5: Post-Merge Consistency Sweep

Immediately after merging this PR, verify ALL skills meet the minimum standard
established by the upgraded skills in this PR.

### Minimum standard per skill (non-negotiable)

Every skill must have:
- [ ] Step 0: Inspect (check current state before acting)
- [ ] Concrete validation step (not "check if it works")
- [ ] Anti-patterns section (at least 1 real failure pattern)
- [ ] Examples section (good/bad contrast, 2-4 lines)
- [ ] "Do not use when" boundary in "When to use"
- [ ] Environment notes (local / Docker / CI as relevant)

### Verification procedure

- [ ] **Step 1:** Run `task lint-skills-strict` — 0 errors, minimal warnings
- [ ] **Step 2:** Compare each remaining skill against the 4 content skills upgraded in this PR
  (`markdown-safe-codeblocks`, `markdown-template-generator`, `readme-generator`, `github-action-docs`)
  as reference examples for the minimum standard
- [ ] **Step 3:** Verify source-of-truth:
  - Every skill has uncompressed + compressed version
  - Compressed is derived from uncompressed
- [ ] **Step 4:** Run `task generate-tools` — all symlinks current
- [ ] **Step 5:** Update AGENTS.md with final skill/rule inventory
- [ ] **Step 6:** Update `.augmentignore`
- [ ] **Step 7:** Run `/compress` on any remaining unsynced files

## Acceptance Criteria

- [ ] All ~90 skills audited and classified (in `skills-audit-results.md`)
- [ ] All rule-like content migrated to `.augment/rules/`
- [ ] `task lint-skills`: 0 fail, minimal warnings
- [ ] Every skill has: Procedure (Step 0 + validation), Output format, Anti-patterns, Examples
- [ ] New focused tool-workflow skills created
- [ ] Source-of-truth workflow respected (uncompressed → compressed)
- [ ] `task generate-tools` produces clean symlink set
- [ ] AGENTS.md and cross-references updated

## Toolchain Reference

| Task | Tool | When |
|---|---|---|
| Audit skills (batch) | `task lint-skills` / `task lint-skills-json` | Phase 1 |
| Audit single skill | `python3 scripts/skill_linter.py path/to/SKILL.md` | Phase 1-3 |
| Create new skill | `skill-writing` skill | Phase 4 |
| Validate skill quality | `skill-validator` skill / `task lint-skills` | Phase 1-5 |
| Refactor existing skill | `skill-refactor` skill | Phase 2-3 |
| Compress for runtime | `skill-caveman-compression` skill | Phase 3-5 |
| Expand for maintenance | `skill-decompression` skill | Any |
| Capture learning | `learning-to-rule-or-skill` skill | Any |
| Generate tool symlinks | `task generate-tools` | Phase 2, 5 |

## Notes

- **Always edit `.augment.uncompressed/`** — never edit `.augment/` directly
- **Compress before commit/push** — not after every edit
- **Linter is the primary audit tool** — use its output to prioritize work
- **Process `fail` first, `warn` second, `pass` last** — highest impact first
- **Do NOT change skill behavior** — only restructure and improve structure/format
- **Rules stay short and hard** — constraints only, no procedures
- **Skills stay focused** — one job, clear trigger, executable steps
- **Tool-first, script-last** — skills with CLI tools (jq, grep) over Python scripts. If a script is needed, capture as learning → create skill (see `token-efficiency` rule)
- **Targeted operations** — single item over list, filtered queries, `--filter=ClassName` over full suite (see `token-efficiency` rule)
- **Session handoff:** Use `/agent-handoff` between batches
- **After restructuring:** Enable `skill-improvement-pipeline` for continuous improvement
- **Phase 2 control layers:** See `agents/roadmaps/controlled-self-optimization.md`
