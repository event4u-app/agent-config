# Post-PR#2 Hardening Roadmap

Source: External review of PR #2 against `main`.
Goal: Close the gap from 8.8 → 9.5+ by fixing the 4 identified weaknesses
and strengthening the areas with the largest remaining score gaps.

## Score Gaps (PR #2 vs target 9.5)

| Area | PR #2 | Gap | Phase |
|---|---|---|---|
| Commands/Tooling | ✅ 9.0 | — | Phase 6 (✅ done) |
| Guidelines Overuse Risk | ✅ mitigated | — | Phase 1.1, 4.1 (✅ done) |
| Complexity/Onboarding | ✅ 8.5 | — | Phase 3, 8 (✅ done) |
| Compression Quality | ✅ checked | — | Phase 7 (✅ done) |
| Rule Compliance | ✅ audited | — | Phase 5 (✅ done) |

## Phase 1: Guardrail Enforcement

Ensure the new systems are used consistently — not just documented.

### 1.1 Skill-Guideline Boundary Enforcement

Core principle: **A skill must remain executable without opening a guideline.**

→ Detailed items in `road-to-10.md` Phase 1 + Phase 2 + Phase 4.

- [x] Linter: `guideline_dependent_skill` error + `pointer_only_skill` warning
- [x] Initial scan: 0 existing skills flagged
- [x] skill-writing + skill-reviewer updated with K6 (analysis-before-change)
- [~] Remaining strategic items tracked in `road-to-10.md`

### 1.2 Consistency CI Hardening
- [x] `task sync-check-hashes` — CI check that source hash matches stored hash (fails if /compress not run)
- [x] Added to `.github/workflows/consistency.yml` as separate step
- [x] Stale hash cleanup: `--check-hashes` now warns about hashes for deleted source files
- [x] `--clean-hashes` subcommand for standalone stale hash removal
- [x] Verified: `task sync-check` checks .augment/ ↔ .augment.uncompressed/ file existence
- [x] CI: `sync + generate-tools + git diff --quiet` catches ALL drift (symlinks, .windsurfrules, GEMINI.md, content)
- [x] CI blocks merge on failure (exit 1 + error annotation)
- [x] Pre-push: `task ci` covers full pipeline locally

### 1.3 Linter Coverage Expansion
- [x] Command size check: warn if >1000 words
- [x] Guideline size check: info if >1500 words
- [x] Rule type check: info if always-rule has topic-specific description (auto candidate)
- [x] Guidelines now linted alongside skills/rules/commands
- [x] Command frontmatter: name, disable-model-invocation, description, H1, Steps — all checked
- [x] Skill Procedure: existence, ordered steps/sub-headings, validation, vague-validation, pointer-only — all checked

## Phase 2: Optimize Commands Alignment

Adapt optimize commands to use all new rules and guardrails.

### 2.1 optimize-agents
- [x] References `rule-type-governance` for always/auto decisions (Step 3)
- [x] References `size-and-scope` for AGENTS.md + copilot-instructions.md limits (Step 4)
- [x] Has preservation gate (MANDATORY before any change)
- [x] Advisory only — never auto-applies
- [x] Operates on `.augment.uncompressed/` only

### 2.2 optimize-skills
- [x] References `size-and-scope` for size checks (Step 5)
- [x] Has preservation gate (MANDATORY before any change)
- [x] Guideline dependency: covered by linter (`pointer_only_skill`, `guideline_dependent_skill`)
- [x] Weak output format: covered by linter (`weak_output_format`)

## Phase 3: Meta-Complexity Management

Keep the growing system maintainable.

### 3.1 Roadmap Hygiene
- [x] Archived 12 completed/superseded roadmaps to `agents/roadmaps/archive/`
- [x] Active roadmaps: post-pr2-hardening, road-to-10, naming-consistency, skill-improvement-pipeline
- [x] Last reviewed: 2026-04-16 (all active roadmaps reviewed during this hardening pass)

### 3.2 Cross-Reference Integrity
- [x] Script: `scripts/check_references.py` — scans all .md for broken paths, skill/rule name refs
- [x] Taskfile: `task check-refs` target added
- [x] CI workflow: added to `.github/workflows/consistency.yml`
- [x] CI pipeline: part of `task ci`
- [x] Reduced false positives from 105 → 0 (example paths, archives, project-specific refs)
- [x] Fixed 5 active files with stale roadmap paths
- [x] `/fix-references` command: created (agent-executed audit + auto-fix)

### 3.3 Package Portability
- [x] Script: `scripts/check_portability.py` — scans for project-specific references in package files
- [x] Taskfile: `task check-portability` target
- [x] CI workflow: added to `.github/workflows/consistency.yml`
- [x] CI pipeline: part of `task ci`
- [x] Fixed 4 violations in `override-system.md` (replaced project-specific repo reference)
- [x] `/fix-portability` command: created (agent-executed audit + auto-fix)
- [x] Expanded pattern list: added PROJECT_INFRA, PROJECT_CONTAINERS, PROJECT_TEAM categories

### 3.4 Token Budget Monitoring
- [x] Baseline: 851 lines / ~3400 tokens always-loaded (10 always-rules + AGENTS.md)
- [x] Target: always-loaded < 1200 lines / ~5000 tokens (current: 851 = healthy)
- [x] optimize-agents already measures this in Step 1 (baseline measurement)

## Phase 4: Boundary Maintenance

Prevent the three identified drift patterns.

### 4.1 Guidelines ≠ Skills
- [x] Boundary documented in `size-and-scope.md` (line 165: "A skill must remain usable WITHOUT opening a guideline")
- [x] Linter enforces: `guideline_dependent_skill` error + `pointer_only_skill` warning
- [x] skill-reviewer Killer 6 checks analysis-before-change

### 4.2 Commands ≠ Rules/Skills
- [x] All commands reference skills via `skills:` frontmatter
- [x] No command has >30 lines of bash (all use small orchestration scripts)
- [x] Commands delegate to skills, not implement logic

### 4.3 Rules stay small
- [x] Audit: 6 rules >100 lines: augment-source-of-truth (116), context-hygiene (106), quality-workflow (148), rtk (145), token-efficiency (116), verify-before-complete (106)
- [x] All >100 contain legitimate complex content — no split needed currently
- [x] `quality-workflow` rule deleted (redundant with quality-tools skill), `rtk` rule → skill

## Phase 5: Rule Compliance Hardening

Problem: Agents (colleagues' AI tools) silently ignore rules — especially auto-rules
with weak trigger descriptions. Rules are only effective if they reliably activate.

### 5.1 Audit rule trigger quality
- [x] Reviewed all 21 auto-rule descriptions for trigger quality
- [x] Fixed 2 weak descriptions: dev-efficiency (added keywords), docs-sync (broadened scope)
- [x] Verified: all 21 descriptions contain exact keywords users would type
- [x] `/rule-compliance-audit` command: agent-executed audit (trigger quality, simulation, overlap, always-rule health)

### 5.2 Add rule-compliance smoke tests
- [x] `/rule-compliance-audit` command covers trigger simulation and test matrix (agent-executed, not static script)
- [x] Test matrix: included in command step 3 (trigger simulation with 3 prompts per rule)

### 5.3 Strengthen critical rules against being ignored
- [x] Always rules: 5/10 are <60 lines (ideal), all <148 lines (acceptable)
- [x] Auto rules: all descriptions keyword-rich and specific
- [x] Critical rules (scope-control, verify-before-complete, token-efficiency) are always-type → always loaded
- [~] Redundant reinforcement in AGENTS.md: not needed — AGENTS.md is already always-loaded

### 5.4 Multi-agent consistency
- [x] Verified: 0 broken symlinks across .cursor/, .claude/, .clinerules/
- [x] Rule counts verified: 31 rules across all tool directories
- [x] .windsurfrules and GEMINI.md exist and up-to-date
- [x] `generate-tools` now verifies rule count consistency (warns on mismatch)
- [~] AGENTS.md fallback: not needed — all tools read rule files

### 5.5 Observability
- [x] `/rule-compliance-audit` command: created (agent-executed audit with 6 analysis steps)
- [~] Session activation tracking: deferred (no tooling exists for this)
- [x] Never-activated rules: covered by `/rule-compliance-audit` step 3 (trigger simulation)

## Phase 6: Command Quality (Score: 7.8 → target 9.0)

### 6.1 Command Linting
- [x] Linter validates: frontmatter (name, disable-model-invocation, description), H1, Steps, size
- [x] All commands pass linter (0 FAIL, warnings only for size on 1 command)
- [x] Implementation logic detection: no command has >30 lines of bash

### 6.2 Command Structure Audit
- [x] All commands have proper frontmatter and section structure
- [x] All commands reference skills via `skills:` frontmatter

### 6.3 Command-Skill Boundary
- [x] No same-named command/skill pairs — clean separation
- [x] Boundary documented in `size-and-scope.md`

## Phase 7: Compression Quality Verification (✅ done)

### 7.1 Compression Diff Audit
- [x] Script: `scripts/check_compression.py` — compares source vs compressed
- [x] Check: H1/H2 headings in source present in compressed
- [x] Check: code blocks preserved exactly (byte-compare)
- [x] Check: YAML frontmatter identical
- [x] `task check-compression` target
- [x] CI workflow: added to `.github/workflows/consistency.yml`
- [x] Part of `task ci` pipeline

### 7.2 Compression Quality Metrics
- [x] Word-count ratio per file: warn if >60% reduction, info if <5%
- [x] `--summary` flag: per-category stats (files, avg source/compressed words, avg reduction %)
- [x] Baseline: 170 files, 4% avg reduction (most skills not yet caveman-compressed)

### 7.3 Automated Compression Validation
- [x] check_compression.py already validates: headings, code blocks, frontmatter, word count
- [x] Linter integration: --report now includes compression pairs + quality checks automatically

## Phase 8: Complexity Reduction (✅ done)

### 8.1 Onboarding Path
- [x] Created `agents/docs/onboarding.md` — 3-step setup, key concepts, top 5 rules, CI commands
- [x] Documents: most important rules, most useful skills, editing workflow, CI pipeline

### 8.2 Simplification Opportunities
- [x] Audit: no skills under 200 words (all healthy, no merge candidates)
- [x] Audit: 31 rules with distinct names, no obvious overlap pairs
- [x] 12 roadmaps already archived (Phase 3.1)
- [x] `quality-workflow` rule deleted (100% redundant), `rtk` rule converted to skill
- [x] Guideline directory flattening: reviewed — structure is clean and future-proof, no action needed

## Completion Summary

All 8 phases completed on 2026-04-16. Remaining deferred items [~]:
- `road-to-10.md` strategic items: tracked independently
- AGENTS.md redundancy/fallback: intentional (standalone document for tools without rule support)
- Session activation tracking: no tooling exists for this
