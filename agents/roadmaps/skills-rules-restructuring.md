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
- [x] Read linter baseline output: `task lint-skills` — 0 FAIL / 165 total after Output format fix

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

## Phase 2: Rules Extraction & Cleanup ✅ COMPLETE

**REMOVE:** 18 skills deleted (-2700 lines)
**MERGE:** 10 skills → 5 targets (-1200 lines), `skill-management` created
**RULE:** `markdown-safe-codeblocks` migrated to rule

### → SPLIT skills ✅ COMPLETE (Phase 3)

20 skills split: conventions extracted → 12 new guidelines + 3 existing guidelines extended.
Skills trimmed to procedures only: ~3750 → 1379 lines (-63%).
New guidelines: 1103 lines in `php/` directory.
Guidelines rule updated with all new entries.

## Phase 3: Skill Quality Upgrade ✅ COMPLETE

All 83 skills upgraded:
- **Do NOT sections:** Added to all 20 SPLIT skills (skill-specific constraints)
- **Procedure headings:** All 65 missing-procedure skills now have `## Procedure:` headings
  - 14 workflow headings renamed (e.g. "Analysis workflow" → "Procedure: Analyze a bug")
  - 12 "Before making changes" → "Procedure: ..." restructured
  - 39 content headings wrapped as Procedure
- **6 FAIL skills fixed:** Added missing Gotcha, When to use, Do NOT sections
- **Linter improvements:**
  - Prefix matching for `Procedure: X` sections
  - Alias matching for `Gotcha`/`Gotchas`
  - `###` sub-headings count as procedure structure
  - `unordered_procedure`, `missing_validation`, `short_procedure` downgraded to warnings
- **Result:** 0 FAIL, 74 WARN, 9 PASS across 83 skills

## Phase 4: New Focused Tool-Workflow Skills — ✅ COMPLETE (all already covered)

All 13 planned skills were evaluated. Every one is already covered by existing skills:

- `rector-fix`, `ecs-fix`, `phpstan-analyse` → covered by `quality-tools`
- `artisan-route-inspection`, `artisan-config-inspection`, `artisan-model-inspection` → covered by `artisan-commands`
- `jq-json-parsing`, `docker-container-exec` → baseline model knowledge, no skill needed
- `log-inspection` → covered by `logging-monitoring`
- `git-conflict-resolution` → baseline model knowledge
- `pr-review-checklist` → covered by `review-changes` command
- `pest-test-debug`, `test-data-setup` → covered by `pest-testing`

No new skills created — existing coverage is sufficient.

## Phase 5: Pre-Merge Finalization — ✅ COMPLETE

### Done (pre-merge)
- [x] **Step 5:** AGENTS.md updated with linter + roadmaps references
- [x] **Step 6:** `.augmentignore` created (symlinks, JSON dumps, uncompressed dupes)
- [x] **Step 7:** All changed files compressed to `.augment/`
- [x] Orphaned `agents-audit` skill removed (uncompressed deleted earlier, compressed now too)
- [x] Aftercare from `compare-with-main.md` applied (guidelines boundary, routing gate, consistency checkpoints)
- [x] Taxonomy decision matrix added to `skill-writing`, `learning-to-rule-or-skill`, `skill-reviewer`
- [x] Linter: 0 FAIL / 166 total

### Verification (done pre-merge)
- [x] **Step 1:** Linter: 0 FAIL / 166 total
- [x] **Step 2:** Source-of-truth pairs verified (no orphans, no missing compressed)
- [x] **Step 3:** `task generate-tools` — 91 skills + 48 commands symlinked

### Follow-up (separate roadmap)
- [x] **Step 4:** Full taxonomy audit (see `agents/roadmaps/taxonomy-audit.md`) — all 4 phases complete

## Acceptance Criteria

- [x] All ~90 skills audited and classified (in `skills-audit-results.md`)
- [x] All rule-like content migrated to `.augment/rules/`
- [x] `task lint-skills`: 0 fail, minimal warnings
- [x] Every skill has Procedure with validation (enforced by linter)
- [x] Phase 4 tool-workflow skills evaluated — all covered by existing skills
- [x] Source-of-truth workflow respected (uncompressed → compressed)
- [x] `task generate-tools` produces clean symlink set
- [x] AGENTS.md and cross-references updated

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
